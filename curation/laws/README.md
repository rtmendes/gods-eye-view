# Speeding penalty curation

`rules.json` is a reviewed, program-scoped dataset, not a complete nationwide statement of traffic law. As of November 7, 2026, it contains 28 monetary rules in 17 jurisdictions. The priority cohort is the 14 Atlantic coastal states, DC, Texas, California and the retained Pennsylvania corridor (18 jurisdictions); New Jersey remains on monetary-review hold. Other jurisdictions remain explicitly unreviewed. Red-light, bus-lane, stop-arm, toll, and other offenses are not modeled.

Every enabled rule has primary government evidence, a review date, a 30-day review window, program/charging scope, exclusions, and known effective or sunset dates. A retrieval date must never be substituted for a legal effective date. Estimates stop before the review date, after the review window, and outside known legal validity dates. A statutory maximum is shown as a cap, not an exact fine or a ticket total.

## Review findings

- New York: ordinary and qualifying work-zone officer ranges differ. School-zone officer charging/timing is excluded. Repeat conviction maximum increases and camera repeat-violation histories have distinct legal meanings. The UI states the applicable history window.
- Pennsylvania: work-zone camera penalties begin with a written warning. Later offenses require the statutory 15-day condition. Officer base-fine doubling requires the qualifying staffed, officially signed work-zone conditions. Costs, points, suspension and other charges are separate.
- Maryland: the current §21-810 work-zone tiers are $60/$80/$140/$270/$500 and double with workers present. Do not replace these with an older flat $40 camera figure or apply them to local school/residential camera programs. The October 2026 court schedule discovered in search returned HTTP 404 when directly retrieved; no officer amount is published from that result.
- Virginia: mailed camera civil notices have a cap, whereas routine officer prepayment is a formula. Reckless-driving speed scenarios suppress routine estimates. The source has future 2027 provisions; those are not applied to the November 2026 comparison.
- California: the AB 645 pilot applies only to specified jurisdictions and eligible local streets. First 60-day warning periods and a vehicle's first 11–15 mph violation matter. Interstate and state-route exclusions prevent using this as a highway camera rate. Other camera authority and officer citations are not modeled.
- New Jersey: the court-hosted schedule retrieved is dated July 29, 2021. It is a dated reference, not a verified November 2026 calculation. The agency's expired red-light pilot is historical evidence, not proof of current statewide camera authority or prohibition.
- District of Columbia: the August 7, 2026 adopted Word file was retrieved through the public View text action and checked. The ordinary-road camera/officer calculation is now enabled; controlled-access status changes the highest tier. School/work-zone doubling remains withheld pending conditions review.

## Add or revise a rule

1. Read the current enacted primary statute, local ordinance where required, agency program rules and current court schedule. Search snippets and introduced bills are discovery material, not sufficient enactment evidence.
2. Record jurisdiction, specific program/charge, operational prerequisites, offense history, base/cap/payable basis, excluded costs, effective/sunset dates, source URL and review note.
3. Resolve conflicting or future versions. Leave unresolved monetary fields unpublished; unknown is not zero and does not establish a camera ban.
4. Implement an explicit calculation method with boundary cases for thresholds, warnings, repeat periods, special zones, severe offenses, expiry and missing inputs. Add source-backed tests.
5. Update `verifiedOn` and `reviewUntil` only after actual review. Run `npm run road:audit`, `npm run test:driving`, `npm run qa:road`, the production build and required repository checks.

Government text was retrieved using the Firecrawl research tools. Source review notes in the JSON preserve what was actually used. No paid legal database, private account, ticket payment records, vehicle plates or driver identifiers are included.

## East Coast, Texas and California pass

`curation/priority-rollout.json` defines the 18-jurisdiction queue, including Pennsylvania to retain the original corridor. Default atlas and fines tiles show this cohort; visitors can show all 51 jurisdictions. Agency traveler-information links are labeled candidate research portals, not ingested equipment feeds or verified enforcement-device inventories.

New rules cover Maine’s interstate statutory minimum, New Hampshire’s distinct standard/65/70 mph tiers, Massachusetts’s statutory minimum, Rhode Island’s first-offense schedule and school-camera penalty, Connecticut’s municipal caps/2026 CTDOT program and a scoped officer range, Delaware’s base formula and eligible camera program, North Carolina’s routine-infraction cap and work-zone addition, South Carolina’s first-offense ranges, Georgia’s current school-camera penalty, Florida’s officer and school-camera amounts, Texas’s general base range and conditional work-zone doubling, California’s 2026 court-chart base amounts, and DC’s adopted ordinary-road schedule.

Minima display as **At least**, caps as **Up to**, and payable totals are not inferred. Statutory surcharges identified in MA/TX are called out separately. SC’s exact 15/25 mph boundaries, NC misdemeanor speeds, FL mandatory-hearing speeds, and unsupported special/repeat contexts withhold an estimate. The primary-source receipts in `evidence-2026-11-07.json` preserve hashes and extracts for the downloaded DC/GA/CA documents. Other source evidence is in each rule’s source review notes and URLs.

The Georgia signed acts have provisions taking effect in July 2027; those are not applied to November 2026. Connecticut’s CTDOT program is not its municipal camera program. Texas’s municipal automated-speed restriction is not a claim that no traffic, toll, plate-reader or officer camera exists.
