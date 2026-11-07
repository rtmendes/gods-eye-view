/** A monetary result is scoped to a reviewed rule, never a prediction of a ticket. */
export function evaluatePenalty(
  rule,
  input,
  asOf = new Date().toISOString().slice(0, 10),
) {
  const unavailable = (reason) => ({
    status: 'unavailable',
    reason,
    min: null,
    max: null,
  });
  if (!rule || rule.reviewStatus !== 'reviewed')
    return unavailable('No current reviewed monetary rule for this selection.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asOf) ||
    !Number.isFinite(Date.parse(asOf)) ||
    new Date(asOf).toISOString().slice(0, 10) !== asOf
  )
    return unavailable('Choose a valid date.');
  if (
    asOf < rule.verifiedOn ||
    asOf > rule.reviewUntil ||
    (rule.effectiveFrom && asOf < rule.effectiveFrom) ||
    (rule.effectiveTo && asOf >= rule.effectiveTo)
  )
    return unavailable(
      'This date is outside the reviewed rule window. Recheck the official source.',
    );
  const {
    speed,
    limit,
    prior = 0,
    zone = 'ordinary',
    workers = 'unknown',
    confirmed = false,
  } = input;
  if (
    ![speed, limit, prior].every(Number.isInteger) ||
    limit < 5 ||
    limit > 85 ||
    speed < 0 ||
    speed > 200 ||
    prior < 0 ||
    prior > 20
  )
    return unavailable(
      'Enter whole-number speeds and prior offenses within the supported ranges.',
    );
  const over = speed - limit;
  if (over <= 0)
    return unavailable(
      'This speeding rule does not apply to the entered speeds. This is not a finding that driving is lawful.',
    );
  if (rule.mode === 'camera' && !confirmed)
    return unavailable(
      'Confirm this is an authorized, operational program and all timing, signage and warning-period conditions apply.',
    );
  const result = (min, max = min, reason = '') => ({
    status: 'estimated',
    min,
    max,
    reason,
    basis: rule.basis,
    excludes: rule.excludes,
  });
  switch (rule.method) {
    case 'ny-work-camera':
      if (zone !== 'work')
        return unavailable('Select a work zone for this program.');
      if (over <= 10)
        return unavailable(
          'The entered scenario is outside this camera rule. It is not a permitted speeding margin.',
        );
      return result(
        prior === 0 ? 50 : prior === 1 ? 75 : 100,
        undefined,
        'Prior violations must fall within the program’s 18-month period.',
      );
    case 'ny-school-camera':
      if (zone !== 'school' || over <= 10)
        return unavailable(
          'Select an eligible NYC school speed zone and an applicable recorded violation.',
        );
      return result(
        0,
        50,
        'Statutory cap; NYC program only. Not a statewide camera rate.',
      );
    case 'ny-officer': {
      if (zone === 'school')
        return unavailable(
          'School-zone timing and charging subsection require separate review.',
        );
      const band = over <= 10 ? 0 : over <= 30 ? 1 : 2;
      const ranges =
        zone === 'work'
          ? [
              [90, 150],
              [180, 300],
              [360, 600],
            ]
          : [
              [45, 150],
              [90, 300],
              [180, 600],
            ];
      const [min, max] = ranges[band];
      return result(
        min,
        max + (prior === 0 ? 0 : prior === 1 ? 150 : 375),
        'Specified VTL §1180 charging subsections only; repeat convictions use an 18-month period. Possible imprisonment is not priced.',
      );
    }
    case 'pa-work-camera':
      if (zone !== 'work' || over < 11)
        return unavailable(
          'This rule covers an applicable recorded violation in an active work zone.',
        );
      if (prior > 0 && input.warningMatured !== true)
        return unavailable(
          'A later offense must occur at least 15 days after mailing of the first warning. Confirm that condition.',
        );
      return result(
        prior === 0 ? 0 : prior === 1 ? 75 : 150,
        undefined,
        prior === 0
          ? 'Written warning for the first offense; this is not an absence of enforcement.'
          : 'Applies to qualifying program offenses after the warning period.',
      );
    case 'pa-officer': {
      if (zone === 'school')
        return unavailable('School-zone offenses require a separate rule.');
      if (
        zone === 'work' &&
        (workers === 'unknown' || input.workSigns !== true)
      )
        return unavailable(
          'Work-zone doubling needs worker presence and the required official signage established.',
        );
      const base = (limit >= 65 ? 42.5 : 35) + 2 * Math.max(0, over - 5);
      return result(
        base * (zone === 'work' && workers === 'yes' ? 2 : 1),
        undefined,
        '§3362 base fine; §3326 doubling applies only to qualifying posted, staffed active work zones. Other charges or suspension are not priced.',
      );
    }
    case 'md-work-camera': {
      if (zone !== 'work' || over < 12)
        return unavailable(
          'This work-zone camera rule does not cover the entered scenario.',
        );
      if (workers === 'unknown')
        return unavailable(
          'Worker presence changes the fine. Select yes or no.',
        );
      const base =
        over <= 15
          ? 60
          : over <= 19
            ? 80
            : over <= 29
              ? 140
              : over <= 39
                ? 270
                : 500;
      return result(
        base * (workers === 'yes' ? 2 : 1),
        undefined,
        'Maryland Transportation §21-810(c); other camera programs have different rules.',
      );
    }
    case 'va-camera':
      if (!['work', 'school'].includes(zone) || over < 10)
        return unavailable(
          'This comparison models eligible Virginia work and school zones only.',
        );
      if (zone === 'work' && workers !== 'yes')
        return unavailable(
          'Virginia work-zone camera liability requires workers to be present.',
        );
      return result(
        0,
        100,
        'Statutory maximum, not a fixed local rate. Mailed civil notice only; personally issued summonses can have different record consequences.',
      );
    case 'va-officer':
      if (over >= 20 || speed > 85)
        return unavailable(
          'The entered speed meets a statutory reckless-driving threshold. A routine speeding prepayment estimate would be misleading.',
        );
      return result(
        over * (zone === 'ordinary' ? 6 : 7) +
          (limit === 65 && speed > 80 && speed < 86 ? 100 : 0),
        undefined,
        'Prepayable ordinary speeding or specified school/work-zone offense only. Residential special zones and other charges are excluded.',
      );
    case 'ca-pilot-camera':
      if (zone !== 'ordinary' || over < 11)
        return unavailable(
          'Select an eligible local pilot street. This program does not apply on interstates or California state routes.',
        );
      if (over <= 15 && prior === 0)
        return result(
          0,
          0,
          'A vehicle’s first 11–15 mph violation in the jurisdiction receives a warning.',
        );
      return result(
        speed >= 100 ? 500 : over <= 15 ? 50 : over <= 25 ? 100 : 200,
        undefined,
        'AB 645 pilot only. Required initial 60-day warning periods must have ended. Income-based reductions and payment alternatives are not calculated.',
      );
    default:
      return unavailable('This rule is not enabled for monetary estimates.');
  }
}

export function formatPenalty(result) {
  if (result.status !== 'estimated') return 'Not estimated';
  const usd = (n) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n);
  if (result.min === 0 && result.max === 0) return 'Written warning';
  if (result.min === 0) return `Up to ${usd(result.max)}`;
  return result.min === result.max
    ? usd(result.min)
    : `${usd(result.min)}–${usd(result.max)}`;
}
