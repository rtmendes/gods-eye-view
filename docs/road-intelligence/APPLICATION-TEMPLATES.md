# Data-access application drafts

Prepared November 8, 2026. These are drafts for the owner to review and submit; **none have been sent**. Replace every bracketed placeholder with true information and remove inapplicable sentences. Never include API keys, student IDs, private agreements or identity documents in GitHub.

## Applicant identity and positioning

A legitimate independent road-safety research project can request ordinary public/developer access without representing itself as a university, media organization or student. Use an eligibility category only if it is accurate. Project purpose alone does not establish eligibility for a provider's research/media/education program.

| Actual status                    | Appropriate description                                                                                                  | Evidence to supply only if requested                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Independent developer/researcher | “I am developing an independent road-safety research and route-information pilot.”                                       | Real project description, demo and methodology; no invented institution                        |
| Enrolled student                 | “I am currently enrolled at [institution], working on [actual course/project].”                                          | Current enrollment or advisor letter via the provider's private channel                        |
| Institutional researcher         | “I am [role] at [institution], conducting [actual study].”                                                               | Affiliation/project letter, supervisor and relevant research approval if applicable            |
| Journalist/media                 | “I report for [actual outlet] on [actual assignment],” or “I am an independent journalist with [actual published work].” | Actual editor assignment, publication links or required credentials                            |
| Business/commercial developer    | “I am building a road-information product with a free pilot and possible affiliate-supported/commercial release.”        | Actual entity/contact and intended distribution; ask if the standard free feed covers this use |

Do not claim nonprofit/tax-exempt status, student enrollment, institutional approval, press accreditation or existing data agreements unless they actually exist. If a form forces an inaccurate category, ask the provider which category to select. Do not hide intended monetization to obtain a research-only license.

## Copy-ready project summary

> God’s Eye View Road is an independent road-safety and route-information project. The current prototype lets users plan a drive, inspect published work-zone and camera-site references, review source provenance, and compare supported traffic-penalty scenarios. Initial geographic focus is New York, New Jersey and Pennsylvania, followed by Atlantic coastal states, DC, Texas and California. It distinguishes traffic-monitoring imagery from citation enforcement and labels uncertain locations and missing coverage. We seek authorized, low-volume access to improve source accuracy, freshness and public understanding. The proposed pilot use is [accurate description]. A future public release may include disclosed affiliate links or other commercial features, subject to separate permission where required.

## General agency data-access request

**Subject:** Request for no-charge pilot access to road-condition and camera data — God’s Eye View Road

> Hello [agency/team],
>
> My name is [name], and I am [accurate role/affiliation]. I am developing God’s Eye View Road, a source-attributed road-safety and route-information pilot. The current prototype is at [appropriate demo URL; note if access is private].
>
> I would like to request access to existing [specific datasets: incidents, roadwork, camera metadata/still imagery, permitted video, traffic measurements] covering [roads/states]. Our initial pilot is [duration], with approximately [realistic estimated users] and [estimated requests per minute/day or camera concurrency]. We can reduce frequency, cache permitted data and start with a limited corridor.
>
> Please advise whether an ordinary free public/developer feed is available, and provide the current application, terms, documentation and attribution requirements. If you have a research/media/education program for which my actual affiliation qualifies, please explain eligibility and the evidence needed. Please do not provision a paid service without our written approval.
>
> We need stable source/device IDs, location geometry and its accuracy/meaning, road/direction references, observation/update times and timezones, availability/quality flags, and relevant speed-limit fields where actually maintained. Please explain which fields or images originate from third-party providers and have separate redistribution restrictions.
>
> Our intended use is [actual current pilot/public-display use]. We may later add disclosed affiliate-supported or commercial features. Please clarify whether the requested access permits that use, or whether we should seek a separate license before any such release. We can start with links/still imagery rather than streaming if that better fits the available permissions.
>
> Could you confirm the access cost, quotas, polling guidance, caching/retention limits, permitted public embedding, stream concurrency/bandwidth obligations, attribution, and renewal/termination conditions? If this is not the correct team, please direct me to the appropriate data-sharing contact.
>
> Thank you,
> [real name / actual entity]
> [contact email]
> [project URL]

## PennDOT request

Use the [official request form](https://paiedprod.powerappsportals.us/DataFeedRequestForm/) and [published policy](https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds). Form field wording may change; the following is proposed content, not a claim that every field appears in the form.

**Requested datasets:** RCRS incidents/roadwork/conditions, camera site metadata and permitted still imagery. Streaming video only if the owner wants to execute the video-sharing agreement.

**Purpose text:**

> I request PennDOT's no-charge transportation data feeds for a source-attributed road-safety/route-information pilot, initially focused on the I-80/I-95 corridor. We intend to show agency-published roadwork/incident references and monitoring camera sites with dates, provenance and explicit limitations. We will acknowledge PennDOT as required and follow the assigned quotas and caching limits. The pilot is [accurate use/duration/volume]. A future release may include affiliate-supported/commercial features; please confirm the applicable terms before that use. Please provide RCRS documentation/credentials, camera metadata/still-image terms, and clarification of whether measured traffic flow is included or separately licensed. If video is available, please provide the Non-Exclusive Video Sharing License Agreement and technical/bandwidth requirements for review before enabling streams.

**Additional questions:**

- Does free access cover our actual pilot/entity and proposed future distribution?
- Does camera “status” indicate imagery health only? Are source coordinates site references or surveyed mounting positions?
- Are observation timestamps/timezones and camera IDs stable across metadata and media?
- Are flow speeds and temporary posted limits separate products/fields?
- Is an existing actual WZSSC operating-status feed available, or only project-level active/paused/completed references?
- What acknowledgment and public stream-display requirements apply, and what may be cached or archived?

## Camera operation / exact-location request

**Subject:** Existing nonpersonal enforcement-location and operating-status data — [jurisdiction]

> Hello [agency/program],
>
> For the road-safety project described below, I am seeking existing nonpersonal records or an authorized feed identifying [program] devices and deployment areas. Please identify which of the following you maintain and can release: stable device/location ID, coordinates and stated accuracy, road/direction/lane or milepost reference, equipment type, applicable posted-speed reference, planned deployment periods, and any explicit actual operating-state observation with timestamp and validity.
>
> We understand that an active project or planned schedule does not establish that a device is currently enforcing, and will preserve that distinction. We are not requesting license plates, driver identities, violation images, credentials, enforcement evasion guidance or a newly created telemetry system.
>
> If actual operating-state data is unavailable or not releasable, please confirm the meaning and limitations of the available status/schedule fields. If exact device coordinates are not maintained, please identify the precision/meaning of the existing location references. Please provide the correct existing public dataset, data-sharing application or records-request process and any applicable costs/use conditions.
>
> Please provide a written fee estimate and available fee-waiver criteria before incurring charges. My actual purpose/affiliation is [truthful description]. [Only if applicable: brief supported explanation of eligibility under that agency's actual waiver criteria.]
>
> [Name / contact / project]

This draft is not a jurisdiction-specific public-records legal filing. Follow the agency's actual request instructions and applicable fee rules. A waived copy fee does not automatically authorize continuous video redistribution or guarantee live data.

## Research / student / media add-on (choose only if true)

> I am [actual role] at/with [actual institution or publication], and this request supports [specific project/course/study/report]. I can provide [actual enrollment/advisor/assignment/affiliation evidence] through your private application channel. Please tell me whether an existing research/education/media access program or fee waiver applies. If it does not, please advise whether a standard no-charge public/developer tier is available. Any later commercial/affiliate use would be disclosed and separately cleared where required.

Do not attach invented letters or substitute a personal email domain as proof of affiliation. Free feeds such as PennDOT's general program may already admit commercial/public users, making special positioning unnecessary.

## Video/still imagery permission add-on

> Please confirm whether the supplied image/stream URLs may be embedded in our public app, whether playback must link to your viewer, what attribution is required, whether tokens expire, and what concurrency/rate limits apply. We propose no recording/archive and no face/plate identification. Please specify any separate video-sharing agreement, required origin restrictions, bandwidth obligations and commercial-use limits. A camera availability flag will be labeled as media availability, not enforcement activation.

## Hardware integration inquiry (optional, later)

> We are evaluating an authorized integration with [device/model] for a road-information app. Do you offer a documented SDK/Bluetooth interface and permitted developer/commercial program? Please provide supported firmware/platforms, test-device options, fees, attribution and distribution rules, and privacy/telemetry requirements. We would ingest only permitted short-lived signal/speed-sign observations; we would not copy your camera database or infer exact enforcement positions from radar/laser detections. Please advise whether a limited research/pilot license is available for our actual use.

## Follow-up after the provider's published response period

> Hello [team], following up on the request submitted [date/reference]. Could you confirm receipt and the next step, or direct us to the correct data owner? We can narrow the pilot to [actual scope] and begin with permitted metadata/still imagery. Please confirm the applicable costs, display rights and documentation before we integrate anything. Thank you, [name].

Do not invent a promised turnaround time. Use the provider's published timeline, if any; otherwise a single courteous follow-up after a reasonable interval is a project choice, not an agency requirement.

## Acceptance record before integration

- [ ] Applicant/affiliation is accurate; owner reviewed the submission.
- [ ] Request submitted through the actual official form/contact; reference/date recorded privately.
- [ ] Approval names the correct applicant, datasets, geography and intended display/use.
- [ ] No-charge basis, paid obligations, quotas, expiry and renewal recorded.
- [ ] Attribution, caching, still/video embedding, recording and commercial/affiliate terms understood.
- [ ] Credentials delivered through a private channel and configured as appropriately restricted secrets.
- [ ] Provider schema and timestamp semantics reviewed; no unsupported activation claims.
- [ ] Tracker updated without exposing keys, identity evidence or signed agreements.
