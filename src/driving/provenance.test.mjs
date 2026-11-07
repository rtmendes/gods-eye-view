import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  filterSources,
  filterLocations,
  locationEvidence,
  sourcesForState,
  sourceUrl,
  accessLabel,
} from '../road/provenance.js';
const registry = JSON.parse(
  readFileSync(
    new URL('../../curation/sources/registry.json', import.meta.url),
  ),
);
const snapshot = JSON.parse(
  readFileSync(
    new URL('../../public/enforcement/snapshot.json', import.meta.url),
  ),
);
test('every jurisdiction has federal, travel, court and legislative source coverage without claiming ingestion', () => {
  assert.equal(registry.jurisdictions.length, 51);
  const ids = new Set();
  for (const source of registry.sources) {
    assert.equal(ids.has(source.id), false);
    ids.add(source.id);
    assert.ok(sourceUrl(source.url));
    assert.ok(
      source.states.every((code) =>
        registry.jurisdictions.some((state) => state.code === code),
      ),
    );
    assert.equal(source.commercialReuse, 'not-cleared');
  }
  for (const state of registry.jurisdictions) {
    const sources = sourcesForState(registry, state.code);
    for (const id of [
      `fhwa-${state.code}`,
      `travel-${state.code}`,
      `courts-${state.code}`,
      `legislature-${state.code}`,
    ])
      assert.ok(sources.some((source) => source.id === id));
    for (const source of sources.filter((entry) =>
      entry.category.endsWith('directory'),
    ))
      assert.notEqual(source.status, 'ingested');
  }
});
test('all published records preserve their exact primary evidence URL and resolve registered sources', () => {
  const indexed = registry.locationIndex.filter(
    (record) => record.inventoryStatus === 'published-inventory',
  );
  assert.equal(indexed.length, snapshot.records.length);
  for (const record of snapshot.records) {
    const location = indexed.find((entry) => entry.id === record.id);
    assert.ok(location);
    assert.equal(location.sourceUrl, record.sourceUrl);
    assert.equal(location.sourceId, record.sourceId);
    assert.ok(
      location.registrySourceIds.every((id) =>
        registry.sources.some((source) => source.id === id),
      ),
    );
    assert.ok(
      locationEvidence(location, registry).some(
        (source) => source.url === sourceUrl(record.sourceUrl),
      ),
    );
  }
});
test('review and quarantine remain opt-in and are not reclassified as published equipment', () => {
  assert.equal(filterLocations(registry).length, snapshot.records.length);
  assert.equal(
    filterLocations(registry, { includeReview: true }).length,
    snapshot.records.length + 18,
  );
  const bad = registry.locationIndex.find(
    (record) => record.inventoryStatus === 'quarantined',
  );
  assert.ok(bad);
  assert.equal(bad.coordinates, null);
  assert.equal(bad.equipmentPositionVerified, false);
  assert.equal(filterLocations(registry, { query: bad.id }).length, 0);
  assert.equal(
    filterLocations(registry, { query: bad.id, includeReview: true }).length,
    1,
  );
  assert.equal(
    registry.locationIndex.some(
      (record) =>
        'plate' in record || 'reporter' in record || 'driver' in record,
    ),
    false,
  );
});
test('related legal and directory resources never become location-coordinate evidence', () => {
  const record = registry.locationIndex[0];
  const evidence = locationEvidence(record, registry);
  assert.ok(
    evidence.every((entry) =>
      ['location-evidence', 'source-catalog'].includes(entry.role),
    ),
  );
  const background = sourcesForState(registry, record.state).filter(
    (entry) => entry.category === 'legislative-directory',
  );
  assert.ok(background.length);
  assert.equal(
    evidence.some((entry) =>
      background.some((source) => source.url === entry.url),
    ),
    false,
  );
});
test('source search composes state/type/status filters and reports HTTP observations separately', () => {
  const sources = filterSources(registry, { state: 'PA', status: 'ingested' });
  assert.equal(sources.length, 2);
  assert.ok(sources.every((entry) => entry.importedRecords > 0));
  assert.equal(
    filterSources(registry, { state: 'TX', status: 'ingested' }).length,
    0,
  );
  assert.ok(filterSources(registry, { query: 'caltrans' }).length > 0);
  assert.match(
    accessLabel({
      lastCheckedAt: '2026-11-07',
      observedHttpStatus: 403,
      lastCheckMethod: 'HEAD',
    }),
    /403/,
  );
  assert.equal(accessLabel({}), 'Not checked');
  assert.equal(sourceUrl('javascript:alert(1)'), null);
  assert.equal(sourceUrl('https://user:password@example.org'), null);
});
