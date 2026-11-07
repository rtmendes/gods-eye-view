import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
const registry = JSON.parse(
  await readFile(
    new URL('../curation/sources/registry.json', import.meta.url),
    'utf8',
  ),
);
const origin = process.env.GEV_QA_ORIGIN || 'http://localhost:4177';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (
      [
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'tile.openstreetmap.org',
      ].includes(url.hostname)
    )
      return request.abort();
    if (url.hostname === 'unpkg.com') {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
        });
        return request.respond({
          status: response.status,
          contentType: response.headers.get('content-type') || 'text/plain',
          body: Buffer.from(await response.arrayBuffer()),
        });
      } catch {
        return request.abort();
      }
    }
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${origin}/road/sources/`, { waitUntil: 'networkidle2' });
  assert.equal(
    await page.$eval('#source-state', (node) => node.options.length),
    52,
  );
  assert.equal(
    await page.$$eval('#source-rows tr', (rows) => rows.length),
    registry.sources.length,
  );
  assert.equal(
    await page.$$eval('#location-rows tr', (rows) => rows.length),
    306,
  );
  await page.type('#source-query', 'caltrans');
  assert.ok((await page.$$eval('#source-rows tr', (rows) => rows.length)) > 0);
  await page.$eval('#source-query', (node) => {
    node.value = '';
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.select('#source-state', 'TX');
  await page.select('#source-status', 'ingested');
  assert.equal(await page.$$eval('#source-rows tr', (rows) => rows.length), 0);
  await page.select('#source-state', 'PA');
  assert.equal(await page.$$eval('#source-rows tr', (rows) => rows.length), 2);
  await page.select('#source-status', '');
  await page.select('#source-state', 'NY');
  assert.equal(
    await page.$$eval('#location-rows tr', (rows) => rows.length),
    7,
  );
  await page.click('#location-rows button');
  assert.match(
    await page.$eval('#location-detail', (node) => node.textContent),
    /Published location evidence/,
  );
  assert.match(
    await page.$eval('#location-detail', (node) => node.textContent),
    /background only/,
  );
  assert.match(page.url(), /location=/);
  await page.select('#source-state', '');
  await page.click('#include-review');
  assert.equal(
    await page.$$eval('#location-rows tr', (rows) => rows.length),
    324,
  );
  await page.type('#location-query', 'TACONY');
  assert.equal(
    await page.$$eval('#location-rows tr', (rows) => rows.length),
    1,
  );
  assert.match(
    await page.$eval('#location-rows', (node) => node.textContent),
    /quarantined/,
  );
  await page.click('#location-rows button');
  assert.match(
    await page.$eval('#location-detail', (node) => node.textContent),
    /quarantined/,
  );
  assert.doesNotMatch(
    await page.$eval('#location-detail', (node) => node.textContent),
    /Source point: latitude/,
  );
  await page.goto(
    `${origin}/road/sources/?location=${encodeURIComponent(registry.locationIndex[0].id)}`,
    { waitUntil: 'networkidle2' },
  );
  assert.equal(
    await page.$eval('#location-detail', (node) => node.hidden),
    false,
  );
  assert.match(
    await page.$eval('#location-detail', (node) => node.textContent),
    /Published location evidence/,
  );
  await mkdir('qa-artifacts/sources', { recursive: true });
  await page.screenshot({
    path: 'qa-artifacts/sources/desktop.png',
    fullPage: true,
  });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: 'qa-artifacts/sources/mobile.png',
    fullPage: true,
  });
  if (process.env.GEV_QA_EQUIPMENT === '1') {
    await page.goto(`${origin}/equipment/`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      () => document.querySelectorAll('#rows tr').length === 67,
    );
    const links = await page.$$eval(
      '#rows a[href*="/road/sources/?location="]',
      (nodes) =>
        nodes.map((node) => new URL(node.href).searchParams.get('location')),
    );
    assert.equal(links.length, 67);
    const ids = new Set(registry.locationIndex.map((record) => record.id));
    assert.ok(links.every((id) => ids.has(id)));
  }
  assert.deepEqual(errors, []);
  console.log(
    'Sources browser QA passed: all 51 jurisdictions, registry filters, 306 published/324 total records, source deep links, quarantine separation and phone layout.',
  );
} finally {
  await browser.close();
}
