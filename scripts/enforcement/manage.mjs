import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshSourceIndex } from '../../server/enforcement/source-index.js';
import { openStore, seedStore } from '../../server/enforcement/store.js';
const [command, arg, file] = process.argv.slice(2);
const store = openStore();
try {
  seedStore(store);
  if (command === 'reports')
    console.log(JSON.stringify(store.reports(), null, 2));
  else if (command === 'reject') store.resolve(arg, null);
  else if (command === 'approve')
    store.resolve(arg, JSON.parse(readFileSync(file, 'utf8')));
  else if (command === 'import') {
    const payload = JSON.parse(readFileSync(arg, 'utf8'));
    store.importSource(payload.source, payload.records);
  } else if (command === 'export') {
    const snapshot = store.snapshot();
    writeFileSync(
      arg || 'enforcement-export.json',
      JSON.stringify(snapshot, null, 2),
    );
    if (
      arg &&
      resolve(arg) ===
        fileURLToPath(
          new URL('../../public/enforcement/snapshot.json', import.meta.url),
        )
    )
      refreshSourceIndex(snapshot);
  } else
    throw new Error(
      'Usage: manage.mjs reports | reject ID | approve ID reviewed-record.json | import source-and-records.json | export [path]',
    );
} finally {
  store.close();
}
