import { createHash } from 'node:crypto';
import { normalizeRecord, coordinate } from '../../src/driving/model.js';

export const NY_PAGE =
  'https://www.ny.gov/work-zone-safety-awareness/automated-work-zone-speed-enforcement-program';
export const PA_PAGE = 'https://workzonecameras.penndot.gov/locations/';
const heading = {
  NORTHBOUND: 0,
  EASTBOUND: 90,
  SOUTHBOUND: 180,
  WESTBOUND: 270,
};
export function normalizePa(rows, features, now) {
  const geometries = new Map(
    features.map((f) => [String(f.properties?.OBJECTID ?? f.id), f.geometry]),
  );
  const byCode = new Map(
    features
      .filter((f) => f.properties?.LOCATION_CODE)
      .map((f) => [f.properties.LOCATION_CODE, f.geometry]),
  );
  return rows
    .filter(
      (r) =>
        ['0080', '0095'].includes(r.stateRouteNumber) &&
        ['ACTIVE', 'PAUSED', 'COMPLETED', 'WINTER'].includes(r.status),
    )
    .map((r) =>
      normalizeRecord({
        id: `pa:${r.objectId}`,
        sourceId: 'pa-wzssc',
        state: 'PA',
        route: `I-${Number(r.stateRouteNumber)}`,
        type: 'work-zone',
        status: {
          ACTIVE: 'active-project',
          PAUSED: 'paused',
          WINTER: 'paused',
          COMPLETED: 'completed',
        }[r.status],
        title: `${r.locationCode} · ${r.countyName}`,
        description: r.description,
        geometry:
          geometries.get(String(r.objectId)) ||
          byCode.get(r.locationCode) ||
          null,
        precision:
          geometries.has(String(r.objectId)) || byCode.has(r.locationCode)
            ? 'segment'
            : 'unlocated',
        direction: r.direction,
        travelBearings:
          heading[r.direction] == null ? [] : [heading[r.direction]],
        speedLimitMph: r.workZoneSpeedLimit,
        standardSpeedLimitMph: r.standardSpeedLimit,
        milepostBegin: r.milepostBegin,
        milepostEnd: r.milepostEnd,
        retrievedAt: now,
        verification: 'official',
        sourceUrl: PA_PAGE,
        license:
          'PennDOT public location data; provider terms apply. Project area, not an exact live camera position.',
      }),
    );
}
function nyDate(s, end = false) {
  const [m, d, y] = s.split('/').map(Number);
  // Eastern local date boundaries, including DST transitions, without an extra dependency.
  const tentative = Date.UTC(
    y,
    m - 1,
    d,
    end ? 23 : 0,
    end ? 59 : 0,
    end ? 59 : 0,
  );
  const localHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(tentative)),
  );
  const utcHour = new Date(tentative).getUTCHours();
  const offsetHours = (utcHour - localHour + 24) % 24;
  return new Date(
    tentative + offsetHours * 3600000 + (end ? 999 : 0),
  ).toISOString();
}
export function normalizeNy(text, pdfUrl, now) {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => /^\s*\d{1,2}\/\d{1,2}\/\d{4}/.test(l));
  if (!lines.length || !/Start Date\s+End Date/.test(text))
    throw new Error(
      'NY schedule format changed: no dated rows; retaining prior data',
    );
  return lines.flatMap((line) => {
    const match =
      /^\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(IN_0?(?:80|95))\s+(.+?)\s*$/.exec(
        line,
      );
    if (!match) {
      if (/\bIN_0?(80|95)\b/.test(line))
        throw new Error('Unparsed corridor row in NY schedule');
      return [];
    }
    const [, start, end, county, route, description] = match;
    return [
      normalizeRecord({
        id: `ny:${createHash('sha256').update(`${county}|${route}|${description}`).digest('hex').slice(0, 20)}`,
        sourceId: 'ny-dot',
        state: 'NY',
        route: `I-${Number(route.split('_')[1])}`,
        type: 'work-zone',
        status: 'scheduled',
        title: `${county} · ${description}`,
        description,
        geometry: null,
        precision: 'unlocated',
        direction: '',
        travelBearings: [],
        validFrom: nyDate(start),
        validTo: nyDate(end, true),
        retrievedAt: now,
        sourceUrl: pdfUrl,
        verification: 'official',
        license:
          'NYSDOT public schedule; exact positioning varies. NYSTA, MTA and other operators are not covered by this source.',
      }),
    ];
  });
}
/** Only cameras explicitly belonging to an interstate way qualify; proximity is insufficient. */
export function normalizeOsm(payload, state, now) {
  if (!Array.isArray(payload.elements) || payload.remark)
    throw new Error('Incomplete OSM response');
  const ways = payload.elements.filter(
    (e) => e.type === 'way' && /^I (80|95)$/.test(e.tags?.ref),
  );
  return payload.elements
    .filter(
      (e) =>
        e.type === 'node' &&
        e.tags?.highway === 'speed_camera' &&
        coordinate([e.lon, e.lat]),
    )
    .flatMap((n) => {
      const way = ways.find((w) => w.nodes?.includes(n.id));
      if (!way) return [];
      const dir = n.tags['direction'] || '';
      const b = /^[0-9]+(?:\.[0-9]+)?$/.test(dir)
        ? Number(dir)
        : { N: 0, E: 90, S: 180, W: 270 }[dir];
      return [
        normalizeRecord({
          id: `osm:${state}:${n.id}`,
          sourceId: `osm-${state}`,
          state,
          route: way.tags.ref.replace(' ', '-'),
          type: 'speed',
          status: 'fixed',
          title: n.tags.name || 'OSM mapped speed camera',
          description:
            'Community mapping; physical presence and current enforcement require verification.',
          geometry: { type: 'Point', coordinates: [n.lon, n.lat] },
          precision: 'point',
          direction: dir,
          travelBearings: Number.isFinite(b) ? [b] : [],
          retrievedAt: now,
          sourceUrl: `https://www.openstreetmap.org/node/${n.id}`,
          verification: 'community',
          license: '© OpenStreetMap contributors · ODbL 1.0',
        }),
      ];
    });
}
