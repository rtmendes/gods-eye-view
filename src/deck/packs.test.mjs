import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractPacks,
  normalizePack,
  packToMarkdown,
  resolvePack,
} from './packs.js';

const pack = {
  title: 'Quakes tonight',
  summary: 'Three M4+ events.',
  narrative: 'The strongest was off Japan.',
  tags: ['earthquakes', 'japan'],
  views: [
    {
      label: 'Japan trench',
      view: {
        camera: { lat: 38.3, lon: 142.4, altitude_m: 800_000 },
        layers: ['earthquakes'],
        style: 'thermal',
      },
    },
  ],
  data: [
    {
      label: 'Events',
      source: 'USGS, last 24 h',
      columns: ['magnitude', 'place'],
      rows: [
        [4.8, 'off Japan'],
        [4.2, 'Chile | coast'],
      ],
    },
  ],
  visuals: [
    { label: 'Oblique capture', kind: 'globe-capture', description: 'FLIR' },
  ],
};

test('packs are lifted out of the answer and the prose keeps the rest', () => {
  const answer = `Here is the angle.\n\n\`\`\`gev-pack\n${JSON.stringify(pack)}\n\`\`\`\n\nAnything else?`;
  const { text, packs, errors } = extractPacks(answer);
  assert.equal(text, 'Here is the angle.\n\nAnything else?');
  assert.equal(packs.length, 1);
  assert.equal(packs[0].title, 'Quakes tonight');
  assert.deepEqual(errors, []);
});

test('a block that is not a pack is reported, not thrown', () => {
  const { text, packs, errors } = extractPacks(
    'Prose\n```gev-pack\n{not json\n```\n```gev-pack\n{"summary":"no title"}\n```',
  );
  assert.equal(text, 'Prose');
  assert.deepEqual(packs, []);
  assert.equal(errors.length, 2);
  assert.match(errors[1], /title/);
});

test('normalization bounds every field and keeps row shapes', () => {
  const normalized = normalizePack({
    title: ' T '.padEnd(300, 'x'),
    tags: Array.from({ length: 30 }, (_, i) => `t${i}`),
    views: [{ label: 7, view: 'nope' }, null],
    data: [{ rows: [{ a: 1, b: { c: 2 } }, 'bare', [null, true]] }],
    visuals: [{ kind: 'unknown' }],
  });
  assert.equal(normalized.title.length, 200);
  assert.equal(normalized.tags.length, 16);
  assert.deepEqual(normalized.views, [
    { label: 'View', caption: '', view: null },
  ]);
  assert.deepEqual(normalized.data[0].rows, [
    { a: 1, b: '{"c":2}' },
    'bare',
    [null, true],
  ]);
  assert.equal(normalized.visuals[0].kind, 'globe-capture');
  assert.equal(normalized.summary, '');
});

test('views resolve to share links and bad views report why', () => {
  const resolved = resolvePack(
    normalizePack({
      ...pack,
      views: [
        ...pack.views,
        {
          label: 'Broken',
          view: { camera: { lat: 1, lon: 0 }, style: 'nope' },
        },
      ],
    }),
    { baseUrl: 'http://localhost:4173/' },
  );
  assert.match(resolved.views[0].url, /^http:\/\/localhost:4173\/#/);
  assert.match(resolved.views[0].url, /style=flir/);
  assert.equal(resolved.views[1].url, null);
  assert.ok(resolved.views[1].error);
  assert.equal(resolved.visuals[0].url, null);
});

test('markdown carries the title, tables, links and escapes pipes', () => {
  const markdown = packToMarkdown(
    resolvePack(normalizePack(pack), { baseUrl: 'http://localhost:4173/' }),
  );
  assert.match(markdown, /^# Quakes tonight\n/);
  assert.match(markdown, /\| magnitude \| place \|/);
  assert.match(markdown, /Chile \\\| coast/);
  assert.match(
    markdown,
    /\[open in God's Eye View\]\(http:\/\/localhost:4173\/#/,
  );
  assert.match(markdown, /## Visuals/);
});
