import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
const origin = process.env.GEV_QA_ORIGIN || 'http://localhost:4173';
const browser = await puppeteer.launch({
  executablePath: process.env.GEV_CHROME_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const u = new URL(request.url());
    if (
      u.hostname === 'fonts.googleapis.com' ||
      u.hostname === 'fonts.gstatic.com'
    )
      return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${origin}/road/`, { waitUntil: 'networkidle2' });
  assert.equal(
    await page.$eval('#state-grid', (grid) => grid.children.length),
    18,
  );
  await page.click('#priority-only');
  assert.equal(
    await page.$eval('#state-grid', (grid) => grid.children.length),
    51,
  );
  await page.type('#state-search', 'new jersey');
  assert.equal(
    await page.$eval('#state-grid', (grid) => grid.children.length),
    1,
  );
  await page.click('#state-grid button');
  assert.match(
    await page.$eval('#state-detail', (node) => node.textContent),
    /No equipment inventory/,
  );
  await page.select('#event-kind', 'radar-signal');
  await page.click('#simulate');
  assert.match(
    await page.$eval('#hardware-status', (node) => node.textContent),
    /SIMULATION/,
  );
  await page.click('#clear-events');
  assert.match(
    await page.$eval('#hardware-status', (node) => node.textContent),
    /No active/,
  );
  await page.click('#parked');
  assert.match(
    await page.$eval('#offers', (node) => node.textContent),
    /No active affiliate offers/,
  );
  await page.goto(`${origin}/road/fines/?state=PA&date=2026-11-07`, {
    waitUntil: 'networkidle2',
  });
  assert.equal(
    await page.$eval('#state-grid', (grid) => grid.children.length),
    18,
  );
  await page.click('#priority-only');
  assert.equal(
    await page.$eval('#state-grid', (grid) => grid.children.length),
    51,
  );
  assert.equal(
    await page.$eval('#state', (select) => select.options.length),
    51,
  );
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /Not estimated/,
  );
  await page.click('#confirmed');
  await page.select('#workers', 'yes');
  await page.click('#work-signs');
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /Written warning/,
  );
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /\$110\.00/,
  );
  await page.$eval('#prior', (node) => {
    node.value = '1';
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /at least 15 days/,
  );
  await page.click('#warning-matured');
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /\$75\.00/,
  );
  await page.select('#state', 'MD');
  assert.equal(await page.$eval('#confirmed', (node) => node.checked), false);
  await page.click('#confirmed');
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /\$120\.00/,
  );
  await page.select('#state', 'VA');
  await page.click('#confirmed');
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /Up to \$100\.00/,
  );
  await page.$eval('#speed', (node) => {
    node.value = '75';
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /reckless-driving threshold/,
  );
  await page.select('#state', 'TX');
  await page.select('#zone', 'ordinary');
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /\$1\.00–\$200\.00/,
  );
  assert.match(
    await page.$eval('#camera-policy', (node) => node.textContent),
    /municipal/,
  );
  await page.select('#state', 'AK');
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /No current reviewed monetary rule/,
  );
  assert.equal(
    await page.$$eval('#results .amount', (nodes) =>
      nodes.every((node) => node.textContent === 'Not estimated'),
    ),
    true,
  );
  await page.select('#state', 'NY');
  await page.select('#zone', 'ordinary');
  await page.$eval('#as-of', (node) => {
    node.value = '2027-01-01';
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(
    await page.$eval('#results', (node) => node.textContent),
    /outside the reviewed rule window/,
  );
  await page.$eval('#as-of', (node) => {
    node.value = '2026-11-07';
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.select('#state', 'PA');
  await page.select('#zone', 'work');
  await mkdir('qa-artifacts/road', { recursive: true });
  await page.screenshot({
    path: 'qa-artifacts/road/fines-desktop.png',
    fullPage: true,
  });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({
    path: 'qa-artifacts/road/fines-mobile.png',
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.goto(`${origin}/road/`, { waitUntil: 'networkidle2' });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    'Road browser QA passed: 51 states, search, program comparisons, warning/worker conditions, stale rules, explicit unknowns, simulated hardware, parked offers and mobile layout.',
  );
} finally {
  await browser.close();
}
