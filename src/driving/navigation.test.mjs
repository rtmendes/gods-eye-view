import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coordinate,
  normalizeRecord,
  project,
  distance,
  upcomingEnforcement,
  temporalStatus,
  gpsUsable,
} from './model.js';
import { NavigationSession } from './navigation.js';
import { openStore } from '../../server/enforcement/store.js';
import {
  normalizePa,
  normalizeNy,
  normalizeOsm,
} from '../../scripts/enforcement/adapters.mjs';

const now = Date.parse('2026-11-06T12:00:00Z');
const path = [
  [-74.1, 40.88],
  [-74.08, 40.88],
  [-74.06, 40.88],
];
const route = {
  geometry: path,
  durationS: 160,
  steps: [
    {
      instruction: 'Continue on I-80',
      ref: 'I 80',
      distanceM: distance(path[0], path[1]),
    },
    {
      instruction: 'Take the exit',
      ref: 'I 80',
      distanceM: distance(path[1], path[2]),
    },
    { instruction: 'Arrive', ref: 'I 80', distanceM: 0 },
  ],
};
const record = (patch = {}) =>
  normalizeRecord({
    id: 'test:1',
    sourceId: 'test',
    title: 'Test',
    state: 'NJ',
    route: 'I-80',
    type: 'speed',
    status: 'fixed',
    geometry: { type: 'Point', coordinates: path[1] },
    precision: 'point',
    travelBearings: [90],
    sourceUrl: 'https://example.com/evidence',
    retrievedAt: new Date(now).toISOString(),
    verification: 'reviewed',
    ...patch,
  });
const fix = (point, patch = {}) => ({
  point,
  accuracy: 5,
  speed: 22,
  heading: 90,
  timestamp: now,
  ...patch,
});

test('route matching measures progress and separation in meters', () => {
  const m = project([-74.09, 40.8801], path);
  assert.ok(m.crossM > 10 && m.crossM < 12);
  assert.ok(Math.abs(m.offsetM - distance(path[0], [-74.09, 40.88])) < 1);
  assert.ok(m.totalM > m.offsetM);
});
test('camera alerts exclude the opposite approach, parallel roads, unrelated highways, unknown direction, and non-enforcement equipment', () => {
  const m = project([-74.095, 40.88], path);
  const good = record();
  const records = [
    good,
    record({ id: 'west', travelBearings: [270] }),
    record({
      id: 'parallel',
      geometry: { type: 'Point', coordinates: [-74.08, 40.881] },
    }),
    record({ id: 'other-road', route: 'I-95' }),
    record({ id: 'unknown', travelBearings: [] }),
    record({ id: 'toll', type: 'toll' }),
  ];
  assert.deepEqual(
    upcomingEnforcement(records, route, m, now).map((a) => a.record.id),
    [good.id],
  );
  assert.equal(
    upcomingEnforcement(
      [good],
      { ...route, steps: route.steps.map((s) => ({ ...s, ref: null })) },
      m,
      now,
    ).length,
    0,
  );
});
test('long work-zone segments match a driver already within the zone', () => {
  const zone = record({
    type: 'work-zone',
    status: 'active-project',
    precision: 'segment',
    geometry: { type: 'LineString', coordinates: path },
  });
  const result = upcomingEnforcement(
    [zone],
    route,
    project(path[1], path),
    now,
  );
  assert.equal(result[0].distanceM, 0);
});
test('expired, future, stale and inactive evidence never produces driving alerts', () => {
  const m = project([-74.095, 40.88], path);
  const rows = [
    record({ id: 'old', retrievedAt: '2026-10-01T00:00:00Z' }),
    record({ id: 'expired', validTo: '2026-11-01T00:00:00Z' }),
    record({ id: 'future', validFrom: '2026-12-01T00:00:00Z' }),
    record({ id: 'paused', status: 'paused' }),
  ];
  assert.equal(upcomingEnforcement(rows, route, m, now).length, 0);
  assert.equal(temporalStatus(rows[0], now), 'stale');
});
test('invalid geometries, dates, sources and permanent observations are rejected', () => {
  assert.equal(coordinate([Infinity, 1]), false);
  assert.throws(() =>
    record({ geometry: { type: 'LineString', coordinates: [[-74, 40]] } }),
  );
  assert.throws(() => record({ sourceUrl: 'javascript:alert(1)' }));
  assert.throws(() => record({ status: 'observed' }));
  assert.throws(() =>
    record({ validFrom: '2026-12-01', validTo: '2026-11-01' }),
  );
});
test('weak, old and future GPS positions cannot advance instructions or alerts', () => {
  const updates = [],
    speech = [];
  const session = new NavigationSession({
    now: () => now,
    onUpdate: (u) => updates.push(u),
    onSpeak: (s) => speech.push(s),
  });
  session.start(route, [record()]);
  for (const f of [
    fix(path[0], { accuracy: 100 }),
    fix(path[0], { timestamp: now - 16000 }),
    fix(path[0], { timestamp: now + 6000 }),
  ])
    session.update(f);
  assert.ok(updates.every((u) => u.state === 'gps-lost'));
  assert.equal(speech.length, 0);
  assert.equal(gpsUsable(fix(path[0], { accuracy: null }), now), false);
});
test('off-route rerouting waits for persistent good fixes and observes cooldown', () => {
  let time = now,
    reroutes = 0;
  const session = new NavigationSession({
    now: () => time,
    onReroute: () => reroutes++,
  });
  session.start(route);
  const update = () =>
    session.update(fix([-74.09, 40.89], { timestamp: time }));
  update();
  assert.equal(reroutes, 0);
  time += 5000;
  update();
  assert.equal(reroutes, 1);
  time += 5000;
  update();
  assert.equal(reroutes, 1);
  time += 20000;
  update();
  assert.equal(reroutes, 2);
  session.stop();
  time += 30000;
  update();
  assert.equal(reroutes, 2);
});
test('arrival stops navigation, replay never reroutes, and camera speech is deduplicated', () => {
  const speech = [],
    updates = [];
  let reroutes = 0;
  const session = new NavigationSession({
    now: () => now,
    onSpeak: (s) => speech.push(s),
    onUpdate: (u) => updates.push(u),
    onReroute: () => reroutes++,
  });
  session.start(route, [record()], true);
  session.update(fix([-74.095, 40.88]));
  session.update(fix([-74.094, 40.88]));
  assert.equal(
    speech.filter((s) => s.includes('Mapped enforcement')).length,
    1,
  );
  session.update(fix(path[1]));
  session.update(fix(path.at(-1)));
  assert.equal(session.active, false);
  assert.equal(updates.at(-1).state, 'arrived');
  assert.equal(reroutes, 0);
});
test('source replacement is atomic, retains history, and marks missing records unknown', () => {
  const store = openStore(':memory:');
  try {
    store.importSource({ id: 'test' }, [record()]);
    assert.throws(() =>
      store.importSource({ id: 'test' }, [record(), record()]),
    );
    assert.equal(store.snapshot().records.length, 1);
    store.importSource({ id: 'test' }, []);
    assert.equal(store.snapshot().records[0].status, 'unknown');
    assert.equal(store.db.prepare('SELECT count(*) n FROM history').get().n, 1);
    store.sourceFailure({ id: 'test', error: 'offline' });
    assert.equal(store.snapshot().records.length, 1);
    assert.equal(store.snapshot().sources[0].status, 'unavailable');
  } finally {
    store.close();
  }
});
test('community reports remain private until a maintainer supplies a valid reviewed record', () => {
  const store = openStore(':memory:');
  try {
    const id = store.report({
      kind: 'new',
      state: 'NJ',
      route: 'I-80',
      type: 'speed',
      details: 'Observed eastbound near exit 60. Evidence attached.',
    });
    assert.equal(store.snapshot().records.length, 0);
    assert.equal(store.reports()[0].status, 'pending');
    assert.throws(() => store.resolve(id, { id: 'bad' }));
    assert.equal(store.reports()[0].status, 'pending');
    store.resolve(id, record());
    assert.equal(store.snapshot().records.length, 1);
    assert.equal(store.reports()[0].status, 'approved');
    assert.throws(() => store.resolve(id, record()));
  } finally {
    store.close();
  }
});
test('PA import preserves project semantics, corridor scope, speed units and missing geometry', () => {
  const rows = normalizePa(
    [
      {
        objectId: 12,
        locationCode: 'ABC',
        stateRouteNumber: '0080',
        status: 'ACTIVE',
        direction: 'EASTBOUND',
        workZoneSpeedLimit: 45,
      },
      { objectId: 13, stateRouteNumber: '0076', status: 'ACTIVE' },
    ],
    [],
    new Date(now).toISOString(),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].geometry, null);
  assert.equal(rows[0].status, 'active-project');
  assert.equal(rows[0].speedLimitMph, 45);
});
test('NY schedules preserve Eastern date boundaries and never invent point locations', () => {
  const rows = normalizeNy(
    'Start Date  End Date  County  Road  Location\n 11/1/2026  11/7/2026  Bronx  IN_95  N/B at Exit 8\n 11/1/2026  11/7/2026  Kings  IN_278  BQE',
    'https://www.ny.gov/test.pdf',
    new Date(now).toISOString(),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].validFrom, '2026-11-01T04:00:00.000Z');
  assert.equal(rows[0].validTo, '2026-11-08T04:59:59.999Z');
  assert.equal(rows[0].geometry, null);
  assert.throws(() =>
    normalizeNy(
      'Website error',
      'https://www.ny.gov/test.pdf',
      new Date(now).toISOString(),
    ),
  );
});
test('OSM import rejects nearby cameras without explicit interstate way membership', () => {
  const elements = [
    {
      type: 'node',
      id: 1,
      lon: -74.1,
      lat: 40.88,
      tags: { highway: 'speed_camera' },
    },
    { type: 'way', tags: { ref: 'I 80' }, nodes: [2, 3] },
  ];
  assert.equal(
    normalizeOsm({ elements }, 'NJ', new Date(now).toISOString()).length,
    0,
  );
  elements[1].nodes.push(1);
  assert.equal(
    normalizeOsm({ elements }, 'NJ', new Date(now).toISOString())[0]
      .travelBearings.length,
    0,
  );
  assert.throws(() =>
    normalizeOsm(
      { elements, remark: 'runtime timeout' },
      'NJ',
      new Date(now).toISOString(),
    ),
  );
});
