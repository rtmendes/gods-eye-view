/**
 * One Deck chat turn: the conversation so far goes to the Claude Messages API
 * with the catalog's tools; tool calls run through the catalog until the
 * model answers; the answer is split into prose and publishing packs. The
 * transport is an injected fetch, so this runs anywhere and tests supply a
 * fake API. See docs/DECK.md.
 */

import { ToolError } from '../tools/catalog.js';
import { extractPacks, packToMarkdown, resolvePack } from './packs.js';
import { toAnthropicTools, toolResultContent } from './tools.js';

export const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
export const ANTHROPIC_VERSION = '2023-06-01';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const MAX_HISTORY_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 16_000;
export const DEFAULT_MAX_ROUNDS = 8;
export const DEFAULT_MAX_TOKENS = 8000;
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_CHARS = 3_000_000;

/** A request the client sent that cannot be served as given. */
export class DeckChatError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DeckChatError';
    this.status = status;
  }
}

/**
 * Check the conversation a client sent: a non-empty list of user and
 * assistant turns with text content, the first and last from the user.
 */
export function validateHistory(messages) {
  if (!Array.isArray(messages) || !messages.length)
    throw new DeckChatError(400, 'messages must be a non-empty list');
  if (messages.length > MAX_HISTORY_MESSAGES)
    throw new DeckChatError(
      400,
      `messages may hold at most ${MAX_HISTORY_MESSAGES} turns`,
    );
  const history = messages.map((message, index) => {
    const role = message?.role;
    const content = message?.content;
    if (!['user', 'assistant'].includes(role))
      throw new DeckChatError(
        400,
        `messages[${index}].role must be user or assistant`,
      );
    if (typeof content !== 'string' || !content.trim())
      throw new DeckChatError(400, `messages[${index}].content must be text`);
    if (content.length > MAX_MESSAGE_CHARS)
      throw new DeckChatError(
        400,
        `messages[${index}].content exceeds ${MAX_MESSAGE_CHARS} characters`,
      );
    return { role, content: content.trim() };
  });
  if (history[0].role !== 'user' || history.at(-1).role !== 'user')
    throw new DeckChatError(
      400,
      'the first and last turns must be from the user',
    );
  return history;
}

/** The text blocks of a response, joined. */
function responseText(content) {
  return (content ?? [])
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** A tool failure as the text the model reads. */
function describeToolFailure(error) {
  if (error instanceof ToolError) return `${error.code}: ${error.message}`;
  if (error?.name === 'AbortError') return 'cancelled';
  return 'The tool failed unexpectedly';
}

/**
 * Run one turn. Resolves to `{ reply, packs, trace, attachments, usage,
 * model, stopReason }`. Throws `DeckChatError` for a bad request, and an
 * `Error` with `status` for an upstream failure.
 */
export async function runDeckChat({
  messages,
  catalog,
  fetchImpl,
  apiKey,
  model,
  system,
  effort = 'medium',
  maxTokens = DEFAULT_MAX_TOKENS,
  maxRounds = DEFAULT_MAX_ROUNDS,
  baseUrl = null,
  apiBase = ANTHROPIC_API_BASE,
  fallbacks = true,
  signal,
  now = () => Date.now(),
}) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('A fetch implementation is required');
  if (!apiKey)
    throw new DeckChatError(503, 'ANTHROPIC_API_KEY is not configured');
  const history = validateHistory(messages);
  const tools = catalog.list();
  const toolRecords = toAnthropicTools(tools);
  const turns = history.map((message) => ({
    role: message.role,
    content: [{ type: 'text', text: message.content }],
  }));
  const trace = [];
  const attachments = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let attachmentChars = 0;
  let response = null;

  for (let round = 0; round <= maxRounds; round += 1) {
    response = await requestMessage({
      fetchImpl,
      apiBase,
      apiKey,
      signal,
      fallbacks,
      body: {
        model,
        max_tokens: maxTokens,
        system: [
          { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ],
        tools: toolRecords,
        messages: turns,
        output_config: { effort },
        ...(fallbacks ? { fallbacks: 'default' } : {}),
      },
    });
    usage.input_tokens += response.usage?.input_tokens ?? 0;
    usage.output_tokens += response.usage?.output_tokens ?? 0;
    const content = Array.isArray(response.content) ? response.content : [];
    turns.push({ role: 'assistant', content });
    const calls = content.filter((block) => block?.type === 'tool_use');
    if (response.stop_reason === 'pause_turn') continue;
    if (response.stop_reason !== 'tool_use' || !calls.length) break;
    if (round === maxRounds) {
      turns.push({
        role: 'user',
        content: calls.map((call) => ({
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content:
            'Tool budget for this turn is spent; answer with what you have.',
        })),
      });
      // One last round without tools so the model can conclude.
      response = await requestMessage({
        fetchImpl,
        apiBase,
        apiKey,
        signal,
        fallbacks,
        body: {
          model,
          max_tokens: maxTokens,
          system: [{ type: 'text', text: system }],
          messages: turns,
          output_config: { effort },
          ...(fallbacks ? { fallbacks: 'default' } : {}),
        },
      });
      usage.input_tokens += response.usage?.input_tokens ?? 0;
      usage.output_tokens += response.usage?.output_tokens ?? 0;
      turns.push({ role: 'assistant', content: response.content ?? [] });
      break;
    }
    const results = await Promise.all(
      calls.map(async (call) => {
        const started = now();
        const args =
          call.input && typeof call.input === 'object' ? call.input : {};
        try {
          const result = await catalog.call(call.name, args, { signal });
          trace.push({
            tool: call.name,
            args,
            ok: true,
            summary: result.summary,
            ms: now() - started,
          });
          for (const image of result.images ?? []) {
            if (
              attachments.length >= MAX_ATTACHMENTS ||
              typeof image?.data !== 'string' ||
              attachmentChars + image.data.length > MAX_ATTACHMENT_CHARS
            )
              continue;
            attachmentChars += image.data.length;
            attachments.push({
              tool: call.name,
              mimeType: image.mimeType,
              data: image.data,
            });
          }
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: toolResultContent(result),
          };
        } catch (error) {
          if (signal?.aborted) throw error;
          const reason = describeToolFailure(error);
          trace.push({
            tool: call.name,
            args,
            ok: false,
            error: reason,
            ms: now() - started,
          });
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            is_error: true,
            content: reason,
          };
        }
      }),
    );
    turns.push({ role: 'user', content: results });
  }

  const stopReason = response?.stop_reason ?? null;
  let answer = responseText(response?.content);
  if (stopReason === 'refusal') {
    answer =
      answer ||
      'The model declined this request' +
        (response?.stop_details?.explanation
          ? `: ${response.stop_details.explanation}`
          : '.');
  } else if (!answer) {
    answer = 'The model returned no text for this turn.';
  }
  const { text, packs, errors } = extractPacks(answer);
  const resolved = packs.map((pack) => resolvePack(pack, { baseUrl }));
  return {
    reply: text || answer,
    packs: resolved,
    markdown: resolved.map(packToMarkdown),
    packErrors: errors,
    trace,
    attachments,
    usage,
    model: response?.model ?? model,
    stopReason,
  };
}

async function requestMessage({
  fetchImpl,
  apiBase,
  apiKey,
  body,
  signal,
  fallbacks,
}) {
  let response;
  try {
    response = await fetchImpl(`${apiBase.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
        ...(fallbacks ? { 'anthropic-beta': FALLBACK_BETA } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw Object.assign(new Error('The model API could not be reached'), {
      status: 502,
    });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data?.error?.message === 'string'
        ? data.error.message
        : `HTTP ${response.status}`;
    throw Object.assign(new Error(`Model API: ${message}`), {
      status: response.status === 429 ? 429 : 502,
      upstreamStatus: response.status,
    });
  }
  if (!data || typeof data !== 'object')
    throw Object.assign(new Error('Model API returned no message'), {
      status: 502,
    });
  return data;
}
