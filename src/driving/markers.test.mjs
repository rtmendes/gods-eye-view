import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import { markerDetails, drawEnforcement, recordDescription } from './map.js';
import { normalizeRecord } from './model.js';

const now = Date.parse('2026-11-06T12:00:00Z');
const record = (patch) =>
  normalizeRecord({
    id: 'test:zone',
    sourceId: 'test',
    state: 'PA',
    route: 'I-80',
    type: 'work-zone',
    status: 'active-project',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-76.2, 41],
        [-76.18, 41],
      ],
    },
    precision: 'segment',
    sourceUrl: 'https://example.com/evidence',
    retrievedAt: new Date(now).toISOString(),
    title: 'Test zone',
    ...patch,
  });
test('zone references lie on a mapped piece and never fabricate a position for unlocated records', () => {
  const marker = markerDetails(record(), now);
  assert.ok(Math.abs(marker.point[0] + 76.19) < 0.00001);
  assert.equal(marker.point[1], 41);
  assert.match(marker.label, /reference/);
  assert.equal(marker.symbol, 'W');
  assert.equal(marker.triangle, true);
  assert.equal(
    markerDetails(record({ geometry: null, precision: 'unlocated' }), now),
    null,
  );
});
test('camera sightings show observation meaning and change to stale styling after expiry', () => {
  const sighting = record({
    type: 'speed',
    status: 'observed',
    geometry: { type: 'Point', coordinates: [-76.2, 41] },
    precision: 'point',
    observedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
  });
  const fresh = markerDetails(sighting, now),
    expired = markerDetails(sighting, now + 3600001);
  assert.equal(fresh.symbol, 'C');
  assert.equal(fresh.color, '#b6a1ff');
  assert.match(fresh.label, /not live/);
  assert.equal(expired.color, '#64748b');
  assert.doesNotMatch(expired.label, /Recent/);
  assert.equal(markerDetails(record({ type: 'monitoring' }), now).symbol, 'T');
});
test('multipart work zones get one reference pin while retaining every published segment', () => {
  const ds = new Cesium.CustomDataSource('test');
  const zone = record({
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [-76.2, 41],
          [-76.18, 41],
        ],
        [
          [-76.18, 41],
          [-76.17, 41],
        ],
      ],
    },
  });
  drawEnforcement(ds, [zone]);
  assert.equal(ds.entities.values.filter((e) => e.billboard).length, 1);
  assert.equal(ds.entities.values.filter((e) => e.polyline).length, 2);
  const pin = ds.entities.values.find((e) => e.billboard);
  assert.match(pin.name, /reference/);
  assert.match(
    pin.description.getValue(Cesium.JulianDate.now()),
    /not an exact camera position/,
  );
});
test('popups retain numeric speed/milepost evidence and escape source text', () => {
  const text = recordDescription(
    record({
      title: '<script>bad</script>',
      standardSpeedLimitMph: 65,
      speedLimitMph: 60,
      milepostBegin: 250.3,
      milepostEnd: 252.5,
    }),
  );
  assert.match(text, /65 mph/);
  assert.match(text, /60 mph/);
  assert.match(text, /250.3–252.5/);
  assert.doesNotMatch(text, /<script>/);
});
