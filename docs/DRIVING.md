# Highway map and foreground driving

Open **Drive** in the globe toolbar, or visit `/drive/`. This feature uses no
paid API and does not require a Google, TomTom or OpenAI key. It uses the
existing OSRM route proxy, device GPS and device speech synthesis. The existing
globe gains an **I-80 / I-95 Enforcement** layer using the same database.

### Map markers and refresh

The first equipment curation adds 49 agency-published monitoring-camera site
points for the Harlem–Tyrone corridor (7 NYC DOT, 42 511PA). They are not
independently verified physical camera mounts and are not treated as citation
cameras. Use the `Harlem–Tyrone corridor` filter or monitoring type filter to
view them. Popups preserve their source coordinates, coordinate meaning, unknown
physical accuracy, evidence and agency camera-view links when supplied.
Seventeen ambiguous candidates and one coordinate/description conflict remain
outside the app imports. See [the curation audit](../curation/harlem-tyrone/README.md).
This point inventory is a dated curation; source ingestion and map refresh are
separate, and the hourly work-zone importer does not refresh these catalogs.

The map and globe refresh their database markers every minute while enabled.
Drive also has **Refresh markers** and an automatic-refresh toggle. The map-sync
time and latest successful source-import time are displayed separately: polling
the database does not turn a weekly schedule into live camera telemetry. Use the
hourly importer below to keep upstream publications current.

- **W / triangle:** a reference point on a published work-zone segment. The
  underlying segment remains visible. This pin is not an exact camera position.
- **C / circle:** a mapped enforcement-camera position when actual point
  geometry is available.
- **T / circle:** traffic monitoring; it does not generate violation alerts.
- **Purple:** a recent, reviewed observation. Its observation and expiry times
  appear in the popup. Expired observations disappear from the current view.

Popups include source speeds, highway mileposts when supplied, travel direction,
retrieval and observation dates, and evidence links. Locations without geometry
remain in the inventory with no guessed pin. The published sources currently do
not establish continuous live camera positions or whether a camera is operating.

## Run

Use the supported Node version in package.json (Node 24.14+ or 26), then:

```sh
npm ci
npm run enforcement:refresh
npm run dev
```

Visit `http://localhost:4173/drive/`. `npm run build` also builds `dist/drive/`;
`npm run preview` serves it with the same routing and enforcement middleware.
This is a server application: uploading only `dist/` to static hosting does not
provide routing, geocoding, reports or the database API. Persist `.gev-data/`
on the server. Existing deployment authentication and access controls still apply.

The committed snapshot is a dated starting inventory, seeded into SQLite on first
use. Refresh the database before relying on its dates. No refresh service is
silently installed. Run this alongside the app under your process supervisor:

```sh
npm run enforcement:watch
```

The watcher imports once at startup and hourly thereafter, without overlapping
runs. Individual source failures retain previous records and appear in Sources
& coverage. It retries next hour. NY publishes weekly schedules; hourly polling
does not make them live observations. `pdftotext` (Poppler) must be on PATH for
NY PDF imports (`brew install poppler` or your Linux package manager). A missing
executable is recorded as an import failure. PA import does not need Poppler.

Optional community import and a distributable snapshot:

```sh
npm run enforcement:refresh -- --osm
npm run enforcement:refresh -- --publish
```

`--publish` writes only curated records/source status to
`public/enforcement/snapshot.json`; it never publishes reports or raw imports.
Review data licenses before redistributing exports. OSM data carries ODbL 1.0
attribution and applicable database obligations, independently of the code's MIT
license. Official publications retain their respective terms.

## Driving

1. Enter a start and destination, or use **Use GPS** for the start. Inputs also
   accept `latitude, longitude`. Search occurs only when the form is submitted,
   not on each keystroke.
2. Preview the route and choose **Start driving**. Enable **Spoken guidance** if
   wanted. The map follows your position; **Recenter map** restores following.
3. **End trip** or **Stop** releases the GPS watcher, screen wake lock and speech.

GPS requires HTTPS or localhost. A phone visiting a computer's plain HTTP LAN IP
usually cannot use GPS; serve it through an HTTPS origin. Keep the page visible:
background and lock-screen guidance are not supported. Position must be no more
than 15 seconds old and have reported accuracy of 50 m or better. Weak GPS pauses
turn instructions and enforcement alerts. A sustained off-route position causes
rerouting, with a 20-second cooldown and no concurrent route requests. Arrival
releases location tracking. Wake lock is best effort and may be refused.

**Try replay** simulates GPS along the planned route at accelerated speed. Without
a route it loads a clearly marked synthetic demo trip, never a published camera
record. Replay never reroutes and cannot be started as a real trip. The inventory
always remains actual imported data. It is possible for a replay to have no camera
alerts because no verified matching records exist on that route.

Alerts require a fresh, currently applicable record with geometry, a known travel
direction, a matching interstate reference in the OSRM route, and a matching road
position within 25 m. Toll and monitoring equipment never produces violation
alerts. Each record alerts once per trip. These conservative checks can miss
cameras with missing metadata. Project alerts say **potential work-zone enforcement**;
they do not assert a mobile camera is operating. Source speed limits are shown in
record details; they are not assumed to replace temporary posted limits.

## Data coverage

Initial scope is I-80 in NJ/PA and I-95 in NY/NJ/PA, including only records
explicitly attributed to those routes. It is not a full three-state inventory.
Local streets, adjacent arterials and other interstate numbers are excluded.

| Source                   | Acquisition                                                                                  | Meaning / coverage limits                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PennDOT WZSSC            | Public location GraphQL and public GIS dynamic-layer geometry, paginated                     | Active, paused and completed projects; potentially enforcing areas, not live positions. Missing GIS geometry remains unmapped. IDs or exact location codes join records; no address-based guessed pins. |
| NYSDOT                   | Deployment PDF discovered from the official program page, extracted with `pdftotext -layout` | Dated planned work zones. No guessed point locations; unlocated rows remain in the list. The program page can change and its parser fails closed if dated corridor rows cannot be read.                 |
| OpenStreetMap (optional) | One bounded interstate-way query per state                                                   | Only speed-camera nodes belonging to an I-80/I-95 way. Unknown directions remain visible but do not alert. Not a complete camera inventory.                                                             |
| Reviewed reports         | Local moderation CLI                                                                         | Maintainer-supplied evidence and explicit status/dates; public reports are never auto-published.                                                                                                        |

The initial November 6, 2026 import contains 257 PA corridor project records:
38 active, 71 paused, 148 completed. Published geometry matched 121 records,
including 8 active projects. The current NYSDOT weekly PDF contains zero I-95
entries. These counts describe the import, not the number of cameras present.
The optional OSM requests returned HTTP 406 in the implementation environment;
that source contributed no records and its failure is visible.

NYSTA/Thruway, MTA, NYS Bridge Authority and Port Authority schedules are **not
covered by the NYSDOT importer**. New Jersey's former red-light pilot is not used
as a current inventory. No verified NJ records were imported in the initial run.
No source establishes comprehensive real-time coverage. An empty result does not
establish that a highway has no enforcement.

Each record preserves source URL, retrieval time, state, route, enforcement
type, status, direction, geometry precision, applicable dates and evidence class.
Mobile observations require an expiry. Records over seven days since retrieval
are labelled stale and do not alert. Successful source refreshes mark disappeared
entries unknown instead of silently deleting their history. Import failures do
not replace accepted records. SQLite transactions keep updates atomic.

## Reports and curation

The browser report form sends only explicitly entered fields and returns a review
reference. It does not attach GPS, plate images or identifying information.
Pending reports are excluded from all public snapshots. Submissions require
same-origin JSON and are limited to 8 KiB and five per client per minute. There
is no remotely accessible approval endpoint.

Review on the server:

```sh
npm run enforcement:manage -- reports
npm run enforcement:manage -- approve REPORT_ID reviewed-record.json
npm run enforcement:manage -- reject REPORT_ID
npm run enforcement:manage -- export /tmp/enforcement.json
```

Approval requires a complete normalized record, not the submitted free text.
Example `reviewed-record.json` (illustrative coordinates; replace with verified
evidence before importing):

```json
{
  "id": "reviewed:your-stable-id",
  "sourceId": "reviewed",
  "state": "PA",
  "route": "I-80",
  "type": "work-zone",
  "status": "observed",
  "title": "Verified location description",
  "description": "Evidence, direction and highway association reviewed by maintainer",
  "geometry": { "type": "Point", "coordinates": [-75, 41] },
  "precision": "point",
  "travelBearings": [90],
  "direction": "EASTBOUND",
  "sourceUrl": "https://example.org/replace-with-real-evidence",
  "retrievedAt": "2026-11-06T12:00:00Z",
  "observedAt": "2026-11-06T12:00:00Z",
  "expiresAt": "2026-11-06T18:00:00Z",
  "verification": "reviewed"
}
```

`enforcement:manage import file.json` accepts `{ "source": { "id": "…", "name":
"…", "url": "https://…" }, "records": [...] }` for separately curated sources.
Keep distinct approach IDs at one intersection. Correct actual geometry and road
attribution rather than merging all nearby pins. SQLite retains superseded
records in `history` and raw source snapshots remain under `.gev-data/imports/`.
Back up the SQLite database using SQLite's backup facilities or with the app and
watcher stopped; include WAL files when copying a running database.

## Costs, hosting and privacy

- Device GPS/speech and this code have no per-use API charge. No new paid account
  is required. Live traffic, traffic-aware ETA, background navigation, offline
  map downloads and CarPlay/Android Auto are not implemented.
- The default OSRM service and OSM standard tiles are for a small personal
  prototype subject to their published policies, not unlimited production
  infrastructure. Tile caching remains browser-managed; there is no bulk download,
  offline prefetch or service-worker tile cache. Attribution stays visible.
- For more users, configure `GEV_ROUTING_CAR_URL` to a self-hosted OSRM service
  (base URL, e.g. `http://localhost:5000`) and set `VITE_DRIVE_TILE_URL` plus
  `VITE_DRIVE_TILE_CREDIT` for a permitted raster tile service. Vite variables need
  a rebuild. Hosting your own open-source services consumes compute and bandwidth.
- GPS stays in browser memory and is not persisted as trip history. Route
  calculations send start/destination coordinates to the routing service; place
  search sends entered text to the geocoding service; map tile requests reveal
  the viewed region to the tile provider. The backend and those providers may
  have normal access logs. Use replay to test without location permission.
- `GEV_ENFORCEMENT_DB` selects a persistent SQLite path. The default
  `.gev-data/` is ignored by git and denied by Vite's filesystem server. Do not
  place private database/raw import files in `public/`.

## Verification

```sh
npm run test:driving
npm test
npm run check:boundaries
npm run build
```

Driving tests cover weak/stale GPS, sustained off-route fixes, reroute cooldown,
arrival and stop, opposite approaches, adjacent roads, unknown road refs, expired
evidence, long zones, speech deduplication, atomic imports, report moderation,
source parsing and same-origin/body-size API limits. Replay and mocked GPS browser
checks are useful before any field testing; they do not establish road-tested
navigation reliability.
