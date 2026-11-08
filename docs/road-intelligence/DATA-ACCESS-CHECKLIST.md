# Data-access checklist and official application links

Research reviewed November 8, 2026. This is an actionable discovery/application list, **not an assertion that accounts, approvals or API keys exist**. “Verified documentation” means the referenced content was retrieved; it does not mean a request was submitted or accepted. State portals below are linked official starting points; where no developer form was verified, the task is to ask the agency for the correct process rather than invent a signup URL.

Read [application drafts](APPLICATION-TEMPLATES.md) before submitting. Track ownership/status in [access-tracker.csv](access-tracker.csv). The national [source registry](../../curation/sources/registry.json) contains further links for all 50 states and DC; this checklist covers the requested priority cohort and shared platforms, not every city/vendor in America.

## 1. What access is actually needed?

| Data/product                                   | Intended provider                                        | Needed now?                          | What it cannot establish                                                        |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| Congestion visualization and traffic-aware ETA | Google Maps/Routes (owner has account, setup unverified) | Yes, selected next integration       | Enforcement-camera positions/activation                                         |
| Monitoring-camera site metadata/stills/video   | State 511/DOT and municipal owners                       | Yes, provider-by-provider            | Citation enforcement or precise mount accuracy by default                       |
| Roadwork/incidents and temporary limits        | Agency feeds/WZDx                                        | Yes                                  | Current deployment of a specific speed camera                                   |
| Enforcement locations and deployment schedules | Agency enforcement programs/city open data               | Yes                                  | An online/offline operating switch unless explicitly published                  |
| Confirmed activation telemetry                 | Actual enforcement operator/agency                       | Conditional; availability unverified | Cannot be manufactured from schedule, CCTV, crowd silence or radar observations |
| Radar/laser hardware signals                   | Documented manufacturer SDK/authorized partnership       | Later, optional                      | Exact remote equipment position or legal speed limit                            |
| Community enrichment                           | OSM; other licenses individually reviewed                | Optional                             | Complete current government verification                                        |

Apply only to providers needed for the selected feature/geography. Existing public downloads usually do not need an application. Avoid signing up for every competing commercial platform.

## 2. Common packet and free-access questions

- [ ] Legal name and contact email; actual entity/project website and private pilot/demo link. Do not publish private correspondence in this repository.
- [ ] One-paragraph road-safety/public-interest objective, target roads/states, expected pilot users, requested fields and access duration.
- [ ] Current use: prototype/research/pilot if true. Disclose planned public display and possible affiliate/commercial use; ask for separate future clearance where needed.
- [ ] Real affiliation evidence only if applicable: current enrollment, advisor/project letter, institutional research letter, publication/editor assignment or published reporting.
- [ ] For an independent project, request the ordinary free public/developer tier first. Do not claim student, nonprofit, accredited-media or university status without evidence.
- [ ] Ask for API documentation/sample payload, coordinate reference system, device IDs, road/direction/lanes/mileposts and source timestamps/timezones.
- [ ] Ask what camera “status” means: stream health, project phase, scheduled deployment or actual enforcement operation.
- [ ] Ask for API rate limits, shared-account limits, stream concurrency, image cadence, caching/retention, allowed derived outputs and refresh guidance.
- [ ] Ask if access is genuinely no-charge, whether card/billing/egress is required, and whether research/media discounts or waivers exist for this use. Do not assume a fee waiver.
- [ ] Obtain attribution requirements, public embedding/redistribution rights and affiliate/commercial-use terms. Note expiry, revocation and renewal requirements.
- [ ] Record approval date and nonsecret scope; install keys privately only after permissions are understood. No secrets in tracker or GitHub.

## 3. First applications and public datasets

### A. Google Maps Platform — congestion and routing

Links: [Cloud Console](https://console.cloud.google.com/) · [Maps JavaScript setup](https://developers.google.com/maps/documentation/javascript/get-api-key) · [Routes setup](https://developers.google.com/maps/documentation/routes/get-api-key) · [Traffic layer](https://developers.google.com/maps/documentation/javascript/trafficlayer) · [Pricing](https://mapsplatform.google.com/pricing/) · [Routes policies](https://developers.google.com/maps/documentation/routes/policies).

Status: owner reports an account. No project/API/key/billing setup verified. Standard Maps use is metered with product-specific allowances; do not promise free nationwide operation or a researcher/student entitlement.

- [ ] Select/create the correct project; record project ID (not key) privately in deployment configuration.
- [ ] Review current SKU pricing/free allowances and link billing only with owner authorization.
- [ ] Enable Maps JavaScript API and Routes API. Keep other APIs off until needed; existing address search can remain initially.
- [ ] Create a browser map key restricted to `https://harlem-tyrone-equipment-map.mahara77.chatgpt.site/*` and Maps JavaScript API.
- [ ] Configure separate secret-bearing routing access in the chosen backend architecture; apply appropriate API/application restrictions. Do not place unrestricted/server keys in frontend code.
- [ ] Set budget alerts and available request quotas. **Alerts are not a hard spending cap.** Add application request budgets before public traffic.
- [ ] Review Google map-display/storage restrictions before combining routes/traffic with current Leaflet/OSRM rendering.
- [ ] Verify one low-volume authorized request, implement integration, timestamps, attribution and baseline fallback. Enabling APIs does not itself change the app.

### B. PennDOT / 511PA — first agency application

Links: [Access policy and free feeds](https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds) · [Official request form](https://paiedprod.powerappsportals.us/DataFeedRequestForm/) · [API documentation](https://www.pa.gov/agencies/penndot/programs-and-doing-business/online-services/developer-resources-documentation-api) · [Camera viewer](https://www.511pa.com/cctv) · [Terms PDF](https://www.pa.gov/content/dam/copapwp-pagov/en/penndot/documents/programs-and-doing-business/onlineservices/511pa_developers_corner-tcs.pdf).

Verified: feeds are free of charge and may serve the public, commercial vendors, researchers and media. Streaming requires the Non-Exclusive Video Sharing License Agreement; bandwidth is the user's expense. PennDOT acknowledgment is required. None of this proves real-time enforcement activation is supplied.

- [ ] Open request form and provide actual applicant/entity/contact/project purpose; complete whatever additional fields the live form requests (not all fields were independently verified).
- [ ] Request RCRS incidents/roadwork/conditions and camera metadata/stills; request streaming separately if actually needed.
- [ ] Start with I-80/I-95 corridor and a low-volume pilot; ask whether measured traffic flow is available and who licenses it.
- [ ] Obtain credentials, documentation, permitted polling/cache rules and attribution guidance after approval.
- [ ] Review/sign video agreement through the actual authorized applicant; confirm permitted public playback, concurrency, recording and affiliate use before embedding.
- [ ] Use [PA-specific draft](APPLICATION-TEMPLATES.md#penndot-request) and store approval privately. Submission is pending.

### C. New York / 511NY and NYC

Links: [511NY](https://511ny.org/) · [NYSDOT](https://www.dot.ny.gov/) · [NYC DOT data feeds](https://www.nyc.gov/html/dot/html/about/datafeeds.shtml) · [NYC traffic speeds dataset](https://data.cityofnewyork.us/Transportation/DOT-Traffic-Speeds/i4gi-tjb9) · [NY deployment program/schedules](https://www.ny.gov/work-zone-safety-awareness/automated-work-zone-speed-enforcement-program) · [Thruway traveler information](https://www.thruway.ny.gov/travelers/).

Verified limitation: `https://511ny.org/developers/doc` currently returned the new public home page, not developer instructions. Do not rely on a legacy signup flow or third-party claim of free access. NYC public dataset availability does not guarantee recent observations, correct units/timezones or camera activation.

- [ ] Through current 511NY/NYSDOT contact/help navigation, ask for the replacement developer/data-sharing process and camera content agreement.
- [ ] Request official IDs, coordinates/accuracy, views, imagery URLs and timestamps, incidents/roadwork, coverage and terms. Confirm whether the app may embed or must link out.
- [ ] Ask explicitly which third-party congestion/Waze/video fields can be redistributed; viewer access alone is insufficient.
- [ ] Separately inspect NYC open-data metadata/API, cadence, units, clock/timezone and missing/invalid sensor codes before any live speed ingestion. Public speed data has not been connected to the planner.
- [ ] Keep NYSDOT schedule, Thruway, MTA, bridge-authority and Port Authority coverage distinct; existing NYSDOT PDF import does not cover all these operators.
- [ ] Ask for actual operating-status telemetry availability; otherwise retain scheduled/unknown. NY says final mobile placement is chosen the morning of deployment and times/locations may change.

### D. New Jersey / 511NJ and shared NY/NJ crossings

Links: [511NJ](https://511nj.org/) · [NJDOT](https://www.nj.gov/transportation/) · [Port Authority advisories](https://www.panynj.gov/alerts-advisories/advisories.html).

Verified: public 511NJ page exposes camera/travel-time information. A public developer application, API fee policy and rebroadcast permission were **not** verified. A camera page/login redirect does not establish that an ordinary My511 account grants bulk data rights.

- [ ] Use NJDOT/511NJ current Contact/Help navigation to ask who grants developer feeds and camera rebroadcast rights; request the proper application URL.
- [ ] Request I-80/I-95/NJ Turnpike/Garden State Parkway scope, owning agencies, stable camera IDs, site geometry and imagery time/availability.
- [ ] Ask whether regional TRANSCOM/other provider agreements are required for travel times; do not copy client tokens/private endpoints.
- [ ] Obtain written no-charge pilot/access terms and public-display/commercial conditions; use general draft, not a fabricated student/media claim.
- [ ] Ask Port Authority separately about shared crossings. No verified NJ equipment records or confirmed activation feed have been imported.

### E. Caltrans / California — public metadata first

Links: [CWWP2 camera documentation and district downloads](https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm) · [Conditions of use](https://dot.ca.gov/conditions-of-use) · [QuickMap viewer](https://quickmap.dot.ca.gov/) · [511 SF Bay Open Data](https://511.org/open-data) · [511 SF Bay traffic data](https://511.org/open-data/traffic).

Verified: Caltrans offers camera location/status files in JSON/CSV/XML/TXT at no charge, by district, subject to conditions of use. File updates are “as necessary,” not guaranteed live activation. Caltrans says video/still images are not retained/archived. SF Bay 511 separately offers free token-based data with required attribution.

- [ ] Read Caltrans conditions and per-field definitions; select pilot districts from the documentation rather than guessing statewide API URLs.
- [ ] Validate site/status/time fields and permitted image/stream display; camera availability is not enforcement state.
- [ ] Record district coverage, update semantics and source attribution. No camera metadata import for CA is claimed yet.
- [ ] If Bay Area traffic data is needed, use token-request navigation on the official 511 Open Data page; review its terms, quotas, camera scope and attribution separately. No token requested.
- [ ] Contact individual city enforcement programs separately; Caltrans monitoring data is not a statewide speed/red-light enforcement registry.

### F. USDOT WZDx / Connected Work Zones — shared work-zone discovery

Links: [USDOT WZDx overview](https://www.transportation.gov/av/data/wzdx) · [Feed registry](https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Exchange-WZDx-Feed-Registry/69qe-yiui) · [Specification](https://github.com/usdot-jpo-ode/wzdx) · [Connected Work Zones standardization](https://www.ite.org/technical-resources/standards/cwz/).

Verified: USDOT points to a feed registry and notes transition to formal standards. WZDx 4.2 is the last version under the prior working-group governance. This is work-zone information, not a national enforcement activation service.

- [ ] Discover actual state producer feed URLs in the registry and verify format/version/current operation.
- [ ] Review each producer's terms, cadence, permissions and coverage. A registry listing is not a universal access license.
- [ ] Ask producers for geometry/direction/temporary-speed field semantics where provided; preserve missing values.
- [ ] Reuse open feeds where permitted; apply only where the producer requires credentials. Do not request a closed historical demonstration grant as an access mechanism.

## 4. Remaining priority-state application subchecklists

The linked portals are official research leads, not blanket confirmation of free APIs. For each row, the listed steps are pending. Use the common packet and request template, and update the tracker after receiving a real response. Camera and flow rights can differ from event-data rights.

| State | Official starting points                                                                                                 | Specific next steps / open questions                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ME    | [New England 511](https://newengland511.org/), [Maine Turnpike](https://www.maineturnpike.com/)                          | [ ] Ask New England 511 for Maine developer feed terms; [ ] separate MaineDOT from turnpike cameras; [ ] ask if Waze-sourced fields are excluded from reuse                                                                                               |
| NH    | [New England 511](https://newengland511.org/), [NHDOT](https://www.dot.nh.gov/)                                          | [ ] Request NHDOT data-sharing contact; [ ] verify camera/event availability and state ownership; [ ] confirm free pilot and redistribution scope                                                                                                         |
| MA    | [Mass511](https://mass511.com/), [MassDOT](https://www.mass.gov/orgs/massachusetts-department-of-transportation)         | [ ] Ask current developer/camera access route; [ ] confirm whether vendor congestion can be reused; [ ] old guessed MassDOT developer URL returned 404, so use current agency navigation                                                                  |
| RI    | [RIDOT traffic cameras](https://www.dot.ri.gov/travel/cameras/), [RIDOT](https://www.dot.ri.gov/)                        | [ ] Ask for camera metadata/imagery permission and refresh limits; [ ] identify incident/feed contact; [ ] seek enforcement data separately from city operators                                                                                           |
| CT    | [CTroads developer docs](https://www.ctroads.org/developers/doc), [registration](https://www.ctroads.org/my511/register) | [ ] Register actual user, then request developer key; [ ] respect documented 10 calls/60 seconds; [ ] current docs list message signs/events/advisories, so request camera/flow availability separately; [ ] fee/commercial terms need confirmation       |
| DE    | [DelDOT map](https://deldot.gov/map/), [DelDOT](https://deldot.gov/)                                                     | [ ] Request documented event/camera feed and approved access route; [ ] ask coordinate/imagery cadence and attribution; [ ] confirm fees/public embedding rather than scrape viewer endpoints                                                             |
| MD    | [CHART](https://chart.maryland.gov/), [Maryland DOT](https://www.mdot.maryland.gov/)                                     | [ ] Ask CHART for public data/video sharing process; [ ] distinguish operational cameras from local speed/red-light programs; [ ] confirm bandwidth and public/commercial use                                                                             |
| DC    | [DDOT](https://ddot.dc.gov/), [DC Open Data](https://opendata.dc.gov/)                                                   | [ ] Find agency-owned camera/enforcement location datasets; [ ] validate current program operator and metadata; [ ] request live operational evidence only if actually available; [ ] confirm reuse terms                                                 |
| VA    | [Current Virginia 511](https://511.vdot.virginia.gov/), [VDOT](https://www.vdot.virginia.gov/)                           | [ ] Request current data/camera-sharing process; [ ] distinguish third-party flow layer rights; [ ] use new portal (legacy 511Virginia redirects), confirm free pilot terms                                                                               |
| NC    | [DriveNC](https://www.drivenc.gov/), [NCDOT](https://www.ncdot.gov/)                                                     | [ ] Ask for developer access to events/cameras and permitted flow reuse; [ ] request active source timestamps and roadway IDs; [ ] confirm terms/fees before public video display                                                                         |
| SC    | [SC511](https://sc511.com/), [SCDOT](https://www.scdot.org/)                                                             | [ ] Verify current portal via SCDOT; [ ] request camera/event data-sharing contact; [ ] SC511 retrieval had a TLS error in this review—do not disable certificate validation or call it nonexistent; [ ] confirm terms/costs                              |
| GA    | [511GA developer docs](https://511ga.org/developers/doc), [registration](https://511ga.org/my511/register)               | [ ] Register then request key; [ ] respect 10 calls/60 seconds; [ ] documented cameras/events/signs/alerts available; [ ] confirm still/video display, fee and commercial terms; [ ] traffic flow is not established by listed resources                  |
| FL    | [FL511](https://fl511.com/), [FDOT](https://www.fdot.gov/)                                                               | [ ] Ask for current developer/feed process and video-sharing requirements; [ ] `fl511.com/developers/doc` returned no usable documentation in this review; [ ] verify flow ownership, access cost and attribution                                         |
| TX    | [DriveTexas](https://drivetexas.org/), [TxDOT](https://www.txdot.gov/), [Texas Open Data](https://data.texas.gov/)       | [ ] Identify current TxDOT incident/work-zone datasets and district camera owners; [ ] request API/video/public-display terms; [ ] verify regional provider rights and free access; [ ] a public viewer/catalog is not a statewide enforcement-camera API |

PA/NY/NJ/CA are covered in the detailed sections above. ME/NH share a regional platform but need state scope confirmation. This totals the 18 priority jurisdictions including DC and PA.

## 5. Optional platforms and requests

- [ ] **OpenStreetMap:** [camera tag documentation](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dspeed_camera), [copyright/license](https://www.openstreetmap.org/copyright), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [tile policy](https://operations.osmfoundation.org/policies/tiles/). No membership application is needed to read public documentation. Review database/attribution and service limits; plan self-hosting/compliant providers for scale. Community records are incomplete and not confirmed activation.
- [ ] **Waze for Cities:** [official program](https://www.waze.com/wazeforcities/). Ask whether the actual entity qualifies. Do not assume a private affiliate-supported app is eligible for government-partner feeds or can redistribute Waze reports. No application/approval exists for this project.
- [ ] **TomTom (alternative to Google):** [developer portal](https://developer.tomtom.com/), [pricing](https://docs.tomtom.com/pricing/). Optional, not a second required signup. Verify current allowances, API rights and actual budget rather than relying on older comments in upstream code.
- [ ] **HERE (alternative):** [developer portal](https://www.here.com/developer). Optional fallback evaluation, not a confirmed free plan or enforcement activation source.
- [ ] **Hardware partners:** [Uniden](https://uniden.com/), [Escort](https://www.escortradar.com/). Ask official support/business contacts for documented SDK/Bluetooth permissions, compatible firmware and commercial rights; no public SDK/free access is claimed. Do not reverse-engineer private databases or equate a hardware signal with activation evidence.
- [ ] **Local enforcement operators:** use state/city source-directory entries to identify the actual agency and public-records route. Request existing nonpersonal device locations/schedules/status definitions and data-sharing terms; do not assume the agency must create a new real-time API. Public-records copies may carry fees; request a written estimate before incurring costs.

## 6. Approval-to-integration checklist

- [ ] Save agency reply/agreement privately; update tracker with request date, decision, scope, cost basis and expiry.
- [ ] Distinguish account created → key issued → permitted dataset → approved public display → commercial use cleared → integrated/tested. Do not collapse into “access granted.”
- [ ] Obtain actual sample and define timestamps, TTL, geometry meaning, device matching and offline behavior before UI labels.
- [ ] Add secure credentials, bounded adapter, attribution and quota handling; use no-charge authorized pilot volume first.
- [ ] Review live-data claims against evidence. No source in this checklist has supplied this project a verified enforcement activation feed.
- [ ] Revisit permissions before affiliates, subscriptions, video archiving or materially larger user/request volume.

## Research limitations

PennDOT, Caltrans, CTroads, 511GA, SF Bay 511 and WZDx documentation were read for the specific requirements cited. 511NJ, 511NY, DriveNC, Virginia 511, FL511 and Texas Open Data were viewed as public portals; this does not verify their application/contract terms. Remaining state links derive from the existing agency/FHWA source registry and are leads requiring direct follow-up. No login was bypassed, TLS checks disabled, application submitted, agreement signed or paid service activated.

See [link-review.csv](link-review.csv) for the point-in-time check of 78 unique documentation links. HEAD produced 60 successful responses and 18 access/method/transient failures; follow-up GETs succeeded for the PA camera viewer and Maryland CHART. Hosted Site 401 responses reflect its existing private audience. An HTTP success is not proof of API access, contractual permission or content accuracy.
