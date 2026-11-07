# Speeding penalty curation

`rules.json` is a reviewed, program-scoped dataset, not a complete nationwide statement of traffic law. As of November 7, 2026, it contains nine monetary rules in five jurisdictions: New York, Pennsylvania, Maryland, Virginia, and California. All other jurisdictions remain explicitly unreviewed. Red-light, bus-lane, stop-arm, toll, and other offenses are not modeled.

Every enabled rule has primary government evidence, a review date, a 30-day review window, program/charging scope, exclusions, and known effective or sunset dates. A retrieval date must never be substituted for a legal effective date. Estimates stop before the review date, after the review window, and outside known legal validity dates. A statutory maximum is shown as a cap, not an exact fine or a ticket total.

## Review findings

- New York: ordinary and qualifying work-zone officer ranges differ. School-zone officer charging/timing is excluded. Repeat conviction maximum increases and camera repeat-violation histories have distinct legal meanings. The UI states the applicable history window.
- Pennsylvania: work-zone camera penalties begin with a written warning. Later offenses require the statutory 15-day condition. Officer base-fine doubling requires the qualifying staffed, officially signed work-zone conditions. Costs, points, suspension and other charges are separate.
- Maryland: the current §21-810 work-zone tiers are $60/$80/$140/$270/$500 and double with workers present. Do not replace these with an older flat $40 camera figure or apply them to local school/residential camera programs. The October 2026 court schedule discovered in search returned HTTP 404 when directly retrieved; no officer amount is published from that result.
- Virginia: mailed camera civil notices have a cap, whereas routine officer prepayment is a formula. Reckless-driving speed scenarios suppress routine estimates. The source has future 2027 provisions; those are not applied to the November 2026 comparison.
- California: the AB 645 pilot applies only to specified jurisdictions and eligible local streets. First 60-day warning periods and a vehicle's first 11–15 mph violation matter. Interstate and state-route exclusions prevent using this as a highway camera rate. Other camera authority and officer citations are not modeled.
- New Jersey: the court-hosted schedule retrieved is dated July 29, 2021. It is a dated reference, not a verified November 2026 calculation. The agency's expired red-light pilot is historical evidence, not proof of current statewide camera authority or prohibition.
- District of Columbia: the official index lists an August 7, 2026 amendment. Calculation is withheld pending adopted-text verification, rather than recycling an older indexed fine table.

## Add or revise a rule

1. Read the current enacted primary statute, local ordinance where required, agency program rules and current court schedule. Search snippets and introduced bills are discovery material, not sufficient enactment evidence.
2. Record jurisdiction, specific program/charge, operational prerequisites, offense history, base/cap/payable basis, excluded costs, effective/sunset dates, source URL and review note.
3. Resolve conflicting or future versions. Leave unresolved monetary fields unpublished; unknown is not zero and does not establish a camera ban.
4. Implement an explicit calculation method with boundary cases for thresholds, warnings, repeat periods, special zones, severe offenses, expiry and missing inputs. Add source-backed tests.
5. Update `verifiedOn` and `reviewUntil` only after actual review. Run `npm run road:audit`, `npm run test:driving`, `npm run qa:road`, the production build and required repository checks.

Government text was retrieved using the Firecrawl research tools. Source review notes in the JSON preserve what was actually used. No paid legal database, private account, ticket payment records, vehicle plates or driver identifiers are included.
