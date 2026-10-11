import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCatalog, defineTool, ToolError } from '../tools/index.js';
import { DeckChatError, runDeckChat, validateHistory } from './chat.js';
import { composeSystemPrompt } from './prompt.js';

const tools = [
  defineTool({
    name: 'count_things',
    title: 'Count things',
    description: 'Counts.',
    inputSchema: {
      type: 'object',
      properties: { what: { type: 'string' } },
      required: ['what'],
      additionalProperties: false,
    },
    run: async ({ what }) => ({
      summary: `Two ${what}.`,
      data: { rows: [{ id: 1 }, { id: 2 }] },
      images: [{ mimeType: 'image/png', data: 'iVBORw0' }],
    }),
  }),
  defineTool({
    name: 'fail',
    title: 'Fail',
    description: 'Fails.',
    inputSchema: { type: 'object', additionalProperties: false },
    run: async () => {
      throw new ToolError('unavailable', 'Feed is down');
    },
  }),
];
const catalog = composeCatalog({ tools });

/** A fake Messages API that answers from a script of responses. */
function fakeApi(script) {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    const next = script.shift();
    if (next instanceof Error) throw next;
    if (next?.status)
      return new Response(JSON.stringify(next.body ?? {}), {
        status: next.status,
      });
    return new Response(
      JSON.stringify({
        model: 'claude-opus-5-5',
        usage: { input_tokens: 10, output_tokens: 5 },
        ...next,
      }),
    );
  };
  return { fetchImpl, requests };
}

const base = {
  catalog,
  apiKey: 'k',
  model: 'claude-opus-5-5',
  system: composeSystemPrompt({ toolNames: ['count_things'] }),
  baseUrl: 'http://localhost:4173/',
};

test('history is checked before anything is sent', () => {
  assert.throws(() => validateHistory([]), DeckChatError);
  assert.throws(
    () => validateHistory([{ role: 'assistant', content: 'hi' }]),
    /first and last/,
  );
  assert.throws(
    () => validateHistory([{ role: 'user', content: '' }]),
    /must be text/,
  );
  assert.throws(
    () => validateHistory([{ role: 'system', content: 'x' }]),
    /user or assistant/,
  );
  assert.deepEqual(validateHistory([{ role: 'user', content: ' hi ' }]), [
    { role: 'user', content: 'hi' },
  ]);
});

test('a plain answer returns prose, usage and the request shape', async () => {
  const { fetchImpl, requests } = fakeApi([
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hello.' }] },
  ]);
  const result = await runDeckChat({
    ...base,
    fetchImpl,
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(result.reply, 'Hello.');
  assert.deepEqual(result.packs, []);
  assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 5 });
  const [request] = requests;
  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.init.headers['x-api-key'], 'k');
  assert.equal(
    request.init.headers['anthropic-beta'],
    'server-side-fallback-2026-07-01',
  );
  assert.equal(request.body.fallbacks, 'default');
  assert.equal(request.body.tools.length, 2);
  assert.equal(request.body.tools[0].input_schema.type, 'object');
  assert.deepEqual(request.body.output_config, { effort: 'medium' });
  assert.equal(request.body.system[0].cache_control.type, 'ephemeral');
  assert.equal(request.body.thinking, undefined);
});

test('tool calls run through the catalog, with failures reported, until the model answers', async () => {
  const { fetchImpl, requests } = fakeApi([
    {
      stop_reason: 'tool_use',
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        {
          type: 'tool_use',
          id: 't1',
          name: 'count_things',
          input: { what: 'ships' },
        },
        { type: 'tool_use', id: 't2', name: 'fail', input: {} },
        {
          type: 'tool_use',
          id: 't3',
          name: 'count_things',
          input: { what: 7 },
        },
      ],
    },
    {
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: 'Two ships.\n\n```gev-pack\n{"title":"Ships","views":[{"label":"Port","view":{"camera":{"lat":33.7,"lon":-118.2,"altitude_m":5000},"layers":["ais-live-vessels"]}}]}\n```',
        },
      ],
    },
  ]);
  const result = await runDeckChat({
    ...base,
    fetchImpl,
    messages: [{ role: 'user', content: 'ships?' }],
  });
  assert.equal(result.reply, 'Two ships.');
  assert.equal(result.packs.length, 1);
  assert.match(result.packs[0].views[0].url, /^http:\/\/localhost:4173\/#/);
  assert.match(result.markdown[0], /^# Ships\n/);
  assert.deepEqual(
    result.trace.map((entry) => [entry.tool, entry.ok]),
    [
      ['count_things', true],
      ['fail', false],
      ['count_things', false],
    ],
  );
  assert.match(result.trace[2].error, /invalid_arguments/);
  assert.equal(result.attachments.length, 1);
  assert.equal(result.attachments[0].mimeType, 'image/png');
  const second = requests[1].body.messages;
  assert.equal(second.length, 3);
  // The assistant turn is echoed in full, thinking block included.
  assert.equal(second[1].content[0].type, 'thinking');
  const results = second[2].content;
  assert.equal(results.length, 3);
  assert.equal(results[0].tool_use_id, 't1');
  assert.equal(results[0].content[0].type, 'text');
  assert.equal(results[0].content[1].type, 'image');
  assert.equal(results[1].is_error, true);
  assert.match(results[1].content, /unavailable: Feed is down/);
  assert.equal(results[2].is_error, true);
  assert.deepEqual(result.usage, { input_tokens: 20, output_tokens: 10 });
});

test('the tool budget ends with a concluding answer', async () => {
  const call = {
    stop_reason: 'tool_use',
    content: [
      { type: 'tool_use', id: 'x', name: 'count_things', input: { what: 'a' } },
    ],
  };
  const { fetchImpl, requests } = fakeApi([
    call,
    call,
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] },
  ]);
  const result = await runDeckChat({
    ...base,
    fetchImpl,
    maxRounds: 1,
    messages: [{ role: 'user', content: 'go' }],
  });
  assert.equal(result.reply, 'Done.');
  assert.equal(requests.length, 3);
  assert.equal(requests[2].body.tools, undefined);
  assert.equal(result.trace.length, 1);
});

test('refusals and upstream failures are reported plainly', async () => {
  const refused = fakeApi([
    {
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'cyber', explanation: 'no' },
      content: [],
    },
  ]);
  const result = await runDeckChat({
    ...base,
    fetchImpl: refused.fetchImpl,
    messages: [{ role: 'user', content: 'x' }],
  });
  assert.equal(result.stopReason, 'refusal');
  assert.match(result.reply, /declined this request: no/);

  const limited = fakeApi([
    { status: 429, body: { error: { message: 'slow down' } } },
  ]);
  await assert.rejects(
    runDeckChat({
      ...base,
      fetchImpl: limited.fetchImpl,
      messages: [{ role: 'user', content: 'x' }],
    }),
    (error) => error.status === 429 && /slow down/.test(error.message),
  );

  const down = fakeApi([new TypeError('fetch failed')]);
  await assert.rejects(
    runDeckChat({
      ...base,
      fetchImpl: down.fetchImpl,
      messages: [{ role: 'user', content: 'x' }],
    }),
    (error) => error.status === 502,
  );

  await assert.rejects(
    runDeckChat({
      ...base,
      apiKey: '',
      fetchImpl: down.fetchImpl,
      messages: [{ role: 'user', content: 'x' }],
    }),
    (error) => error instanceof DeckChatError && error.status === 503,
  );
});

test('the system prompt names the brief, the app, the layers and the pack fence', () => {
  const prompt = composeSystemPrompt({
    brief: 'Serve ACME.',
    appUrl: 'http://globe.local',
    toolNames: ['a', 'b'],
    now: new Date('2026-10-11T00:00:00Z'),
  });
  assert.match(prompt, /Serve ACME\./);
  assert.match(prompt, /http:\/\/globe\.local/);
  assert.match(prompt, /2026-10-11T00:00:00\.000Z/);
  assert.match(prompt, /Tools available: a, b\./);
  assert.match(prompt, /```gev-pack/);
  assert.match(prompt, /ais-live-vessels/);
  assert.match(prompt, /thermal/);
});
