import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCoordinates,
  normalizeRoutes,
  normalizePlaces,
  matchRouteIntelligence,
  createRouteClient,
} from '../road/routing.js';

const at = Date.parse('2026-11-07T12:00:00Z');
const path = [
  [-74, 41],
  [-73.99, 41],
];
const raw = {
  code: 'Ok',
  routes: [
    {
      geometry: { type: 'LineString', coordinates: path },
      distance: 840,
      duration: 60,
      legs: [
        {
          summary: 'I-80',
          steps: [
            {
              name: 'Interstate 80',
              ref: 'I 80',
              distance: 840,
              duration: 60,
              maneuver: { type: 'depart', location: path[0] },
            },
          ],
        },
      ],
    },
  ],
};
const route = normalizeRoutes(raw)[0];
const record = (id, extra = {}) => ({
  id,
  state: 'NY',
  route: 'I-80',
  type: 'work-zone',
  status: 'active-project',
  travelBearings: [90],
  retrievedAt: new Date(at).toISOString(),
  geometry: { type: 'Point', coordinates: [-73.995, 41] },
  ...extra,
});
test('coordinate input uses latitude, longitude and invalid provider responses do not become routes', () => {
  assert.deepEqual(parseCoordinates('40.8116, -73.9442'), [-73.9442, 40.8116]);
  for (const input of ['hello', '91, 0', '0, 181', 'NaN, 50'])
    assert.equal(parseCoordinates(input), null);
  assert.throws(() => normalizeRoutes({ code: 'NoRoute', routes: [] }));
  assert.throws(() =>
    normalizeRoutes({
      code: 'Ok',
      routes: [
        {
          ...raw.routes[0],
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [190, 0],
            ],
          },
        },
      ],
    }),
  );
  assert.equal(route.steps[0].instruction, 'Head out on Interstate 80 (I 80)');
});
test('address candidates remain distinct and foreign or malformed results are excluded', () => {
  const places = normalizePlaces([
    {
      lat: '41',
      lon: '-74',
      display_name: 'First US place',
      address: { country_code: 'us' },
    },
    {
      lat: '42',
      lon: '-75',
      display_name: 'Second US place',
      address: { country_code: 'us' },
    },
    {
      lat: '50',
      lon: '10',
      display_name: 'Foreign',
      address: { country_code: 'de' },
    },
  ]);
  assert.equal(places.length, 2);
  assert.equal(
    normalizePlaces([
      { lat: null, lon: null, display_name: 'Missing coordinates' },
    ]).length,
    0,
  );
  assert.notDeepEqual(places[0].point, places[1].point);
  assert.throws(() => normalizePlaces({ error: 'wrong shape' }));
});
test('route context includes monitors without converting them to enforcement and excludes opposite/history by default', () => {
  const records = [
    record('forward'),
    record('monitor', { type: 'monitoring', travelBearings: [] }),
    record('opposite', { travelBearings: [270] }),
    record('history', { status: 'completed' }),
    record('stale', { retrievedAt: '2026-01-01' }),
    record('unmapped', { geometry: null }),
  ];
  const matches = matchRouteIntelligence(records, route, { now: at });
  assert.equal(matches.length, 2);
  assert.equal(
    matches.find((m) => m.record.id === 'monitor').record.type,
    'monitoring',
  );
  assert.equal(
    matches.find((m) => m.record.id === 'monitor').direction,
    'unknown',
  );
  assert.equal(
    matches.find((m) => m.record.id === 'forward').roadConfirmed,
    true,
  );
  assert.equal(
    matchRouteIntelligence(records, route, { now: at, includeOpposite: true })
      .length,
    3,
  );
  assert.equal(
    matchRouteIntelligence(records, route, {
      now: at,
      includeHistory: true,
      includeOpposite: true,
    }).length,
    5,
  );
});
test('nearby roads are explicitly unconfirmed and line crossings are found between vertices', () => {
  const nearby = record('adjacent', {
    route: 'I-95',
    geometry: { type: 'Point', coordinates: [-73.995, 41.001] },
  });
  const crossing = record('crossing', {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-73.995, 40.999],
        [-73.995, 41.001],
      ],
    },
  });
  const matches = matchRouteIntelligence([nearby, crossing], route, {
    now: at,
    radiusM: 150,
  });
  assert.equal(matches.length, 2);
  assert.equal(
    matches.find((m) => m.record.id === 'adjacent').roadConfirmed,
    false,
  );
  assert.match(
    matches.find((m) => m.record.id === 'adjacent').matchLabel,
    /unconfirmed/,
  );
  assert.equal(matches.find((m) => m.record.id === 'crossing').crossM, 0);
  assert.equal(
    matchRouteIntelligence([nearby], route, { now: at, radiusM: 25 }).length,
    0,
  );
  assert.throws(() => matchRouteIntelligence([], route, { radiusM: 5000 }));
});
test('explicit search requests are serialized and cached; routing omits credentials and reports rate limits', async () => {
  let time = 0;
  const calls = [];
  const client = createRouteClient({
    now: () => time,
    wait: async (ms) => {
      time += ms;
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options, time });
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes('nominatim')
            ? [
                {
                  lat: '41',
                  lon: '-74',
                  display_name: 'US place',
                  address: { country_code: 'us' },
                },
              ]
            : raw,
      };
    },
  });
  await Promise.all([
    client.search('Origin town'),
    client.search('Destination town'),
  ]);
  assert.ok(calls[1].time - calls[0].time >= 1100);
  await client.search('Origin town');
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).searchParams.get('countrycodes'), 'us');
  await client.route(path[0], path[1]);
  await client.route(path[0], path[1]);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].options.credentials, 'omit');
  assert.equal(calls[2].options.referrerPolicy, 'origin');
  client.clear();
  time += 1200;
  await client.route(path[0], path[1]);
  assert.equal(calls.length, 4);
  const limited = createRouteClient({
    fetchImpl: async () => ({ status: 429, ok: false }),
  });
  await assert.rejects(() => limited.route(path[0], path[1]), /rate limited/);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    () => client.search('Cancelled search', { signal: abort.signal }),
    /Cancel/,
  );
});
