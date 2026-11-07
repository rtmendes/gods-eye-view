import { mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { refreshSourceIndex } from '../../server/enforcement/source-index.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { openStore } from '../../server/enforcement/store.js';
import {
  normalizePa,
  normalizeNy,
  normalizeOsm,
  NY_PAGE,
  PA_PAGE,
} from './adapters.mjs';

// CLI only: no browser-triggered crawling or arbitrary URL proxy. Failures preserve accepted data.
const store = openStore();
const now = new Date().toISOString();
const rawDir = new URL('../../.gev-data/imports/', import.meta.url);
await mkdir(rawDir, { recursive: true });
async function fetchText(url, max = 16 * 1024 * 1024, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(45000),
    headers: {
      'User-Agent':
        'gods-eye-view-corridors/1.0 (+https://github.com/rtmendes/gods-eye-view)',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Source HTTP ${res.status}`);
  let size = 0;
  const chunks = [];
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > max) throw new Error('Source exceeds import size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function json(url) {
  return JSON.parse((await fetchText(url)).toString());
}
async function importSource(source, load) {
  try {
    const { records, raw, ...metadata } = await load();
    await writeFile(
      new URL(`${source.id}-${now.replace(/[:.]/g, '-')}.json`, rawDir),
      JSON.stringify(raw),
    );
    store.importSource(
      {
        ...source,
        ...metadata,
        lastSuccess: now,
        lastAttempt: now,
        status: 'available',
        count: records.length,
      },
      records,
    );
    console.log(`${source.id}: ${records.length} records`);
  } catch (e) {
    store.sourceFailure({ ...source, error: e.message });
    console.error(`${source.id}: ${e.message}; previous data retained`);
    process.exitCode = 1;
  }
}
try {
  await importSource(
    {
      id: 'pa-wzssc',
      name: 'PennDOT work-zone projects',
      url: PA_PAGE,
      coverage:
        'PA I-80/I-95 project areas; active does not mean enforcing now',
    },
    async () => {
      const base = 'https://gis.penndot.pa.gov/wzssc/api/';
      const settings = await json(`${base}public-app-settings`);
      if (
        new URL(settings.mapServerUrl).hostname !== 'gis.penndot.pa.gov' ||
        !/^[A-Z0-9_.]+$/.test(settings.locationsDataSourceName)
      )
        throw new Error('Unexpected PennDOT GIS configuration');
      const query =
        'query { locations { objectId locationCode status countyName stateRouteNumber direction description standardSpeedLimit workZoneSpeedLimit milepostBegin milepostEnd } }';
      const rows = await json(
        `${base}graphql?${new URLSearchParams({ query })}`,
      );
      if (rows.errors || !rows.data?.locations?.length)
        throw new Error('Invalid PennDOT location response');
      const layer = {
        id: 0,
        source: {
          type: 'dataLayer',
          dataSource: {
            type: 'table',
            workspaceId: 'MapcoreWorkspace',
            dataSourceName: settings.locationsDataSourceName,
            oidFields: 'objectid',
          },
        },
      };
      const features = [];
      // ArcGIS transfer limits must not silently turn a partial response into full coverage.
      for (let offset = 0; offset < 20000; offset += 500) {
        const params = new URLSearchParams({
          layer: JSON.stringify(layer),
          where: '1=1',
          outFields: 'OBJECTID,LOCATION_CODE',
          outSR: '4326',
          f: 'geojson',
          resultOffset: String(offset),
          resultRecordCount: '500',
          orderByFields: 'OBJECTID',
        });
        const page = await json(
          `${settings.mapServerUrl}/dynamicLayer/query?${params}`,
        );
        if (!Array.isArray(page.features) || page.error)
          throw new Error('Invalid PennDOT geometry response');
        features.push(...page.features);
        if (
          page.features.length < 500 &&
          !page.exceededTransferLimit &&
          !page.properties?.exceededTransferLimit
        )
          break;
        if (offset === 19500)
          throw new Error('PennDOT pagination cap exceeded');
      }
      const records = normalizePa(rows.data.locations, features, now);
      if (!records.length)
        throw new Error('Unexpected empty PennDOT corridor inventory');
      return { records, raw: { rows: rows.data.locations, features } };
    },
  );
  await importSource(
    {
      id: 'ny-dot',
      name: 'NYSDOT deployment schedule',
      url: NY_PAGE,
      coverage:
        'NYSDOT scheduled I-95 work zones only; excludes separate operator schedules. No listed deployment does not mean no cameras.',
    },
    async () => {
      const html = (await fetchText(NY_PAGE)).toString();
      const candidates = [
        ...html.matchAll(/href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi),
      ].filter((m) => /deployment|schedule|AWZSE/i.test(m[0]));
      if (!candidates.length)
        throw new Error('NY deployment PDF link not found');
      const pdfUrl = new URL(candidates[0][1], NY_PAGE);
      if (pdfUrl.hostname !== 'www.ny.gov' || pdfUrl.protocol !== 'https:')
        throw new Error('Unexpected NY PDF host');
      const temp = await mkdtemp(join(tmpdir(), 'gev-ny-'));
      try {
        await writeFile(join(temp, 'schedule.pdf'), await fetchText(pdfUrl));
        execFileSync(
          'pdftotext',
          ['-layout', join(temp, 'schedule.pdf'), join(temp, 'schedule.txt')],
          { timeout: 20000 },
        );
        const text = await readFile(join(temp, 'schedule.txt'), 'utf8');
        return {
          records: normalizeNy(text, pdfUrl.href, now),
          raw: { pdfUrl: pdfUrl.href, text },
          scheduleUrl: pdfUrl.href,
        };
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
    },
  );
  if (process.argv.includes('--osm'))
    for (const state of ['NY', 'NJ', 'PA']) {
      await importSource(
        {
          id: `osm-${state}`,
          name: `OpenStreetMap ${state}`,
          url: 'https://www.openstreetmap.org/copyright',
          coverage:
            'Only speed cameras explicitly mapped on I-80/I-95 ways; incomplete community inventory',
        },
        async () => {
          const query = `[out:json][timeout:40];area["ISO3166-2"="US-${state}"][admin_level=4]->.s;way(area.s)[ref~"^I (80|95)$"]->.roads;node(w.roads)[highway=speed_camera];out body;.roads out body;`;
          const raw = JSON.parse(
            (
              await fetchText(
                'https://overpass-api.de/api/interpreter',
                undefined,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({ data: query }),
                },
              )
            ).toString(),
          );
          return { raw, records: normalizeOsm(raw, state, now) };
        },
      );
    }
  if (process.argv.includes('--publish')) {
    const snapshot = store.snapshot();
    await writeFile(
      new URL('../../public/enforcement/snapshot.json', import.meta.url),
      JSON.stringify(snapshot) + '\n',
    );
    refreshSourceIndex(snapshot);
  }
} finally {
  store.close();
}
