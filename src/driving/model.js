/** Shared, dependency-free navigation and enforcement policy. Coordinates are [lon, lat]. */
export const STATES = ['NY', 'NJ', 'PA'];
export const ROUTES = ['I-80', 'I-95'];
export const STATUSES = [
  'fixed',
  'scheduled',
  'active-project',
  'observed',
  'paused',
  'completed',
  'unknown',
];
export const TYPES = [
  'speed',
  'red-light',
  'speed-and-red-light',
  'work-zone',
  'bus-lane',
  'toll',
  'monitoring',
];
const rad = Math.PI / 180;
export function coordinate(p) {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    p.slice(0, 2).every(Number.isFinite) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90
  );
}
export function distance(a, b) {
  const x =
    Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 +
    Math.cos(a[1] * rad) *
      Math.cos(b[1] * rad) *
      Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}
export function bearing(a, b) {
  const d = (b[0] - a[0]) * rad;
  return (
    (Math.atan2(
      Math.sin(d) * Math.cos(b[1] * rad),
      Math.cos(a[1] * rad) * Math.sin(b[1] * rad) -
        Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(d),
    ) /
      rad +
      360) %
    360
  );
}
export function angle(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}
export function lines(geometry) {
  if (geometry?.type === 'Point') return [[geometry.coordinates]];
  if (geometry?.type === 'LineString') return [geometry.coordinates];
  if (geometry?.type === 'MultiLineString') return geometry.coordinates;
  return [];
}
export function validGeometry(geometry) {
  const parts = lines(geometry);
  return (
    parts.length > 0 &&
    parts.length < 100 &&
    parts.every(
      (p) =>
        p.length >= (geometry.type === 'Point' ? 1 : 2) &&
        p.length <= 20000 &&
        p.every(coordinate),
    )
  );
}
export function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function normalizeRecord(r) {
  if (
    !r ||
    !/^[a-zA-Z0-9:._-]{1,160}$/.test(r.id || '') ||
    !STATES.includes(r.state) ||
    !ROUTES.includes(r.route) ||
    !TYPES.includes(r.type) ||
    !STATUSES.includes(r.status)
  )
    throw new Error('Invalid enforcement identity, corridor, type or status');
  if (!/^[a-zA-Z0-9:._-]{1,80}$/.test(r.sourceId || ''))
    throw new Error('Invalid source identity');
  if (r.geometry != null && !validGeometry(r.geometry))
    throw new Error('Invalid enforcement geometry');
  if (!safeUrl(r.sourceUrl))
    throw new Error('An HTTPS evidence source is required');
  for (const key of [
    'validFrom',
    'validTo',
    'observedAt',
    'expiresAt',
    'retrievedAt',
  ])
    if (r[key] != null && !Number.isFinite(Date.parse(r[key])))
      throw new Error(`Invalid ${key}`);
  if (
    r.validFrom &&
    r.validTo &&
    Date.parse(r.validFrom) > Date.parse(r.validTo)
  )
    throw new Error('Invalid date range');
  if (r.status === 'observed' && (!r.observedAt || !r.expiresAt))
    throw new Error('Observations require observation and expiry times');
  if (
    r.status === 'observed' &&
    (Date.parse(r.expiresAt) <= Date.parse(r.observedAt) ||
      Date.parse(r.expiresAt) - Date.parse(r.observedAt) > 86400000)
  )
    throw new Error(
      'Observation expiry must be within 24 hours of observation',
    );
  if (r.status === 'scheduled' && (!r.validFrom || !r.validTo))
    throw new Error('Scheduled deployments require start and end times');
  const text = (s, n = 1000) =>
    String(s || '')
      .replace(/[\x00-\x1f]/g, ' ')
      .trim()
      .slice(0, n);
  return {
    id: r.id,
    state: r.state,
    route: r.route,
    type: r.type,
    status: r.status,
    title: text(r.title, 200),
    description: text(r.description),
    geometry: r.geometry || null,
    precision: ['point', 'segment', 'unlocated'].includes(r.precision)
      ? r.precision
      : 'unlocated',
    travelBearings: Array.isArray(r.travelBearings)
      ? r.travelBearings
          .filter((n) => Number.isFinite(n) && n >= 0 && n < 360)
          .slice(0, 4)
      : [],
    direction: text(r.direction, 60),
    speedLimitMph:
      Number.isFinite(r.speedLimitMph) &&
      r.speedLimitMph > 0 &&
      r.speedLimitMph <= 85
        ? r.speedLimitMph
        : null,
    sourceId: text(r.sourceId, 80),
    sourceUrl: safeUrl(r.sourceUrl),
    license: text(r.license, 300),
    validFrom: r.validFrom || null,
    validTo: r.validTo || null,
    observedAt: r.observedAt || null,
    expiresAt: r.expiresAt || null,
    retrievedAt: r.retrievedAt || null,
    verification: ['official', 'community', 'reviewed'].includes(r.verification)
      ? r.verification
      : 'community',
  };
}
export function temporalStatus(r, now = Date.now()) {
  if (r.expiresAt && Date.parse(r.expiresAt) < now) return 'expired';
  if (r.validTo && Date.parse(r.validTo) < now) return 'expired';
  if (r.validFrom && Date.parse(r.validFrom) > now) return 'upcoming';
  if (!r.retrievedAt || now - Date.parse(r.retrievedAt) > 7 * 86400000)
    return 'stale';
  return r.status;
}
/** Project onto route segments in local metric space; hint bounds ambiguous loop matching. */
export function project(point, path, { hintM = null } = {}) {
  let along = 0,
    best = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = distance(a, b);
    const k = Math.cos(point[1] * rad),
      dx = (b[0] - a[0]) * k,
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - a[0]) * k * dx + (point[1] - a[1]) * dy) /
          (dx * dx + dy * dy || 1),
      ),
    );
    const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const offsetM = along + t * length,
      crossM = distance(point, p);
    if (
      (hintM == null || (offsetM >= hintM - 100 && offsetM <= hintM + 2500)) &&
      (!best || crossM < best.crossM)
    )
      best = {
        point: p,
        offsetM,
        crossM,
        bearing: bearing(a, b),
        segment: i - 1,
      };
    along += length;
  }
  return best && { ...best, totalM: along };
}
export function pointAt(path, targetM) {
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const length = distance(path[i - 1], path[i]);
    if (walked + length >= targetM) {
      const t = Math.max(0, Math.min(1, (targetM - walked) / (length || 1)));
      return path[i - 1].map((v, j) => v + t * (path[i][j] - v));
    }
    walked += length;
  }
  return path.at(-1);
}
export function gpsUsable(fix, now = Date.now()) {
  return (
    coordinate(fix?.point) &&
    Number.isFinite(fix.accuracy) &&
    fix.accuracy >= 0 &&
    fix.accuracy <= 50 &&
    Number.isFinite(fix.timestamp) &&
    now - fix.timestamp <= 15000 &&
    now - fix.timestamp >= -5000
  );
}
export function maneuverProgress(route, matched) {
  let offset = 0;
  for (let i = 0; i < route.steps.length; i++) {
    if (i > 0 && offset > matched.offsetM + 15)
      return {
        step: route.steps[i],
        index: i,
        distanceM: offset - matched.offsetM,
      };
    offset += route.steps[i].distanceM;
  }
  return {
    step: route.steps.at(-1),
    index: route.steps.length - 1,
    distanceM: Math.max(0, matched.totalM - matched.offsetM),
  };
}
/** Match explicit road refs at the route offset; never infer a highway from proximity alone. */
export function routeRefAt(route, offsetM) {
  let start = 0;
  for (const step of route.steps || []) {
    const end = start + step.distanceM;
    if (offsetM <= end)
      return /\bI[ -]?(80|95)\b/i.exec(step.ref || '')?.[1]
        ? `I-${/\bI[ -]?(80|95)\b/i.exec(step.ref)[1]}`
        : null;
    start = end;
  }
  return null;
}
/** Compute road/direction matches once per route or source refresh, not on every GPS fix. */
export function indexEnforcement(records, route) {
  return records.flatMap((r) => {
    if (
      ['toll', 'monitoring'].includes(r.type) ||
      !r.geometry ||
      !r.travelBearings.length
    )
      return [];
    const offsets = [];
    const accept = (m) => {
      if (
        m &&
        m.crossM <= 25 &&
        routeRefAt(route, m.offsetM) === r.route &&
        r.travelBearings.some((b) => angle(b, m.bearing) <= 65)
      )
        offsets.push(m.offsetM);
    };
    for (const part of lines(r.geometry)) {
      if (part.length === 1) {
        accept(project(part[0], route.geometry));
        continue;
      }
      // A bounding box removes unrelated route vertices before the metric projection.
      const xs = part.map((p) => p[0]),
        ys = part.map((p) => p[1]);
      const box = [
        Math.min(...xs) - 0.001,
        Math.min(...ys) - 0.001,
        Math.max(...xs) + 0.001,
        Math.max(...ys) + 0.001,
      ];
      let along = 0;
      for (let i = 0; i < route.geometry.length; i++) {
        const p = route.geometry[i];
        if (i) along += distance(route.geometry[i - 1], p);
        if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3])
          continue;
        const zone = project(p, part);
        const direction =
          i + 1 < route.geometry.length
            ? bearing(p, route.geometry[i + 1])
            : bearing(route.geometry[i - 1], p);
        if (zone?.crossM <= 25)
          accept({ offsetM: along, crossM: zone.crossM, bearing: direction });
      }
      accept(project(part[0], route.geometry));
      accept(project(part.at(-1), route.geometry));
    }
    return offsets.length
      ? [
          {
            record: r,
            startM: Math.min(...offsets),
            endM: Math.max(...offsets),
          },
        ]
      : [];
  });
}
export function upcomingEnforcement(
  records,
  route,
  matched,
  now = Date.now(),
  index = indexEnforcement(records, route),
) {
  return index
    .flatMap(({ record, startM, endM }) => {
      const status = temporalStatus(record, now);
      if (
        !['fixed', 'scheduled', 'active-project', 'observed'].includes(
          status,
        ) ||
        endM < matched.offsetM - 30
      )
        return [];
      const distanceM = Math.max(0, startM - matched.offsetM);
      return distanceM <= 1600 ? [{ record, distanceM, status }] : [];
    })
    .sort((a, b) => a.distanceM - b.distanceM);
}
export function miles(m) {
  return m < 160
    ? `${Math.round((m * 3.28084) / 50) * 50} ft`
    : `${(m / 1609.344).toFixed(1)} mi`;
}
