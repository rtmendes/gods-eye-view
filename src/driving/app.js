import * as Cesium from 'cesium';
import './style.css';
import { createEnforcementSource } from './source.js';
import { drawEnforcement } from './map.js';
import { NavigationSession } from './navigation.js';
import {
  coordinate,
  gpsUsable,
  pointAt,
  project,
  bearing,
  distance,
  temporalStatus,
  miles,
  lines,
} from './model.js';
import { demoTrip } from './demo.js';
import { JURISDICTIONS } from './jurisdictions.js';

const $ = (id) => document.getElementById(id);
for (const select of [
  $('state-filter'),
  document.querySelector('#report-form [name="state"]'),
]) {
  const selected = select.value;
  select.replaceChildren();
  if (select.id === 'state-filter') select.add(new Option('All states', ''));
  for (const state of JURISDICTIONS)
    select.add(new Option(`${state.code} · ${state.name}`, state.code));
  select.value = selected;
}
const message = (text) => {
  $('message').textContent = text;
};
const arrivalTime = (seconds) =>
  new Date(Date.now() + seconds * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
const routeSource = createEnforcementSource();
let snapshot = { records: [], sources: [] },
  route = null,
  watch = null,
  replayTimer = null,
  wake = null,
  routing = null,
  destroyed = false;
let lastFix = null,
  gpsOrigin = null,
  replayOffset = 0,
  selectedDestination = null,
  nextRefresh = null;
let planVersion = 0;
let refreshingInventory = false;
let viewer, enforcementMap, routeMap, driver;
function speak(text) {
  if (!$('voice').checked || !('speechSynthesis' in window) || document.hidden)
    return;
  if (speechSynthesis.pending) speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}
async function keepAwake() {
  if (!document.hidden && session.active && navigator.wakeLock && !wake) {
    try {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => {
        wake = null;
      });
    } catch {
      /* Browser can refuse; foreground guidance still works. */
    }
  }
}
function releaseTracking() {
  if (watch != null) navigator.geolocation.clearWatch(watch);
  watch = null;
  clearInterval(replayTimer);
  replayTimer = null;
  wake?.release();
  wake = null;
}
function stop({ hide = true, preserveSpeech = false } = {}) {
  planVersion++;
  document.body.classList.remove('driving');
  session.stop();
  releaseTracking();
  routing?.abort();
  routing = null;
  if (!preserveSpeech) window.speechSynthesis?.cancel();
  $('stop').hidden = true;
  $('start').disabled = !route || route.demo;
  $('plan').disabled = false;
  $('replay').disabled = false;
  if (hide) $('guidance').hidden = true;
  $('inventory').open = true;
}
function follow(fix, matched) {
  if (!viewer || !$('follow').checked) return;
  const position = matched?.point || fix.point;
  const heading = Number.isFinite(fix.heading)
    ? fix.heading
    : matched?.bearing || 0;
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(...position, 1300),
    orientation: {
      heading: Cesium.Math.toRadians(heading),
      pitch: -Math.PI / 2,
      roll: 0,
    },
  });
}
function updateDriver(fix, matched) {
  if (driver)
    driver.position = Cesium.Cartesian3.fromDegrees(
      ...(matched?.point || fix.point),
    );
  follow(fix, matched);
  viewer?.scene.requestRender();
}
const session = new NavigationSession({
  onSpeak: speak,
  onUpdate(update) {
    if (update.fix) updateDriver(update.fix, update.matched);
    $('gps-quality').textContent = update.fix
      ? `±${Math.round(update.fix.accuracy)} m`
      : 'GPS unavailable';
    if (update.state === 'arrived') {
      $('turn-text').textContent = 'You have arrived';
      $('turn-distance').textContent = '✓';
      $('remaining').textContent = '0 mi left';
      $('eta').textContent = '';
      $('alert').textContent = '';
      stop({ hide: false, preserveSpeech: true });
      message('Trip complete. Location tracking stopped.');
      return;
    }
    if (update.state !== 'driving') {
      $('turn-text').textContent = update.message;
      $('turn-distance').textContent = '—';
      $('alert').textContent = '';
      $('speed').textContent = '—';
      $('remaining').textContent = 'Guidance paused';
      $('eta').textContent = '';
      return;
    }
    $('speed').textContent = Number.isFinite(update.fix.speed)
      ? Math.round(Math.max(0, update.fix.speed) * 2.236936)
      : '—';
    $('turn-distance').textContent = miles(update.maneuver.distanceM);
    $('turn-text').textContent =
      update.maneuver.step?.instruction || 'Turn instructions unavailable';
    $('remaining').textContent = `${miles(update.remainingM)} left`;
    const minutes = Math.max(1, Math.round(update.remainingS / 60));
    $('eta').textContent = `${minutes} min · ${arrivalTime(update.remainingS)}`;
    const upcoming = update.upcoming;
    $('alert').textContent = upcoming
      ? `${upcoming.record.type === 'work-zone' ? 'Potential work-zone enforcement' : 'Mapped camera'} · ${miles(upcoming.distanceM)} ahead · ${upcoming.record.route}. Follow posted signs.`
      : '';
  },
  onReroute: async (point) => {
    if (routing || !selectedDestination) return;
    message('Recalculating route…');
    try {
      await requestRoute(point, selectedDestination, true);
      message('Route updated. ETA excludes live traffic.');
    } catch (e) {
      if (e.name !== 'AbortError')
        message(
          `Rerouting unavailable: ${e.message}. Guidance will resume when you return to the route.`,
        );
    }
  },
});
function initializeMap() {
  try {
    Cesium.Ion.defaultAccessToken = '';
    viewer = new Cesium.Viewer('map', {
      baseLayer: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
    });
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#162b38');
    const imagery = new Cesium.UrlTemplateImageryProvider({
      url:
        import.meta.env.VITE_DRIVE_TILE_URL ||
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maximumLevel: 19,
      credit:
        import.meta.env.VITE_DRIVE_TILE_CREDIT ||
        '© OpenStreetMap contributors · Map tiles © OpenStreetMap',
    });
    imagery.errorEvent.addEventListener(() => {
      $('map-health').hidden = false;
      $('map-health').textContent =
        'Some basemap tiles are unavailable. Route and enforcement overlays may lack road context.';
    });
    viewer.imageryLayers.addImageryProvider(imagery);
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-75.8, 41.0, 700000),
    });
    enforcementMap = new Cesium.CustomDataSource('enforcement');
    routeMap = new Cesium.CustomDataSource('driving-route');
    viewer.dataSources.add(enforcementMap);
    viewer.dataSources.add(routeMap);
    driver = viewer.entities.add({
      id: 'driver',
      point: {
        pixelSize: 18,
        color: Cesium.Color.fromCssColorString('#58d9cc'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Infinity,
      },
    });
    viewer.scene.screenSpaceCameraController.enableTilt = false;
  } catch (e) {
    message(
      `Map unavailable (${e.message}). Route information and the inventory remain available.`,
    );
  }
}
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function sourceLink(url, text) {
  const a = element('a', text);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
function renderInventory() {
  const state = $('state-filter').value,
    highway = $('route-filter').value,
    type = $('type-filter').value,
    status = $('status-filter').value;
  const records = snapshot.records
    .filter((r) => {
      const s = temporalStatus(r);
      return (
        (!state || r.state === state) &&
        (!highway || r.route === highway) &&
        (!type || r.type === type) &&
        (status === 'all' ||
          (status
            ? s === status
            : !['completed', 'paused', 'expired', 'unknown'].includes(s)))
      );
    })
    .sort((a, b) =>
      (a.state + a.route + a.title).localeCompare(b.state + b.route + b.title),
    );
  $('inventory-count').textContent =
    `${records.length} / ${snapshot.records.length}`;
  if (enforcementMap) {
    drawEnforcement(enforcementMap, records);
    viewer.scene.requestRender();
  }
  $('records').replaceChildren();
  if (!records.length)
    $('records').append(
      element(
        'p',
        'No matching published records. Coverage is incomplete; check source details.',
        'fine',
      ),
    );
  for (const r of records) {
    const row = element('article', null, 'record');
    row.append(
      element('div', `${r.state} · ${r.route} · ${temporalStatus(r)}`, 'badge'),
      element('strong', r.title),
      element('p', r.description),
      element(
        'p',
        `${r.direction || 'Direction unverified'} · ${r.geometry ? r.precision : 'Location not mapped'}${r.speedLimitMph ? ` · source limit ${r.speedLimitMph} mph` : ''}`,
      ),
    );
    if (r.curationNote) row.append(element('p', r.curationNote, 'fine'));
    if (r.validTo || r.expiresAt)
      row.append(
        element(
          'p',
          `Valid until ${new Date(r.validTo || r.expiresAt).toLocaleString()}`,
        ),
      );
    if (r.milepostBegin != null && r.milepostEnd != null)
      row.append(
        element(
          'p',
          `Highway mileposts ${r.milepostBegin}–${r.milepostEnd}${r.standardSpeedLimitMph ? ` · source standard ${r.standardSpeedLimitMph} mph` : ''}`,
        ),
      );
    if (r.geometry && viewer) {
      const button = element('button', 'View on map');
      button.onclick = () => {
        $('follow').checked = false;
        const p = lines(r.geometry)[0][0];
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            ...p,
            r.precision === 'point' ? 1700 : 15000,
          ),
          duration: 0.5,
        });
        if (innerWidth < 760) window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      row.append(button);
    }
    row.append(sourceLink(r.sourceUrl, 'Source ↗'));
    $('records').append(row);
  }
  $('sources').replaceChildren();
  for (const s of snapshot.sources) {
    const row = element('div', null, 'source');
    const safe = /^https:\/\//.test(s.url || '') && !new URL(s.url).username;
    row.append(safe ? sourceLink(s.url, s.name) : element('strong', s.name));
    row.append(
      element(
        'p',
        `${s.status} · last successful import ${s.lastSuccess ? new Date(s.lastSuccess).toLocaleString() : 'never'} · ${s.count ?? 0} records`,
      ),
      element('p', s.coverage),
    );
    if (s.error) row.append(element('p', `Latest import failed: ${s.error}`));
    $('sources').append(row);
  }
  if (!snapshot.sources.length)
    $('sources').append(
      element(
        'p',
        'No sources imported. Run npm run enforcement:refresh on the server.',
        'fine',
      ),
    );
}
async function refreshInventory() {
  if (refreshingInventory || destroyed) return;
  refreshingInventory = true;
  $('refresh-data').disabled = true;
  $('data-sync').textContent = 'Refreshing database markers…';
  try {
    snapshot = await routeSource.getSnapshot({
      signal: AbortSignal.timeout(15000),
    });
    if (destroyed) return;
    const routeSelect = $('route-filter');
    const selectedRoute = routeSelect.value;
    routeSelect.replaceChildren(new Option('All roads', ''));
    for (const road of [
      ...new Set(snapshot.records.map((record) => record.route)),
    ].sort())
      routeSelect.add(new Option(road, road));
    routeSelect.value = selectedRoute;
    session.setRecords(snapshot.records);
    renderInventory();
    const imports = snapshot.sources
      .map((s) => Date.parse(s.lastSuccess))
      .filter(Number.isFinite);
    const imported = imports.length
      ? new Date(Math.max(...imports)).toLocaleString()
      : 'no successful import';
    const synced = new Date().toLocaleTimeString();
    $('data-sync').textContent =
      `Map synced ${synced}. Latest successful source import: ${imported}. Camera operation unconfirmed.`;
  } catch (e) {
    if (destroyed) return;
    renderInventory(); // Expire observations even when the backend is unavailable.
    $('data-sync').textContent =
      'Refresh failed. Showing previously loaded data; check source dates.';
    message(
      `Camera data unavailable: ${e.message}. Previously loaded locations may be stale.`,
    );
  } finally {
    refreshingInventory = false;
    if (!destroyed) $('refresh-data').disabled = false;
  }
}
$('refresh-data').onclick = refreshInventory;
async function lookup(text) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (match) {
    const point = [Number(match[2]), Number(match[1])];
    if (!coordinate(point))
      throw new Error('Coordinates must be latitude, longitude');
    return point;
  }
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Place search unavailable (HTTP ${response.status})`);
  const result = (await response.json()).results?.[0];
  const location = result?.geometry?.location;
  if (!location || !coordinate([location.lng, location.lat]))
    throw new Error('Place not found. Try latitude, longitude.');
  return [location.lng, location.lat];
}
async function requestRoute(a, b, reroute = false) {
  routing?.abort();
  const request = new AbortController();
  routing = request;
  try {
    const response = await fetch(
      `/api/route?${new URLSearchParams({ profile: 'car', coords: `${a.join(',')};${b.join(',')}`, steps: '1' })}`,
      { signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]) },
    );
    const result = await response.json();
    request.signal.throwIfAborted();
    if (!response.ok || !result.ok)
      throw new Error(result.error || 'Routing service unavailable');
    if (
      !Array.isArray(result.geometry) ||
      result.geometry.length < 2 ||
      !result.geometry.every(coordinate) ||
      !Array.isArray(result.steps) ||
      !result.steps.length ||
      result.stepsTruncated ||
      !Number.isFinite(result.durationS)
    )
      throw new Error(
        'Complete turn instructions unavailable for this route. Try a shorter trip.',
      );
    route = result;
    selectedDestination = b;
    if (reroute) session.setRoute(route);
    drawRoute(!reroute);
    $('start').disabled = session.active;
    $('route-summary').hidden = false;
    $('route-summary').textContent =
      `${miles(route.distanceM)} · about ${Math.round(route.durationS / 60)} min · no live traffic`;
  } finally {
    if (routing === request) routing = null;
  }
}
function drawRoute(frame = true) {
  if (!viewer) return;
  routeMap.entities.removeAll();
  const entity = routeMap.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray(
        route.geometry.flatMap((p) => p.slice(0, 2)),
      ),
      material: Cesium.Color.fromCssColorString('#66c7ff'),
      width: 6,
      clampToGround: true,
    },
  });
  routeMap.entities.add({
    position: Cesium.Cartesian3.fromDegrees(...route.geometry.at(-1)),
    point: {
      pixelSize: 12,
      color: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
    },
  });
  if (frame) viewer.flyTo(entity, { duration: 0.5 });
  viewer.scene.requestRender();
}
function fixFromPosition(position) {
  const c = position.coords;
  return {
    point: [c.longitude, c.latitude],
    accuracy: c.accuracy,
    heading: c.heading,
    speed: c.speed,
    timestamp: position.timestamp,
  };
}
function gpsError(e) {
  return e.code === 1
    ? 'Location permission denied. Enable it in your browser settings, or use replay.'
    : e.code === 2
      ? 'GPS position unavailable. Try again outdoors.'
      : 'GPS timed out. Try again or use replay.';
}
$('locate').onclick = () => {
  if (!navigator.geolocation || !window.isSecureContext)
    return message(
      'GPS requires HTTPS or localhost and a browser with location support.',
    );
  $('locate').disabled = true;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      $('locate').disabled = false;
      lastFix = fixFromPosition(p);
      if (!gpsUsable(lastFix))
        return message('GPS is not accurate enough yet. Try again.');
      gpsOrigin = lastFix.point;
      $('origin').value = 'Current GPS location';
      updateDriver(lastFix);
      message('Starting point set from GPS.');
    },
    (e) => {
      $('locate').disabled = false;
      message(gpsError(e));
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
};
$('origin').oninput = () => {
  gpsOrigin = null;
};
$('route-form').onsubmit = async (e) => {
  e.preventDefault();
  stop();
  const version = planVersion;
  route = null;
  selectedDestination = null;
  routeMap?.entities.removeAll();
  $('route-summary').hidden = true;
  $('plan').disabled = true;
  $('start').disabled = true;
  message('Finding your route…');
  try {
    if (!$('origin').value.trim())
      throw new Error('Enter a starting point or select Use GPS.');
    const a = gpsOrigin || (await lookup($('origin').value.trim()));
    if (version !== planVersion) return;
    const b = await lookup($('destination').value.trim());
    if (version !== planVersion) return;
    await requestRoute(a, b);
    message('Route ready. Start driving for live GPS guidance.');
  } catch (e) {
    if (version === planVersion) message(e.message);
  } finally {
    if (version === planVersion) $('plan').disabled = false;
  }
};
function begin(replay) {
  stop();
  session.start(route, snapshot.records, replay);
  document.body.classList.add('driving');
  $('guidance').hidden = false;
  $('mode-label').textContent = replay
    ? 'REPLAY · SIMULATED GPS'
    : 'LIVE GPS · FOREGROUND';
  $('inventory').open = false;
  $('stop').hidden = false;
  $('start').disabled = true;
  $('replay').disabled = true;
  $('follow').checked = true;
  $('turn-distance').textContent = '—';
  $('turn-text').textContent = 'Waiting for an accurate position';
  $('alert').textContent = '';
  $('speed').textContent = '—';
  keepAwake();
}
$('start').onclick = () => {
  if (!route || route.demo) return;
  if (!navigator.geolocation || !window.isSecureContext)
    return message('Live driving requires HTTPS or localhost and GPS support.');
  begin(false);
  message(
    'GPS tracking started. Guidance pauses when position is weak or this page is hidden.',
  );
  watch = navigator.geolocation.watchPosition(
    (p) => {
      lastFix = fixFromPosition(p);
      if (!document.hidden) session.update(lastFix);
    },
    (e) => {
      stop();
      message(gpsError(e));
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
};
$('replay').onclick = () => {
  if (!route) {
    route = demoTrip();
    drawRoute();
    $('route-summary').hidden = false;
    $('route-summary').textContent =
      'Demo route · synthetic trip for testing, not directions';
  }
  begin(true);
  replayOffset = 0;
  const total = project(route.geometry.at(-1), route.geometry).totalM;
  const tick = () => {
    const point = pointAt(route.geometry, replayOffset),
      ahead = pointAt(route.geometry, Math.min(total, replayOffset + 20));
    session.update({
      point,
      accuracy: 5,
      speed: 22,
      heading: distance(point, ahead) > 1 ? bearing(point, ahead) : null,
      timestamp: Date.now(),
    });
    replayOffset = Math.min(total, replayOffset + 100);
  };
  tick();
  replayTimer = setInterval(tick, 1000);
  message(
    'Replay uses simulated GPS at accelerated speed. Stop before starting a real trip.',
  );
};
$('stop').onclick = () => {
  stop();
  message('Stopped. Location tracking and spoken guidance are off.');
};
$('stop-driving').onclick = $('stop').onclick;
$('recenter').onclick = () => {
  $('follow').checked = true;
  if (session.lastFix) updateDriver(session.lastFix);
};
$('voice').onchange = () => {
  if (!$('voice').checked) window.speechSynthesis?.cancel();
  else speak('Spoken guidance enabled.');
};
if (!('speechSynthesis' in window)) {
  $('voice').disabled = true;
  $('voice').parentElement.title =
    'Speech synthesis is unavailable in this browser';
}
for (const id of [
  'state-filter',
  'route-filter',
  'type-filter',
  'status-filter',
])
  $(id).onchange = renderInventory;
$('report-form').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.currentTarget,
    button = form.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/api/enforcement/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || 'Report submission failed');
    $('report-message').textContent =
      `Submitted for review. Reference: ${result.id}`;
    form.reset();
  } catch (e) {
    $('report-message').textContent = e.message;
  } finally {
    button.disabled = false;
  }
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.speechSynthesis?.cancel();
    wake?.release();
    if (session.active)
      message('Page hidden: guidance and alerts paused until you return.');
  } else {
    keepAwake();
    if (session.active && lastFix && !session.replay) session.update(lastFix);
    refreshInventory();
  }
});
const clock = setInterval(() => {
  if (!document.hidden) session.tick();
}, 1000);
initializeMap();
refreshInventory();
nextRefresh = setInterval(() => {
  if (document.hidden || destroyed) return;
  if ($('auto-refresh').checked) refreshInventory();
  else renderInventory(); // Expired observations disappear even with refresh paused.
}, 60000);
window.addEventListener(
  'pagehide',
  () => {
    destroyed = true;
    stop();
    clearInterval(clock);
    clearInterval(nextRefresh);
    viewer?.destroy();
  },
  { once: true },
);
