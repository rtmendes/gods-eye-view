import { openStore, seedStore } from './store.js';
import { makeRateLimiter, clientKey } from '../providers/common/rate-limit.js';

export function enforcementPlugin({
  storeFactory = openStore,
  seed = seedStore,
} = {}) {
  let store;
  const get = () => {
    if (!store) {
      store = storeFactory();
      seed(store);
    }
    return store;
  };
  const limiter = makeRateLimiter({ windowMs: 60000, max: 5, globalMax: 60 });
  function install(server) {
    server.middlewares.use('/api/enforcement', async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const reply = (status, body) => {
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(JSON.stringify(body));
      };
      try {
        if (
          (url.pathname === '/' || url.pathname === '') &&
          req.method === 'GET'
        )
          return reply(200, get().snapshot());
        if (url.pathname !== '/reports')
          return reply(404, { error: 'Not found' });
        if (req.method !== 'POST')
          return reply(405, { error: 'Use POST to submit a report' });
        // No remotely exposed moderation endpoint. Browser submissions must be same-origin JSON.
        let origin;
        try {
          origin = new URL(req.headers.origin);
        } catch {
          return reply(403, { error: 'Same-origin request required' });
        }
        if (
          origin.host !== req.headers.host ||
          !['http:', 'https:'].includes(origin.protocol) ||
          req.headers['sec-fetch-site'] === 'cross-site'
        )
          return reply(403, { error: 'Same-origin request required' });
        if (!String(req.headers['content-type']).startsWith('application/json'))
          return reply(415, { error: 'JSON required' });
        if (!limiter(clientKey(req)))
          return reply(429, { error: 'Too many reports; try again later' });
        let body = '',
          bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 8192) return reply(413, { error: 'Report too large' });
          body += chunk;
        }
        const id = get().report(JSON.parse(body));
        return reply(201, {
          id,
          status: 'pending',
          message: 'Submitted for review; not published on the map.',
        });
      } catch (e) {
        if (e instanceof SyntaxError || /Invalid|Choose|Please/.test(e.message))
          reply(400, { error: e.message });
        else {
          console.error('[Enforcement]', e.message);
          reply(503, { error: 'Enforcement storage unavailable' });
        }
      }
    });
    server.httpServer?.once('close', () => {
      store?.close();
      store = null;
    });
  }
  return {
    name: 'corridor-enforcement',
    configureServer: install,
    configurePreviewServer: install,
  };
}
