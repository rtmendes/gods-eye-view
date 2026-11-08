import { normalizeRecord } from './model.js';
export function createEnforcementSource({
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      const response = await fetchImpl('/api/enforcement', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Enforcement database unavailable');
      const snapshot = await response.json();
      if (
        snapshot.schemaVersion !== 1 ||
        !Array.isArray(snapshot.records) ||
        !Array.isArray(snapshot.sources)
      )
        throw new Error('Invalid enforcement snapshot');
      return { ...snapshot, records: snapshot.records.map(normalizeRecord) };
    },
  };
}
