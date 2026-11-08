import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JURISDICTIONS, validRoad } from './jurisdictions.js';
import { normalizeRecord } from './model.js';
import { openStore } from '../../server/enforcement/store.js';
import { evaluatePenalty } from '../road/penalties.js';
import {
  normalizeHardwareEvent,
  commercialVisible,
  approvedOffer,
} from '../road/hardware.js';
import { commercialUseAllowed } from '../road/quality.js';
const laws = JSON.parse(
  readFileSync(new URL('../../curation/laws/rules.json', import.meta.url)),
);
test('national coverage counts remain derived from the actual inventory snapshot', () => {
  const summary = JSON.parse(
    readFileSync(
      new URL('../../curation/national-coverage.json', import.meta.url),
    ),
  );
  const snapshot = JSON.parse(
    readFileSync(
      new URL('../../public/enforcement/snapshot.json', import.meta.url),
    ),
  );
  assert.equal(summary.generatedAt, snapshot.generatedAt);
  assert.equal(summary.states.length, 51);
  for (const state of summary.states) {
    const records = snapshot.records.filter(
      (record) => record.state === state.code,
    );
    assert.equal(state.records, records.length);
    assert.equal(
      state.monitoring,
      records.filter((record) => record.type === 'monitoring').length,
    );
    assert.equal(
      state.physicalVerified,
      records.filter((record) => record.equipmentPositionVerified === true)
        .length,
    );
  }
});
const calc = (id, values = {}, date = '2026-11-07') =>
  evaluatePenalty(
    laws.rules.find((r) => r.id === id),
    {
      speed: 70,
      limit: 55,
      prior: 0,
      zone: 'work',
      workers: 'yes',
      confirmed: true,
      workSigns: true,
      warningMatured: true,
      ...values,
    },
    date,
  );
test('all states plus DC can be imported and reports remain moderated', () => {
  assert.equal(new Set(JURISDICTIONS.map((s) => s.code)).size, 51);
  const store = openStore(':memory:');
  try {
    const rows = JURISDICTIONS.map((s) => ({
      id: `test:${s.code}`,
      sourceId: 'test',
      state: s.code,
      route: s.code === 'TX' ? 'SH 130' : 'Main Street',
      type: 'monitoring',
      status: 'fixed',
      geometry: null,
      sourceUrl: 'https://example.org/evidence',
    }));
    store.importSource({ id: 'test' }, rows);
    assert.equal(store.snapshot().records.length, 51);
    store.report({
      kind: 'new',
      state: 'CA',
      route: 'US-101',
      type: 'speed',
      details: 'Test fixture: direction and source require review.',
    });
    assert.equal(store.reports().length, 1);
    assert.equal(store.snapshot().records.length, 51);
    assert.throws(() => normalizeRecord({ ...rows[0], state: 'XX' }));
    assert.equal(validRoad('<img onerror=alert(1)>'), false);
    assert.equal(validRoad('I-80\n'), false);
  } finally {
    store.close();
  }
});
test('unreviewed, future, stale, invalid dates and ineligible scenarios never show dollar estimates', () => {
  assert.equal(evaluatePenalty(null, {}).status, 'unavailable');
  for (const date of ['2026-11-06', '2026-12-08', '2026-11-31', 'not-a-date'])
    assert.equal(calc('ny-officer', {}, date).status, 'unavailable');
  assert.equal(
    calc('ny-work-camera', { confirmed: false }).status,
    'unavailable',
  );
  assert.equal(calc('ny-work-camera', { speed: 55 }).status, 'unavailable');
  assert.equal(calc('ny-officer', { speed: NaN }).status, 'unavailable');
});
test('NY base fine ranges distinguish work zones and repeat conviction maximums', () => {
  assert.deepEqual(
    [
      calc('ny-officer', { zone: 'ordinary' }).min,
      calc('ny-officer', { zone: 'ordinary' }).max,
    ],
    [90, 300],
  );
  assert.deepEqual(
    [calc('ny-officer').min, calc('ny-officer').max],
    [180, 300],
  );
  assert.equal(calc('ny-officer', { prior: 1 }).max, 450);
  assert.equal(calc('ny-work-camera', { prior: 2 }).min, 100);
  assert.equal(calc('ny-officer', { zone: 'school' }).status, 'unavailable');
});
test('PA first warning, second-offense timing, and posted staffed work-zone doubling', () => {
  assert.equal(calc('pa-work-camera').min, 0);
  assert.equal(
    calc('pa-work-camera', { prior: 1, warningMatured: false }).status,
    'unavailable',
  );
  assert.equal(calc('pa-work-camera', { prior: 1 }).min, 75);
  assert.equal(calc('pa-officer', { zone: 'ordinary' }).min, 55);
  assert.equal(calc('pa-officer').min, 110);
  assert.equal(
    calc('pa-officer', { workers: 'unknown' }).status,
    'unavailable',
  );
  assert.equal(calc('pa-officer', { workSigns: false }).status, 'unavailable');
});
test('Maryland work-zone tiers and worker presence are not replaced with old flat camera fines', () => {
  assert.equal(calc('md-work-camera', { workers: 'no' }).min, 60);
  assert.equal(calc('md-work-camera').min, 120);
  assert.equal(calc('md-work-camera', { speed: 95 }).min, 1000);
  assert.equal(
    calc('md-work-camera', { workers: 'unknown' }).status,
    'unavailable',
  );
  assert.equal(
    calc('md-work-camera', { zone: 'school' }).status,
    'unavailable',
  );
});
test('Virginia caps do not become fixed fines and reckless scenarios stop ordinary estimates', () => {
  const cap = calc('va-camera');
  assert.equal(cap.min, 0);
  assert.equal(cap.max, 100);
  assert.equal(calc('va-camera', { workers: 'no' }).status, 'unavailable');
  assert.equal(calc('va-officer', { zone: 'ordinary' }).min, 90);
  assert.equal(calc('va-officer', { speed: 75 }).status, 'unavailable');
  assert.equal(
    calc('va-officer', { zone: 'ordinary', speed: 81, limit: 65 }).min,
    196,
  );
  assert.equal(
    calc('va-officer', { speed: 86, limit: 70 }).status,
    'unavailable',
  );
});
test('California pilot warning, absolute speed tier, location limits and sunset', () => {
  assert.equal(calc('ca-pilot-camera', { zone: 'ordinary' }).min, 0);
  assert.equal(calc('ca-pilot-camera', { zone: 'ordinary', prior: 1 }).min, 50);
  assert.equal(
    calc('ca-pilot-camera', { zone: 'ordinary', speed: 100 }).min,
    500,
  );
  assert.equal(calc('ca-pilot-camera').status, 'unavailable');
  assert.equal(
    calc('ca-pilot-camera', { zone: 'ordinary' }, '2032-01-01').status,
    'unavailable',
  );
});
test('hardware events expire, strip location/device identifiers, and never become equipment facts', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  const raw = {
    adapterId: 'test-adapter',
    kind: 'radar-signal',
    observedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 20000).toISOString(),
    latitude: 40,
    deviceSerial: 'private',
  };
  const event = normalizeHardwareEvent(raw, now);
  assert.equal(event.publishable, false);
  assert.equal(event.equipmentLocationVerified, false);
  assert.equal(event.latitude, undefined);
  assert.equal(event.deviceSerial, undefined);
  assert.throws(() => normalizeHardwareEvent(raw, now + 21000));
  assert.throws(() =>
    normalizeHardwareEvent({ ...raw, kind: 'camera-confirmed' }, now),
  );
  assert.throws(() =>
    normalizeHardwareEvent(
      { ...raw, kind: 'speed-sign-observation', speedLimitMph: 200 },
      now,
    ),
  );
});
test('commercial content needs a stationary non-driving context and explicit disclosures; data needs rights evidence', () => {
  assert.equal(commercialVisible({ driving: true, speedMph: 0 }), false);
  assert.equal(commercialVisible({ driving: false, speedMph: null }), false);
  assert.equal(commercialVisible({ driving: false, speedMph: 10 }), false);
  assert.equal(commercialVisible({ driving: false, speedMph: 0 }), true);
  assert.equal(
    approvedOffer({ enabled: true, url: 'https://example.org' }),
    null,
  );
  assert.equal(
    approvedOffer({
      enabled: true,
      relationship: 'affiliate',
      disclosure: 'Commission disclosure',
      url: 'javascript:alert(1)',
    }),
    null,
  );
  assert.equal(
    commercialUseAllowed({ reuse: { status: 'cleared', rights: ['display'] } }),
    false,
  );
  assert.equal(
    commercialUseAllowed({
      reuse: {
        status: 'cleared',
        rights: ['display', 'commercial'],
        evidenceUrl: 'https://example.org/license',
      },
    }),
    true,
  );
});
