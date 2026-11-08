# SOP: source curation, access and publication

Version 1.0 · November 8, 2026. Owner: repository maintainer. Applies to Road inventory, sources, legal scenarios and future authorized live feeds. Use [access checklist](DATA-ACCESS-CHECKLIST.md) and [technical specification](TECHNICAL-SPECIFICATION.md) alongside this procedure.

## 1. Establish scope and baseline

- [ ] Record date, commit, target states/routes and current snapshot timestamp before edits.
- [ ] Read the existing guides and applicable repository instructions. Check `git status --short`; preserve unrelated work.
- [ ] State whether work affects a source directory, accepted records, monetary rules, software, hosted publication or actual upstream access.
- [ ] Use the current source registry and record IDs; do not create a second untraceable location catalog.
- [ ] Identify which claims require new evidence: physical equipment location, enforcement type, activation, traffic measurement, speed limit or legal fine.

## 2. Request source access

- [ ] Choose a provider from the linked checklist and confirm the current application entry point. A public viewer is not an API license.
- [ ] Complete the common application packet with accurate owner/organization/affiliation and the real proposed use.
- [ ] Describe the current pilot separately from possible future affiliate-supported/commercial deployment.
- [ ] Request the smallest useful feed, geography and polling volume first; ask whether ordinary public/commercial developers qualify for free access.
- [ ] If genuinely eligible, attach requested researcher, student or media evidence. Otherwise use independent developer/research project language without invented institutional affiliation.
- [ ] Obtain approval for the particular dataset, display rights, streaming, caching, attribution and future commercial reuse. Credentials alone do not answer every rights question.
- [ ] Store keys and agreements privately; put only provider, status, dates, nonsecret limits and a private reference identifier in the tracker.
- [ ] Do not submit drafts, create accounts, accept a charge or sign agreements as part of a documentation update. The owner handles identity/terms and authorizes actual submissions separately.

## 3. Inspect and normalize evidence

- [ ] Preserve source URL/ID, retrieval time, publication/observation time, stated precision and source status.
- [ ] Validate coordinate ranges/order, jurisdiction, route/direction and ID joins. Inspect mismatched descriptions against geometry.
- [ ] Use actual source geometry. Missing coordinates stay unmapped. Roadwork segments and geocoded descriptions do not become exact camera mounts.
- [ ] Classify monitoring versus citation enforcement explicitly. A CCTV feed online/offline flag describes imagery availability, not enforcement activation.
- [ ] Keep PA active/paused/completed project labels distinct from actual operating evidence. NY weekly deployments remain scheduled and changeable.
- [ ] Keep source-reported temporary/standard speeds and mileposts separately; never treat traffic flow speed as a legal limit.
- [ ] Quarantine conflicts and malformed payloads. Do not publish review candidates automatically.
- [ ] Review terms and provenance before importing media URLs or any third-party camera database.

## 4. Refresh the backend and publish data

Use the supported Node version and dependencies from the lockfile. `pdftotext` is needed for the NY deployment PDF importer. Run commands from repository root.

```sh
npm ci
npm run enforcement:refresh
npm run enforcement:manage -- export public/enforcement/snapshot.json
npm run sources:index
npm run road:audit
```

The refresh updates the backend store; the explicit export above publishes its accepted snapshot into tracked static data and refreshes provenance. Inspect command results and source-level failures before committing. Do not export private pending/rejected reports. `npm run enforcement:watch` performs startup/hourly import work when explicitly operated under a process supervisor; it does not deploy the Site. Do not start a second watcher for the same store.

- [ ] Compare record counts and categories with the prior release. Explain additions, disappearances, source failures and geometry changes.
- [ ] Inspect stale data and original timestamps. A successful fetch or database poll cannot reset the source observation age.
- [ ] Review the output diff for unintentional evidence loss, guessed coordinates, credential URLs or private reports.
- [ ] Regenerate coverage/source artifacts when inventory changes; review counts instead of copying old numbers into docs.
- [ ] Recheck current laws and program eligibility separately from equipment refresh. Preserve “Not estimated” for incomplete or stale rules.

Moderation commands (only after evidence review):

```sh
npm run enforcement:manage -- reports
npm run enforcement:manage -- approve REPORT_ID /private/path/reviewed-record.json
npm run enforcement:manage -- reject REPORT_ID
```

`reports` may print private submissions; run locally in an appropriate private context and do not paste output into GitHub. Reviewed record files must satisfy the current model; a raw report is not an approved record.

## 5. Validate changes

- [ ] For docs-only changes: check Markdown formatting, relative links, source links and implementation claims. No need to rerun application/browser suites when code and data are unchanged.
- [ ] For model/import/API changes: run relevant tests including `npm run test:driving` and source/data audit checks.
- [ ] For planner/atlas/fines/sources UI changes: run relevant `qa:route`, `qa:road`, `qa:sources` against a running local server; check phone layout and error/unknown states.
- [ ] For code/build changes: run `npm run check:boundaries`, appropriate formatting checks and `npm run build`.
- [ ] For approved live adapters: perform controlled smoke requests and test expired credentials, quota, staleness, bad clock/geometry, attribution and fallback behavior. Fixture success is not proof of live coverage.
- [ ] Record executed checks and limitations in the PR; do not claim older test results as newly run.

## 6. Commit and release

- [ ] Stage intentional source, tests, curation artifacts and documentation only. Preserve secrets, `.gev-data/`, dependency folders and private agreements outside Git.
- [ ] Commit/push the feature branch and update the existing draft PR with the final scope and validation. Do not merge without a separate instruction.
- [ ] For an app/data release, build and synchronize the generated Site source, preserving project ID and owner-private audience. Package the exact pushed Site source state and deploy that version.
- [ ] Confirm terminal deployment success and record URL, application commit, Site source commit and deployment/version references in the release note.
- [ ] For a docs-only release, GitHub push is sufficient; do not redeploy unchanged app assets merely to publish repository docs.

## 7. Monitor and correct

- [ ] Future live services: monitor source age, successful ingestion, API failures, quota use and playback availability independently. Agree on provider-specific cadence and expiry before enabling “live.”
- [ ] Upon outage/schema mismatch: stop unsupported activation/live claims, retain previous evidence with dates, show unavailable/unknown, and back off requests.
- [ ] On a wrong coordinate/type/fine: quarantine/correct the record, document evidence and affected releases, rebuild indexes, publish corrected assets and verify the result.
- [ ] On credential exposure: revoke/rotate through the provider, remove from code/logs and review Git history exposure; deleting the latest text is insufficient.
- [ ] On denied/revoked rights or a move to affiliate use: disable the affected content until permitted. Do not treat a research grant as perpetual commercial clearance.
- [ ] Review source links and access terms monthly during the pilot; review quotas/costs with actual usage and before public expansion. These are operating targets, not a scheduled service already installed.

## Definition of done

Evidence and rights status are recorded; imported records preserve uncertainty; current documentation matches code/data; relevant checks pass; intentional files are pushed; any requested hosted release is verified; remaining access/coverage gaps are stated. No confirmed camera activation claim is made without explicit authoritative current evidence.
