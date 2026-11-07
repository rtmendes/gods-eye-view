import { refreshSourceIndex } from '../../server/enforcement/source-index.js';
const registry = refreshSourceIndex();
console.log(
  JSON.stringify({
    sources: registry.sources.length,
    indexedLocations: registry.locationIndex.length,
    publishedLocations: registry.locationIndex.filter(
      (record) => record.inventoryStatus === 'published-inventory',
    ).length,
  }),
);
