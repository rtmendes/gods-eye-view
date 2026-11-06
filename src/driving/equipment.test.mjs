import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRecord, upcomingEnforcement, project } from './model.js';
import { markerDetails, recordDescription } from './map.js';

const load = (file) =>
  JSON.parse(
    readFileSync(
      new URL(`../../curation/harlem-tyrone/${file}`, import.meta.url),
      'utf8',
    ),
  );
test('curated agency points preserve coordinate meaning and never become enforcement alerts', () => {
  const records = ['app-import-nyc.json', 'app-import-pa.json'].flatMap(
    (file) => load(file).records.map(normalizeRecord),
  );
  assert.equal(records.length, 49);
  for (const record of records) {
    assert.equal(record.type, 'monitoring');
    assert.equal(record.route, 'Harlem–Tyrone corridor');
    assert.equal(record.equipmentPositionVerified, false);
    assert.equal(record.positionAccuracyMeters, null);
    assert.equal(record.coordinateMeaning, 'agency-camera-site-marker');
    assert.match(markerDetails(record).label, /mount accuracy unverified/);
    assert.match(
      recordDescription(record),
      /physical mount position and accuracy are unverified/,
    );
    const p = record.geometry.coordinates;
    const route = {
      geometry: [
        [p[0] - 0.001, p[1]],
        [p[0] + 0.001, p[1]],
      ],
      steps: [{ ref: 'I 80', distanceM: 200 }],
    };
    assert.deepEqual(
      upcomingEnforcement(
        [record],
        route,
        project(route.geometry[0], route.geometry),
      ),
      [],
    );
  }
});
test('ambiguous and conflicting equipment records remain outside app imports', () => {
  const inventory = load('equipment-inventory.json');
  assert.equal(inventory.records.length, 67);
  assert.equal(
    inventory.records.filter((r) => r.curationStatus === 'needs-review').length,
    17,
  );
  assert.deepEqual(
    inventory.records
      .filter((r) => r.curationStatus === 'quarantined')
      .map((r) => r.id),
    ['pa:3889'],
  );
  assert.equal(inventory.counts.verifiedEnforcementDevicePositions, 0);
  assert.equal(inventory.counts.physicallyVerifiedEquipmentPositions, 0);
  const app = ['app-import-nyc.json', 'app-import-pa.json'].flatMap(
    (file) => load(file).records,
  );
  assert.equal(
    app.some((r) => r.id === 'equipment:pa:3889'),
    false,
  );
  assert.equal(
    app.some((r) => /portable|tipping bucket/i.test(r.title)),
    false,
  );
});
test('physical-position verification needs positional evidence, not more decimal places', () => {
  const r = load('app-import-pa.json').records[0];
  assert.throws(
    () => normalizeRecord({ ...r, equipmentPositionVerified: true }),
    /accuracy and verification date/,
  );
  const accepted = normalizeRecord({
    ...r,
    equipmentPositionVerified: true,
    coordinateMeaning: 'physical-device',
    positionAccuracyMeters: 5,
    lastPhysicalVerificationUTC: '2026-11-06T12:00:00Z',
  });
  assert.equal(accepted.positionAccuracyMeters, 5);
  assert.equal(accepted.equipmentPositionVerified, true);
});
