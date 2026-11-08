import './style.css';
import catalog from '../../curation/sources/access.json' with { type: 'json' };
import registry from '../../curation/sources/registry.json' with { type: 'json' };
import guide from '../../docs/road-intelligence/DATA-ACCESS-CHECKLIST.md?raw';
import templates from '../../docs/road-intelligence/APPLICATION-TEMPLATES.md?raw';
import prd from '../../docs/road-intelligence/PRD.md?raw';
import technical from '../../docs/road-intelligence/TECHNICAL-SPECIFICATION.md?raw';
import sop from '../../docs/road-intelligence/SOP.md?raw';
import { $, el, link } from './dom.js';
import { inline, renderDocument } from './document.js';
const priority = new Set([
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
]);
const documents = { checklist: guide, templates, prd, technical, sop };
const params = new URLSearchParams(location.search);
const storageKey = 'gev-access-checklist-v1';
let progress = {};
try {
  const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (value && typeof value === 'object' && !Array.isArray(value))
    progress = value;
} catch {
  /* Private browsers can disable storage. */
}
const common = [
  'Identify the actual applicant and truthful affiliation. Describe the pilot, intended public display and possible future affiliate/commercial use.',
  'Open the official platform links below; request only the datasets and geography needed. Confirm no-charge eligibility, quotas and bandwidth obligations.',
  'Submit through the provider’s official process. Keep credentials, personal evidence and agreements outside this page and GitHub.',
  'Receive written approval and confirm attribution, caching, video/public-display and commercial reuse permissions. A checklist tick is not approval.',
  'Configure restricted credentials privately; build and test the authorized adapter, source timestamps, geometry, direction, expiry and failure states.',
  'Import accepted records, quarantine conflicts, rebuild source/coverage indexes and publish the app. Inspect each location’s evidence below. Missing coverage remains unknown.',
];
function check(text, id) {
  const label = el('label', null, 'access-check');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = progress[id] === true;
  input.addEventListener('change', () => {
    progress[id] = input.checked;
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      $('access-progress-note').textContent =
        'Storage is unavailable. Checklist progress lasts only for this page session; no agency approval is recorded.';
    }
  });
  label.append(input, inline(el('span'), text));
  return label;
}
for (const state of [...registry.jurisdictions].sort(
  (a, b) =>
    Number(priority.has(b.code)) - Number(priority.has(a.code)) ||
    a.name.localeCompare(b.name),
))
  $('access-state').add(
    new Option(
      `${state.name} (${state.code})${priority.has(state.code) ? ' · priority' : ''}`,
      state.code,
    ),
  );
$('access-state').value = registry.jurisdictions.some(
  (s) => s.code === params.get('state'),
)
  ? params.get('state')
  : 'NY';
const published = registry.locationIndex.filter(
  (r) => r.inventoryStatus === 'published-inventory',
);
for (const [number, label] of [
  [51, 'state / district views'],
  [18, 'priority jurisdictions'],
  [catalog.providers.length, 'provider tracker entries'],
  [published.length, 'published location records'],
]) {
  const card = el('div', null, 'metric');
  card.append(el('strong', String(number)), el('span', label));
  $('access-metrics').append(card);
}
function stateRecords() {
  return published.filter((r) => r.state === $('access-state').value);
}
function locations() {
  const state = $('access-state').value,
    all = stateRecords(),
    query = $('access-location-search').value.trim().toLowerCase();
  const records = all.filter((r) =>
    `${r.title} ${r.route} ${r.id} ${r.sourceId}`.toLowerCase().includes(query),
  );
  $('access-location-count').textContent =
    `${records.length} of ${all.length} published records shown for ${state}. No new access or activation is implied. Inventory ${registry.locationSnapshotGeneratedAt}.`;
  const node = $('access-locations');
  node.replaceChildren();
  if (!all.length)
    node.append(
      el(
        'p',
        'No published equipment/project records for this jurisdiction in the current snapshot. This is a coverage gap, not evidence of no cameras.',
        'panel',
      ),
    );
  else if (!records.length)
    node.append(el('p', 'No location records match this search.', 'panel'));
  for (const record of records) {
    const details = el('details', null, 'panel access-location');
    details.append(
      el('summary', `${record.title} · ${record.route} · ${record.type}`),
    );
    details.append(
      el(
        'p',
        `Source status: ${record.recordStatus || record.status}. Enforcement activation: unknown. Physical equipment position: ${record.equipmentPositionVerified ? 'see verification evidence' : 'not independently verified'}.`,
      ),
    );
    const point = record.coordinates;
    details.append(
      el(
        'p',
        `Published coordinate: ${Array.isArray(point) && point.length >= 2 ? `${point[1]}, ${point[0]} (latitude, longitude)` : 'no point coordinate supplied in provenance index; inspect source geometry'}. Meaning: ${record.coordinateMeaning || record.precision || 'unspecified'}.`,
      ),
    );
    details.append(
      el(
        'p',
        `Record ${record.id} · source ${record.sourceId} · retrieved ${record.retrievedAt || 'unknown'}.`,
        'muted small',
      ),
    );
    const actions = el('p', null, 'inline-actions');
    actions.append(
      link(
        'Inspect full evidence & source location',
        `/road/sources/?location=${encodeURIComponent(record.id)}`,
      ),
    );
    if (record.sourceUrl?.startsWith('https://'))
      actions.append(link('Original agency evidence ↗', record.sourceUrl));
    details.append(actions);
    const heading = el('h3', 'Location verification steps');
    details.append(heading);
    const steps = [
      'Confirm this source ID and agency ownership in the approved feed; do not assume a camera-viewing login grants API rights.',
      'Verify source geometry, road, travel direction and coordinate precision. A project/site reference is not a surveyed camera mount.',
      'Confirm imagery display permission and source capture/update time if media is supplied. Media availability is separate from enforcement state.',
      'Check actual device-level operating evidence and expiry if supplied by an authorized agency. Otherwise keep activation unknown.',
      'Review the normalized record, preserve provenance, publish accepted changes and confirm that this location appears correctly in the app.',
    ];
    for (const [i, step] of steps.entries())
      details.append(check(step, `location:${record.id}:${i}`));
    node.append(details);
  }
}
function renderState() {
  const code = $('access-state').value,
    state = registry.jurisdictions.find((s) => s.code === code);
  const summary = $('state-summary');
  summary.replaceChildren(
    el('h2', `${state.name}: access and coverage`),
    el(
      'p',
      `${priority.has(code) ? 'Priority application plan' : 'Expansion discovery plan; state-specific application requirements need agency confirmation'}. No authoritative live enforcement activation feed is connected. Provider status below reflects the November 8 documentation, not these browser ticks.`,
    ),
  );
  summary.append(
    link(
      'Browse every registered source for this state',
      `/road/sources/?state=${code}`,
    ),
  );
  const commonNode = $('common-steps');
  commonNode.replaceChildren();
  common.forEach((text, i) =>
    commonNode.append(check(text, `state:${code}:${i}`)),
  );
  const providers = catalog.providers.filter(
    (p) =>
      p.jurisdictions === 'US' || p.jurisdictions.split(';').includes(code),
  );
  const node = $('access-providers');
  node.replaceChildren();
  if (!providers.some((p) => p.jurisdictions !== 'US'))
    node.append(
      el(
        'p',
        'No state-specific access application has been curated yet. Start with this state’s registered agency sources, request the current process, and use the shared application guide. Free access is unverified.',
        'callout',
      ),
    );
  for (const provider of providers) {
    const details = el('details', null, 'panel access-provider');
    details.open = provider.jurisdictions !== 'US';
    details.append(
      el(
        'summary',
        `${provider.platform} · ${provider.jurisdictions === 'US' ? 'shared / optional platform' : provider.jurisdictions}`,
      ),
    );
    details.append(
      el('p', `Documented access status: ${provider.status}.`),
      el('p', `Cost / limits: ${provider.cost_basis}.`),
      el(
        'p',
        `Commercial reuse: ${provider.commercial_reuse}. No approval is asserted by this interface.`,
      ),
      link(
        'Open official platform / application ↗',
        provider.official_entry_url,
      ),
    );
    provider.steps.forEach((step, i) =>
      details.append(check(step, `${code}:${provider.id}:${i}`)),
    );
    details.append(
      link(
        'Read complete requirements and request drafts',
        '/road/access/?view=templates',
      ),
    );
    node.append(details);
  }
  locations();
}
function view(name) {
  if (name !== 'states' && !documents[name]) name = 'states';
  $('state-view').hidden = name !== 'states';
  $('document-view').hidden = name === 'states';
  for (const button of document.querySelectorAll('[data-view]'))
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  if (documents[name]) renderDocument($('access-document'), documents[name]);
  const url = new URL(location.href);
  url.searchParams.set('state', $('access-state').value);
  url.searchParams.set('view', name);
  history.replaceState(null, '', url);
}
$('access-state').addEventListener('change', () => {
  $('access-location-search').value = '';
  renderState();
  view('states');
});
$('access-location-search').addEventListener('input', locations);
for (const button of document.querySelectorAll('[data-view]'))
  button.addEventListener('click', () => view(button.dataset.view));
$('clear-access-progress').addEventListener('click', () => {
  progress = {};
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* Session-only fallback. */
  }
  renderState();
  $('access-progress-note').textContent =
    'All checklist ticks in this browser have been reset. Agency and shared source statuses are unchanged.';
});
$('print-access').addEventListener('click', () => window.print());
renderState();
view(params.get('view') || 'states');
