import * as Cesium from 'cesium';
import { lines, temporalStatus, safeUrl } from './model.js';
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
  return `<h3>${escape(r.title)}</h3><p>${escape(r.description)}</p><p>${escape(r.state)} · ${escape(r.route)} · ${escape(r.direction || 'Direction unverified')}</p><p>${escape(temporalStatus(r))} · ${escape(r.precision)} location · ${escape(r.verification)}</p><p>Retrieved ${escape(r.retrievedAt || 'unknown')}. ${r.validTo ? `Schedule ends ${escape(r.validTo)}.` : ''} ${r.expiresAt ? `Observation expires ${escape(r.expiresAt)}.` : ''}</p><p>Project status does not confirm a camera is enforcing now.</p><p><a href="${escape(safeUrl(r.sourceUrl))}" target="_blank" rel="noopener noreferrer">Source evidence</a></p><p>${escape(r.license)}</p>`;
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
      if (part.length === 1)
        dataSource.entities.add({
          ...common,
          position: Cesium.Cartesian3.fromDegrees(...part[0]),
          point: {
            pixelSize: 12,
            color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      else
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
  }
}
