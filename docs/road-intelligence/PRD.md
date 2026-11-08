# Product requirements: God’s Eye View Road

Version 1.0 · November 8, 2026 · Product owner: repository owner (individual/entity details to be supplied). Implementation baseline: route-planner commit `4d9ec44`; this document adds requirements, not unimplemented live capabilities.

## Problem and intended value

Drivers and road-safety researchers need understandable, source-backed context for a planned drive: traffic conditions, roadwork, monitoring cameras, enforcement references, source-reported speeds and possible penalties. Published information is fragmented across agencies. Mobile deployments, stale feeds and project-level locations make claims of “all exact cameras” unreliable.

Provide a route with clearly attributed observations and explicit gaps. Distinguish a physical device position from a camera-site reference, project segment or deployment schedule. Distinguish a traffic-monitoring camera from a citation camera, and a permitted operating schedule from actual operation.

## Users and journeys

| User                                | Journey                                                                                     | Success condition                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Driver planning a trip              | Enter addresses or coordinates, select endpoints, compare routes, inspect nearby references | Sees a usable route, baseline ETA, source dates and coverage limits                                               |
| Driver using the backend Drive page | Start foreground GPS session, inspect route and applicable alerts                           | Monitoring-only sites do not become violation alerts; unreliable fixes do not produce confident road associations |
| Researcher/editor                   | Filter sources by state and inspect location provenance                                     | Every published location leads to its actual evidence, not only a generic state portal                            |
| Curator                             | Import, review mismatches, correct a record and publish                                     | Bad joins and unsupported physical-location claims stay out of the published inventory                            |
| Maintainer                          | Detect stale/failed sources and update the hosted release                                   | Source retrieval, database sync and hosted publication have separate timestamps                                   |

## Geographic rollout

1. Existing Harlem–Tyrone, I-80/I-95 NY/NJ/PA corridor, with actual imported coverage primarily NY/PA.
2. Priority cohort: ME, NH, MA, RI, CT, NY, NJ, PA, DE, MD, DC, VA, NC, SC, GA, FL, TX and CA.
3. Expand remaining jurisdictions and smaller/local roads only after source access, normalization and evidence checks. All 50 states and DC already have source-directory entries; this is discovery support, not equipment completeness.

## Capability status

| Capability                                                            | Status                             | Limits                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Address/coordinate inputs, selected endpoints and example trip        | Implemented in hosted planner      | Public explicit-request geocoder; no continuous autocomplete                                 |
| Route alternatives and step directions                                | Implemented                        | Options depend on provider; OSRM baseline time excludes traffic                              |
| Route-linked inventory, corridor radius and direction/history filters | Implemented                        | Nearby geometry is not proof of same lane, activation or mounting precision                  |
| Coverage atlas and state fine scenarios                               | Implemented                        | Monetary rules are incomplete; show “Not estimated” where unsupported                        |
| Location-level source directory                                       | Implemented                        | 306 published records, 17 review candidates and one quarantined mismatch kept distinct       |
| Foreground GPS/routing/report backend                                 | Implemented separately             | Needs Node/Vite backend; not static-hosted mobile background navigation                      |
| Live congestion and traffic-aware ETA                                 | Planned                            | Google account exists per owner; APIs/billing/credentials/integration not verified           |
| Road-camera live imagery/video                                        | Planned                            | Agency permissions, stream rights, timestamps and bandwidth required                         |
| Confirmed camera activation                                           | Blocked on authoritative telemetry | PA active projects mean “may enforce”; NY schedules can change; never infer an on/off switch |
| Hardware signal events                                                | Simulator/contract only            | No real licensed adapter; a signal is not a device-coordinate verification                   |
| Affiliate monetization                                                | Policy groundwork only             | No active offers, billing or signed licenses; disclose future commercial intent to providers |

## Functional requirements and acceptance

| ID  | Requirement                                      | Acceptance criterion                                                                                                                                                            |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Generate a driving route from explicit endpoints | Ambiguous addresses require selection; failures never display a fabricated fallback route                                                                                       |
| R2  | Compare alternatives and directions              | Changing alternative updates route geometry and nearby records; stale requests cannot overwrite a newer trip                                                                    |
| R3  | Show published equipment/project context         | Every card includes type, source evidence, retrieval date and coordinate meaning; no guessed marker for missing geometry                                                        |
| R4  | Make uncertainty visible                         | Empty coverage says unknown; monitoring sites are labeled monitoring; project pins are not labeled exact camera positions                                                       |
| R5  | Support penalties by state and context           | Camera versus officer scenarios expose applicable conditions, base/cap basis, excluded fees and unknown/stale rules                                                             |
| R6  | Protect trip privacy                             | Hosted trips stay in page memory; clear removes route cache; no precise-trip URL or account history; external provider disclosure shown                                         |
| R7  | Connect traffic provider (next release)          | Traffic-aware ETA labeled with retrieval time and departure basis; outage falls back explicitly to baseline, never a stale “live” badge                                         |
| R8  | Display congestion (next release)                | Provider map attribution and license conditions respected; observed speeds are distinct from posted speed limits; traffic colors never imply enforcement                        |
| R9  | Show agency camera imagery (next release)        | Stream/image permission recorded; show image observation time when available and stale/offline state; unknown capture time is not labeled live                                  |
| R10 | Represent activation (conditional future)        | “Confirmed operating” requires exact device match, authorized explicit operating evidence, source event time and unexpired validity; expired/ambiguous evidence becomes unknown |
| R11 | Support sustainable free-access pilot            | Each source has recorded quota, cost basis and allowed use; no claim that free access includes unlimited bandwidth or commercial rights                                         |
| R12 | Add hardware/affiliates (later)                  | Documented API rights and real-device validation before adapter rollout; offers disclosed and suppressed in driving/unknown-motion contexts                                     |

## Live-data product rules

Live means a recent provider measurement within a reviewed provider-specific freshness window, not a recently reloaded website. Show data time and retrieval time separately. Never assign “not enforcing” from missing records, an offline traffic video, weather, lack of a crowd report or a quiet radar detector. A 24/7 legal program is operating eligibility, not proof that each unit is online.

The target integration uses Google for traffic visualization/routing, agency sources for roadwork and camera content, and reviewed records for enforcement. Google does not provide an enforcement activation API for this use case. Google content must be displayed and stored in accordance with its service policies; switching providers requires implementation work, not simply enabling a Cloud API.

## Proposed measures (not yet instrumented)

- Percentage of published records with valid evidence and explicit coordinate meaning: target 100%.
- Unsupported “exact equipment” or “confirmed active” assertions: target zero.
- Stale-source rate, upstream failures, age of latest successful imports and publication lag, tracked separately by provider.
- Route request success/latency, cancellation correctness and mobile usability using privacy-preserving aggregates.
- Provider requests and bandwidth versus quota; percentage of route with supported live data (not a fabricated national coverage percentage).

## Non-goals for this release

Guaranteed detection of every camera; evasion guarantees; traffic-aware routing before configuration; private vendor database extraction; enforcement inferred from CCTV; unlicensed video redistribution; Android Auto/CarPlay/native background navigation; automated legal advice; fabricated eligibility credentials; submission of application drafts without owner instruction.

## Release gates and dependencies

- [ ] Owner completes Google billing/API choices and secure credential setup.
- [ ] Choose compliant Google display/routing architecture, request budgets and outage handling.
- [ ] Submit agency applications with accurate affiliation, pilot scope and future commercial disclosure.
- [ ] Review provider agreements for public display, caching, streams, derived data and affiliate use.
- [ ] Implement/test adapters, timestamps, coverage and expiry before advertising live features.
- [ ] Review accessibility, mobile layout, attribution, failure modes and current legal rules.
- [ ] Publish only a build matching the pushed source state; preserve the existing Site audience.

See [technical specification](TECHNICAL-SPECIFICATION.md), [SOP](SOP.md) and [access checklist](DATA-ACCESS-CHECKLIST.md) for execution details.
