import { readFileSync, writeFileSync } from 'node:fs';
const registryFile = new URL(
  '../../curation/sources/registry.json',
  import.meta.url,
);
const rawFile = new URL(
  '../../curation/harlem-tyrone/equipment-inventory.json',
  import.meta.url,
);
const snapshotFile = new URL(
  '../../public/enforcement/snapshot.json',
  import.meta.url,
);

/** Export only published records and curated review candidates; never private crowd reports. */
export function refreshSourceIndex(
  snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8')),
) {
  const registry = JSON.parse(readFileSync(registryFile, 'utf8'));
  for (const source of snapshot.sources) {
    const records = snapshot.records.filter(
      (record) => record.sourceId === source.id,
    );
    const id = `inventory-${source.id}`;
    let entry = registry.sources.find((item) => item.id === id);
    if (!entry) {
      entry = {
        id,
        name: source.name || source.id,
        url: source.url,
        states: [],
        category: 'equipment-feed',
        notes: source.coverage || 'Imported source; coverage is partial.',
        commercialReuse: 'not-cleared',
        contentReview: 'used-for-import',
        snapshotSourceId: source.id,
        observedHttpStatus: null,
        lastCheckedAt: null,
      };
      registry.sources.push(entry);
    }
    if (records.length)
      entry.states = [...new Set(records.map((record) => record.state))].sort();
    entry.status = records.length
      ? 'ingested'
      : ['unavailable', 'failed'].includes(source.status)
        ? 'attempt-failed'
        : 'configured-empty';
    entry.importedRecords = records.length;
    entry.lastImportAt = source.lastSuccess || null;
  }
  registry.locationIndex = snapshot.records.map((record) => {
    const fields = [
      'id',
      'state',
      'route',
      'title',
      'type',
      'sourceId',
      'sourceUrl',
      'sourceSiteId',
      'sourceImageUrl',
      'retrievedAt',
      'precision',
      'coordinateMeaning',
      'equipmentPositionVerified',
      'curationNote',
      'status',
    ];
    return {
      ...Object.fromEntries(
        fields.map((field) => [field, record[field] ?? null]),
      ),
      registrySourceIds: [`inventory-${record.sourceId}`],
      inventoryStatus: 'published-inventory',
      recordStatus: record.status,
      coordinates:
        record.geometry?.type === 'Point' ? record.geometry.coordinates : null,
    };
  });
  const published = new Set(
    snapshot.records
      .filter((record) => record.sourceSiteId)
      .map((record) => `${record.state}:${record.sourceSiteId}`),
  );
  const raw = JSON.parse(readFileSync(rawFile, 'utf8'));
  for (const record of raw.records) {
    const state = record.sourceAgency === 'NYC DOT' ? 'NY' : 'PA';
    if (published.has(`${state}:${record.sourceSiteId}`)) continue;
    // An accepted source point removed from the latest inventory is not silently reclassified.
    if (!['needs-review', 'quarantined'].includes(record.curationStatus))
      continue;
    const sourceId = state === 'NY' ? 'equipment-nyc' : 'equipment-pa';
    registry.locationIndex.push({
      id: `candidate:${record.id}`,
      state,
      route: 'Harlem–Tyrone corridor',
      title: record.name,
      type: record.equipmentType,
      sourceId,
      sourceUrl: record.sourceUrl,
      sourceSiteId: record.sourceSiteId,
      sourceImageUrl: record.sourceImageUrl || null,
      retrievedAt: record.sourceRetrievedAtUTC,
      precision: 'point',
      coordinateMeaning: 'agency-camera-site-marker',
      equipmentPositionVerified: false,
      curationNote: record.curationNote,
      registrySourceIds: [`inventory-${sourceId}`],
      inventoryStatus: record.curationStatus,
      coordinates: null,
    });
  }
  registry.locationSnapshotGeneratedAt = snapshot.generatedAt;
  writeFileSync(registryFile, JSON.stringify(registry, null, 2) + '\n');
  return registry;
}
