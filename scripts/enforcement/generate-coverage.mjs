import { readFileSync, writeFileSync } from 'node:fs';
import { JURISDICTIONS } from '../../src/driving/jurisdictions.js';
const snapshot = JSON.parse(
  readFileSync(
    new URL('../../public/enforcement/snapshot.json', import.meta.url),
    'utf8',
  ),
);
const states = JURISDICTIONS.map((state) => {
  const records = snapshot.records.filter(
    (record) => record.state === state.code,
  );
  return {
    ...state,
    records: records.length,
    monitoring: records.filter((r) => r.type === 'monitoring').length,
    physicalVerified: records.filter(
      (r) => r.equipmentPositionVerified === true,
    ).length,
  };
});
writeFileSync(
  new URL('../../curation/national-coverage.json', import.meta.url),
  JSON.stringify({ generatedAt: snapshot.generatedAt, states }, null, 2) + '\n',
);
console.log(
  'Generated national coverage counts from the bundled equipment snapshot.',
);
