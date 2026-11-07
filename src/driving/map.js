import * as Cesium from 'cesium';
import { lines, temporalStatus, safeUrl, distance, pointAt } from './model.js';
export const statusColors = {
  fixed: '#58d9cc',
  scheduled: '#efbc68',
  'active-project': '#efbc68',
  observed: '#b6a1ff',
  paused: '#94a4b5',
  completed: '#64748b',
  unknown: '#94a4b5',
  stale: '#94a4b5',
  upcoming: '#b6a1ff',
  expired: '#64748b',
};
const escape = (s) =>
  String(s || '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
export function recordDescription(r) {
  const marker = markerDetails(r);
  const sitePoint = r.coordinateMeaning === 'agency-camera-site-marker';
  const pointNote = sitePoint
    ? 'Agency camera-site marker; physical mount position and accuracy are unverified.'
    : 'Mapped position; current camera operation is unconfirmed.';
  const quality = r.equipmentPositionVerified
    ? `Physical-device position verified ${escape(r.lastPhysicalVerificationUTC)}; stated accuracy ${escape(r.positionAccuracyMeters)} m.`
    : 'Physical-device coordinates have not been independently verified.';
  const coordinates =
    r.geometry?.type === 'Point'
      ? `Source latitude/longitude: ${escape(r.geometry.coordinates[1])}, ${escape(r.geometry.coordinates[0])}.`
      : '';
  return `<h3>${escape(r.title)}</h3><p>${escape(r.description)}</p><p>${escape(r.state)} · ${escape(r.route)} · ${escape(r.direction || 'Direction unverified')}</p><p>${escape(temporalStatus(r))} · ${escape(r.precision)} location · ${escape(r.verification)}</p><p>${escape(marker?.label || 'Location unavailable')}. ${r.geometry?.type !== 'Point' ? 'Pin is a reference inside the published zone, not an exact camera position.' : pointNote}</p><p>${coordinates} ${quality} ${escape(r.curationNote || '')}</p><p>Source standard limit: ${r.standardSpeedLimitMph ? `${escape(r.standardSpeedLimitMph)} mph` : 'not supplied'}. Source work-zone / camera limit: ${r.speedLimitMph ? `${escape(r.speedLimitMph)} mph` : 'not supplied'}. Overlapping records may disagree; follow posted signs.</p><p>Published highway mileposts: ${r.milepostBegin != null && r.milepostEnd != null ? `${escape(r.milepostBegin)}–${escape(r.milepostEnd)}` : 'not supplied'}.</p><p>Source retrieved ${escape(r.retrievedAt || 'unknown')}. ${r.observedAt ? `Observed ${escape(r.observedAt)}.` : ''} ${r.validTo ? `Schedule ends ${escape(r.validTo)}.` : ''} ${r.expiresAt ? `Observation expires ${escape(r.expiresAt)}.` : ''}</p><p>Project status does not confirm a camera is enforcing now. These markers are refreshed database records, not live camera telemetry.</p><p><a href="${escape(safeUrl(r.sourceUrl))}" target="_blank" rel="noopener noreferrer">Source evidence</a>${r.sourceImageUrl ? ` · <a href="${escape(safeUrl(r.sourceImageUrl))}" target="_blank" rel="noopener noreferrer">Agency camera view (not a device photo)</a>` : ''}</p><p>${r.sourceViewCount ? `${escape(r.sourceViewCount)} source view(s); this is not a physical device count.` : ''}</p><p>${escape(r.license)}</p><p><a href="/road/sources/?location=${encodeURIComponent(r.id)}" target="_blank" rel="noopener noreferrer">All sources &amp; provenance</a></p>`;
}
/** A zone pin is a reference on its longest mapped piece, never a guessed camera position. */
export function markerDetails(r, now = Date.now()) {
  if (!r.geometry) return null;
  const length = (part) =>
    part.slice(1).reduce((m, p, i) => m + distance(part[i], p), 0);
  const part = [...lines(r.geometry)].sort((a, b) => length(b) - length(a))[0];
  if (!part?.length) return null;
  const status = temporalStatus(r, now);
  const observed = status === 'observed';
  const workZone = r.type === 'work-zone';
  const monitor = r.type === 'monitoring';
  const toll = r.type === 'toll';
  const label = observed
    ? 'Recent observation; not live telemetry'
    : workZone
      ? 'Published work-zone reference'
      : monitor
        ? r.coordinateMeaning === 'agency-camera-site-marker'
          ? 'Agency camera-site point; mount accuracy unverified'
          : 'Traffic-monitoring location'
        : toll
          ? 'Toll-reader location'
          : 'Mapped enforcement-camera location';
  return {
    point: part.length === 1 ? part[0] : pointAt(part, length(part) / 2),
    label,
    symbol: workZone ? 'W' : monitor ? 'T' : toll ? '$' : 'C',
    triangle: workZone,
    color: statusColors[status] || '#94a4b5',
  };
}
function markerImage(marker) {
  const shape = marker.triangle
    ? `<path d="M18 2L35 32H1Z" fill="${marker.color}" stroke="#10202e" stroke-width="2"/>`
    : `<circle cx="18" cy="18" r="16" fill="${marker.color}" stroke="#10202e" stroke-width="2"/>`;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">${shape}<text x="18" y="${marker.triangle ? 27 : 24}" text-anchor="middle" font-family="sans-serif" font-size="19" font-weight="bold" fill="#10202e">${marker.symbol}</text></svg>`)}`;
}
export function drawEnforcement(dataSource, records) {
  dataSource.entities.removeAll();
  for (const r of records) {
    if (!r.geometry) continue;
    const color = Cesium.Color.fromCssColorString(
      statusColors[temporalStatus(r)] || '#94a4b5',
    );
    lines(r.geometry).forEach((part, index) => {
      const common = {
        id: `enforcement:${r.id}:${index}`,
        name: r.title,
        description: recordDescription(r),
        properties: { recordId: r.id },
      };
      if (part.length > 1)
        dataSource.entities.add({
          ...common,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(
              part.flatMap((p) => p.slice(0, 2)),
            ),
            width: 6,
            material: color.withAlpha(0.9),
            clampToGround: true,
          },
        });
    });
    const marker = markerDetails(r);
    dataSource.entities.add({
      id: `enforcement:${r.id}:marker`,
      name: `${marker.label} · ${r.title}`,
      description: recordDescription(r),
      properties: { recordId: r.id, markerMeaning: marker.label },
      position: Cesium.Cartesian3.fromDegrees(...marker.point.slice(0, 2)),
      billboard: {
        image: markerImage(marker),
        width: 32,
        height: 32,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Infinity,
      },
    });
  }
}
