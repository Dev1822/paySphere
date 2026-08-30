/**
 * Employees' State Insurance Act, 1948 (#1768).
 *
 * The case worth stating first, because it is the one every payroll gets wrong:
 * a raise from ₹20,000 to ₹26,000 in July does not end coverage in July. The
 * Rule 50 proviso carries it to 30 September, and July, August and September are
 * contributed on **₹26,000** — the wages actually paid. Not the ₹21,000 ceiling,
 * and not the old ₹20,000.
 *
 * The other boundaries:
 *
 *   - overtime outside the coverage test and inside the contribution base, the
 *     same rupee on both sides of one line;
 *   - a January date belonging to the contribution period that began the
 *     previous October;
 *   - the two shares rounded up separately, so the total is not four per cent;
 *   - section 42(1) zeroing the employee's half and not the employer's;
 *   - and the continuation not surviving the period boundary, which is the
 *     entire point of the proviso.
 */

const {
  ESI_RULES,
  COVERAGE,
  FINDING,
  contributionPeriodFor,
  benefitPeriodFor,
  coverageWage,
  contributionWage,
  decideCoverage,
  computeContribution,
  assessEmployeePeriod,
  computeDelayCharges,
  dueDateFor,
  assessPeriod,
} = require('../esiContribution');

/** Wages that sit at `total` with no overtime. */
const wages = (basic, extra = {}) => ({ basic, ...extra });

const iso = (date) => date.toISOString().slice(0, 10);

const monthsOf = (result) => result.months.map((month) => month.status);

describe('contribution periods', () => {
  it('puts April to September in the first', () => {
    const period = contributionPeriodFor('2026-04-01');

    expect(period.key).toBe('2026-H1');
    expect(iso(period.start)).toBe('2026-04-01');
    expect(iso(period.end)).toBe('2026-09-30');
  });

  it('puts October to March in the second', () => {
    const period = contributionPeriodFor('2026-10-15');

    expect(period.key).toBe('2026-H2');
    expect(iso(period.start)).toBe('2026-10-01');
    expect(iso(period.end)).toBe('2027-03-31');
  });

  it('puts January in the period that began the previous October', () => {
    // The detail every home-grown implementation gets wrong: the period start
    // is in a different calendar year from the date.
    const period = contributionPeriodFor('2027-01-20');

    expect(period.key).toBe('2026-H2');
    expect(iso(period.start)).toBe('2026-10-01');
  });

  it('puts 31 March at the end of the second and 1 April at the start of the first', () => {
    expect(contributionPeriodFor('2027-03-31').key).toBe('2026-H2');
    expect(contributionPeriodFor('2027-04-01').key).toBe('2027-H1');
  });
});

describe('benefit periods lag by three months', () => {
  it('April–September pays for January–June of the next year', () => {
    const benefit = benefitPeriodFor(contributionPeriodFor('2026-06-01'));

    expect(iso(benefit.start)).toBe('2027-01-01');
    expect(iso(benefit.end)).toBe('2027-06-30');
  });

  it('October–March pays for July–December of the next year', () => {
    const benefit = benefitPeriodFor(contributionPeriodFor('2026-11-01'));

    expect(iso(benefit.start)).toBe('2027-07-01');
    expect(iso(benefit.end)).toBe('2027-12-31');
  });

  it('means somebody who left the scheme in September is still drawing in December', () => {
    // The lag is why dropping an employee the month their wages rose is visible
    // to the employee before it is visible to the employer.
    const benefit = benefitPeriodFor(contributionPeriodFor('2026-09-30'));

    expect(benefit.start <= new Date('2027-06-30')).toBe(true);
  });
});

describe('the overtime asymmetry', () => {
  const withOvertime = wages(20000, { overtime: 2000 });

  it('excludes overtime from the coverage test', () => {
    expect(coverageWage(withOvertime)).toBe(20000);
  });

  it('includes overtime in the contribution base', () => {
    expect(contributionWage(withOvertime)).toBe(22000);
  });

  it('keeps an employee in the scheme through a heavy overtime month', () => {
    // ₹22,000 paid, and ₹21,000 is the ceiling. Testing on the paid figure
    // would throw them out of the scheme for working extra hours.
    const decision = decideCoverage({
      wages: withOvertime,
      monthStart: new Date('2026-06-01'),
      period: contributionPeriodFor('2026-06-01'),
    });

    expect(decision.status).toBe(COVERAGE.COVERED);
    expect(decision.contributionWage).toBe(22000);
  });

  it('contributes on the ₹22,000, not the ₹20,000 it was tested on', () => {
    const contribution = computeContribution({
      contributionWage: 22000,
      daysWorked: 26,
    });

    // 0.75% of 22,000 = 165. Of 20,000 it would be 150.
    expect(contribution.employee).toBe(165);
  });
});

describe('the Rule 50 proviso — the case every payroll gets wrong', () => {
  const period = contributionPeriodFor('2026-07-01');

  /** ₹20,000 April to June, then ₹26,000 from July. */
  const raisedInJuly = [
    { month: 4, year: 2026, wages: wages(20000), daysWorked: 26 },
    { month: 5, year: 2026, wages: wages(20000), daysWorked: 26 },
    { month: 6, year: 2026, wages: wages(20000), daysWorked: 26 },
    { month: 7, year: 2026, wages: wages(26000), daysWorked: 26 },
    { month: 8, year: 2026, wages: wages(26000), daysWorked: 26 },
    { month: 9, year: 2026, wages: wages(26000), daysWorked: 26 },
  ];

  it('does not end coverage in the month of the raise', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1', name: 'Asha' },
      period,
      months: raisedInJuly,
    });

    expect(monthsOf(result)).toEqual([
      COVERAGE.COVERED,
      COVERAGE.COVERED,
      COVERAGE.COVERED,
      COVERAGE.CONTINUED,
      COVERAGE.CONTINUED,
      COVERAGE.CONTINUED,
    ]);
  });

  it('contributes on the raised wage, not on the ceiling', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1', name: 'Asha' },
      period,
      months: raisedInJuly,
    });

    const july = result.months.find((month) => month.month === 7);

    // The Act sets no cap on the base. Capping at 21,000 would give 158.
    expect(july.contributionWage).toBe(26000);
    expect(july.employeeContribution).toBe(Math.ceil(26000 * 0.0075));
    expect(july.employeeContribution).toBe(195);
  });

  it('records the date the ceiling was crossed', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1', name: 'Asha' },
      period,
      months: raisedInJuly,
    });

    const july = result.months.find((month) => month.month === 7);
    expect(iso(july.continuedFrom)).toBe('2026-07-01');

    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.CEILING_CROSSED_MID_PERIOD,
    );
  });

  it('does not restart when the wages fall back below the ceiling', () => {
    // Coverage never stopped, so there is nothing to restart. A boolean toggled
    // by the salary edit would flip twice and lose the continuation.
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1' },
      period,
      months: [
        { month: 4, year: 2026, wages: wages(20000), daysWorked: 26 },
        { month: 5, year: 2026, wages: wages(26000), daysWorked: 26 },
        { month: 6, year: 2026, wages: wages(19000), daysWorked: 26 },
      ],
    });

    expect(monthsOf(result)).toEqual([
      COVERAGE.COVERED,
      COVERAGE.CONTINUED,
      COVERAGE.CONTINUED,
    ]);
  });

  it('does not carry the continuation across the period boundary', () => {
    // The entire point of the proviso is that it runs to the end of *that*
    // period. Carrying it further would keep somebody in the scheme forever.
    const first = assessEmployeePeriod({
      employee: { employeeId: 'e1' },
      period,
      months: raisedInJuly,
    });

    expect(first.carriedForward.status).toBe(COVERAGE.EXCLUDED);
    expect(first.carriedForward.continuedFrom).toBeNull();

    const second = assessEmployeePeriod({
      employee: { employeeId: 'e1', carriedForward: first.carriedForward },
      period: contributionPeriodFor('2026-10-01'),
      months: [
        { month: 10, year: 2026, wages: wages(26000), daysWorked: 26 },
        { month: 11, year: 2026, wages: wages(26000), daysWorked: 26 },
      ],
    });

    expect(monthsOf(second)).toEqual([COVERAGE.EXCLUDED, COVERAGE.EXCLUDED]);
    expect(second.total).toBe(0);
  });

  it('excludes somebody who was already above the ceiling when the period began', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e2' },
      period,
      months: [
        { month: 4, year: 2026, wages: wages(30000), daysWorked: 26 },
        { month: 5, year: 2026, wages: wages(30000), daysWorked: 26 },
      ],
    });

    expect(monthsOf(result)).toEqual([COVERAGE.EXCLUDED, COVERAGE.EXCLUDED]);
  });

  it('brings somebody into the scheme at the start of a period when wages fall', () => {
    const result = assessEmployeePeriod({
      employee: {
        employeeId: 'e3',
        carriedForward: { status: COVERAGE.EXCLUDED, continuedFrom: null },
      },
      period: contributionPeriodFor('2026-10-01'),
      months: [{ month: 10, year: 2026, wages: wages(19000), daysWorked: 26 }],
    });

    expect(monthsOf(result)).toEqual([COVERAGE.COVERED]);
  });
});

describe('the ceiling', () => {
  const period = contributionPeriodFor('2026-04-01');

  it('covers at exactly the ceiling', () => {
    const decision = decideCoverage({
      wages: wages(ESI_RULES.wageCeiling),
      monthStart: new Date('2026-04-01'),
      period,
    });

    expect(decision.status).toBe(COVERAGE.COVERED);
  });

  it('excludes one rupee above it at the start of a period', () => {
    const decision = decideCoverage({
      wages: wages(ESI_RULES.wageCeiling + 1),
      monthStart: new Date('2026-04-01'),
      period,
    });

    expect(decision.status).toBe(COVERAGE.EXCLUDED);
  });

  it('uses the higher ceiling for a person with a disability', () => {
    const decision = decideCoverage({
      wages: wages(24000),
      monthStart: new Date('2026-04-01'),
      period,
      disabled: true,
    });

    expect(decision.ceiling).toBe(ESI_RULES.disabledWageCeiling);
    expect(decision.status).toBe(COVERAGE.COVERED);
  });
});

describe('the two shares are rounded up separately', () => {
  it('rounds each to the next rupee', () => {
    // 0.75% of 18,333 = 137.4975 → 138. 3.25% = 595.8225 → 596.
    const contribution = computeContribution({
      contributionWage: 18333,
      daysWorked: 26,
    });

    expect(contribution.employee).toBe(138);
    expect(contribution.employer).toBe(596);
  });

  it('gives a total that is not four per cent of the wage', () => {
    const contribution = computeContribution({
      contributionWage: 18333,
      daysWorked: 26,
    });

    expect(contribution.total).toBe(734);
    // Four per cent of 18,333 is 733.32, and rounding that gives 734 by luck
    // rather than by rule — so assert the halves, which is what is remitted.
    expect(contribution.employee + contribution.employer).toBe(734);
  });

  it('cannot be back-computed from the total', () => {
    // 0.75% of 10,001 = 75.0075 → 76. 3.25% = 325.03 → 326. Total 402.
    // Four per cent of 10,001 is 400.04, which is not 402.
    const contribution = computeContribution({
      contributionWage: 10001,
      daysWorked: 26,
    });

    expect(contribution.employee).toBe(76);
    expect(contribution.employer).toBe(326);
    expect(Math.ceil(10001 * 0.04)).not.toBe(contribution.total);
  });
});

describe('section 42(1) — the daily wage floor', () => {
  it('zeroes the employee half below the floor', () => {
    // ₹4,000 over 26 days is ₹153.85 a day, below ₹176.
    const contribution = computeContribution({
      contributionWage: 4000,
      daysWorked: 26,
    });

    expect(contribution.employee).toBe(0);
  });

  it('leaves the employer half payable', () => {
    // Treating "not liable" as "not covered" would drop this too, and it is
    // the employer's own statutory liability.
    const contribution = computeContribution({
      contributionWage: 4000,
      daysWorked: 26,
    });

    expect(contribution.employer).toBe(Math.ceil(4000 * 0.0325));
    expect(contribution.employer).toBe(130);
  });

  it('reports it rather than silently producing a zero', () => {
    const contribution = computeContribution({
      contributionWage: 4000,
      daysWorked: 26,
    });

    expect(contribution.findings.map((f) => f.code)).toContain(
      FINDING.EMPLOYEE_EXEMPT_EMPLOYER_LIABLE,
    );
  });

  it('is a test on the daily average, not on the monthly wage', () => {
    // The same ₹4,000 over 5 days is ₹800 a day and well above the floor.
    const contribution = computeContribution({
      contributionWage: 4000,
      daysWorked: 5,
    });

    expect(contribution.employee).toBe(30);
  });
});

describe('the disabled employer exemption', () => {
  it('waives the employer half inside the three years', () => {
    const contribution = computeContribution({
      contributionWage: 22000,
      daysWorked: 26,
      disabled: true,
      monthsSinceEngagement: 12,
    });

    expect(contribution.employer).toBe(0);
    expect(contribution.employee).toBe(165);
  });

  it('resumes it after thirty-six months', () => {
    const contribution = computeContribution({
      contributionWage: 22000,
      daysWorked: 26,
      disabled: true,
      monthsSinceEngagement: 36,
    });

    expect(contribution.employer).toBe(715);
  });
});

describe('benefit eligibility', () => {
  const period = contributionPeriodFor('2026-04-01');

  const monthsWith = (days) =>
    [4, 5, 6, 7, 8, 9].map((month) => ({
      month,
      year: 2026,
      wages: wages(18000),
      daysWorked: days,
    }));

  it('counts contribution days across the period', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1' },
      period,
      months: monthsWith(26),
    });

    expect(result.qualifyingDays).toBe(156);
    expect(result.benefitEligible).toBe(true);
  });

  it('reports a shortfall against the seventy-eight days', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1' },
      period,
      months: monthsWith(12),
    });

    expect(result.qualifyingDays).toBe(72);
    expect(result.benefitEligible).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.BELOW_QUALIFYING_DAYS,
    );
  });

  it('counts a month where the employee paid nothing under section 42(1)', () => {
    // A contribution was paid — by the employer — so the days count.
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1' },
      period,
      months: [
        { month: 4, year: 2026, wages: wages(4000), daysWorked: 26 },
        { month: 5, year: 2026, wages: wages(4000), daysWorked: 26 },
        { month: 6, year: 2026, wages: wages(4000), daysWorked: 26 },
      ],
    });

    expect(result.qualifyingDays).toBe(78);
    expect(result.employeeTotal).toBe(0);
    expect(result.employerTotal).toBeGreaterThan(0);
  });

  it('names the benefit period the days feed', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1' },
      period,
      months: monthsWith(26),
    });

    expect(result.benefitPeriod.key).toBe('2027-B1');
  });
});

describe('a month the employee was not employed', () => {
  it('contributes nothing and does not count days', () => {
    const result = assessEmployeePeriod({
      employee: { employeeId: 'e1' },
      period: contributionPeriodFor('2026-04-01'),
      months: [
        { month: 4, year: 2026, wages: wages(18000), daysWorked: 26 },
        {
          month: 5,
          year: 2026,
          wages: wages(0),
          daysWorked: 0,
          employed: false,
        },
      ],
    });

    expect(monthsOf(result)).toEqual([COVERAGE.COVERED, COVERAGE.NOT_EMPLOYED]);
    expect(result.qualifyingDays).toBe(26);
  });
});

describe('a late remittance carries two charges', () => {
  it('computes interest and damages separately', () => {
    const charges = computeDelayCharges({
      amount: 50000,
      dueOn: '2026-07-15',
      paidOn: '2026-08-14',
    });

    expect(charges.daysLate).toBe(30);
    expect(charges.interest).toBeGreaterThan(0);
    expect(charges.damages).toBeGreaterThan(0);
    // Both. Paying one does not discharge the other.
    expect(charges.total).toBe(charges.interest + charges.damages);
  });

  it('picks the Regulation 31C band from the delay', () => {
    expect(
      computeDelayCharges({
        amount: 50000,
        dueOn: '2026-07-15',
        paidOn: '2026-08-14',
      }).bandRatePercent,
    ).toBe(5);

    expect(
      computeDelayCharges({
        amount: 50000,
        dueOn: '2026-07-15',
        paidOn: '2026-12-15',
      }).bandRatePercent,
    ).toBe(15);

    expect(
      computeDelayCharges({
        amount: 50000,
        dueOn: '2026-07-15',
        paidOn: '2027-07-15',
      }).bandRatePercent,
    ).toBe(25);
  });

  it('charges nothing when it was paid on time', () => {
    const charges = computeDelayCharges({
      amount: 50000,
      dueOn: '2026-07-15',
      paidOn: '2026-07-15',
    });

    expect(charges.total).toBe(0);
    expect(charges.findings).toHaveLength(0);
  });

  it('falls due on the fifteenth of the following month', () => {
    expect(iso(dueDateFor(6, 2026))).toBe('2026-07-15');
    expect(iso(dueDateFor(12, 2026))).toBe('2027-01-15');
  });
});

describe('the establishment', () => {
  const period = contributionPeriodFor('2026-04-01');

  const employee = (id, monthly) => ({
    employee: { employeeId: id, name: id },
    period,
    months: [4, 5, 6].map((month) => ({
      month,
      year: 2026,
      wages: wages(monthly),
      daysWorked: 26,
    })),
  });

  it('counts who is in the scheme and who is being continued', () => {
    const result = assessPeriod(
      [
        employee('a', 18000),
        {
          employee: { employeeId: 'b', name: 'b' },
          period,
          months: [
            { month: 4, year: 2026, wages: wages(20000), daysWorked: 26 },
            { month: 5, year: 2026, wages: wages(26000), daysWorked: 26 },
            { month: 6, year: 2026, wages: wages(26000), daysWorked: 26 },
          ],
        },
        employee('c', 40000),
      ],
      { headcount: 25 },
    );

    expect(result.employeeCount).toBe(3);
    expect(result.coveredCount).toBe(2);
    expect(result.continuedCount).toBe(1);
  });

  it('reports that the Act does not apply below ten employees', () => {
    const result = assessPeriod([employee('a', 18000)], { headcount: 6 });

    expect(result.applicable).toBe(false);
    expect(result.findings[0].code).toBe(FINDING.NOT_APPLICABLE);
  });

  it('applies at exactly ten', () => {
    const result = assessPeriod([employee('a', 18000)], { headcount: 10 });

    expect(result.applicable).toBe(true);
    expect(result.findings.map((f) => f.code)).not.toContain(
      FINDING.NOT_APPLICABLE,
    );
  });

  it('totals the two shares separately', () => {
    const result = assessPeriod([employee('a', 18000)], { headcount: 25 });

    expect(result.employeeTotal).toBe(3 * Math.ceil(18000 * 0.0075));
    expect(result.employerTotal).toBe(3 * Math.ceil(18000 * 0.0325));
    expect(result.total).toBe(result.employeeTotal + result.employerTotal);
  });

  it('carries the employee onto every finding', () => {
    const result = assessPeriod(
      [
        {
          employee: { employeeId: 'b', name: 'Bhaskar' },
          period,
          months: [
            { month: 4, year: 2026, wages: wages(20000), daysWorked: 26 },
            { month: 5, year: 2026, wages: wages(26000), daysWorked: 26 },
          ],
        },
      ],
      { headcount: 25 },
    );

    const crossing = result.findings.find(
      (entry) => entry.code === FINDING.CEILING_CROSSED_MID_PERIOD,
    );

    expect(crossing.employeeName).toBe('Bhaskar');
    expect(crossing.month).toBe(5);
  });
});
