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
    roadClass = 'other',
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
  if (!['other', 'controlled-access', 'interstate'].includes(roadClass))
    return unavailable('Choose a supported road classification.');
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
    case 'me-officer-min':
      if (zone !== 'ordinary' || roadClass !== 'interstate' || over >= 30)
        return unavailable(
          'This minimum covers ordinary Maine interstate/Turnpike speeding below 30 mph over only.',
        );
      return {
        ...result(
          50,
          null,
          'Statutory floor only. The applicable court schedule may require more; 30+ mph over is outside this infraction rule.',
        ),
        amountKind: 'minimum',
      };
    case 'nh-officer': {
      if (zone !== 'ordinary' || (limit > 55 && ![65, 70].includes(limit)))
        return unavailable(
          'Special zones and nonstandard maximums require the appropriate charging provision.',
        );
      if (limit >= 65 && roadClass === 'other')
        return unavailable(
          'The 65/70 mph schedule requires the specified divided/limited-access highway context.',
        );
      const tiers =
        limit === 70
          ? [
              [5, 65],
              [10, 100],
              [15, 200],
              [20, 300],
              [200, 400],
            ]
          : limit === 65
            ? [
                [5, 65],
                [10, 100],
                [15, 150],
                [20, 250],
                [200, 350],
              ]
            : [
                [10, 50],
                [15, 75],
                [20, 100],
                [25, 200],
                [200, 350],
              ];
      return result(
        tiers.find(([max]) => over <= max)[1],
        undefined,
        'RSA 265:60 base fine; the statutory penalty assessment is additional.',
      );
    }
    case 'ma-officer-min':
      if (zone !== 'ordinary')
        return unavailable('Special-zone charges require a separate review.');
      return {
        ...result(
          50 + Math.max(0, over - 10) * 10,
          null,
          'Minimum base fine only. Separate identified surcharges of $50 and $5 are not included, and other consequences can apply.',
        ),
        amountKind: 'minimum',
      };
    case 'ri-officer':
      if (zone !== 'ordinary' || prior !== 0)
        return unavailable(
          'This record models the ordinary first-offense schedule only.',
        );
      if (over <= 10)
        return result(
          95,
          undefined,
          'Published first-offense schedule; separate technology surcharge and other judicial consequences are not totaled.',
        );
      return {
        ...result(
          95 + over * 10,
          null,
          'Published higher-speed minimum; additional judicial/repeat provisions are not converted into a fixed payable amount.',
        ),
        amountKind: 'minimum',
      };
    case 'ri-school-camera':
      if (zone !== 'school' || over < 11)
        return unavailable(
          'Only an established qualifying school-zone program violation is modeled; lower-speed eligibility is not estimated.',
        );
      return result(
        50,
        undefined,
        'New-system initial 30-day warning period must have ended. This does not identify an active camera.',
      );
    case 'ct-city-camera':
      if (zone === 'work' || over < 10)
        return unavailable(
          'Select an eligible municipal program context; the CTDOT highway work-zone program has a separate rule.',
        );
      return result(
        0,
        prior === 0 ? 50 : 75,
        'Local ordinance cap, not a fixed local rate. Repeat window is one year. Up to $15 electronic-processing fee is excluded.',
      );
    case 'ct-work-camera':
      if (zone !== 'work' || limit < 45 || over < 10)
        return unavailable(
          'The CTDOT program requires an eligible operational work zone, a posted limit of at least 45 mph and an applicable recorded violation.',
        );
      return result(
        speed >= 85 || prior > 0 ? 75 : 0,
        undefined,
        speed >= 85
          ? 'At 85 mph or more, $75 applies even on a first offense.'
          : prior === 0
            ? 'First qualifying offense: written warning.'
            : 'Subsequent qualifying offense within one year: $75.',
      );
    case 'ct-officer':
      if (
        zone !== 'ordinary' ||
        speed > 85 ||
        speed <= (roadClass === 'other' ? 60 : 70)
      )
        return unavailable(
          'This range covers §14-219(c) passenger-vehicle speeds >60 through 85 on other roads, or >70 through 85 on multi-lane limited-access roads. Other charging provisions require review.',
        );
      return result(
        100,
        150,
        'Specified §14-219(c) base range only; trucks, junior-driver and reckless-driving provisions are not modeled.',
      );
    case 'de-speed': {
      if (
        prior > 1 ||
        (rule.mode === 'officer' && zone !== 'ordinary') ||
        (rule.mode === 'camera' && (zone === 'school' || over < 11))
      )
        return unavailable(
          'Select a covered ordinary officer or authorized camera scenario. Third and later qualifying offenses and unmodeled special zones need separate review.',
        );
      const rate =
        over <= 5
          ? 0
          : over <= 15
            ? prior
              ? 2
              : 1
            : over <= 19
              ? prior
                ? 3
                : 2
              : prior
                ? 4
                : 3;
      return result(
        (prior ? 25 : 20) + over * rate,
        undefined,
        '§4169(c) base formula. Repeat window is 24 months; camera work-zone assessments and conditional hearing costs are additional.',
      );
    }
    case 'nc-officer':
      if (over > 15 || speed > 80)
        return unavailable(
          'The entered speed meets a G.S. 20-141(j1) misdemeanor threshold. A routine infraction cap would be misleading.',
        );
      if (zone === 'school' || (zone === 'work' && input.workSigns !== true))
        return unavailable(
          'School-zone charges require separate review; a work-zone addition needs the legally required penalty signs established.',
        );
      return zone === 'work'
        ? result(
            250,
            350,
            'Qualifying posted work-zone $250 addition plus an ordinary infraction base penalty up to $100; costs and other charges excluded.',
          )
        : result(
            0,
            100,
            'Ordinary infraction statutory cap where no specific penalty supersedes it; not a fixed ticket amount.',
          );
    case 'sc-officer':
      if (zone !== 'ordinary' || prior !== 0 || [15, 25].includes(over))
        return unavailable(
          'Only the ordinary first-offense range is modeled. The exact 15/25 mph boundaries require charge/statutory interpretation review; no amount is guessed.',
        );
      return over <= 10
        ? result(15, 25)
        : over < 15
          ? result(25, 50)
          : over < 25
            ? result(50, 75)
            : result(
                75,
                200,
                'Potential imprisonment and other consequences above 25 mph over are not priced.',
              );
    case 'ga-school-camera':
      if (zone !== 'school' || over < 11)
        return unavailable(
          'This penalty record covers an established qualifying school-zone camera violation; it does not determine every permitted operating window or location condition.',
        );
      return result(
        prior === 0 ? 75 : 125,
        undefined,
        'Initial 30-day warnings and current permit, sign and school-session conditions must be established. Processing charges are excluded; July 2027 provisions are not applied.',
      );
    case 'fl-school-camera':
      if (zone !== 'school' || over <= 10)
        return unavailable(
          'This program requires an applicable school-related period and a recorded violation more than 10 mph over.',
        );
      return result(
        100,
        undefined,
        '§318.18(3)(d) school-camera penalty; differs from an officer-issued school-zone citation.',
      );
    case 'fl-officer': {
      if (over >= 30 || limit > 70)
        return unavailable(
          'Mandatory-hearing/severe-speed or unsupported road-limit cases require separate assessment.',
        );
      if (
        zone === 'work' &&
        (workers === 'unknown' || input.workSigns !== true)
      )
        return unavailable(
          'Construction-zone doubling requires qualifying worker/equipment presence and the prescribed posted notices.',
        );
      if (zone === 'school' && over <= 5) return result(50);
      const base =
        over <= 5
          ? 0
          : over <= 9
            ? 25
            : over <= 14
              ? 100
              : over <= 19
                ? 150
                : 175;
      return result(
        base *
          (zone === 'school' || (zone === 'work' && workers === 'yes') ? 2 : 1),
        undefined,
        base === 0
          ? 'Statutory warning for the modeled ordinary-speed infraction; other charges can still apply.'
          : '§318.18(3) base schedule only. Court costs and local assessments are additional.',
      );
    }
    case 'tx-officer': {
      if (zone === 'school')
        return unavailable(
          'School-zone charging and additional conditions require separate review.',
        );
      if (
        zone === 'work' &&
        (workers === 'unknown' ||
          (workers === 'yes' && (!input.workSigns || !input.workNotice)))
      )
        return unavailable(
          'Work-zone doubling requires workers, the prescribed maximum-speed sign, and a citation that states workers were present. Establish those conditions.',
        );
      const multiplier = zone === 'work' && workers === 'yes' ? 2 : 1;
      return result(
        multiplier,
        200 * multiplier,
        'General base range only; excludes the separate statutory $3 and $50 amounts, court costs and any different charge-specific penalties. Not a court quote.',
      );
    }
    case 'ca-officer-schedule':
      if (zone !== 'ordinary' || prior !== 0 || speed > 100 || limit > 70)
        return unavailable(
          'Only ordinary first-offense speed-chart cases through 100 mph are modeled; special zones, prior enhancements and higher speeds require separate review.',
        );
      return result(
        over <= 15 ? 35 : over <= 25 ? 70 : 100,
        undefined,
        'Published 2026 court-chart base amount; assessments make actual ticket totals substantially higher and county totals differ.',
      );
    case 'dc-speed':
      if (zone !== 'ordinary')
        return unavailable(
          'School/work-zone doubling conditions require separate review; this record models ordinary-road fines only.',
        );
      return result(
        over <= 10
          ? 50
          : over <= 15
            ? 100
            : over <= 20
              ? 150
              : over <= 25
                ? 200
                : roadClass === 'other'
                  ? 500
                  : 400,
        undefined,
        'Adopted August 7, 2026 ordinary-road schedule. Controlled-access status changes the highest tier. Other offenses and special-zone enhancements are not modeled.',
      );
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
      if (zone !== 'ordinary' || over < 11 || roadClass !== 'other')
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
  if (result.amountKind === 'minimum') return `At least ${usd(result.min)}`;
  if (result.min === 0 && result.max === 0) return 'Written warning';
  if (result.min === 0) return `Up to ${usd(result.max)}`;
  return result.min === result.max
    ? usd(result.min)
    : `${usd(result.min)}–${usd(result.max)}`;
}
