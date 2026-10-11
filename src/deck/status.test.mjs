import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deckStatus,
  fallbacksEnabled,
  handoffConfig,
  providerStatus,
  resolveEffort,
  resolveModel,
} from './status.js';

test('status reports names and booleans, never values', () => {
  const env = {
    ANTHROPIC_API_KEY: 'sk-ant-secret',
    CESIUM_ION_TOKEN: 'your_token_here',
    GEV_DECK_HANDOFF_WEBHOOK_URL: 'https://writer.example/hook?token=abc',
    GEV_EMBED_FRAME_ANCESTORS: "'self'",
  };
  const status = deckStatus(env, { version: '1.2.3', appUrl: 'http://x' });
  const text = JSON.stringify(status);
  assert.ok(!text.includes('sk-ant-secret'));
  assert.ok(!text.includes('token=abc'));
  assert.equal(status.chat.configured, true);
  assert.equal(status.chat.model, 'claude-opus-5-5');
  assert.equal(status.handoff.configured, true);
  assert.equal(status.handoff.label, 'Elite Writer');
  assert.equal(status.embed.frameAncestors, "'self'");
  const cesium = providerStatus(env).find((p) => p.name === 'CESIUM_ION_TOKEN');
  assert.equal(cesium.configured, false);
});

test('model, effort, fallbacks and hand-off fall back to defaults on bad input', () => {
  assert.equal(
    resolveModel({ GEV_DECK_MODEL: 'claude-sonnet-5-5' }),
    'claude-sonnet-5-5',
  );
  assert.equal(
    resolveModel({ GEV_DECK_MODEL: 'not a model!' }),
    'claude-opus-5-5',
  );
  assert.equal(resolveEffort({ GEV_DECK_EFFORT: 'HIGH' }), 'high');
  assert.equal(resolveEffort({ GEV_DECK_EFFORT: 'turbo' }), 'medium');
  assert.equal(fallbacksEnabled({}), true);
  assert.equal(fallbacksEnabled({ GEV_DECK_FALLBACKS: '0' }), false);
  assert.equal(
    handoffConfig({ GEV_DECK_HANDOFF_WEBHOOK_URL: 'ftp://x' }).configured,
    false,
  );
  assert.equal(
    handoffConfig({ GEV_DECK_HANDOFF_LABEL: 'Chief of Staff' }).label,
    'Chief of Staff',
  );
});
