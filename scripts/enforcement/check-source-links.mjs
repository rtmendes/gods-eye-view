import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('../../curation/sources/registry.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
const urls = [
  ...new Set(data.sources.filter((s) => !s.lastCheckedAt).map((s) => s.url)),
];
let index = 0,
  done = 0;
const results = new Map();
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (index < urls.length) {
      const url = urls[index++];
      const checkedAt = new Date().toISOString();
      try {
        let response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        let method = 'HEAD';
        if ([405, 501].includes(response.status)) {
          await response.body?.cancel();
          response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
          });
          method = 'GET';
        }
        results.set(url, {
          lastCheckedAt: checkedAt,
          observedHttpStatus: response.status,
          lastCheckMethod: method,
          observedFinalUrl:
            new URL(response.url).origin + new URL(response.url).pathname,
          accessObservation: response.ok
            ? 'http-success'
            : 'http-response-not-success',
        });
        await response.body?.cancel();
      } catch (error) {
        results.set(url, {
          lastCheckedAt: checkedAt,
          observedHttpStatus: null,
          lastCheckMethod: 'HEAD',
          accessObservation:
            error.name === 'TimeoutError'
              ? 'timeout'
              : 'connection-not-confirmed',
        });
      }
      done++;
      if (done % 40 === 0)
        console.log(`Checked ${done}/${urls.length} distinct URLs`);
    }
  }),
);
for (const source of data.sources) {
  const result = results.get(source.url);
  if (result) Object.assign(source, result);
}
data.linkChecksCompletedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(
  JSON.stringify({
    distinctUrlsChecked: done,
    successful: [...results.values()].filter(
      (x) => x.observedHttpStatus >= 200 && x.observedHttpStatus < 300,
    ).length,
    other: [...results.values()].filter(
      (x) => !(x.observedHttpStatus >= 200 && x.observedHttpStatus < 300),
    ).length,
  }),
);
