import {
  coordinate,
  distance,
  bearing,
  angle,
  lines,
  temporalStatus,
} from '../driving/model.js';
import { normalizeOsrmSteps } from '../data/routeSteps.js';

export function parseCoordinates(text) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!match) return null;
  const point = [Number(match[2]), Number(match[1])];
  return coordinate(point) ? point : null;
}

export function normalizeRoutes(payload) {
  if (
    payload?.code !== 'Ok' ||
    !Array.isArray(payload.routes) ||
    !payload.routes.length
  )
    throw new Error(
      'No driving route was returned. Check the selected endpoints.',
    );
  return payload.routes.slice(0, 3).map((route, index) => {
    const geometry = route.geometry?.coordinates;
    if (
      route.geometry?.type !== 'LineString' ||
      !Array.isArray(geometry) ||
      geometry.length < 2 ||
      geometry.length > 100000 ||
      !geometry.every(coordinate) ||
      !Number.isFinite(route.distance) ||
      route.distance <= 0 ||
      !Number.isFinite(route.duration) ||
      route.duration < 0
    )
      throw new Error('The routing service returned an invalid route.');
    const { steps, truncated } = normalizeOsrmSteps(route);
    return {
      id: index,
      geometry,
      distanceM: route.distance,
      durationS: route.duration,
      steps,
      stepsTruncated: truncated,
      summary:
        route.legs
          ?.map((leg) => leg.summary)
          .filter(Boolean)
          .join(' · ') || `Driving route ${index + 1}`,
    };
  });
}

export function normalizePlaces(payload) {
  if (!Array.isArray(payload))
    throw new Error('Address search returned an invalid response.');
  return payload.slice(0, 5).flatMap((place) => {
    if (
      !['string', 'number'].includes(typeof place.lat) ||
      !['string', 'number'].includes(typeof place.lon) ||
      String(place.lat).trim() === '' ||
      String(place.lon).trim() === ''
    )
      return [];
    const point = [Number(place.lon), Number(place.lat)];
    if (
      !coordinate(point) ||
      typeof place.display_name !== 'string' ||
      (place.address?.country_code && place.address.country_code !== 'us')
    )
      return [];
    return [{ label: place.display_name.slice(0, 500), point }];
  });
}

function overlaps(a, b, pad = 0) {
  return (
    a[0] <= b[2] + pad &&
    a[2] >= b[0] - pad &&
    a[1] <= b[3] + pad &&
    a[3] >= b[1] - pad
  );
}
function box(a, b = a) {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
  ];
}
function pointOnSegment(p, a, b) {
  const scale = Math.cos((p[1] * Math.PI) / 180),
    dx = (b[0] - a[0]) * scale,
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * scale * dx + (p[1] - a[1]) * dy) /
        (dx * dx + dy * dy || 1),
    ),
  );
  const point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return { point, t, crossM: distance(p, point) };
}
function segmentMatch(routeSegment, c, d) {
  const { a, b } = routeSegment;
  const rx = b[0] - a[0],
    ry = b[1] - a[1],
    sx = d[0] - c[0],
    sy = d[1] - c[1];
  const determinant = rx * sy - ry * sx;
  if (Math.abs(determinant) > 1e-15) {
    const qx = c[0] - a[0],
      qy = c[1] - a[1];
    const t = (qx * sy - qy * sx) / determinant,
      u = (qx * ry - qy * rx) / determinant;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
      return { point: [a[0] + t * rx, a[1] + t * ry], t, crossM: 0 };
  }
  const candidates = [
    pointOnSegment(c, a, b),
    pointOnSegment(d, a, b),
    { ...pointOnSegment(a, c, d), point: a, t: 0 },
    { ...pointOnSegment(b, c, d), point: b, t: 1 },
  ];
  return candidates.sort((x, y) => x.crossM - y.crossM)[0];
}
function roadAt(route, offsetM) {
  let start = 0;
  for (const step of route.steps) {
    start += step.distanceM;
    if (offsetM <= start + 10) return step.ref || step.name || '';
  }
  return '';
}
function sameRoad(a, b) {
  const normalize = (s) =>
    String(s)
      .toUpperCase()
      .replace(/INTERSTATE/g, 'I')
      .replace(/[^A-Z0-9]/g, '');
  const name = normalize(a);
  return (
    name &&
    String(b)
      .split(';')
      .some((part) => normalize(part) === name)
  );
}

/** Corridor context, not map matching or a finding of active enforcement. */
export function matchRouteIntelligence(
  records,
  route,
  {
    radiusM = 250,
    includeHistory = false,
    includeOpposite = false,
    now = Date.now(),
  } = {},
) {
  if (!Number.isFinite(radiusM) || radiusM < 25 || radiusM > 1000)
    throw new Error('Unsupported corridor radius');
  const segments = [];
  let along = 0;
  for (let i = 1; i < route.geometry.length; i++) {
    const a = route.geometry[i - 1],
      b = route.geometry[i],
      length = distance(a, b);
    segments.push({
      a,
      b,
      length,
      along,
      box: box(a, b),
      bearing: bearing(a, b),
    });
    along += length;
  }
  const matches = [];
  for (const record of records) {
    const status = temporalStatus(record, now);
    if (
      !includeHistory &&
      ![
        'fixed',
        'active-project',
        'scheduled',
        'observed',
        'upcoming',
      ].includes(status)
    )
      continue;
    if (!record.geometry) continue;
    let best = null;
    for (const part of lines(record.geometry)) {
      const bounds = [
        Math.min(...part.map((p) => p[0])),
        Math.min(...part.map((p) => p[1])),
        Math.max(...part.map((p) => p[0])),
        Math.max(...part.map((p) => p[1])),
      ];
      // Conservative longitude expansion for the US, including Alaska; metric distance gates the result.
      const pad =
        radiusM /
        (111000 *
          Math.max(
            0.12,
            Math.cos((((bounds[1] + bounds[3]) / 2) * Math.PI) / 180),
          ));
      for (const segment of segments) {
        if (!overlaps(segment.box, bounds, pad)) continue;
        for (let j = 0; j < Math.max(1, part.length - 1); j++) {
          const c = part[j],
            d = part[j + 1] || c;
          if (!overlaps(segment.box, box(c, d), pad)) continue;
          const match =
            part.length === 1
              ? pointOnSegment(c, segment.a, segment.b)
              : segmentMatch(segment, c, d);
          if (match.crossM <= radiusM && (!best || match.crossM < best.crossM))
            best = {
              ...match,
              offsetM: segment.along + segment.length * match.t,
              bearing: segment.bearing,
            };
        }
      }
    }
    if (!best) continue;
    const direction = record.travelBearings?.length
      ? record.travelBearings.some((value) => angle(value, best.bearing) <= 65)
        ? 'aligned'
        : 'opposite'
      : 'unknown';
    if (direction === 'opposite' && !includeOpposite) continue;
    const roadConfirmed = sameRoad(record.route, roadAt(route, best.offsetM));
    matches.push({
      record,
      status,
      offsetM: best.offsetM,
      crossM: best.crossM,
      routePoint: best.point,
      direction,
      roadConfirmed,
      matchLabel:
        roadConfirmed && direction === 'aligned' && best.crossM <= 30
          ? 'Road and direction references align'
          : 'Nearby corridor reference — road/lane association unconfirmed',
    });
  }
  return matches.sort(
    (a, b) => a.offsetM - b.offsetM || a.record.id.localeCompare(b.record.id),
  );
}

/** Explicit-request clients only: no autocomplete, telemetry, credentials or trip persistence. */
export function createRouteClient({
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const cache = new Map();
  const routeCachedAt = new Map();
  let nextSearch = 0,
    nextRoute = 0;
  let queue = Promise.resolve();
  async function request(url, signal) {
    const response = await fetchImpl(url, {
      signal,
      credentials: 'omit',
      referrerPolicy: 'origin',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429)
      throw new Error(
        'The public service is rate limited. Wait before trying again.',
      );
    if (!response.ok)
      throw new Error(
        `Public service returned HTTP ${response.status}. Try again later or use coordinates.`,
      );
    return response.json();
  }
  return {
    clear() {
      cache.clear();
      routeCachedAt.clear();
    },
    search(query, { signal } = {}) {
      const text = query.trim();
      if (text.length < 3 || text.length > 200)
        return Promise.reject(
          new Error('Enter a location between 3 and 200 characters.'),
        );
      const key = `place:${text.toLowerCase()}`;
      if (cache.has(key)) return Promise.resolve(cache.get(key));
      const task = queue
        .catch(() => {})
        .then(async () => {
          if (signal?.aborted)
            throw new DOMException('Cancelled', 'AbortError');
          await wait(Math.max(0, nextSearch - now()));
          if (signal?.aborted)
            throw new DOMException('Cancelled', 'AbortError');
          nextSearch = now() + 1100;
          const url = new URL('https://nominatim.openstreetmap.org/search');
          url.search = new URLSearchParams({
            q: text,
            format: 'jsonv2',
            countrycodes: 'us',
            limit: '5',
            addressdetails: '1',
          }).toString();
          const places = normalizePlaces(await request(url.href, signal));
          cache.set(key, places);
          return places;
        });
      queue = task;
      return task;
    },
    async route(origin, destination, { signal } = {}) {
      if (
        !coordinate(origin) ||
        !coordinate(destination) ||
        distance(origin, destination) < 10
      )
        throw new Error('Select two distinct valid endpoints.');
      const key = `route:${origin.join(',')};${destination.join(',')}`;
      if (cache.has(key) && now() - routeCachedAt.get(key) < 600000)
        return cache.get(key);
      if (now() < nextRoute)
        throw new Error('Wait a moment before requesting another route.');
      nextRoute = now() + 1100;
      const coords = [origin, destination]
        .map((point) => point.map((value) => value.toFixed(6)).join(','))
        .join(';');
      const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=true`;
      const routes = normalizeRoutes(await request(url, signal));
      cache.set(key, routes);
      routeCachedAt.set(key, now());
      return routes;
    },
  };
}
