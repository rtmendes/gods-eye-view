import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { demoTrip } from '../src/driving/demo.js';

const origin = process.env.GEV_QA_ORIGIN || 'http://localhost:4173';
const trip = { ...demoTrip(), demo: undefined };
const browser = await puppeteer.launch({
  executablePath: process.env.GEV_CHROME_PATH || '/usr/bin/chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = new URL(req.url());
    if (url.pathname === '/api/route')
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(trip),
      });
    // Managed-environment Chromium may lack the proxy CA in its own trust store.
    // Node's inherited CA and proxy verify TLS; never disable certificate checks.
    if (
      process.env.GEV_QA_NODE_TILE_TRANSPORT === '1' &&
      url.origin === 'https://tile.openstreetmap.org'
    ) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'gods-eye-view-driving-qa/1.0',
            Referer: origin,
          },
        });
        return req.respond({
          status: response.status,
          contentType: 'image/png',
          headers: { 'access-control-allow-origin': '*' },
          body: Buffer.from(await response.arrayBuffer()),
        });
      } catch {
        return req.abort();
      }
    }
    return req.continue();
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition(success, error) {
          window.qaFix = success;
          window.qaGpsError = error;
          return 7;
        },
        clearWatch(id) {
          window.qaCleared = id;
        },
      },
    });
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${origin}/drive/`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  await page.waitForFunction(() =>
    document.getElementById('inventory-count').textContent.includes('/'),
  );
  await page.waitForFunction(() =>
    document.getElementById('data-sync').textContent.includes('Map synced'),
  );
  await page.click('#refresh-data');
  await page.waitForFunction(
    () =>
      !document.getElementById('refresh-data').disabled &&
      document
        .getElementById('data-sync')
        .textContent.includes('source import'),
  );
  await page.type('#origin', '40.892, -74.110');
  await page.type('#destination', '40.882, -74.075');
  await page.click('#plan');
  await page.waitForFunction(() => !document.getElementById('start').disabled);
  await page.click('#start');
  const fix = async (accuracy = 5) =>
    page.evaluate(
      (accuracy) =>
        window.qaFix({
          coords: {
            latitude: 40.892,
            longitude: -74.11,
            accuracy,
            speed: 22,
            heading: 100,
          },
          timestamp: Date.now(),
        }),
      accuracy,
    );
  await fix();
  await page.waitForFunction(
    () => document.getElementById('turn-distance').textContent !== '—',
  );
  assert.match(
    await page.$eval('#mode-label', (e) => e.textContent),
    /LIVE GPS/,
  );
  await fix(100);
  assert.equal(await page.$eval('#turn-distance', (e) => e.textContent), '—');
  await fix();
  await page.click('#stop-driving');
  assert.equal(await page.evaluate(() => window.qaCleared), 7);
  assert.equal(await page.$eval('#guidance', (e) => e.hidden), true);
  await page.select('#state-filter', 'NY');
  assert.equal(
    await page.$$eval('#records .badge', (rows) =>
      rows.every((row) => row.textContent.startsWith('NY ·')),
    ),
    true,
  );
  await page.select('#state-filter', '');
  await page.click('#replay');
  await page.waitForFunction(
    () => document.getElementById('turn-distance').textContent !== '—',
  );
  await page
    .waitForNetworkIdle({ idleTime: 1000, timeout: 30000 })
    .catch(() => {});
  await mkdir('qa-artifacts/driving', { recursive: true });
  await page.screenshot({
    path: 'qa-artifacts/driving/desktop.png',
    fullPage: true,
  });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: 'qa-artifacts/driving/mobile-driving.png',
    fullPage: false,
  });
  await page.click('#stop-driving');
  await page.screenshot({
    path: 'qa-artifacts/driving/mobile-inventory.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    'Driving browser QA passed: planning, GPS follow, weak-fix pause, stop cleanup, filters, replay, desktop and phone layout.',
  );
} finally {
  await browser.close();
}
