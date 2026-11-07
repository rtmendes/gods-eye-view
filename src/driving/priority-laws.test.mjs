import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluatePenalty, formatPenalty } from '../road/penalties.js';
const laws = JSON.parse(
  readFileSync(new URL('../../curation/laws/rules.json', import.meta.url)),
);
const rollout = JSON.parse(
  readFileSync(
    new URL('../../curation/priority-rollout.json', import.meta.url),
  ),
);
const calc = (id, values = {}) =>
  evaluatePenalty(
    laws.rules.find((r) => r.id === id),
    {
      speed: 70,
      limit: 55,
      prior: 0,
      zone: 'ordinary',
      workers: 'yes',
      confirmed: true,
      roadClass: 'other',
      workSigns: true,
      workNotice: true,
      ...values,
    },
    '2026-11-07',
  );

test('priority scope is Atlantic coastal states, DC, TX/CA and retained Pennsylvania; source research is not device curation', () => {
  const states = new Set(rollout.jurisdictions.map((r) => r.state));
  assert.equal(states.size, 18);
  for (const state of [
    'ME',
    'NH',
    'MA',
    'RI',
    'CT',
    'NY',
    'NJ',
    'PA',
    'DE',
    'MD',
    'DC',
    'VA',
    'NC',
    'SC',
    'GA',
    'FL',
    'TX',
    'CA',
  ])
    assert.equal(states.has(state), true);
  assert.equal(states.has('AK'), false);
  for (const entry of rollout.jurisdictions)
    assert.equal(
      entry.equipmentSourceStatus,
      ['NY', 'PA'].includes(entry.state)
        ? 'partial-existing'
        : 'candidate-not-ingested',
    );
  assert.equal(new Set(laws.rules.map((r) => r.state)).size, 17);
  assert.equal(
    laws.rules.some((r) => r.state === 'NJ'),
    false,
  );
});
test('Maine and Massachusetts statutory minima never display as exact fines', () => {
  assert.equal(calc('me-officer-min').status, 'unavailable');
  const me = calc('me-officer-min', { roadClass: 'interstate' });
  assert.equal(me.min, 50);
  assert.equal(me.max, null);
  assert.equal(formatPenalty(me), 'At least $50.00');
  assert.equal(
    calc('me-officer-min', { roadClass: 'interstate', speed: 85 }).status,
    'unavailable',
  );
  const ma = calc('ma-officer-min');
  assert.equal(ma.min, 100);
  assert.equal(ma.max, null);
  assert.equal(formatPenalty(ma), 'At least $100.00');
  assert.equal(
    calc('ma-officer-min', { zone: 'school' }).status,
    'unavailable',
  );
});
test('New Hampshire has distinct 65 and 70 mph tiers and excludes penalty assessments', () => {
  assert.equal(calc('nh-officer').min, 75);
  assert.equal(
    calc('nh-officer', { limit: 65, speed: 80, roadClass: 'interstate' }).min,
    150,
  );
  assert.equal(
    calc('nh-officer', { limit: 70, speed: 85, roadClass: 'interstate' }).min,
    200,
  );
  assert.equal(
    calc('nh-officer', { limit: 65, speed: 80 }).status,
    'unavailable',
  );
  assert.equal(calc('nh-officer', { zone: 'work' }).status, 'unavailable');
});
test('Rhode Island first-offense schedule and camera amount are scoped separately', () => {
  assert.equal(calc('ri-officer', { speed: 65 }).min, 95);
  assert.equal(calc('ri-officer', { speed: 66 }).min, 205);
  assert.equal(calc('ri-officer', { prior: 1 }).status, 'unavailable');
  assert.equal(calc('ri-school-camera', { zone: 'school' }).min, 50);
  assert.equal(
    calc('ri-school-camera', { zone: 'school', confirmed: false }).status,
    'unavailable',
  );
});
test('Connecticut municipal caps differ from 2026 CTDOT warnings, repeats and 85 mph rule', () => {
  assert.equal(calc('ct-city-camera').max, 50);
  assert.equal(calc('ct-city-camera', { prior: 1 }).max, 75);
  assert.equal(calc('ct-city-camera', { zone: 'work' }).status, 'unavailable');
  assert.equal(calc('ct-work-camera', { zone: 'work' }).min, 0);
  assert.equal(calc('ct-work-camera', { zone: 'work', prior: 1 }).min, 75);
  assert.equal(calc('ct-work-camera', { zone: 'work', prior: 2 }).min, 75);
  assert.equal(calc('ct-work-camera', { zone: 'work', speed: 85 }).min, 75);
  assert.equal(
    calc('ct-work-camera', { zone: 'work', limit: 40 }).status,
    'unavailable',
  );
  assert.equal(calc('ct-officer').min, 100);
  assert.equal(calc('ct-officer').max, 150);
  assert.equal(
    calc('ct-officer', { roadClass: 'interstate' }).status,
    'unavailable',
  );
  assert.equal(
    calc('ct-officer', { roadClass: 'interstate', speed: 71 }).min,
    100,
  );
});
test('Delaware applies tier rates to all mph over rather than only mph past five', () => {
  for (const [over, amount] of [
    [5, 20],
    [6, 26],
    [15, 35],
    [16, 52],
    [19, 58],
    [20, 80],
  ])
    assert.equal(calc('de-officer', { speed: 55 + over }).min, amount);
  assert.equal(calc('de-officer', { prior: 1 }).min, 55);
  assert.equal(calc('de-officer', { prior: 2 }).status, 'unavailable');
  assert.equal(calc('de-camera', { speed: 65 }).status, 'unavailable');
  assert.equal(calc('de-camera', { zone: 'work' }).min, 35);
});
test('North Carolina caps stop at misdemeanor thresholds and separate work-zone addition', () => {
  assert.equal(calc('nc-officer').max, 100);
  assert.equal(calc('nc-officer', { speed: 71 }).status, 'unavailable');
  assert.equal(
    calc('nc-officer', { speed: 81, limit: 70 }).status,
    'unavailable',
  );
  assert.deepEqual(
    [
      calc('nc-officer', { zone: 'work' }).min,
      calc('nc-officer', { zone: 'work' }).max,
    ],
    [250, 350],
  );
  assert.equal(
    calc('nc-officer', { zone: 'work', workSigns: false }).status,
    'unavailable',
  );
});
test('South Carolina statute boundary ambiguities are withheld rather than invented', () => {
  for (const over of [15, 25])
    assert.equal(
      calc('sc-officer', { speed: 55 + over }).status,
      'unavailable',
    );
  for (const [over, min, max] of [
    [10, 15, 25],
    [11, 25, 50],
    [16, 50, 75],
    [26, 75, 200],
  ])
    assert.deepEqual(
      [
        calc('sc-officer', { speed: 55 + over }).min,
        calc('sc-officer', { speed: 55 + over }).max,
      ],
      [min, max],
    );
  assert.equal(calc('sc-officer', { prior: 1 }).status, 'unavailable');
});
test('Georgia and Florida camera programs use separate scopes and amounts from officer citations', () => {
  assert.equal(calc('ga-school-camera', { zone: 'school' }).min, 75);
  assert.equal(calc('ga-school-camera', { zone: 'school', prior: 1 }).min, 125);
  assert.equal(calc('fl-school-camera', { zone: 'school' }).min, 100);
  assert.equal(
    calc('fl-school-camera', { zone: 'school', speed: 65 }).status,
    'unavailable',
  );
  assert.equal(calc('fl-officer', { speed: 60 }).min, 0);
  assert.equal(calc('fl-officer', { speed: 61 }).min, 25);
  assert.equal(calc('fl-officer', { speed: 65 }).min, 100);
  assert.equal(calc('fl-officer', { zone: 'school' }).min, 300);
  assert.equal(calc('fl-officer', { zone: 'work', workers: 'yes' }).min, 300);
  assert.equal(calc('fl-officer', { zone: 'work', workers: 'no' }).min, 150);
  assert.equal(calc('fl-officer', { speed: 85 }).status, 'unavailable');
});
test('Texas base range and notice-dependent work-zone doubling exclude separate charges', () => {
  assert.deepEqual([calc('tx-officer').min, calc('tx-officer').max], [1, 200]);
  assert.deepEqual(
    [
      calc('tx-officer', { zone: 'work' }).min,
      calc('tx-officer', { zone: 'work' }).max,
    ],
    [2, 400],
  );
  assert.equal(
    calc('tx-officer', { zone: 'work', workNotice: false }).status,
    'unavailable',
  );
  assert.equal(
    calc('tx-officer', { zone: 'work', workers: 'unknown' }).status,
    'unavailable',
  );
  assert.equal(
    laws.cameraPolicies
      .find((p) => p.state === 'TX')
      .sourceIds.includes('tx-camera'),
    true,
  );
});
test('California officer base schedule is not the camera schedule or a county payable total', () => {
  for (const [over, amount] of [
    [15, 35],
    [16, 70],
    [25, 70],
    [26, 100],
  ])
    assert.equal(calc('ca-officer-schedule', { speed: 55 + over }).min, amount);
  assert.equal(
    calc('ca-officer-schedule', { speed: 101 }).status,
    'unavailable',
  );
  assert.equal(calc('ca-officer-schedule', { prior: 1 }).status, 'unavailable');
  assert.equal(
    calc('ca-pilot-camera', { roadClass: 'interstate' }).status,
    'unavailable',
  );
});
test('DC adopted 2026 schedule distinguishes controlled-access roads for both enforcement modes', () => {
  for (const id of ['dc-camera', 'dc-officer']) {
    for (const [over, amount] of [
      [10, 50],
      [15, 100],
      [20, 150],
      [25, 200],
      [26, 500],
    ])
      assert.equal(calc(id, { speed: 55 + over }).min, amount);
    assert.equal(
      calc(id, { speed: 81, roadClass: 'controlled-access' }).min,
      400,
    );
    assert.equal(calc(id, { zone: 'work' }).status, 'unavailable');
  }
  assert.equal(
    laws.holds.some((h) => h.state === 'DC'),
    false,
  );
});
