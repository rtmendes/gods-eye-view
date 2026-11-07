# Nationwide source registry and location provenance

The registry covers all 50 states and DC. It contains 524 **source entries** representing 500 distinct URLs, including 269 outgoing links extracted from the 51 FHWA state traffic-directory pages. Entries can share a provider or URL because they have different roles. This is not an exhaustive inventory of every municipality, camera, legal authority or data provider.

## What's included

- Federal state traffic directories and their statewide/regional/city travel, roadwork, weather and camera resources. The current root directory is <https://highways.dot.gov/traffic-info>. All 51 state pages were retrieved on November 7, 2026. The provider's own publication/update date is preserved where available.
- Traveler-information research portals, legislative portals and court research portals for every jurisdiction. Root portals are research leads; they do not establish an API, current fine or device location.
- All existing legal source references, including sources supporting reviewed penalty rules, camera-policy context and unresolved holds.
- All existing inventory source definitions, with import counts and status. Three sources currently contribute published records. Configured-empty and failed imports remain visible.
- USDOT WZDx, community camera-mapping documentation and Waze partnership information, with their limitations. No Waze/private feed access or commercial agreement is claimed.
- A provenance index for all 306 published project/site records plus the curated 17 review candidates and one quarantined mismatch. Private crowd reports and rejected ticket/plate datasets are excluded.

## Separate claims

1. `status` describes the source's role/import state. A directory, discovered portal, reviewed reference or restricted partnership is not an ingested feed.
2. `contentReview` describes the limited content work actually done. Extracting directory links does not verify their destination content.
3. `observedHttpStatus`, `lastCheckMethod`, `lastCheckedAt` and `accessObservation` describe a point-in-time HTTP observation. A 200 HEAD response does not prove the page contains a usable API; a timeout/403 does not prove it is private or nonexistent.
4. `commercialReuse` remains `not-cleared`. A public link does not grant commercial redistribution rights.
5. Location evidence retains the original record's `sourceUrl`, source ID and site ID. Related state directories/legal references are background, not additional proof of physical equipment coordinates.

All 500 distinct URLs received an observation in this pass: 51 FHWA state-page GETs plus 449 distinct destination checks. 413 returned a successful HTTP response; 87 had unsuccessful responses or unconfirmed access. Those outcomes are preserved without silently removing the links or pretending the sources were ingested. Some legacy HTTP directory links were retained as unverified HTTPS candidates and explicitly labeled in their notes.

## Maintain

- `npm run sources:index` rebuilds the index from the published enforcement snapshot and the curated review ledger. It never reads private report queues. Exporting to `public/enforcement/snapshot.json` through the management CLI, or using the refresh script with `--publish`, also refreshes this index.
- `npm run sources:check` performs bounded public HTTP checks with the inherited proxy and CA trust. It preserves separate import/content/rights states; it does not log in, create accounts, accept terms, buy subscriptions or import equipment.
- Add a newly discovered provider with jurisdiction, category, evidence URL, provenance and limitations. Do not change it to `ingested` until actual records were imported and checked.
- Rebuild and republish the static companion after updates. The hosted source page is a snapshot, not a live link or device-status monitor.

The registry JSON is the canonical curated artifact. Original FHWA page captures and bounded collection scripts are retained in the task workspace at `/workspace/source-curation`; raw pages are not published. The `directoryEvidence` links make the federal listings independently reviewable.
