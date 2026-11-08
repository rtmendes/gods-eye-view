import './style.css';
import registry from '../../curation/sources/registry.json' with { type: 'json' };
import { $, el, link } from './dom.js';
import {
  sourceUrl,
  filterSources,
  filterLocations,
  locationEvidence,
  sourcesForState,
  accessLabel,
} from './provenance.js';
const params = new URLSearchParams(location.search);
for (const state of registry.jurisdictions)
  $('source-state').add(
    new Option(`${state.name} (${state.code})`, state.code),
  );
if (registry.jurisdictions.some((state) => state.code === params.get('state')))
  $('source-state').value = params.get('state');
for (const category of [
  ...new Set(registry.sources.map((s) => s.category)),
].sort())
  $('source-category').add(new Option(category.replaceAll('-', ' '), category));
for (const status of [...new Set(registry.sources.map((s) => s.status))].sort())
  $('source-status').add(new Option(status.replaceAll('-', ' '), status));
for (const [n, label] of [
  [registry.jurisdictions.length, 'jurisdictions in the registry'],
  [registry.sources.length, 'registered source entries'],
  [
    registry.locationIndex.filter(
      (r) => r.inventoryStatus === 'published-inventory',
    ).length,
    'published records with provenance',
  ],
  [
    registry.sources.filter((r) => r.status === 'ingested').length,
    'sources with imported records',
  ],
]) {
  const card = el('div', null, 'metric');
  card.append(el('strong', String(n)), el('span', label));
  $('source-metrics').append(card);
}
$('registry-date').textContent =
  `Registry ${registry.generatedAt} · location snapshot ${registry.locationSnapshotGeneratedAt}. ${registry.linkChecksCompletedAt ? `Link observations completed ${registry.linkChecksCompletedAt}.` : ''} Sources can become inaccessible or change after this snapshot.`;
function safeLink(title, url) {
  const safe = sourceUrl(url);
  return safe
    ? link(title, safe)
    : el('span', `${title} (unsafe or unavailable link)`);
}
function detail(id) {
  const record = registry.locationIndex.find((r) => r.id === id);
  const node = $('location-detail');
  node.hidden = false;
  node.replaceChildren();
  if (!record) {
    node.append(
      el('h2', 'Location not found'),
      el(
        'p',
        'This ID is not in the bundled provenance index. New backend imports require regenerating this index.',
      ),
    );
    return;
  }
  $('source-state').value = record.state;
  if (record.inventoryStatus !== 'published-inventory')
    $('include-review').checked = true;
  node.append(
    el('span', record.inventoryStatus.replaceAll('-', ' '), 'tag'),
    el('h2', record.title),
    el('p', `${record.state} · ${record.route} · ${record.id}`, 'muted'),
    el('h3', 'Published location evidence'),
  );
  for (const evidence of locationEvidence(record, registry))
    node.append(
      safeLink(evidence.title + ' ↗', evidence.url),
      el('p', evidence.url, 'muted small'),
    );
  node.append(
    el(
      'p',
      `Source/site ID: ${record.sourceSiteId || record.sourceId}. Position meaning: ${record.coordinateMeaning || 'unverified'}. Independently verified physical position: ${record.equipmentPositionVerified ? 'yes' : 'no'}.`,
    ),
  );
  if (record.coordinates)
    node.append(
      el(
        'p',
        `Source point: latitude ${record.coordinates[1]}, longitude ${record.coordinates[0]}. This is not a surveyed mounting position.`,
        'muted',
      ),
    );
  if (record.curationNote) node.append(el('p', record.curationNote, 'muted'));
  if (record.sourceImageUrl)
    node.append(
      safeLink(
        'Agency camera view (not a device photograph) ↗',
        record.sourceImageUrl,
      ),
    );
  const refs = el('details'),
    related = sourcesForState(registry, record.state);
  refs.append(
    el(
      'summary',
      `${related.length} related state resources — background only`,
    ),
    el(
      'p',
      'These resources do not independently establish this device’s coordinates or current operation.',
      'muted',
    ),
  );
  for (const source of related) {
    const row = el('p');
    row.append(
      safeLink(source.name, source.url),
      el('span', ` · ${source.status} · ${source.category}`, 'muted small'),
    );
    refs.append(row);
  }
  node.append(refs);
  const url = new URL(location.href);
  url.search = new URLSearchParams({ location: record.id }).toString();
  history.replaceState(null, '', url);
}
function render() {
  const state = $('source-state').value;
  const sources = filterSources(registry, {
    state,
    category: $('source-category').value,
    status: $('source-status').value,
    query: $('source-query').value,
  });
  $('source-rows').replaceChildren();
  for (const source of sources) {
    const row = el('tr');
    const name = el('td');
    name.append(
      safeLink(source.name + ' ↗', source.url),
      el('p', source.id, 'muted small'),
    );
    if (source.directoryEvidence?.length) {
      const refs = el('details');
      refs.append(el('summary', 'Directory listing evidence'));
      for (const url of source.directoryEvidence)
        refs.append(safeLink('FHWA listing ↗', url), el('br'));
      name.append(refs);
    }
    const stateCell = el(
      'td',
      source.states.length === 51
        ? 'All 50 states + DC'
        : source.states.join(', '),
    );
    const status = el('td');
    status.append(
      el('span', source.status.replaceAll('-', ' '), 'tag'),
      el('p', source.contentReview.replaceAll('-', ' '), 'muted small'),
    );
    if (source.importedRecords != null)
      status.append(
        el('p', `${source.importedRecords} imported records`, 'muted'),
      );
    if (source.retrievedOn)
      status.append(
        el('p', `Reference retrieved ${source.retrievedOn}`, 'muted small'),
      );
    if (source.lastImportAt)
      status.append(
        el('p', `Last import ${source.lastImportAt}`, 'muted small'),
      );
    const observed = el('td');
    observed.append(
      el('strong', accessLabel(source)),
      el('p', source.lastCheckedAt || 'No link check recorded', 'muted small'),
    );
    if (source.observedFinalUrl)
      observed.append(
        el(
          'p',
          `Observed destination: ${source.observedFinalUrl}`,
          'muted small',
        ),
      );
    const notes = el('td');
    notes.append(
      el('p', source.notes),
      el('p', `Commercial reuse: ${source.commercialReuse}.`, 'muted small'),
    );
    row.append(
      name,
      stateCell,
      el('td', source.category.replaceAll('-', ' ')),
      status,
      observed,
      notes,
    );
    $('source-rows').append(row);
  }
  $('sources-count').textContent =
    `${sources.length} of ${registry.sources.length} source entries shown. Roles may share a provider or URL; this is not a count of independent data feeds.`;
  const locations = filterLocations(registry, {
    state,
    query: $('location-query').value,
    includeReview: $('include-review').checked,
  });
  $('location-rows').replaceChildren();
  for (const record of locations) {
    const row = el('tr');
    const name = el('td');
    name.append(el('strong', record.title), el('p', record.id, 'muted small'));
    const button = el('button', 'View all sources', 'secondary');
    button.type = 'button';
    button.addEventListener('click', () => {
      detail(record.id);
      render();
      $('location-detail').scrollIntoView({ block: 'start' });
    });
    name.append(button);
    const evidence = el('td');
    for (const entry of locationEvidence(record, registry))
      evidence.append(safeLink(entry.title + ' ↗', entry.url), el('br'));
    row.append(
      name,
      el('td', `${record.state} · ${record.route}`),
      el(
        'td',
        `${record.type} · ${record.recordStatus || 'unconfirmed'} · ${record.inventoryStatus}`,
      ),
      el(
        'td',
        `${record.coordinateMeaning || 'unverified'} · physical position ${record.equipmentPositionVerified ? 'verified' : 'unverified'}`,
      ),
      evidence,
      el('td', record.retrievedAt || 'Not supplied'),
    );
    $('location-rows').append(row);
  }
  $('locations-count').textContent =
    `${locations.length} of ${registry.locationIndex.length} indexed records shown; ${registry.locationIndex.filter((r) => r.inventoryStatus === 'published-inventory').length} are published inventory records. Review and quarantined candidates are never promoted to published equipment by this view.`;
}
for (const id of [
  'source-state',
  'source-category',
  'source-status',
  'source-query',
  'location-query',
  'include-review',
])
  $(id).addEventListener('input', render);
$('source-state').addEventListener('change', () => {
  $('location-detail').hidden = true;
  const url = new URL(location.href);
  url.search = $('source-state').value
    ? new URLSearchParams({ state: $('source-state').value }).toString()
    : '';
  history.replaceState(null, '', url);
});
$('download-registry').addEventListener('click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(registry, null, 2)], { type: 'application/json' }),
  );
  const a = el('a');
  a.href = url;
  a.download = 'gods-eye-view-source-registry-and-provenance.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
if (params.has('location')) detail(params.get('location'));
render();
