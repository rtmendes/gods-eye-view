import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
const origin = process.env.GEV_QA_ORIGIN || 'http://localhost:4178';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const start = [-74, 41],
  end = [-73.99, 41],
  at = new Date().toISOString();
function record(id, extra = {}) {
  return {
    id,
    state: 'NY',
    route: 'I-80',
    title: `Fixture ${id}`,
    description: 'Published reference fixture',
    sourceId: 'fixture',
    sourceUrl: 'https://example.org/evidence',
    type: 'work-zone',
    status: 'active-project',
    retrievedAt: at,
    travelBearings: [90],
    coordinateMeaning: 'road-reference',
    precision: 'point',
    geometry: { type: 'Point', coordinates: [-73.995, 41] },
    ...extra,
  };
}
const records = [
  record('forward', { speedLimitMph: 45 }),
  record('monitor', {
    type: 'monitoring',
    status: 'fixed',
    travelBearings: [],
    coordinateMeaning: 'agency-camera-site-marker',
  }),
  record('opposite', { travelBearings: [270] }),
  record('history', { status: 'completed' }),
  record('adjacent', {
    route: 'I-95',
    geometry: { type: 'Point', coordinates: [-73.995, 41.001] },
  }),
  record('unmapped', { geometry: null, precision: 'unlocated' }),
];
const route = (geometry, distance, duration) => ({
  geometry: { type: 'LineString', coordinates: geometry },
  distance,
  duration,
  legs: [
    {
      summary: 'Interstate 80',
      steps: [
        {
          name: 'Interstate 80',
          ref: 'I 80',
          distance,
          duration,
          maneuver: { type: 'depart', location: geometry[0] },
        },
        {
          name: '',
          distance: 0,
          duration: 0,
          maneuver: { type: 'arrive', location: geometry.at(-1) },
        },
      ],
    },
  ],
});
const payload = {
  code: 'Ok',
  routes: [
    route([start, end], 840, 60),
    route([start, [-74, 41.02], [-73.99, 41.02], end], 5300, 360),
  ],
};
try {
  const page = await browser.newPage(),
    errors = [];
  let fail = false,
    delay = 0,
    routeCalls = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const u = new URL(req.url());
    if (
      [
        'tile.openstreetmap.org',
        'fonts.googleapis.com',
        'fonts.gstatic.com',
      ].includes(u.hostname)
    )
      return req.abort();
    if (u.pathname === '/enforcement/snapshot.json')
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schemaVersion: 1,
          generatedAt: at,
          sources: [],
          records,
        }),
      });
    if (u.hostname === 'nominatim.openstreetmap.org')
      return req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(
          u.searchParams.get('q').includes('Origin')
            ? [
                {
                  lat: '40.5',
                  lon: '-74.5',
                  display_name: 'Other origin',
                  address: { country_code: 'us' },
                },
                {
                  lat: '41',
                  lon: '-74',
                  display_name: 'Chosen origin',
                  address: { country_code: 'us' },
                },
              ]
            : [
                {
                  lat: '41',
                  lon: '-73.99',
                  display_name: 'Chosen destination',
                  address: { country_code: 'us' },
                },
              ],
        ),
      });
    if (u.hostname === 'routing.openstreetmap.de') {
      routeCalls++;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return req
        .respond({
          status: fail ? 429 : 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify(fail ? { message: 'rate limited' } : payload),
        })
        .catch(() => {});
    }
    return req.continue();
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${origin}/road/route/`, { waitUntil: 'networkidle2' });
  await page.type('#trip-origin', 'Origin town');
  await page.click('#find-origin');
  await page.waitForSelector('#origin-options button');
  assert.equal(
    await page.$$eval('#origin-options button', (nodes) => nodes.length),
    2,
  );
  await page.click('#origin-options button:nth-child(2)');
  await page.type('#trip-destination', 'Destination town');
  await page.click('#find-destination');
  await page.waitForSelector('#destination-options button');
  await page.click('#destination-options button');
  await page.click('#generate-route');
  await page.waitForFunction(
    () => !document.querySelector('#trip-results').hidden,
  );
  assert.equal(routeCalls, 1);
  assert.equal(
    await page.$$eval('.corridor-record', (nodes) => nodes.length),
    3,
  );
  assert.match(
    await page.$eval('#corridor-records', (n) => n.textContent),
    /Monitoring only/,
  );
  assert.match(
    await page.$eval('#corridor-records', (n) => n.textContent),
    /45 mph/,
  );
  assert.match(
    await page.$eval('#corridor-records', (n) => n.textContent),
    /unconfirmed/,
  );
  await page.click('input[name="route-option"][value="1"]');
  assert.equal(
    await page.$$eval('.corridor-record', (nodes) => nodes.length),
    0,
  );
  assert.match(
    await page.$eval('#corridor-records', (n) => n.textContent),
    /does not establish an absence/,
  );
  await page.click('input[name="route-option"][value="0"]');
  await page.click('#include-opposite');
  assert.equal(
    await page.$$eval('.corridor-record', (nodes) => nodes.length),
    4,
  );
  await page.click('#include-history');
  assert.equal(
    await page.$$eval('.corridor-record', (nodes) => nodes.length),
    5,
  );
  await page.click('#refresh-trip-data');
  await page.waitForFunction(
    () => !document.querySelector('#refresh-trip-data').disabled,
  );
  assert.match(
    await page.$eval('#trip-data-status', (n) => n.textContent),
    /Snapshot rechecked/,
  );
  await page.click('#corridor-records button');
  assert.ok(await page.$('.leaflet-popup-content'));
  assert.equal(await page.evaluate(() => location.search), '');
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await mkdir('qa-artifacts/route', { recursive: true });
  await page.screenshot({
    path: 'qa-artifacts/route/desktop.png',
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
    path: 'qa-artifacts/route/mobile.png',
    fullPage: true,
  });
  await page.type('#trip-origin', ' changed');
  assert.equal(await page.$eval('#trip-results', (n) => n.hidden), true);
  await page.click('#clear-route');
  await page.type('#trip-origin', '41, -74.02');
  await page.type('#trip-destination', '41, -73.98');
  fail = true;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await page.click('#generate-route');
  await page
    .waitForFunction(
      () =>
        document
          .querySelector('#trip-status')
          .textContent.includes('rate limited'),
      { timeout: 8000 },
    )
    .catch(async (e) => {
      console.log(await page.$eval('#trip-status', (n) => n.textContent));
      console.log('route calls', routeCalls);
      throw e;
    });
  assert.equal(await page.$eval('#trip-results', (n) => n.hidden), true);
  await page.click('#clear-route');
  await page.type('#trip-origin', '41, -74.03');
  await page.type('#trip-destination', '41, -73.97');
  fail = false;
  delay = 1000;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await page.click('#generate-route');
  await page.click('#cancel-route');
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal(await page.$eval('#trip-results', (n) => n.hidden), true);
  assert.match(
    await page.$eval('#trip-status', (n) => n.textContent),
    /cancelled/,
  );
  assert.deepEqual(errors, []);
  console.log(
    'Route planner browser QA passed: address choices, generated routes, alternatives, corridor matching, history/direction filters, source links, refresh, input invalidation, rate-limit failure, cancellation and mobile layout.',
  );
} finally {
  await browser.close();
}
