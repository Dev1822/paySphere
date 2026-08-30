/**
 * Section 10A of the Industrial Employment (Standing Orders) Act, 1946 (#1828).
 *
 * The case worth stating first, because it is the reason the module is not date
 * arithmetic: the uplift from fifty per cent to seventy-five turns on a
 * **finding** — whether the delay in completing the enquiry is attributable to
 * the workman — and not on the calendar. Two suspensions of identical length
 * carry different entitlements depending on an answer somebody has to give.
 *
 * `ATTRIBUTABILITY.NOT_DETERMINED` therefore does not uplift. Defaulting the
 * other way would overpay by silence, and the only correction available
 * afterwards is recovery, which is the remedy labour law is least forgiving
 * about.
 *
 * The other boundaries:
 *
 *   - day 90 in the first tier and day 91 in the second, which is what "for the
 *     first ninety days" means;
 *   - the wage base frozen at the date of suspension, so a grade revision
 *     during a two-year suspension does not move it;
 *   - the drawn allowance becoming a set-off on reinstatement and nothing at
 *     all on dismissal;
 *   - a certified standing order permitted to better section 10A and not to
 *     undercut it;
 *   - and an establishment below the threshold that adopted standing orders
 *     still being bound by them.
 */

const {
  SUBSISTENCE_RULES,
  ATTRIBUTABILITY,
  OUTCOME,
  WAGE_BASIS,
  FINDING,
  SEVERITY,
  rateForDay,
  wageBase,
  entitlementSchedule,
  resolveOutcome,
  assessSuspension,
  assessApplicability,
  assessEstablishment,
} = require('../subsistenceAllowance');

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

/** ₹30,000 basic and ₹6,000 DA — ₹1,200 a day on a thirty-day month. */
const wages = { basic: 30000, dearnessAllowance: 6000 };

describe('the rate, and the finding it turns on', () => {
  it('pays fifty per cent through day ninety', () => {
    expect(rateForDay(1, ATTRIBUTABILITY.NOT_WORKMAN).percent).toBe(50);
    expect(rateForDay(90, ATTRIBUTABILITY.NOT_WORKMAN).percent).toBe(50);
    expect(rateForDay(90, ATTRIBUTABILITY.NOT_WORKMAN).tier).toBe(1);
  });

  it('moves to seventy-five on day ninety-one where the finding permits', () => {
    const rate = rateForDay(91, ATTRIBUTABILITY.NOT_WORKMAN);

    expect(rate.tier).toBe(2);
    expect(rate.percent).toBe(75);
    expect(rate.uplifted).toBe(true);
  });

  it('reaches full wages past day one hundred and eighty', () => {
    expect(rateForDay(180, ATTRIBUTABILITY.NOT_WORKMAN).percent).toBe(75);
    expect(rateForDay(181, ATTRIBUTABILITY.NOT_WORKMAN).percent).toBe(100);
  });

  it('does not uplift where the delay is the workman’s own conduct', () => {
    // The rate stays at fifty per cent however long the enquiry runs. Section
    // 10A does not reward the workman for a delay they caused.
    expect(rateForDay(120, ATTRIBUTABILITY.WORKMAN).percent).toBe(50);
    expect(rateForDay(400, ATTRIBUTABILITY.WORKMAN).percent).toBe(50);
  });

  it('does not uplift where nobody has made the finding', () => {
    // The whole point. A finding nobody has made is not a finding in the
    // workman's favour, and the alternative default overpays silently.
    expect(rateForDay(120, ATTRIBUTABILITY.NOT_DETERMINED).percent).toBe(50);
    expect(rateForDay(120, ATTRIBUTABILITY.NOT_DETERMINED).uplifted).toBe(
      false,
    );
  });

  it('refuses to answer without a finding at all', () => {
    expect(() => rateForDay(120)).toThrow(TypeError);
    expect(() => rateForDay(120, 'MAYBE')).toThrow(/not one of/);
  });
});

describe('which wages', () => {
  it('is basic plus dearness allowance, and says so', () => {
    const base = wageBase(wages);

    expect(base.basis).toBe(WAGE_BASIS.BASIC_PLUS_DA);
    expect(base.monthly).toBe(36000);
    expect(base.daily).toBe(1200);
    // Stated in the payload, because there are already three definitions of
    // "wages" live in this tree and this is a fourth.
    expect(base.note).toMatch(/not the gross/);
  });

  it('honours a rule set that counts a different number of days', () => {
    const base = wageBase(wages, { daysPerMonth: 26 });

    expect(base.daily).toBe(1384.62);
  });
});

describe('the schedule', () => {
  const schedule = (attributability, through = '2026-08-01') =>
    entitlementSchedule({
      suspendedOn: '2026-01-01',
      through,
      wages,
      attributability,
    });

  it('counts both ends, so a one-day suspension is one day', () => {
    const result = schedule(ATTRIBUTABILITY.NOT_WORKMAN, '2026-01-01');

    expect(result.days).toBe(1);
    expect(result.due).toBe(600);
  });

  it('bands the period into the three tiers', () => {
    const result = schedule(ATTRIBUTABILITY.NOT_WORKMAN);

    expect(result.days).toBe(213);
    expect(
      result.bands.map((band) => [band.tier, band.percent, band.days]),
    ).toEqual([
      [1, 50, 90],
      [2, 75, 90],
      [3, 100, 33],
    ]);
    // 90×600 + 90×900 + 33×1200
    expect(result.due).toBe(174600);
  });

  it('keeps every band at fifty per cent where no finding has been made', () => {
    const result = schedule(ATTRIBUTABILITY.NOT_DETERMINED);

    expect(result.bands.every((band) => band.percent === 50)).toBe(true);
    expect(result.due).toBe(213 * 600);
  });

  it('says when the rate next changes, so it need not be remembered', () => {
    const result = schedule(ATTRIBUTABILITY.NOT_WORKMAN, '2026-02-01');

    expect(result.nextTransition.onDay).toBe(91);
    expect(result.nextTransition.toPercent).toBe(75);
  });

  it('has no next transition once the third tier is reached', () => {
    expect(schedule(ATTRIBUTABILITY.NOT_WORKMAN).nextTransition).toBeNull();
  });

  it('reports the transition an un-made finding will not actually deliver', () => {
    // Day 91 arrives either way; what changes at it depends on the finding.
    const result = schedule(ATTRIBUTABILITY.NOT_DETERMINED, '2026-02-01');

    expect(result.nextTransition.onDay).toBe(91);
    expect(result.nextTransition.toPercent).toBe(50);
  });
});

describe('a certified standing order may better the statute', () => {
  it('accepts a more generous first tier', () => {
    const result = entitlementSchedule(
      {
        suspendedOn: '2026-01-01',
        through: '2026-01-30',
        wages,
        attributability: ATTRIBUTABILITY.NOT_DETERMINED,
      },
      { firstTierPercent: 75 },
    );

    expect(result.bands[0].percent).toBe(75);
  });

  it('clamps one that undercuts it rather than trusting the rule set', () => {
    // A stored figure below section 10A would produce an underpayment that
    // looks authorised, which is worse than a loud wrong number.
    const result = entitlementSchedule(
      {
        suspendedOn: '2026-01-01',
        through: '2026-01-30',
        wages,
        attributability: ATTRIBUTABILITY.NOT_DETERMINED,
      },
      { firstTierPercent: 25 },
    );

    expect(result.bands[0].percent).toBe(SUBSISTENCE_RULES.firstTierPercent);
  });
});

describe('what the drawn allowance becomes', () => {
  it('sets off against back wages on reinstatement', () => {
    const result = resolveOutcome({
      outcome: OUTCOME.REINSTATED_WITH_BACK_WAGES,
      drawn: 54000,
      backWages: 108000,
    });

    expect(result.setOff).toBe(54000);
    expect(result.netPayable).toBe(54000);
    expect(codesOf(result)).toContain(FINDING.SET_OFF_APPLIED);
  });

  it('never turns a set-off into a recovery', () => {
    // Back wages smaller than the allowance drawn nets to nil, not to a debt.
    const result = resolveOutcome({
      outcome: OUTCOME.REINSTATED_WITH_BACK_WAGES,
      drawn: 108000,
      backWages: 54000,
    });

    expect(result.netPayable).toBe(0);
    expect(result.recoverable).toBe(0);
  });

  it('does not recover the allowance on a dismissal', () => {
    const result = resolveOutcome({ outcome: OUTCOME.DISMISSED, drawn: 54000 });

    expect(result.recoverable).toBe(0);
    expect(codesOf(result)).toContain(FINDING.NOT_RECOVERABLE);
  });

  it('closes out a reinstatement with no back wages ordered', () => {
    const result = resolveOutcome({
      outcome: OUTCOME.REINSTATED_WITHOUT_BACK_WAGES,
      drawn: 54000,
    });

    expect(result.setOff).toBe(0);
    expect(result.netPayable).toBe(0);
  });
});

describe('a suspension end to end', () => {
  const suspension = {
    suspensionId: 's1',
    employeeId: 'e1',
    name: 'Bhaskar Naik',
    suspendedOn: '2026-01-01',
    asAt: '2026-08-01',
    wages,
    attributability: ATTRIBUTABILITY.NOT_DETERMINED,
    paid: 0,
  };

  it('prices what a finding would be worth, rather than only noting its absence', () => {
    const result = assessSuspension(suspension);
    const entry = result.findings.find(
      (row) => row.code === FINDING.ATTRIBUTABILITY_NOT_DETERMINED,
    );

    // 174,600 with the finding against 127,800 without it.
    expect(entry.differenceIfFound).toBe(174600 - 127800);
    expect(entry.severity).toBe(SEVERITY.EXPOSURE);
  });

  it('does not ask for a finding that cannot yet matter', () => {
    // Inside the first ninety days the rate is fifty per cent either way.
    const result = assessSuspension({ ...suspension, asAt: '2026-02-01' });

    expect(codesOf(result)).not.toContain(
      FINDING.ATTRIBUTABILITY_NOT_DETERMINED,
    );
  });

  it('treats non-payment as an offence in its own right', () => {
    const result = assessSuspension(suspension);
    const entry = result.findings.find((row) => row.code === FINDING.UNPAID);

    expect(entry.section).toBe('section 10A(4)');
    expect(entry.severity).toBe(SEVERITY.BREACH);
  });

  it('reports an underpayment with the shortfall', () => {
    const result = assessSuspension({ ...suspension, paid: 100000 });

    expect(codesOf(result)).toContain(FINDING.UNDERPAID);
    expect(result.shortfall).toBe(127800 - 100000);
  });

  it('reports an overpayment rather than netting it into a recovery', () => {
    const result = assessSuspension({ ...suspension, paid: 200000 });

    expect(codesOf(result)).toContain(FINDING.OVERPAID);
    expect(result.excess).toBe(200000 - 127800);
    expect(result.shortfall).toBe(0);
  });

  it('flags a suspension with no recorded wage base', () => {
    // The entitlement would otherwise compute to nil and look compliant.
    const result = assessSuspension({ ...suspension, wages: {} });

    expect(codesOf(result)).toContain(FINDING.WAGE_BASIS_UNRECORDED);
  });

  it('carries the statutory-treatment declaration with the result', () => {
    const result = assessSuspension(suspension);

    // One decision, consumed everywhere — rather than six independent ones
    // falling out of whichever module reads the payslip row.
    expect(result.treatment).toEqual({
      basis: WAGE_BASIS.BASIC_PLUS_DA,
      countsForProvidentFund: false,
      countsForEsi: false,
      countsForBonus: false,
      countsForTds: true,
    });
  });

  it('honours a rule set that takes a different view of the treatment', () => {
    const result = assessSuspension(suspension, { countsForEsi: true });

    expect(result.treatment.countsForEsi).toBe(true);
  });

  it('stamps every finding with the suspension it belongs to', () => {
    const result = assessSuspension(suspension);

    for (const entry of result.findings) {
      expect(entry.suspensionId).toBe('s1');
      expect(entry.employeeName).toBe('Bhaskar Naik');
    }
  });
});

describe('the section 1(3) threshold', () => {
  it('is not certifiable below the state’s threshold', () => {
    const result = assessApplicability({ workmen: 60 });

    expect(result.certifiable).toBe(false);
    expect(codesOf(result)).toEqual([FINDING.NOT_APPLICABLE]);
  });

  it('binds an establishment that adopted standing orders anyway', () => {
    // Reported rather than used as a gate: returning nil for a bound
    // establishment would be wrong.
    const result = assessApplicability({
      workmen: 60,
      standingOrdersCertified: true,
    });

    expect(result.certifiable).toBe(false);
    expect(result.applicable).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('honours a state that certifies at fifty', () => {
    const result = assessApplicability(
      { workmen: 60 },
      { standingOrdersThreshold: 50 },
    );

    expect(result.certifiable).toBe(true);
  });
});

describe('the establishment', () => {
  const establishment = {
    applicability: { workmen: 400 },
    suspensions: [
      {
        suspensionId: 's1',
        name: 'Bhaskar Naik',
        suspendedOn: '2026-01-01',
        asAt: '2026-08-01',
        wages,
        attributability: ATTRIBUTABILITY.NOT_DETERMINED,
        paid: 127800,
      },
      {
        suspensionId: 's2',
        name: 'Fatima Sheikh',
        suspendedOn: '2026-06-01',
        asAt: '2026-08-01',
        wages,
        attributability: ATTRIBUTABILITY.NOT_DETERMINED,
        paid: 37200,
      },
      {
        suspensionId: 's3',
        name: 'Vikram Rathod',
        suspendedOn: '2026-01-01',
        concludedOn: '2026-05-01',
        wages,
        attributability: ATTRIBUTABILITY.NOT_WORKMAN,
        paid: 80000,
        outcome: OUTCOME.REINSTATED_WITH_BACK_WAGES,
        backWages: 144000,
      },
    ],
  };

  it('counts the open suspensions waiting on a finding that now matters', () => {
    const result = assessEstablishment(establishment);

    // Only the first: the second is still inside the first ninety days, and the
    // third has both a finding and an outcome.
    expect(result.awaitingFindingCount).toBe(1);
  });

  it('prices what those findings are collectively worth', () => {
    const result = assessEstablishment(establishment);

    expect(result.exposureIfAttributed).toBe(174600 - 127800);
  });

  it('adds the set-off across concluded reinstatements', () => {
    const result = assessEstablishment(establishment);

    expect(result.setOffOnReinstatement).toBe(80000);
  });

  it('groups findings by code with a distinct suspension count', () => {
    const result = assessEstablishment(establishment);
    const transition = result.summary.find(
      (row) => row.code === FINDING.TIER_TRANSITION_DUE,
    );

    // Two of the three: the second is short of day ninety-one and the third of
    // day one hundred and eighty-one. The first has run past every tier, so
    // there is nothing left for it to transition to.
    expect(transition.suspensionCount).toBe(2);
    expect(
      result.suspensions.find((row) => row.suspensionId === 's1').schedule
        .nextTransition,
    ).toBeNull();
  });

  it('counts the open suspensions separately from the concluded ones', () => {
    const result = assessEstablishment(establishment);

    expect(result.suspensionCount).toBe(3);
    expect(result.openCount).toBe(2);
  });
});
