import './style.css';
import { coverage, coverageSnapshotDate, rollout } from './catalog.js';
import { $, el, link, stateGrid } from './dom.js';
import {
  HARDWARE,
  normalizeHardwareEvent,
  hardwareMessage,
  approvedOffer,
  commercialVisible,
} from './hardware.js';
const reviewed = coverage.filter((s) => s.rules).length;
for (const [value, label] of [
  [51, 'states + DC supported'],
  [
    coverage.reduce((n, s) => n + s.monitoring, 0),
    'agency monitoring-site points',
  ],
  [
    coverage.reduce((n, s) => n + s.physicalVerified, 0),
    'verified physical device positions',
  ],
  [reviewed, 'jurisdictions with reviewed speeding rules'],
]) {
  const card = el('div', null, 'metric');
  card.append(el('strong', String(value)), el('span', label));
  $('metrics').append(card);
}
const snapshotTime = new Date(coverageSnapshotDate).toLocaleString('en-US', {
  timeZone: 'UTC',
  timeZoneName: 'short',
});
$('snapshot-date').textContent = `Snapshot generated ${snapshotTime}.`;
const params = new URLSearchParams(location.search);
let selected = coverage.some((s) => s.code === params.get('state'))
  ? params.get('state')
  : 'PA';
if (!coverage.find((state) => state.code === selected)?.rollout)
  $('priority-only').checked = false;
$('priority-summary').textContent =
  `${rollout.name}: ${rollout.jurisdictions.length} prioritized jurisdictions; ${coverage.filter((s) => s.rollout && s.rules).length} have some reviewed monetary rules. ${rollout.scope}`;
function select(code) {
  selected = code;
  const state = coverage.find((s) => s.code === selected);
  const query = new URLSearchParams({ state: code });
  history.replaceState(null, '', `${location.pathname}?${query}`);
  stateGrid(
    $('priority-only').checked ? coverage.filter((s) => s.rollout) : coverage,
    selected,
    select,
    $('state-search').value,
  );
  $('search-status').textContent =
    `${$('state-grid').children.length} of 51 jurisdictions shown.`;
  const detail = $('state-detail');
  detail.replaceChildren(
    el('span', state.coverage, 'tag'),
    el('h3', state.name),
  );
  const numbers = el('div', null, 'report-numbers');
  for (const [n, label] of [
    [state.records, 'total inventory records'],
    [state.monitoring, 'monitoring-site points'],
    [state.physicalVerified, 'verified physical positions'],
    [state.rules, 'reviewed speeding rules'],
  ]) {
    const p = el('p');
    p.append(el('strong', String(n)), el('span', label));
    numbers.append(p);
  }
  detail.append(
    numbers,
    el(
      'p',
      state.records
        ? 'These records cover a limited corridor and include project references. They do not constitute complete state coverage or a live deployment feed.'
        : 'No equipment inventory has been curated for this jurisdiction. This does not establish an absence of cameras or enforcement.',
      'muted',
    ),
  );
  detail.append(
    el(
      'p',
      `${state.cameraRules} camera rules · ${state.officerRules} officer rules. Legal and equipment coverage are independent. ${state.licensing}.`,
      'muted',
    ),
  );
  const actions = el('div', null, 'inline-actions');
  actions.append(
    link('Compare fines →', `/road/fines/?state=${state.code}`),
    link('Explore curated corridor map →', '/equipment/'),
  );
  detail.append(actions);
  if (state.rollout) {
    detail.append(
      el('h3', 'Equipment-source research'),
      el(
        'p',
        state.rollout.equipmentSourceStatus === 'partial-existing'
          ? 'Existing partial inventory. Broader state equipment curation is still needed.'
          : 'Candidate agency portal; no equipment coordinates have been ingested from this portal.',
        'muted',
      ),
      link(
        'Agency traveler-information research portal ↗',
        state.rollout.equipmentPortal,
      ),
      el('p', state.rollout.note, 'muted small'),
    );
  }
}
$('priority-only').addEventListener('change', () => select(selected));
$('state-search').addEventListener('input', () => select(selected));
select(selected);
for (const device of HARDWARE) {
  const card = el('article', null, 'panel');
  card.append(
    el('span', 'MANUFACTURER REFERENCE', 'tag'),
    el('h3', device.name),
    el('p', device.capabilities.join(' · ')),
    el('p', device.integration, 'muted'),
    link('Read manufacturer specifications ↗', device.url),
  );
  $('hardware-catalog').append(card);
}
let expiryTimer;
function clearEvent(
  message = 'No active observations. No location collection.',
) {
  clearTimeout(expiryTimer);
  $('hardware-status').textContent = message;
  $('hardware-status').classList.remove('active');
}
$('simulate').addEventListener('click', () => {
  clearEvent();
  const now = Date.now();
  const event = normalizeHardwareEvent(
    {
      adapterId: 'local-simulator',
      kind: $('event-kind').value,
      observedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 20000).toISOString(),
      speedLimitMph: 45,
      simulation: true,
    },
    now,
  );
  $('hardware-status').textContent =
    hardwareMessage(event) + ' Expires in 20 seconds; not saved or published.';
  $('hardware-status').classList.add('active');
  expiryTimer = setTimeout(
    () => clearEvent('Simulated observation expired and was discarded.'),
    20000,
  );
});
$('clear-events').addEventListener('click', () => clearEvent());
// No affiliate credentials, paid placements, tracking pixels, or active offers are configured.
const configuredOffers = [];
$('parked').addEventListener('change', () => {
  const visible = commercialVisible({
    driving: !$('parked').checked,
    speedMph: $('parked').checked ? 0 : null,
  });
  const offers = visible
    ? configuredOffers.map(approvedOffer).filter(Boolean)
    : [];
  $('offers').replaceChildren(
    el(
      'p',
      !visible
        ? 'Offers remain hidden until you confirm you are parked.'
        : offers.length
          ? 'Approved affiliate offers:'
          : 'No active affiliate offers. Manufacturer references above are ordinary links.',
      'muted',
    ),
  );
  for (const offer of offers)
    $('offers').append(el('p', offer.disclosure), link(offer.title, offer.url));
});
$('offers').textContent =
  'Offers remain hidden until you confirm you are parked.';
window.addEventListener('pagehide', () => clearTimeout(expiryTimer));
