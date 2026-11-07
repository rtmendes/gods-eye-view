import { readFileSync } from 'node:fs';
import { JURISDICTIONS } from '../../src/driving/jurisdictions.js';
import { normalizeRecord } from '../../src/driving/model.js';
import { commercialUseAllowed } from '../../src/road/quality.js';
const load = (name) =>
  JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const snapshot = load('../../public/enforcement/snapshot.json');
const laws = load('../../curation/laws/rules.json');
const rollout = load('../../curation/priority-rollout.json');
const states = new Set(JURISDICTIONS.map((state) => state.code));
const errors = [];
if (states.size !== 51)
  errors.push('National registry must contain 50 states and DC');
const sourceIds = new Set(laws.sources.map((source) => source.id));
const ruleIds = new Set();
for (const rule of laws.rules) {
  if (ruleIds.has(rule.id)) errors.push(`Duplicate rule ${rule.id}`);
  ruleIds.add(rule.id);
  if (!states.has(rule.state) || !['camera', 'officer'].includes(rule.mode))
    errors.push(`Invalid rule jurisdiction/mode ${rule.id}`);
  if (!rule.sourceIds.length || rule.sourceIds.some((id) => !sourceIds.has(id)))
    errors.push(`Missing evidence for ${rule.id}`);
  if (
    !rule.verifiedOn ||
    !rule.reviewUntil ||
    rule.reviewUntil < rule.verifiedOn
  )
    errors.push(`Invalid review window ${rule.id}`);
}
for (const source of laws.sources)
  if (
    !source.url.startsWith('https:') ||
    !source.reviewNote ||
    !source.retrievedOn
  )
    errors.push(`Invalid legal source ${source.id}`);
for (const record of snapshot.records) {
  try {
    normalizeRecord(record);
  } catch (error) {
    errors.push(`${record.id}: ${error.message}`);
  }
}
const today = new Date().toISOString().slice(0, 10);
const activeRules = laws.rules.filter(
  (rule) =>
    rule.reviewStatus === 'reviewed' &&
    rule.verifiedOn <= today &&
    rule.reviewUntil >= today,
);
const covered = new Set(activeRules.map((rule) => rule.state));
const report = {
  supportedJurisdictions: states.size,
  reviewedJurisdictions: covered.size,
  currentReviewedRules: activeRules.length,
  priorityJurisdictions: rollout.jurisdictions.length,
  priorityReviewed: rollout.jurisdictions.filter((entry) =>
    covered.has(entry.state),
  ).length,
  priorityMonetaryReviewPending: rollout.jurisdictions
    .filter((entry) => !covered.has(entry.state))
    .map((entry) => entry.state),
  legalReviewPending: JURISDICTIONS.filter((s) => !covered.has(s.code)).map(
    (s) => s.code,
  ),
  equipmentRecords: snapshot.records.length,
  physicalPositionsVerified: snapshot.records.filter(
    (r) => r.equipmentPositionVerified,
  ).length,
  commercialSourcesCleared:
    snapshot.sources.filter(commercialUseAllowed).length,
  errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
