import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCatalog, coreTools, defineTool } from '../tools/index.js';
import { createToolServices } from '../tools/services.js';
import {
  boundedToolData,
  deckCatalog,
  describeTools,
  toAnthropicTools,
  toolResultContent,
} from './tools.js';

const catalog = () =>
  composeCatalog({
    tools: coreTools,
    services: createToolServices({
      fetchImpl: async () => new Response('{}'),
      appUrl: 'http://localhost:4173',
    }),
  });

test('the deck offers the MCP tools plus the chat additions, minus the panel loader', () => {
  const names = deckCatalog(catalog())
    .list()
    .map((tool) => tool.name);
  for (const name of [
    'situation_brief',
    'show_in_gods_eye_view',
    'get_weather',
    'search_places',
    'plan_route',
    'get_regional_brief',
  ])
    assert.ok(names.includes(name), name);
  assert.ok(!names.includes('panel_request'));
  assert.ok(!names.includes('get_hud_caption'));
});

test('a catalog missing an overridden tool still composes', () => {
  const small = composeCatalog({
    tools: [
      defineTool({
        name: 'ping',
        title: 'Ping',
        description: 'Answers.',
        inputSchema: { type: 'object', additionalProperties: false },
        run: async () => ({ summary: 'pong', data: {} }),
      }),
    ],
  });
  assert.deepEqual(
    deckCatalog(small)
      .list()
      .map((tool) => tool.name),
    ['ping'],
  );
});

test('tool records carry the schema under input_schema', () => {
  const [record] = toAnthropicTools(coreTools.slice(0, 1));
  assert.equal(record.name, 'get_earthquakes');
  assert.equal(record.input_schema.type, 'object');
  assert.ok(record.description);
  assert.equal(record.parameters, undefined);
  const [described] = describeTools(coreTools.slice(0, 1));
  assert.deepEqual(Object.keys(described), [
    'name',
    'title',
    'description',
    'kind',
    'requires',
  ]);
});

test('long list results keep the rows that fit and say what was cut', () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({
    i,
    text: 'x'.repeat(100),
  }));
  const { text, truncated } = boundedToolData({ total: 200, rows }, 5000);
  assert.ok(truncated);
  assert.ok(text.length <= 5000);
  const parsed = JSON.parse(text);
  assert.equal(parsed.rows.length + parsed.rows_cut_for_model, 200);
  assert.equal(parsed.truncated, true);
  const plain = boundedToolData({ blob: 'y'.repeat(10_000) }, 100);
  assert.ok(plain.truncated);
  assert.match(plain.text, /cut at 100 characters/);
  assert.equal(boundedToolData({ a: 1 }).truncated, false);
});

test('tool result content carries the summary, data and images', () => {
  const content = toolResultContent({
    summary: 'One camera.',
    data: { rows: [{ id: 'cam' }] },
    images: [{ mimeType: 'image/jpeg', data: 'AAAA' }, { mimeType: null }],
  });
  assert.equal(content.length, 2);
  assert.match(content[0].text, /^One camera\.\n\{"rows"/);
  assert.deepEqual(content[1], {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
  });
});
