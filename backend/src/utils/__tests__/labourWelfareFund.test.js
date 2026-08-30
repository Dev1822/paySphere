/**
 * Labour Welfare Fund (#1701).
 *
 * The boundaries worth naming, because each is a place a hand-rolled
 * implementation goes wrong and none of them is obvious from the amounts:
 *
 *   - the contribution period running *back* from the collection month, which
 *     is what makes December in a half-yearly state mean July–December;
 *   - LWF not pro-rating, which is the opposite of every other deduction;
 *   - liability decided on the last day of the period rather than on days
 *     worked;
 *   - the managerial exclusion needing capacity *and* wage together;
 *   - slab boundaries being inclusive, because the notifications say "not
 *     exceeding";
 *   - and a state with staff and no rule being surfaced rather than skipped.
 */

const {
  PERIODICITY,
  EXCLUSION,
  resolveContributionPeriod,
  resolveSlab,
  assessEmployee,
  remittanceSchedule,
  assessState,
  assessPeriod,
  collectionCalendar,
} = require('../labourWelfareFund');

/** Maharashtra: half-yearly, June and December, slabbed at ₹3,000. */
const MH = {
  state: 'MH',
  periodicity: PERIODICITY.HALF_YEARLY,
  contributionMonths: [6, 12],
  slabs: [
    { upTo: 3000, employee: 6, employer: 18 },
    { upTo: null, employee: 12, employer: 36 },
  ],
  establishmentThreshold: 5,
  managerialWageThreshold: 3500,
  remittanceDueDays: 15,
  lateInterestRate: 0.12,
};

/** Karnataka: annual, December, flat. */
const KA = {
  state: 'KA',
  periodicity: PERIODICITY.ANNUAL,
  contributionMonths: [12],
  slabs: [{ upTo: null, employee: 20, employer: 40 }],
  establishmentThreshold: 50,
  managerialWageThreshold: 0,
  remittanceDueDays: 30,
  lateInterestRate: 0,
};

/** Kerala: monthly, flat, no managerial exclusion. */
const KL = {
  state: 'KL',
  periodicity: PERIODICITY.MONTHLY,
  contributionMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  slabs: [{ upTo: null, employee: 50, employer: 50 }],
  establishmentThreshold: 0,
  managerialWageThreshold: 0,
  remittanceDueDays: 5,
  lateInterestRate: 0.12,
};

const employee = (overrides = {}) => ({
  employeeId: 'e1',
  name: 'A Kumar',
  designation: 'Technician',
  state: 'MH',
  wages: 24000,
  managerial: false,
  joinedOn: '2020-01-01',
  leftOn: null,
  ...overrides,
});

describe('resolving the contribution period', () => {
  it('runs back from the collection month, half-yearly', () => {
    // December in a half-yearly state is July–December, not December–May.
    const period = resolveContributionPeriod(MH, 12, 2026);

    expect(period.startMonth).toBe(7);
    expect(period.startYear).toBe(2026);
    expect(period.endMonth).toBe(12);
    expect(period.label).toBe('2026-07 to 2026-12');
  });

  it('the other half-year is January to June', () => {
    const period = resolveContributionPeriod(MH, 6, 2026);

    expect(period.label).toBe('2026-01 to 2026-06');
  });

  it('crosses the year boundary where the window requires it', () => {
    // An annual state collecting in June covers July of the previous year
    // through June of this one — the case a naive implementation gets wrong.
    const june = {
      ...KA,
      periodicity: PERIODICITY.ANNUAL,
      contributionMonths: [6],
    };
    const period = resolveContributionPeriod(june, 6, 2026);

    expect(period.startMonth).toBe(7);
    expect(period.startYear).toBe(2025);
    expect(period.endYear).toBe(2026);
  });

  it('is a single month for a monthly state', () => {
    const period = resolveContributionPeriod(KL, 4, 2026);

    expect(period.monthsInPeriod).toBe(1);
    expect(period.periodStart.toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(period.periodEnd.toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  it('gets February right in a leap year', () => {
    const period = resolveContributionPeriod(KL, 2, 2028);

    expect(period.periodEnd.toISOString().slice(0, 10)).toBe('2028-02-29');
  });

  it('is null in a month the state does not collect in', () => {
    // A single `if (month === 12)` is wrong for two thirds of a multi-state
    // workforce, which is the whole reason the months are data.
    expect(resolveContributionPeriod(MH, 9, 2026)).toBeNull();
    expect(resolveContributionPeriod(KA, 6, 2026)).toBeNull();
  });
});

describe('resolving the slab', () => {
  it('is inclusive of the boundary', () => {
    // Maharashtra's lower slab is "wages not exceeding ₹3,000", so an employee
    // on exactly ₹3,000 is in it.
    expect(resolveSlab(MH, 3000).employee).toBe(6);
    expect(resolveSlab(MH, 3000.01).employee).toBe(12);
  });

  it('falls through to the open-ended slab', () => {
    expect(resolveSlab(MH, 90000).employee).toBe(12);
  });

  it('does not depend on the order the slabs are written in', () => {
    const reversed = { ...MH, slabs: [...MH.slabs].reverse() };

    expect(resolveSlab(reversed, 2500).employee).toBe(6);
  });

  it('is null where the rule has no slabs', () => {
    expect(resolveSlab({ ...MH, slabs: [] }, 5000)).toBeNull();
  });

  it('is null where every slab has a ceiling below the wage', () => {
    const capped = {
      ...MH,
      slabs: [{ upTo: 3000, employee: 6, employer: 18 }],
    };

    expect(resolveSlab(capped, 9000)).toBeNull();
  });
});

describe('who contributes', () => {
  const period = resolveContributionPeriod(MH, 12, 2026);

  const assess = (overrides, rule = MH, headcount = 40) =>
    assessEmployee({
      employee: employee(overrides),
      rule,
      period,
      stateHeadcount: headcount,
    });

  it('takes the slab amounts for a liable employee', () => {
    expect(assess({})).toMatchObject({
      liable: true,
      employeeShare: 12,
      employerShare: 36,
      total: 48,
    });
  });

  it('does not pro-rate a joiner', () => {
    // The rule that is the opposite of every other deduction in payroll: a
    // joiner in November owes the *full* amount for a half-year ending in
    // December.
    const result = assess({ joinedOn: '2026-11-20' });

    expect(result.liable).toBe(true);
    expect(result.employeeShare).toBe(12);
  });

  it('charges a leaver nothing at all', () => {
    // And the mirror of it: liability is decided on the last day of the period,
    // so somebody who left in November owes nothing rather than five sixths.
    const result = assess({ leftOn: '2026-11-30' });

    expect(result.liable).toBe(false);
    expect(result.code).toBe(EXCLUSION.NOT_ON_ROLLS_AT_PERIOD_END);
  });

  it('charges somebody who joins after the period end nothing', () => {
    expect(assess({ joinedOn: '2027-01-05' }).code).toBe(
      EXCLUSION.NOT_ON_ROLLS_AT_PERIOD_END,
    );
  });

  it('excludes a supervisor above the wage threshold', () => {
    expect(assess({ managerial: true, wages: 9000 }).code).toBe(
      EXCLUSION.MANAGERIAL_ABOVE_THRESHOLD,
    );
  });

  it('does not exclude a high earner who is not managerial', () => {
    // The exclusion is by capacity *and* wage together. A senior engineer on
    // ₹90,000 who supervises nobody is still liable.
    expect(assess({ managerial: false, wages: 90000 }).liable).toBe(true);
  });

  it('does not exclude a supervisor below the wage threshold', () => {
    expect(assess({ managerial: true, wages: 3000 }).liable).toBe(true);
  });

  it('does not exclude anybody where the state names no threshold', () => {
    expect(
      assess({ managerial: true, wages: 90000, state: 'KL' }, KL, 3).liable,
    ).toBe(true);
  });

  it('excludes everybody below the establishment threshold', () => {
    const result = assess({}, MH, 3);

    expect(result.code).toBe(EXCLUSION.BELOW_ESTABLISHMENT_THRESHOLD);
    expect(result.reason).toMatch(/3 against a threshold of 5/);
  });

  it('reports a missing state rule rather than deducting nothing quietly', () => {
    expect(
      assessEmployee({
        employee: employee(),
        rule: null,
        period,
        stateHeadcount: 40,
      }).code,
    ).toBe(EXCLUSION.NO_STATE_RULE);
  });
});

describe('the remittance schedule', () => {
  const period = resolveContributionPeriod(MH, 12, 2026);

  it('is due the stated number of days after the period end', () => {
    // An offset rather than a fixed calendar date, because the states express
    // it that way and a fixed date would be wrong for every state but one.
    const result = remittanceSchedule(MH, period, null, '2027-01-10', 4800);

    expect(result.dueBy.toISOString().slice(0, 10)).toBe('2027-01-15');
    expect(result.daysLate).toBe(0);
    expect(result.interest).toBe(0);
  });

  it('charges interest on a late remittance', () => {
    const result = remittanceSchedule(MH, period, '2027-03-16', null, 4800);

    // Whole days past a due date that runs to the end of 15 January, so a
    // remittance at any hour on the 15th is not late and the 16th of March is
    // fifty-nine rather than sixty.
    expect(result.daysLate).toBe(59);
    expect(result.interest).toBe(
      Math.round(((4800 * 0.12 * 59) / 365) * 100) / 100,
    );
  });

  it('charges nothing where the state names no interest rate', () => {
    const kaPeriod = resolveContributionPeriod(KA, 12, 2026);
    const result = remittanceSchedule(KA, kaPeriod, '2027-06-01', null, 6000);

    expect(result.daysLate).toBeGreaterThan(0);
    expect(result.interest).toBe(0);
  });

  it('measures an unremitted contribution to the date given', () => {
    const result = remittanceSchedule(MH, period, null, '2027-04-15', 4800);

    expect(result.paid).toBe(false);
    expect(result.daysLate).toBeGreaterThan(0);
  });
});

describe('a state for a collection month', () => {
  // The establishment threshold is exercised on its own below; here it would
  // only mask the slab and roll-date behaviour these cases are about.
  const MH_NO_THRESHOLD = { ...MH, establishmentThreshold: 0 };

  const staff = [
    employee({ employeeId: 'a', wages: 2800 }),
    employee({ employeeId: 'b', wages: 24000 }),
    employee({ employeeId: 'c', wages: 9000, managerial: true }),
    employee({ employeeId: 'd', wages: 30000, leftOn: '2026-08-01' }),
  ];

  it('splits liable lines from exclusions and totals both shares', () => {
    const result = assessState({
      rule: MH_NO_THRESHOLD,
      employees: staff,
      month: 12,
      year: 2026,
      asAt: '2027-01-10',
    });

    expect(result.collects).toBe(true);
    expect(result.liableCount).toBe(2);
    expect(result.excludedCount).toBe(2);
    expect(result.employeeTotal).toBe(6 + 12);
    expect(result.employerTotal).toBe(18 + 36);
    expect(result.total).toBe(72);
  });

  it('says so plainly in a month the state does not collect in', () => {
    const result = assessState({
      rule: MH_NO_THRESHOLD,
      employees: staff,
      month: 9,
      year: 2026,
    });

    expect(result.collects).toBe(false);
    expect(result.total).toBe(0);
    expect(result.reason).toMatch(/not a contribution month/i);
  });

  it('counts the headcount at the period end, not the roster', () => {
    // The leaver is off the rolls by 31 December, so the establishment is four
    // on paper and three for the threshold test.
    const result = assessState({
      rule: MH_NO_THRESHOLD,
      employees: staff,
      month: 12,
      year: 2026,
    });

    expect(result.headcountAtPeriodEnd).toBe(3);
  });

  it('excludes everybody where the period-end headcount is under the threshold', () => {
    const result = assessState({
      rule: KA,
      employees: staff.map((e) => ({ ...e, state: 'KA' })),
      month: 12,
      year: 2026,
    });

    // Karnataka's threshold is fifty and there are three on the rolls.
    expect(result.liableCount).toBe(0);
    expect(result.exclusions[0].code).toBe(
      EXCLUSION.BELOW_ESTABLISHMENT_THRESHOLD,
    );
  });
});

describe('a whole multi-state workforce', () => {
  // Same reasoning as above: the threshold has its own case, and two employees
  // in Maharashtra would otherwise fall under it and take the roll-up with them.
  const rules = [{ ...MH, establishmentThreshold: 0 }, KA, KL];

  const workforce = [
    employee({ employeeId: 'a', state: 'MH', wages: 24000 }),
    employee({ employeeId: 'b', state: 'MH', wages: 2500 }),
    employee({ employeeId: 'c', state: 'KL', wages: 30000 }),
    employee({ employeeId: 'd', state: 'TN', wages: 30000 }),
  ];

  it('collects only from the states that collect this month', () => {
    // June: Maharashtra collects, Karnataka does not, Kerala does every month.
    const result = assessPeriod({
      rules,
      employees: workforce,
      month: 6,
      year: 2026,
      asAt: '2026-07-10',
    });

    const collecting = result.states
      .filter((s) => s.collects)
      .map((s) => s.state);

    expect(collecting.sort()).toEqual(['KL', 'MH']);
    expect(result.collectingStates).toBe(2);
  });

  it('surfaces a state with staff and no rule rather than skipping it', () => {
    // Silence here reads as "nothing is due", which is the single most likely
    // way a multi-state workforce ends up under-remitting.
    const result = assessPeriod({
      rules,
      employees: workforce,
      month: 6,
      year: 2026,
    });

    expect(result.unruled).toEqual([
      expect.objectContaining({ state: 'TN', headcount: 1 }),
    ]);
  });

  it('totals the employee and employer shares separately', () => {
    const result = assessPeriod({
      rules,
      employees: workforce,
      month: 6,
      year: 2026,
      asAt: '2026-07-10',
    });

    // MH: 12 + 6 employee, 36 + 18 employer. KL: 50 and 50.
    expect(result.employeeTotal).toBe(12 + 6 + 50);
    expect(result.employerTotal).toBe(36 + 18 + 50);
    expect(result.total).toBe(172);
  });

  it('rolls up interest across the states that are late', () => {
    const result = assessPeriod({
      rules,
      employees: workforce,
      month: 6,
      year: 2026,
      asAt: '2027-06-30',
    });

    expect(result.interest).toBeGreaterThan(0);
  });

  it('is quiet in a month nothing is collected', () => {
    const result = assessPeriod({
      rules: [MH, KA],
      employees: workforce.filter((e) => e.state !== 'KL'),
      month: 9,
      year: 2026,
    });

    expect(result.collectingStates).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('the collection calendar', () => {
  it('lists a half-yearly state twice with its due dates', () => {
    const calendar = collectionCalendar(MH, 2026);

    expect(calendar).toHaveLength(2);
    expect(calendar[0].dueBy.toISOString().slice(0, 10)).toBe('2026-07-15');
    expect(calendar[1].dueBy.toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('lists a monthly state twelve times', () => {
    expect(collectionCalendar(KL, 2026)).toHaveLength(12);
  });

  it('is empty for a rule with no contribution months', () => {
    expect(collectionCalendar({ ...MH, contributionMonths: [] }, 2026)).toEqual(
      [],
    );
  });
});
