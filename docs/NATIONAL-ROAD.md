# National road intelligence

Open `/road/` for the coverage atlas, hardware observation simulator and equipment references. `/road/fines/` is a separate responsive, shareable speeding-penalty explorer. `/equipment/` preserves the curated Harlem–Tyrone camera-site map. `/drive/` remains the foreground GPS/routing application served by the Node/Vite backend.

## This release

- Canonical identity for 50 states and DC. Enforcement imports and moderated reports accept interstate, US, state and local road names. National support is distinct from data coverage.
- Equipment coverage still comprises the existing NY/PA corridor snapshot: 306 project/site records, including 49 monitoring-site points, and zero independently verified physical device positions. No new national equipment inventory is implied.
- Nine current reviewed speeding rules across NY, PA, MD, VA and CA. The remaining 46 jurisdictions, and missing programs within reviewed states, return “Not estimated.” See `curation/laws/README.md` for source decisions and exclusions.
- Camera eligibility confirmations, worker presence, warning conditions and severe-offense checks affect results. Estimates expose base/cap basis and excluded fees. They are not ticket totals or legal determinations.
- Share links carry only the entered state/date/speed/context/history scenario. Camera eligibility confirmations, GPS tracks and device information are not shared.
- A portable hardware event contract and local simulator. No real Uniden/Escort adapter is connected, no undocumented protocols are used, and no vendor database has been copied or licensed.
- Source commercial-rights evaluation and affiliate disclosure/stationary-context policy. No affiliate offers, checkout, tracking pixels, subscription billing or active revenue are configured.

## Data and publication

`src/driving/jurisdictions.js` is the canonical state list. `scripts/enforcement/generate-coverage.mjs` derives a small national coverage summary from the bundled snapshot; rerun it after exporting new equipment data. `npm run road:audit` validates current rules and reports legal review gaps, equipment verification and commercial source clearance. `src/road/quality.js` distinguishes physical verification from source site markers and requires explicit evidence before commercial source clearance.

The hosted Site is a static companion: atlas, fine comparisons, simulation and curated map. Live route requests, GPS driving and the SQLite reports service stay in the backend application. Hosted Site publication does not create a mobile app or background navigation service.

## Hardware integration contract

Manufacturer Bluetooth advertising or app support is not an integration license or an accessible API. Before enabling an adapter, obtain the documented interface and required rights, validate against the real device, and record supported firmware/platform versions. Test disconnects, reconnects, permissions, duplicates, expiry and foreground/background behavior.

`normalizeHardwareEvent` permits only radar/laser signal observations and speed-sign observations. Events expire within 60 seconds, are unpublishable, and omit location/serial identifiers. A radar event never establishes an equipment coordinate, device type or active enforcement. A sign observation does not replace a posted road speed without reviewed road association and validity context. The UI simulator expires its observation after 20 seconds and retains nothing.

## Monetization rollout

Equipment links are currently ordinary manufacturer references. Configure real affiliate relationships only after approval by the relevant merchant, and include an explicit disclosure on each offer. `approvedOffer` rejects missing disclosures and unsafe links; `commercialVisible` rejects driving, moving, or unknown movement contexts. The simulator's parked checkbox is an explicit research-page attestation, not automatic motion detection. A production mobile integration must use actual driving session/motion state and fail closed when it is unknown.

Confidence, map rank, penalty calculation and alert selection must never depend on commissions. Do not sell precise trip history. Commercial source reuse requires documented rights, not merely an accessible endpoint. Premium offline packages, a native mobile app, fleets, billing, agency licensing agreements and live hardware adapters remain separate rollout work.

## Validation

`npm run test:driving` covers navigation plus national normalization, legal scope and arithmetic, stale rules, hardware expiry/privacy and commerce policy. `npm run qa:road` checks state navigation, eligibility, conditions, unknowns and mobile layout in Chromium. Run the repository build, formatter, boundary checks and unit suite before publication.
