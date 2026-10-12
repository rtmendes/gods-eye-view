/**
 * The Deck: the dashboard's server routes on the development and preview
 * servers. `/deck` opens the dashboard page; `/api/deck/*` answers it:
 * status (which keys are set, by name), the tool list, share links for
 * views, the analyst chat over the Claude Messages API with the tool
 * catalog, and the hand-off that forwards a publishing pack to the
 * configured webhook (Elite Writer, the Chief of Staff, an automation).
 *
 * The chat and hand-off spend money or reach out, so they take the same
 * same-site gate as the other cost-bearing endpoints and a per-IP throttle
 * (GEV_RATELIMIT_DECK_PER_MIN). The hand-off posts only to the URL the
 * server was configured with; the browser never supplies an address.
 * See docs/DECK.md.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BRIEF,
  DeckChatError,
  composeSystemPrompt,
  deckCatalog,
  deckStatus,
  describeTools,
  fallbacksEnabled,
  handoffConfig,
  resolveEffort,
  resolveModel,
  runDeckChat,
} from '../../src/deck/index.js';
import { composeCatalog, coreTools } from '../../src/tools/index.js';
import { createToolServices } from '../../src/tools/services.js';
import { createView, viewUrl } from '../../src/view/index.js';
import { createApiFetch } from '../mcp/services.js';
import { readRequestBody } from './common/request.js';
import { makeCostRateLimiter, clientKey } from './common/rate-limit.js';
import { sameSiteGated } from './common/same-site.js';

const ROOT = new URL('../../', import.meta.url);
const DECK_DEFAULT_PER_MIN = 20;
const MAX_CHAT_BODY_BYTES = 512 * 1024;
const MAX_HANDOFF_BODY_BYTES = 2 * 1024 * 1024;
const MAX_VIEWS_PER_REQUEST = 50;
const HANDOFF_TIMEOUT_MS = 15_000;
const BRIEF_FILE_DEFAULT = 'config/deck.brief.md';

/** The operator's brief: inline env, then the brief file, then the default. */
export function readBrief(env = process.env, root = ROOT) {
  const inline = String(env.GEV_DECK_BRIEF ?? '').trim();
  if (inline) return inline;
  const file =
    String(env.GEV_DECK_BRIEF_FILE ?? '').trim() || BRIEF_FILE_DEFAULT;
  try {
    const path = fileURLToPath(new URL(file, root));
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8').trim();
      if (text) return text;
    }
  } catch {
    // An unreadable brief file falls back to the default below.
  }
  return DEFAULT_BRIEF;
}

/**
 * The address links open: the configured public URL, else the request's own
 * scheme and Host. Links are for the person's browser, which reached this
 * server by that Host.
 */
export function publicBaseUrl(req, env = process.env) {
  const configured = String(env.GEV_DECK_PUBLIC_URL ?? '').trim();
  if (configured) {
    try {
      return new URL(configured).href;
    } catch {
      // Fall through to the request's own address.
    }
  }
  const protocol = req.socket?.encrypted ? 'https:' : 'http:';
  try {
    return new URL(`${protocol}//${req.headers.host}/`).href;
  } catch {
    return null;
  }
}

/** The loopback address the tools read the app's own routes from. */
function loopbackApiBase(req) {
  const port = req.socket?.localPort;
  return `http://127.0.0.1:${port || 4173}`;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, res, maxBytes) {
  let text;
  try {
    text = await readRequestBody(req, maxBytes);
  } catch (error) {
    sendJson(res, error?.code === 'BODY_TOO_LARGE' ? 413 : 400, {
      error:
        error?.code === 'BODY_TOO_LARGE'
          ? 'Request too large'
          : 'Could not read the request',
    });
    return undefined;
  }
  try {
    const body = JSON.parse(text || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new TypeError('not an object');
    return body;
  } catch {
    sendJson(res, 400, { error: 'The request body must be a JSON object' });
    return undefined;
  }
}

/** Vite plugin serving the Deck's page shortcut and API routes. */
export function deckPlugin({
  env = process.env,
  fetchImpl = (...args) => globalThis.fetch(...args),
  version = null,
} = {}) {
  const resolvedVersion =
    version ??
    JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')).version;
  // Built lazily, like the other cost limiters: .env values reach process.env
  // after this module is imported.
  let limiter;
  const throttle = (req, res) => {
    if (limiter === undefined)
      limiter = makeCostRateLimiter(
        env.GEV_RATELIMIT_DECK_PER_MIN,
        DECK_DEFAULT_PER_MIN,
      );
    if (!limiter || limiter(clientKey(req))) return true;
    res.setHeader('Retry-After', '5');
    sendJson(res, 429, { error: 'Rate limit exceeded' });
    return false;
  };
  const catalogs = new Map();
  const catalogFor = (apiBase, appUrl) => {
    const key = `${apiBase} ${appUrl}`;
    if (!catalogs.has(key))
      catalogs.set(
        key,
        deckCatalog(
          composeCatalog({
            tools: coreTools,
            services: createToolServices({
              fetchImpl: createApiFetch({ apiBase, fetchImpl }),
              appUrl,
            }),
          }),
        ),
      );
    return catalogs.get(key);
  };

  const status = (req, res) => {
    sendJson(
      res,
      200,
      deckStatus(env, {
        version: resolvedVersion,
        appUrl: publicBaseUrl(req, env),
      }),
    );
  };

  const tools = (req, res) => {
    const catalog = catalogFor(loopbackApiBase(req), publicBaseUrl(req, env));
    sendJson(res, 200, { tools: describeTools(catalog.list()) });
  };

  const viewUrls = async (req, res) => {
    if (req.method !== 'POST')
      return sendJson(res, 405, { error: 'Method not allowed' });
    const body = await readJsonBody(req, res, MAX_CHAT_BODY_BYTES);
    if (!body) return undefined;
    const base = publicBaseUrl(req, env);
    const views = Array.isArray(body.views)
      ? body.views.slice(0, MAX_VIEWS_PER_REQUEST)
      : [];
    return sendJson(res, 200, {
      urls: views.map((spec) => {
        try {
          const view = createView(spec ?? {});
          return { url: base ? viewUrl(base, view) : null, view };
        } catch (error) {
          return { url: null, error: error.message };
        }
      }),
    });
  };

  const chat = async (req, res) => {
    if (req.method !== 'POST')
      return sendJson(res, 405, { error: 'Method not allowed' });
    const apiKey = String(env.ANTHROPIC_API_KEY ?? '').trim();
    if (!apiKey)
      return sendJson(res, 503, {
        error:
          'ANTHROPIC_API_KEY is not configured; the Deck chat is off until it is',
      });
    if (!throttle(req, res)) return undefined;
    const body = await readJsonBody(req, res, MAX_CHAT_BODY_BYTES);
    if (!body) return undefined;
    const baseUrl = publicBaseUrl(req, env);
    const catalog = catalogFor(loopbackApiBase(req), baseUrl);
    const abort = new AbortController();
    const onClose = () => {
      if (!res.writableFinished) abort.abort();
    };
    res.on('close', onClose);
    try {
      const result = await runDeckChat({
        messages: body.messages,
        catalog,
        fetchImpl,
        apiKey,
        model: resolveModel(env),
        effort: resolveEffort(env),
        fallbacks: fallbacksEnabled(env),
        apiBase: String(env.ANTHROPIC_BASE_URL ?? '').trim() || undefined,
        system: composeSystemPrompt({
          brief: readBrief(env),
          appUrl: baseUrl,
          toolNames: catalog.list().map((tool) => tool.name),
        }),
        baseUrl,
        signal: abort.signal,
      });
      return sendJson(res, 200, result);
    } catch (error) {
      if (abort.signal.aborted) return undefined;
      if (error instanceof DeckChatError)
        return sendJson(res, error.status, { error: error.message });
      const status = [429, 502, 503].includes(error?.status)
        ? error.status
        : 500;
      if (status === 500) console.error('[deck] chat failed:', error);
      else console.warn(`[deck] chat: ${error.message}`);
      return sendJson(res, status, {
        error: status === 500 ? 'The chat failed' : error.message,
      });
    } finally {
      res.off('close', onClose);
    }
  };

  const handoff = async (req, res) => {
    if (req.method !== 'POST')
      return sendJson(res, 405, { error: 'Method not allowed' });
    const target = handoffConfig(env);
    if (!target.configured)
      return sendJson(res, 503, {
        error: 'GEV_DECK_HANDOFF_WEBHOOK_URL is not configured',
      });
    if (!throttle(req, res)) return undefined;
    const body = await readJsonBody(req, res, MAX_HANDOFF_BODY_BYTES);
    if (!body) return undefined;
    if (!body.pack || typeof body.pack !== 'object')
      return sendJson(res, 400, { error: 'A pack is required' });
    const token = String(env.GEV_DECK_HANDOFF_TOKEN ?? '').trim();
    try {
      const response = await fetchImpl(env.GEV_DECK_HANDOFF_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          source: 'gods-eye-view-deck',
          version: resolvedVersion,
          sentAt: new Date().toISOString(),
          app: publicBaseUrl(req, env),
          note: typeof body.note === 'string' ? body.note.slice(0, 2000) : '',
          pack: body.pack,
          attachments: Array.isArray(body.attachments)
            ? body.attachments.slice(0, 6)
            : [],
        }),
        signal: AbortSignal.timeout(HANDOFF_TIMEOUT_MS),
        redirect: 'error',
      });
      // The receiver's body is not relayed: it is another system's text.
      return sendJson(res, response.ok ? 200 : 502, {
        ok: response.ok,
        status: response.status,
        label: target.label,
      });
    } catch (error) {
      console.warn(`[deck] hand-off failed: ${error?.name || 'error'}`);
      return sendJson(res, 502, {
        error: `${target.label} did not accept the pack`,
      });
    }
  };

  const install = (server) => {
    // `/deck` opens the dashboard page without the file name.
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || '').split('?')[0];
      if (path === '/deck' || path === '/deck/') {
        req.url = `/deck/index.html${req.url.slice(path.length)}`;
      }
      next();
    });
    server.middlewares.use('/api/deck/status', status);
    server.middlewares.use('/api/deck/tools', tools);
    server.middlewares.use('/api/deck/view-urls', viewUrls);
    server.middlewares.use('/api/deck/chat', sameSiteGated(chat));
    server.middlewares.use('/api/deck/handoff', sameSiteGated(handoff));
  };
  return {
    name: 'deck',
    configureServer: install,
    configurePreviewServer: install,
  };
}
