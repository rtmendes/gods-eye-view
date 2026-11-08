# National road intelligence

Open `/road/` for the coverage atlas, hardware observation simulator and equipment references. `/road/fines/` is a separate responsive, shareable speeding-penalty explorer. `/equipment/` preserves the curated Harlem–Tyrone camera-site map. `/drive/` remains the foreground GPS/routing application served by the Node/Vite backend.

## This release

- Canonical identity for 50 states and DC. Enforcement imports and moderated reports accept interstate, US, state and local road names. National support is distinct from data coverage.
- Equipment coverage still comprises the existing NY/PA corridor snapshot: 306 project/site records, including 49 monitoring-site points, and zero independently verified physical device positions. No new national equipment inventory is implied.
- 28 current reviewed speeding rules across 17 jurisdictions. The remaining 34 jurisdictions, and missing programs within reviewed states, return “Not estimated.” See `curation/laws/README.md` for source decisions and exclusions.
- Camera eligibility confirmations, worker presence, warning conditions and severe-offense checks affect results. Estimates expose base/cap basis and excluded fees. They are not ticket totals or legal determinations.
- Share links carry only the entered state/date/speed/context/history scenario. Camera eligibility confirmations, GPS tracks and device information are not shared.
- A portable hardware event contract and local simulator. No real Uniden/Escort adapter is connected, no undocumented protocols are used, and no vendor database has been copied or licensed.
- Source commercial-rights evaluation and affiliate disclosure/stationary-context policy. No affiliate offers, checkout, tracking pixels, subscription billing or active revenue are configured.

## Data and publication

`src/driving/jurisdictions.js` is the canonical state list. `scripts/enforcement/generate-coverage.mjs` derives a small national coverage summary from the bundled snapshot; rerun it after exporting new equipment data. `npm run road:audit` validates current rules and reports legal review gaps, equipment verification and commercial source clearance. `src/road/quality.js` distinguishes physical verification from source site markers and requires explicit evidence before commercial source clearance.

The hosted Site is a static companion: atlas, fine comparisons, simulation and curated map. The hosted `/road/route/` planner supports explicit address searches, coordinates, a single GPS starting fix, route alternatives and source-linked corridor references. Foreground GPS driving and the SQLite reports service stay in the backend application. Hosted Site publication does not create a mobile app or background navigation service.

## Hardware integration contract

Manufacturer Bluetooth advertising or app support is not an integration license or an accessible API. Before enabling an adapter, obtain the documented interface and required rights, validate against the real device, and record supported firmware/platform versions. Test disconnects, reconnects, permissions, duplicates, expiry and foreground/background behavior.

`normalizeHardwareEvent` permits only radar/laser signal observations and speed-sign observations. Events expire within 60 seconds, are unpublishable, and omit location/serial identifiers. A radar event never establishes an equipment coordinate, device type or active enforcement. A sign observation does not replace a posted road speed without reviewed road association and validity context. The UI simulator expires its observation after 20 seconds and retains nothing.

## Monetization rollout

Equipment links are currently ordinary manufacturer references. Configure real affiliate relationships only after approval by the relevant merchant, and include an explicit disclosure on each offer. `approvedOffer` rejects missing disclosures and unsafe links; `commercialVisible` rejects driving, moving, or unknown movement contexts. The simulator's parked checkbox is an explicit research-page attestation, not automatic motion detection. A production mobile integration must use actual driving session/motion state and fail closed when it is unknown.

Confidence, map rank, penalty calculation and alert selection must never depend on commissions. Do not sell precise trip history. Commercial source reuse requires documented rights, not merely an accessible endpoint. Premium offline packages, a native mobile app, fleets, billing, agency licensing agreements and live hardware adapters remain separate rollout work.

## Validation

`npm run test:driving` covers navigation plus national normalization, legal scope and arithmetic, stale rules, hardware expiry/privacy and commerce policy. `npm run qa:road` checks state navigation, eligibility, conditions, unknowns and mobile layout in Chromium. Run the repository build, formatter, boundary checks and unit suite before publication.

## Priority cohort

The initial rollout prioritizes Atlantic coastal states ME/NH/MA/RI/CT/NY/NJ/DE/MD/VA/NC/SC/GA/FL, plus DC, Texas, California, and the retained Pennsylvania corridor. 17 of these 18 jurisdictions have at least one reviewed monetary rule; NJ still requires current monetary schedule verification. This is not full program/charge coverage within those states.

The default atlas tiles show these 18; the filter can expose all states. Road classification is a scenario input where a statute differentiates interstates/limited-access roads. Texas work-zone doubling also requires confirming the citation’s worker-presence notation. Candidate agency portals are research links only. The equipment inventory remains unchanged: no new physical device coordinates or live deployments are implied by legal coverage.

## Nationwide source directory

`/road/sources/` exposes the full registered source directory for all 50 states and DC. It includes 524 source entries/500 distinct URLs: federal/state/regional traveler-information listings, court and legislative research portals, all existing legal references and inventory sources, plus clearly labeled community/partnership resources. HTTP observations do not change content verification, import status or commercial rights.

Every one of the 306 published inventory records has a source-provenance deep link. The 17 curated review candidates and one quarantined mismatch are opt-in, never promoted to published map equipment. Related state resources are background and are not treated as additional coordinate evidence. See `curation/sources/README.md` for counts, link-check limitations and update commands.

The source index refreshes when the local enforcement refresh script publishes the snapshot, or the CLI exports to the canonical snapshot path. The static Site still requires a build and deployment to expose those changes. No nationwide equipment import, private source access, source subscription, commercial license or additional verified device position was created by registering the sources.

## Dynamic route planner

Enter a starting point and destination at `/road/route/`, use Find and select the intended places, then generate a driving route. Coordinates use latitude, longitude. Alternatives appear only when returned by the service. Step directions are planning instructions; this page does not provide continuous GPS guidance or automatic rerouting.

Explicit address searches go to public Nominatim, route endpoints to the FOSSGIS OSRM car service, and basemap requests to OpenStreetMap. No API key is required. These public services have usage limits and no availability guarantee; production scale needs a compliant hosted provider or self-hosting. Searches are serialized and cached in page memory; trips are not stored in URLs, local storage or an account. Clear trip erases this cache.

Travel times exclude live traffic. Route matching uses the same-origin published inventory, with 100/250/500 m corridor filters, source direction and date status. Opposite-direction and historical records are excluded by default. Nearby references do not establish lane association, device activation or precise equipment mounting. Source limits and highway mileposts remain distinct from trip distance. Missing records mean unknown coverage. Refresh reloads the published snapshot, not upstream agency feeds.

Validation: `npm run qa:route` exercises endpoint selection, alternatives, direction/history filters, snapshot refresh, mobile layout, service failures and cancellation against controlled fixtures. `src/driving/routing-planner.test.mjs` checks matching and public-service clients.

## Project requirements and operations

See the [road-intelligence documentation index](road-intelligence/README.md) for the PRD, technical specification, SOP, official data-access checklist, application drafts and access tracker. These distinguish implemented capabilities from planned Google/agency integrations and do not claim live enforcement activation.
