import './style.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { normalizeRecord } from '../driving/model.js';
import { formatRouteDuration } from '../data/routeSteps.js';
import { $, el, link } from './dom.js';
import {
  parseCoordinates,
  createRouteClient,
  matchRouteIntelligence,
} from './routing.js';

const client = createRouteClient();
const map = L.map('trip-map', { zoomControl: true }).setView([39, -96], 4);
const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
}).addTo(map);
let tileError = false;
tiles.on('tileerror', () => {
  if (!tileError) {
    tileError = true;
    $('map-status').textContent =
      'Some basemap tiles are unavailable. Route and reference overlays can still be shown.';
  }
});
const routeLayer = L.layerGroup().addTo(map),
  intelligenceLayer = L.layerGroup().addTo(map);
let snapshot = { generatedAt: null, records: [] };
let inventoryLoaded = false;
let routes = [],
  selectedRoute = null,
  controller = null,
  version = 0,
  disposed = false;
const endpoints = { origin: null, destination: null },
  searchControllers = { origin: null, destination: null };
const field = (kind) => $(`trip-${kind}`);
const miles = (m) => `${(m / 1609.344).toFixed(1)} mi`;
function status(message) {
  $('trip-status').textContent = message;
}
function busy(value) {
  $('generate-route').disabled = value;
  $('cancel-route').hidden = !value;
  $('example-route').disabled = value;
}
function discardRoute() {
  version++;
  controller?.abort();
  controller = null;
  routes = [];
  selectedRoute = null;
  routeLayer.clearLayers();
  intelligenceLayer.clearLayers();
  $('trip-results').hidden = true;
  $('route-choices').replaceChildren();
  $('corridor-records').replaceChildren();
  $('trip-steps').replaceChildren();
  busy(false);
}
function choose(kind, place) {
  discardRoute();
  searchControllers[kind]?.abort();
  endpoints[kind] = place;
  field(kind).value = place.label;
  $(`${kind}-options`).replaceChildren(el('p', 'Selected.', 'muted small'));
  status(
    'Endpoint selected. Generate the driving route when both endpoints are ready.',
  );
}
async function search(kind) {
  const query = field(kind).value.trim(),
    point = parseCoordinates(query);
  discardRoute();
  endpoints[kind] = null;
  if (point) {
    choose(kind, { point, label: query });
    return;
  }
  if (query.length < 3) {
    status('Enter a town, address or valid latitude, longitude.');
    return;
  }
  const request = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    request.abort();
  }, 15000);
  searchControllers[kind]?.abort();
  searchControllers[kind] = request;
  const button = $(`find-${kind}`);
  button.disabled = true;
  $(`${kind}-options`).replaceChildren();
  status(`Finding ${kind === 'origin' ? 'starting point' : 'destination'}…`);
  try {
    const places = await client.search(query, { signal: request.signal });
    if (
      disposed ||
      request.signal.aborted ||
      field(kind).value.trim() !== query
    )
      return;
    if (!places.length) {
      $(`${kind}-options`).append(
        el(
          'p',
          'No US place matched. Refine the address or enter coordinates.',
          'muted',
        ),
      );
      return;
    }
    for (const place of places) {
      const option = el('button', place.label, 'place-option');
      option.type = 'button';
      option.addEventListener('click', () => choose(kind, place));
      $(`${kind}-options`).append(option);
    }
    status(
      'Choose the intended search result for each endpoint, then generate the route.',
    );
  } catch (error) {
    if (error.name !== 'AbortError' || timedOut) {
      const reason = timedOut
        ? 'The address search timed out. Try again or use coordinates.'
        : error.message;
      status(`Address search unavailable: ${reason}`);
      $(`${kind}-options`).append(
        el('p', `Search unavailable: ${reason}`, 'muted'),
      );
    }
  } finally {
    clearTimeout(timeout);
    if (searchControllers[kind] === request) button.disabled = false;
  }
}
for (const kind of ['origin', 'destination']) {
  field(kind).addEventListener('input', () => {
    endpoints[kind] = null;
    searchControllers[kind]?.abort();
    discardRoute();
    $(`${kind}-options`).replaceChildren();
    status(
      'Endpoint changed. Select the updated location and generate a new route.',
    );
  });
  $(`find-${kind}`).addEventListener('click', () => search(kind));
}
function drawRoute() {
  routeLayer.clearLayers();
  if (!selectedRoute) return;
  const line = L.polyline(
    selectedRoute.geometry.map(([lon, lat]) => [lat, lon]),
    { color: '#087565', weight: 6, opacity: 0.9 },
  ).addTo(routeLayer);
  for (const [point, label] of [
    [selectedRoute.geometry[0], 'Start'],
    [selectedRoute.geometry.at(-1), 'Destination'],
  ])
    L.circleMarker([point[1], point[0]], {
      radius: 8,
      color: '#102e35',
      weight: 3,
      fillColor: '#fff',
      fillOpacity: 1,
    })
      .bindTooltip(label)
      .addTo(routeLayer);
  map.fitBounds(line.getBounds(), { padding: [28, 28], maxZoom: 15 });
  $('trip-summary').replaceChildren();
  for (const [value, label] of [
    [miles(selectedRoute.distanceM), 'driving distance'],
    [formatRouteDuration(selectedRoute.durationS), 'baseline travel time'],
    [String(routes.length), 'returned route option(s)'],
  ]) {
    const metric = el('div', null, 'metric');
    metric.append(el('strong', value), el('span', label));
    $('trip-summary').append(metric);
  }
  $('trip-steps').replaceChildren();
  for (const step of selectedRoute.steps) {
    const item = el('li');
    const button = el('button', step.instruction, 'secondary');
    button.type = 'button';
    button.addEventListener('click', () =>
      map.setView([step.lat, step.lon], 16),
    );
    item.append(button, el('span', ` · ${miles(step.distanceM)}`, 'muted'));
    $('trip-steps').append(item);
  }
  $('steps-status').textContent = selectedRoute.steps.length
    ? `${selectedRoute.steps.length} directions${selectedRoute.stepsTruncated ? ' (truncated by the route-step limit)' : ''}.`
    : 'Step directions were not supplied by the service.';
  $('trip-results').hidden = false;
  renderIntelligence();
}
function selectRoute(index) {
  selectedRoute = routes[index];
  for (const input of $('route-choices').querySelectorAll('input'))
    input.checked = Number(input.value) === index;
  drawRoute();
}
function renderChoices() {
  $('route-choices').replaceChildren(el('h3', 'Route options'));
  for (const [index, route] of routes.entries()) {
    const label = el('label', null, 'route-choice');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'route-option';
    radio.value = String(index);
    radio.addEventListener('change', () => selectRoute(index));
    const description = el('span');
    description.append(
      el('strong', `Option ${index + 1} · ${miles(route.distanceM)}`),
      el(
        'small',
        `${formatRouteDuration(route.durationS)} baseline · ${route.summary}`,
      ),
    );
    label.append(radio, description);
    $('route-choices').append(label);
  }
}
async function generate() {
  const pending = [];
  for (const kind of ['origin', 'destination']) {
    const point = parseCoordinates(field(kind).value);
    if (point && !endpoints[kind])
      endpoints[kind] = { point, label: field(kind).value.trim() };
    if (!endpoints[kind]) pending.push(kind);
  }
  if (pending.length) {
    for (const kind of pending) await search(kind);
    if (!endpoints.origin || !endpoints.destination) {
      status(
        'Select the matching endpoint results, then press Generate driving route. Any search errors are listed above.',
      );
      return;
    }
  }
  discardRoute();
  const current = version,
    request = new AbortController();
  controller = request;
  busy(true);
  status('Generating a driving route…');
  const timeout = setTimeout(() => request.abort(), 30000);
  try {
    const result = await client.route(
      endpoints.origin.point,
      endpoints.destination.point,
      { signal: request.signal },
    );
    if (disposed || request.signal.aborted || current !== version) return;
    routes = result;
    renderChoices();
    selectRoute(0);
    status(
      `Route generated. ${routes.length === 1 ? 'The service returned one route.' : `${routes.length} route options returned.`} Baseline travel time excludes live traffic.`,
    );
    if (!tileError)
      $('map-status').textContent =
        'Route displayed. Select an intelligence card to inspect a source reference.';
  } catch (error) {
    if (current === version)
      status(
        error.name === 'AbortError'
          ? 'Route request cancelled or timed out. Try again.'
          : `Route unavailable: ${error.message}`,
      );
  } finally {
    clearTimeout(timeout);
    if (current === version) {
      controller = null;
      busy(false);
    }
  }
}
$('trip-form').addEventListener('submit', (event) => {
  event.preventDefault();
  generate();
});
$('cancel-route').addEventListener('click', () => {
  discardRoute();
  status('Route request cancelled.');
});
$('example-route').addEventListener('click', () => {
  choose('origin', {
    point: [-73.9442, 40.8116],
    label: 'Harlem, New York (example centroid)',
  });
  choose('destination', {
    point: [-78.2381, 40.6706],
    label: 'Tyrone, Pennsylvania (example centroid)',
  });
  generate();
});
$('clear-route').addEventListener('click', () => {
  discardRoute();
  client.clear();
  map.setView([39, -96], 4);
  for (const kind of ['origin', 'destination']) {
    searchControllers[kind]?.abort();
    endpoints[kind] = null;
    field(kind).value = '';
    $(`${kind}-options`).replaceChildren();
  }
  status('Trip cleared. No trip was saved.');
});
$('trip-gps').addEventListener('click', () => {
  if (!navigator.geolocation) {
    status('Location is unavailable in this browser. Enter a starting point.');
    return;
  }
  status('Requesting your current location…');
  const requestedAtVersion = version;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (disposed || requestedAtVersion !== version) return;
      if (position.coords.accuracy > 100) {
        status(
          `GPS accuracy is ±${Math.round(position.coords.accuracy)} m. Choose an address or try a better fix.`,
        );
        return;
      }
      choose('origin', {
        point: [position.coords.longitude, position.coords.latitude],
        label: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
      });
      status(
        'GPS starting point selected. Coordinates are sent for routing only when you generate a route.',
      );
    },
    () => {
      if (disposed || requestedAtVersion !== version) return;
      status(
        'Location permission or a usable GPS fix was unavailable. Enter a starting point.',
      );
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
});
function renderIntelligence() {
  if (!selectedRoute) return;
  if (!inventoryLoaded) {
    $('trip-data-status').textContent =
      'The published inventory has not loaded. Route directions are available, but intelligence coverage is unknown.';
    $('corridor-records').replaceChildren(
      el(
        'p',
        'No inventory loaded; this is not evidence of a clear route.',
        'panel empty',
      ),
    );
    return;
  }
  const matches = matchRouteIntelligence(snapshot.records, selectedRoute, {
    radiusM: Number($('corridor-radius').value),
    includeHistory: $('include-history').checked,
    includeOpposite: $('include-opposite').checked,
  });
  intelligenceLayer.clearLayers();
  $('corridor-records').replaceChildren();
  $('trip-data-status').textContent =
    `${matches.length} matched references within ${$('corridor-radius').value} m of the route. Inventory snapshot: ${snapshot.generatedAt}. Geometric proximity alone does not establish the same road, lane or direction.`;
  const unmapped = snapshot.records.filter((record) => !record.geometry).length;
  $('corridor-coverage').textContent =
    `Coverage is partial, primarily the curated NY/PA corridor. ${unmapped} inventory records lack geometry and cannot be placed on this route. Empty areas mean unknown coverage. No live flow, incident or enforcement-device telemetry is connected.`;
  if (!matches.length)
    $('corridor-records').append(
      el(
        'p',
        'No mapped records matched this corridor and filter. This does not establish an absence of cameras, work zones, incidents or delays.',
        'panel empty',
      ),
    );
  for (const match of matches) {
    const r = match.record;
    const monitoring = r.type === 'monitoring';
    const work = r.type === 'work-zone';
    const symbol = monitoring ? 'T' : work ? 'W' : 'C',
      color = monitoring ? '#426f9a' : work ? '#a66705' : '#6a4990';
    const position =
      r.geometry.type === 'Point' ? r.geometry.coordinates : match.routePoint;
    const popup = el('div');
    popup.append(
      el('strong', r.title),
      el(
        'p',
        `${monitoring ? 'Traffic-monitoring site' : work ? 'Published work-zone reference' : 'Mapped camera reference'} · ${match.status}`,
      ),
      el('p', match.matchLabel),
      el(
        'p',
        `Source limit: ${r.speedLimitMph ? `${r.speedLimitMph} mph` : 'not supplied'}. Current posted limits and activation are not confirmed.`,
      ),
      link(
        'Sources & provenance ↗',
        `${location.origin}/road/sources/?location=${encodeURIComponent(r.id)}`,
      ),
    );
    const marker = L.circleMarker([position[1], position[0]], {
      radius: 11,
      color,
      weight: 2,
      fillColor: '#fff',
      fillOpacity: 0.95,
    })
      .bindTooltip(symbol, {
        permanent: true,
        direction: 'center',
        className: 'trip-marker-letter',
      })
      .bindPopup(popup)
      .addTo(intelligenceLayer);
    if (work && r.geometry.type !== 'Point')
      for (const part of r.geometry.type === 'MultiLineString'
        ? r.geometry.coordinates
        : [r.geometry.coordinates])
        L.polyline(
          part.map(([lon, lat]) => [lat, lon]),
          { color, weight: 4, dashArray: '6 7' },
        ).addTo(intelligenceLayer);
    const card = el('article', null, 'panel corridor-record');
    card.append(
      el('span', `${symbol} · ${r.state} · ${r.route}`, 'tag'),
      el('h3', r.title),
      el(
        'p',
        `${miles(match.offsetM)} from start · ${Math.round(match.crossM)} m from route · ${match.status}`,
        'muted',
      ),
      el('p', match.matchLabel),
      el(
        'p',
        `Travel-direction reference: ${match.direction}. ${monitoring ? 'Monitoring only; no verified citation enforcement.' : work ? 'Project reference; enforcement may occur, but activation and equipment position are unconfirmed.' : 'Device activation and physical mounting accuracy are unconfirmed.'}`,
      ),
    );
    if (r.speedLimitMph || r.standardSpeedLimitMph)
      card.append(
        el(
          'p',
          `Source-reported limit: ${r.speedLimitMph || 'unknown'} mph${r.standardSpeedLimitMph ? ` · standard reference ${r.standardSpeedLimitMph} mph` : ''}. Follow current posted signs.`,
        ),
      );
    if (r.milepostBegin != null && r.milepostEnd != null)
      card.append(
        el(
          'p',
          `Published highway mileposts ${r.milepostBegin}–${r.milepostEnd}. These are not trip-distance mileposts.`,
          'muted',
        ),
      );
    card.append(
      el(
        'p',
        `Source retrieved ${r.retrievedAt || 'unknown'} · position meaning: ${r.coordinateMeaning}.`,
        'muted small',
      ),
    );
    const actions = el('div', null, 'inline-actions'),
      inspect = el('button', 'Inspect on map', 'secondary');
    inspect.type = 'button';
    inspect.addEventListener('click', () => {
      map.setView([position[1], position[0]], 15);
      marker.openPopup();
      $('trip-map').scrollIntoView({ block: 'center' });
    });
    actions.append(
      inspect,
      link('Published evidence ↗', r.sourceUrl),
      link(
        'All provenance ↗',
        `${location.origin}/road/sources/?location=${encodeURIComponent(r.id)}`,
      ),
      link(
        'State penalty context ↗',
        `${location.origin}/road/fines/?state=${r.state}`,
      ),
    );
    card.append(actions);
    $('corridor-records').append(card);
  }
}
for (const id of ['corridor-radius', 'include-history', 'include-opposite'])
  $(id).addEventListener('input', renderIntelligence);
async function refreshInventory() {
  $('refresh-trip-data').disabled = true;
  try {
    const response = await fetch('/enforcement/snapshot.json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const next = await response.json();
    if (next.schemaVersion !== 1 || !Array.isArray(next.records))
      throw new Error('Invalid inventory snapshot');
    const changed = next.generatedAt !== snapshot.generatedAt;
    const records = next.records.map(normalizeRecord);
    if (disposed) return;
    snapshot = { ...next, records };
    inventoryLoaded = true;
    renderIntelligence();
    if (selectedRoute)
      $('trip-data-status').append(
        document.createTextNode(
          changed
            ? ' Published snapshot loaded.'
            : ' Snapshot rechecked; upstream imports and hosted publication run separately.',
        ),
      );
  } catch (error) {
    if (!disposed)
      $('trip-data-status').textContent =
        `Snapshot refresh unavailable (${error.message}). ${inventoryLoaded ? 'Previously loaded references retain their original dates.' : 'No intelligence inventory is available; do not interpret this as no enforcement.'}`;
  } finally {
    if (!disposed) $('refresh-trip-data').disabled = false;
  }
}
$('refresh-trip-data').addEventListener('click', refreshInventory);
refreshInventory();
window.addEventListener('pagehide', (event) => {
  disposed = true;
  controller?.abort();
  Object.values(searchControllers).forEach((request) => request?.abort());
  if (!event.persisted) map.remove();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    disposed = false;
    map.invalidateSize();
    busy(false);
  }
});
