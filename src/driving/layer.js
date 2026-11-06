import * as Cesium from 'cesium';
import { drawEnforcement } from './map.js';
import { temporalStatus } from './model.js';
export function createEnforcementLayer({ source }) {
  let viewer,
    data,
    enabled = false,
    request,
    lastUpdate,
    error,
    count = 0;
  return {
    id: 'corridor-enforcement',
    name: 'I-80 / I-95 Enforcement',
    icon: '🚗',
    source: 'NYSDOT · PennDOT · reviewed reports',
    updateInterval: 60000,
    init(v) {
      viewer = v;
      data = new Cesium.CustomDataSource('corridor-enforcement');
      data.show = false;
      viewer.dataSources.add(data);
    },
    enable() {
      enabled = true;
      data.show = true;
    },
    disable() {
      enabled = false;
      request?.abort();
      data.show = false;
      viewer.scene.requestRender();
    },
    async update() {
      if (!enabled) return;
      request?.abort();
      const pending = new AbortController();
      request = pending;
      try {
        const snapshot = await source.getSnapshot({ signal: pending.signal });
        if (pending.signal.aborted || !enabled) return;
        drawEnforcement(
          data,
          snapshot.records.filter(
            (r) =>
              !['completed', 'paused', 'expired', 'unknown'].includes(
                temporalStatus(r),
              ),
          ),
        );
        count = snapshot.records.length;
        lastUpdate = Date.now();
        error = null;
        viewer.scene.requestRender();
      } catch (e) {
        if (!pending.signal.aborted) error = e.message;
      }
    },
    getStats() {
      return {
        count,
        lastUpdate,
        error,
        loadingLabel:
          'NY/NJ/PA highway inventory · includes historical records; open Drive for source health and filters',
      };
    },
    getRowControls() {
      return {
        chips: [
          {
            id: 'drive',
            label: 'OPEN DRIVE',
            onClick() {
              window.location.assign('/drive/');
            },
          },
        ],
        legend: [
          {
            color: '#efbc68',
            label: 'Work-zone areas',
            blurb:
              'Scheduled or potentially active; exact enforcement is not confirmed.',
          },
        ],
      };
    },
    destroy() {
      request?.abort();
      if (viewer && data) viewer.dataSources.remove(data, true);
      viewer = null;
      data = null;
    },
  };
}
