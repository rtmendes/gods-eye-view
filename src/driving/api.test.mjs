import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { enforcementPlugin } from '../../server/enforcement/plugin.js';
import { openStore } from '../../server/enforcement/store.js';

function fixture(t) {
  const store = openStore(':memory:');
  t.after(() => store.close());
  const plugin = enforcementPlugin({
    storeFactory: () => store,
    seed: () => {},
  });
  let handler;
  plugin.configureServer({
    middlewares: {
      use(path, fn) {
        assert.equal(path, '/api/enforcement');
        handler = fn;
      },
    },
  });
  return {
    store,
    async request({
      path = '/reports',
      method = 'POST',
      body,
      headers = {},
    } = {}) {
      const req = Readable.from([
        Buffer.from(
          body ??
            JSON.stringify({
              kind: 'new',
              state: 'PA',
              route: 'I-80',
              type: 'work-zone',
              details: 'Eastbound near exit 70, observed November 6.',
            }),
        ),
      ]);
      Object.assign(req, {
        url: path,
        method,
        headers: {
          host: 'localhost:4173',
          origin: 'http://localhost:4173',
          'content-type': 'application/json',
          ...headers,
        },
        socket: { remoteAddress: '127.0.0.1' },
      });
      let status, payload;
      await handler(req, {
        writeHead(s) {
          status = s;
        },
        end(body) {
          payload = JSON.parse(body);
        },
      });
      return { status, payload };
    },
  };
}
test('read API exposes curated data but never pending reports or moderation', async (t) => {
  const f = fixture(t);
  assert.equal((await f.request()).status, 201);
  assert.equal(f.store.reports().length, 1);
  const snapshot = await f.request({ path: '/', method: 'GET' });
  assert.equal(snapshot.status, 200);
  assert.deepEqual(snapshot.payload.records, []);
  assert.equal(snapshot.payload.reports, undefined);
  assert.equal((await f.request({ path: '/approve' })).status, 404);
  assert.equal((await f.request({ method: 'GET' })).status, 405);
});
test('cross-origin and non-JSON writes are refused before storage', async (t) => {
  const f = fixture(t);
  assert.equal(
    (await f.request({ headers: { origin: 'https://elsewhere.example' } }))
      .status,
    403,
  );
  assert.equal((await f.request({ headers: { origin: 'null' } })).status, 403);
  assert.equal(
    (await f.request({ headers: { 'sec-fetch-site': 'cross-site' } })).status,
    403,
  );
  assert.equal(
    (await f.request({ headers: { 'content-type': 'text/plain' } })).status,
    415,
  );
  assert.equal(f.store.reports().length, 0);
});
test('oversized and malformed report bodies do not enter the queue', async (t) => {
  const f = fixture(t);
  assert.equal((await f.request({ body: 'x'.repeat(9000) })).status, 413);
  assert.equal((await f.request({ body: '{oops' })).status, 400);
  assert.equal(
    (await f.request({ body: JSON.stringify({ state: 'CA' }) })).status,
    400,
  );
  assert.equal(f.store.reports().length, 0);
});
