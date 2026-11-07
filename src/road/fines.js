import './style.css';
import { laws, coverage, OFFICIAL_PORTALS, rollout } from './catalog.js';
import { $, el, link, stateGrid } from './dom.js';
import { evaluatePenalty, formatPenalty } from './penalties.js';
const params = new URLSearchParams(location.search);
const today = new Date().toISOString().slice(0, 10);
for (const [label, states] of [
  [
    'Priority rollout: East Coast, DC, Texas and California',
    coverage.filter((state) => state.rollout),
  ],
  ['Other states', coverage.filter((state) => !state.rollout)],
]) {
  const group = document.createElement('optgroup');
  group.label = label;
  for (const state of states)
    group.append(new Option(`${state.name} (${state.code})`, state.code));
  $('state').append(group);
}
$('state').value = coverage.some((s) => s.code === params.get('state'))
  ? params.get('state')
  : 'PA';
$('as-of').value = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '')
  ? params.get('date')
  : today;
for (const id of ['speed', 'limit', 'prior']) {
  const v = params.get(id);
  if (v != null && /^\d{1,3}$/.test(v)) $(id).value = v;
}
if (['ordinary', 'work', 'school'].includes(params.get('zone')))
  $('zone').value = params.get('zone');
if (
  ['other', 'controlled-access', 'interstate'].includes(params.get('roadClass'))
)
  $('road-class').value = params.get('roadClass');
if (!coverage.find((state) => state.code === $('state').value)?.rollout)
  $('priority-only').checked = false;
$('priority-summary').textContent =
  `${rollout.name}: ${rollout.jurisdictions.length} prioritized jurisdictions. ${rollout.scope}`;
// Eligibility attestations never travel in a shared URL; each visitor must establish them.
$('legal-coverage').textContent =
  `${coverage.filter((s) => s.rollout && s.rules).length} of ${rollout.jurisdictions.length} priority jurisdictions have some reviewed speeding rules (${laws.rules.length} rules total). Priority: East Coast, DC, Texas and California, with Pennsylvania retained. All 51 jurisdictions remain selectable; unreviewed programs show “Not estimated.” Sources reviewed ${laws.asOf}; this is not complete program or national legal coverage.`;
function choices() {
  const existing = $('camera-rule').value;
  const rules = laws.rules.filter(
    (r) => r.state === $('state').value && r.mode === 'camera',
  );
  $('camera-rule').replaceChildren();
  for (const rule of rules)
    $('camera-rule').add(new Option(rule.program, rule.id));
  if (!rules.length)
    $('camera-rule').add(new Option('No reviewed camera program', ''));
  if (rules.some((r) => r.id === existing)) $('camera-rule').value = existing;
  else if ($('state').value === 'NY')
    $('camera-rule').value =
      $('zone').value === 'school' ? 'ny-school-camera' : 'ny-work-camera';
  else if ($('state').value === 'CT')
    $('camera-rule').value =
      $('zone').value === 'work' ? 'ct-work-camera' : 'ct-city-camera';
}
function card(mode, rule, input) {
  const result = evaluatePenalty(rule, input, $('as-of').value);
  const card = el(
    'article',
    null,
    `panel result ${result.status === 'estimated' ? '' : 'unavailable'}`,
  );
  card.append(
    el('span', mode === 'camera' ? 'CAMERA NOTICE' : 'OFFICER CITATION', 'tag'),
    el(
      'h3',
      rule?.title ||
        (mode === 'camera' ? 'Camera penalty' : 'Officer-issued penalty'),
    ),
    el('div', formatPenalty(result), 'amount'),
    el(
      'p',
      result.status === 'estimated'
        ? result.basis
        : 'No reliable monetary estimate',
      'muted',
    ),
    el('p', result.reason),
  );
  if (rule) {
    card.append(el('p', rule.scope), el('p', rule.notes, 'muted'));
    if (result.status === 'estimated')
      card.append(el('p', result.excludes, 'muted'));
    card.append(
      el(
        'p',
        `Review: ${rule.verifiedOn} · recheck after ${rule.reviewUntil}. Effective from: ${rule.effectiveFrom || 'not established in review'}${rule.effectiveTo ? ` · expires ${rule.effectiveTo}` : ''}.`,
        'muted small',
      ),
    );
  } else
    card.append(
      el(
        'p',
        'A missing estimate does not mean $0, that cameras are prohibited, or that there are no points or other consequences.',
        'muted',
      ),
    );
  return card;
}
function render() {
  const code = $('state').value,
    state = coverage.find((s) => s.code === code);
  $('state-code').textContent = `${code} / SPEEDING PENALTIES`;
  $('state-name').textContent = state.name;
  const input = {
    speed: Number($('speed').value),
    limit: Number($('limit').value),
    prior: Number($('prior').value),
    zone: $('zone').value,
    workers: $('workers').value,
    confirmed: $('confirmed').checked,
    warningMatured: $('warning-matured').checked,
    workSigns: $('work-signs').checked,
    roadClass: $('road-class').value,
    workNotice: $('work-notice').checked,
  };
  const camera = laws.rules.find(
    (r) => r.id === $('camera-rule').value && r.state === code,
  );
  const officer = laws.rules.find(
    (r) => r.state === code && r.mode === 'officer',
  );
  $('results').replaceChildren(
    card('camera', camera, input),
    card('officer', officer, input),
  );
  const hold = laws.holds.find((r) => r.state === code);
  if (hold) $('results').append(el('p', hold.reason, 'empty'));
  const policy = laws.cameraPolicies?.find((entry) => entry.state === code);
  $('camera-policy').hidden = !policy;
  $('camera-policy').replaceChildren();
  if (policy)
    $('camera-policy').append(
      el('h3', 'Camera-authority context'),
      el('p', policy.summary),
      el(
        'p',
        `Source review ${policy.reviewedOn}; recheck after ${policy.reviewUntil}. This is not an absence-of-cameras finding.`,
        'muted',
      ),
    );
  const ids = new Set([
    ...(camera?.sourceIds || []),
    ...(officer?.sourceIds || []),
    ...(hold?.sourceIds || []),
    ...(policy?.sourceIds || []),
  ]);
  $('law-sources').replaceChildren();
  for (const source of laws.sources.filter((s) => ids.has(s.id))) {
    const row = el('article', null, 'source');
    row.append(
      link(source.title + ' ↗', source.url),
      el('p', source.reviewNote),
      el(
        'p',
        `Retrieved ${source.retrievedOn}; retrieval is not an effective date.`,
        'muted',
      ),
    );
    $('law-sources').append(row);
  }
  if (!ids.size)
    $('law-sources').append(
      el(
        'p',
        'No reviewed program source is published for this state yet. The legislative portal below is a research starting point.',
      ),
    );
  $('state-portal').href = OFFICIAL_PORTALS[code];
  $('review-window').textContent =
    'Monetary estimates stop outside the published review window. Historical dates before the review are not reconstructed. Additional laws or local ordinances may apply.';
  stateGrid(
    $('priority-only').checked ? coverage.filter((s) => s.rollout) : coverage,
    code,
    (next) => {
      $('state').value = next;
      $('confirmed').checked = false;
      choices();
      render();
      $('state-name').scrollIntoView({ behavior: 'auto', block: 'start' });
    },
  );
}
$('scenario-form').addEventListener('submit', (event) =>
  event.preventDefault(),
);
$('state').addEventListener('change', () => {
  if (!coverage.find((state) => state.code === $('state').value)?.rollout)
    $('priority-only').checked = false;
  $('confirmed').checked = false;
  choices();
  render();
});
$('zone').addEventListener('change', () => {
  $('confirmed').checked = false;
  if ($('state').value === 'NY')
    $('camera-rule').value =
      $('zone').value === 'school' ? 'ny-school-camera' : 'ny-work-camera';
  if ($('state').value === 'CT')
    $('camera-rule').value =
      $('zone').value === 'work' ? 'ct-work-camera' : 'ct-city-camera';
  render();
});
$('camera-rule').addEventListener('change', () => {
  $('confirmed').checked = false;
  render();
});
for (const id of [
  'as-of',
  'speed',
  'limit',
  'prior',
  'workers',
  'confirmed',
  'warning-matured',
  'work-signs',
  'road-class',
  'work-notice',
  'priority-only',
])
  $(id).addEventListener('input', render);
$('share').addEventListener('click', async () => {
  const p = new URLSearchParams({
    state: $('state').value,
    date: $('as-of').value,
    zone: $('zone').value,
    speed: $('speed').value,
    limit: $('limit').value,
    prior: $('prior').value,
    roadClass: $('road-class').value,
  });
  const url = new URL(location.href);
  url.search = p.toString();
  url.hash = '';
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url.href);
    $('share-status').textContent =
      'Scenario link copied. Eligibility confirmations and device information are not included.';
  } catch {
    $('share-status').textContent =
      `Copy the scenario URL from the address bar. Eligibility confirmations are not included.`;
  }
});
choices();
render();
