import laws from '../../curation/laws/rules.json' with { type: 'json' };
import snapshot from '../../curation/national-coverage.json' with { type: 'json' };
import rollout from '../../curation/priority-rollout.json' with { type: 'json' };
export { laws };
export { rollout };
export const coverageSnapshotDate = snapshot.generatedAt;
export const coverage = snapshot.states.map((state) => {
  const rules = laws.rules.filter(
    (rule) => rule.state === state.code && rule.reviewStatus === 'reviewed',
  );
  return {
    ...state,
    rollout:
      rollout.jurisdictions.find((entry) => entry.state === state.code) || null,
    rules: rules.length,
    cameraRules: rules.filter((r) => r.mode === 'camera').length,
    officerRules: rules.filter((r) => r.mode === 'officer').length,
    coverage: state.records ? 'Partial corridor inventory' : 'Not curated',
    licensing: 'Commercial reuse review required',
  };
});
export const OFFICIAL_PORTALS = {
  AL: 'https://alison.legislature.state.al.us/',
  AK: 'https://www.akleg.gov/',
  AZ: 'https://www.azleg.gov/',
  AR: 'https://www.arkleg.state.ar.us/',
  CA: 'https://leginfo.legislature.ca.gov/',
  CO: 'https://leg.colorado.gov/',
  CT: 'https://www.cga.ct.gov/',
  DE: 'https://delcode.delaware.gov/',
  DC: 'https://code.dccouncil.gov/',
  FL: 'https://www.leg.state.fl.us/',
  GA: 'https://www.legis.ga.gov/',
  HI: 'https://www.capitol.hawaii.gov/',
  ID: 'https://legislature.idaho.gov/',
  IL: 'https://www.ilga.gov/',
  IN: 'https://iga.in.gov/',
  IA: 'https://www.legis.iowa.gov/',
  KS: 'https://www.kslegislature.gov/',
  KY: 'https://legislature.ky.gov/',
  LA: 'https://legis.la.gov/',
  ME: 'https://legislature.maine.gov/',
  MD: 'https://mgaleg.maryland.gov/',
  MA: 'https://malegislature.gov/',
  MI: 'https://www.legislature.mi.gov/',
  MN: 'https://www.revisor.mn.gov/',
  MS: 'https://www.legislature.ms.gov/',
  MO: 'https://revisor.mo.gov/',
  MT: 'https://leg.mt.gov/',
  NE: 'https://nebraskalegislature.gov/',
  NV: 'https://www.leg.state.nv.us/',
  NH: 'https://gc.nh.gov/',
  NJ: 'https://www.njleg.state.nj.us/',
  NM: 'https://www.nmlegis.gov/',
  NY: 'https://www.nysenate.gov/legislation/laws',
  NC: 'https://www.ncleg.gov/',
  ND: 'https://ndlegis.gov/',
  OH: 'https://codes.ohio.gov/',
  OK: 'https://www.oklegislature.gov/',
  OR: 'https://www.oregonlegislature.gov/',
  PA: 'https://www.legis.state.pa.us/',
  RI: 'https://webserver.rilegislature.gov/Statutes/',
  SC: 'https://www.scstatehouse.gov/',
  SD: 'https://sdlegislature.gov/',
  TN: 'https://www.capitol.tn.gov/',
  TX: 'https://statutes.capitol.texas.gov/',
  UT: 'https://le.utah.gov/',
  VT: 'https://legislature.vermont.gov/',
  VA: 'https://law.lis.virginia.gov/',
  WA: 'https://app.leg.wa.gov/',
  WV: 'https://code.wvlegislature.gov/',
  WI: 'https://docs.legis.wisconsin.gov/',
  WY: 'https://wyoleg.gov/',
};
