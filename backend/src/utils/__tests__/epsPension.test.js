/**
 * Employees' Pension Scheme, 1995 (#1769).
 *
 * The case worth stating first, because it is the reason the module exists: a
 * member on ₹40,000 for fifty-five months who dropped to ₹9,000 for the last
 * five. Cap each month and average gives **₹14,500**. Average the actual wages
 * and cap the result gives **₹15,000**, and the pension has been over-stated for
 * the rest of that person's life.
 *
 * The two orders differ whenever a single month in the window is below the
 * ceiling — which is every window containing a joining month, a maternity month
 * or a month of loss of pay.
 *
 * The other boundaries:
 *
 *   - the window reaching back sixty-four calendar months to find sixty
 *     contributory ones, rather than averaging four zeros;
 *   - the paragraph 10(2) bonus being added after the twenty-year test, so it
 *     can never satisfy its own threshold;
 *   - eligible service and pensionable service being separate numbers, so the
 *     ten-year threshold is not reached by the bonus;
 *   - the same four per cent a year running in both directions from 58;
 *   - and a member below ten years getting a Table D withdrawal rather than a
 *     monthly pension that will never be paid.
 */

const {
  EPS_ASSUMPTIONS,
  OUTCOME,
  FINDING,
  splitEmployerContribution,
  pensionableSalary,
  pensionableService,
  pastServiceBenefit,
  withdrawalBenefit,
  adjustForAge,
  computePension,
  projectToSuperannuation,
  valueScheme,
} = require('../epsPension');

/**
 * `count` months of `wage`, ending at `endMonth`/`endYear` and walking back.
 *
 * @returns {Array<object>}
 */
const monthsOf = (count, wage, endMonth = 3, endYear = 2026, options = {}) => {
  const rows = [];
  let month = endMonth;
  let year = endYear;

  for (let index = 0; index < count; index += 1) {
    rows.push({ month, year, wage, ...options });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return rows;
};

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

describe('the case the module exists for', () => {
  /** ₹40,000 for 55 months, then ₹9,000 for the last 5. */
  const history = [
    ...monthsOf(5, 9000, 3, 2026),
    ...monthsOf(55, 40000, 10, 2025),
  ];

  it('caps each month and then averages', () => {
    const result = pensionableSalary(history);

    // (15,000 × 55 + 9,000 × 5) / 60 = 14,500.
    expect(result.pensionableSalary).toBe(14500);
  });

  it('is not the same as averaging and then capping', () => {
    const result = pensionableSalary(history);

    // (40,000 × 55 + 9,000 × 5) / 60 = 37,416.67, capped to 15,000.
    expect(result.naiveAverageThenCap).toBe(15000);
    expect(result.pensionableSalary).toBeLessThan(result.naiveAverageThenCap);
  });

  it('reports the difference rather than merely avoiding it', () => {
    const result = pensionableSalary(history);

    const entry = result.findings.find(
      (f) => f.code === FINDING.CAPPED_BEFORE_AVERAGING,
    );

    expect(entry).toBeDefined();
    expect(entry.paragraph).toBe('paragraph 11(1) with 11(3)');
    expect(entry.averageThenCap).toBe(15000);
  });

  it('is worth ₹264.29 a month for life on 35 years of service', () => {
    const correct = computePension({
      member: { memberId: 'm1' },
      wageHistory: history,
      serviceMonths: 35 * 12,
      ageAtDrawing: 58,
    });

    // 35 eligible years, so 37 pensionable after the paragraph 10(2) bonus.
    // 14,500 × 37 / 70 = 7,664.29, against 15,000 × 37 / 70 = 7,928.57.
    expect(correct.pensionableSalary).toBe(14500);
    expect(correct.monthlyPension).toBe(7664.29);

    const wrong = Math.round(((15000 * 37) / 70 + Number.EPSILON) * 100) / 100;
    expect(wrong - correct.monthlyPension).toBeCloseTo(264.28, 2);
  });

  it('makes no difference where every month is above the ceiling', () => {
    // Both orders give 15,000, which is why the error hides in plain sight.
    const result = pensionableSalary(monthsOf(60, 40000));

    expect(result.pensionableSalary).toBe(15000);
    expect(result.naiveAverageThenCap).toBe(15000);
    expect(codesOf(result)).not.toContain(FINDING.CAPPED_BEFORE_AVERAGING);
  });

  it('makes no difference where every month is below it', () => {
    const result = pensionableSalary(monthsOf(60, 12000));

    expect(result.pensionableSalary).toBe(12000);
    expect(result.naiveAverageThenCap).toBe(12000);
  });

  it('makes a difference on a single sub-ceiling month in sixty', () => {
    const history59 = [
      ...monthsOf(1, 0, 3, 2026),
      ...monthsOf(59, 40000, 2, 2026),
    ];

    const result = pensionableSalary(history59);

    // (15,000 × 59) / 60 = 14,750, against 15,000.
    expect(result.pensionableSalary).toBe(14750);
    expect(codesOf(result)).toContain(FINDING.CAPPED_BEFORE_AVERAGING);
  });
});

describe('the window is sixty contributory months, not sixty calendar ones', () => {
  it('skips a non-contributory month rather than averaging in a zero', () => {
    const history = [
      ...monthsOf(2, 12000, 3, 2026),
      ...monthsOf(4, 0, 1, 2026, { contributory: false }),
      ...monthsOf(58, 12000, 9, 2025),
    ];

    const result = pensionableSalary(history);

    expect(result.monthsUsed).toBe(60);
    expect(result.pensionableSalary).toBe(12000);
  });

  it('reaches back sixty-four calendar months to find sixty', () => {
    const history = [
      ...monthsOf(2, 12000, 3, 2026),
      ...monthsOf(4, 0, 1, 2026, { contributory: false }),
      ...monthsOf(58, 12000, 9, 2025),
    ];

    const result = pensionableSalary(history);

    expect(result.windowMonths).toBe(64);
    expect(codesOf(result)).toContain(FINDING.WINDOW_EXTENDED);
  });

  it('averages the four zeros in if they are treated as contributory', () => {
    // The counter-case, asserted so the distinction is visible: this is what a
    // fixed calendar window would produce.
    const history = [
      ...monthsOf(2, 12000, 3, 2026),
      ...monthsOf(4, 0, 1, 2026),
      ...monthsOf(54, 12000, 9, 2025),
    ];

    const result = pensionableSalary(history);

    expect(result.monthsUsed).toBe(60);
    expect(result.pensionableSalary).toBe(11200);
  });

  it('averages what exists where there are fewer than sixty months', () => {
    const result = pensionableSalary(monthsOf(18, 12000));

    expect(result.monthsUsed).toBe(18);
    expect(result.pensionableSalary).toBe(12000);
    expect(codesOf(result)).toContain(FINDING.SHORT_AVERAGING_WINDOW);
  });

  it('takes the newest months regardless of the order given', () => {
    const history = [
      ...monthsOf(60, 20000, 3, 2020),
      ...monthsOf(60, 10000, 3, 2026),
    ];

    // Shuffled input, newest-first result.
    expect(pensionableSalary(history).pensionableSalary).toBe(10000);
  });
});

describe('pensionable service', () => {
  it('rounds six months up to a year', () => {
    expect(
      pensionableService({ serviceMonths: 12 * 14 + 6 }).eligibleYears,
    ).toBe(15);
  });

  it('drops five', () => {
    expect(
      pensionableService({ serviceMonths: 12 * 14 + 5 }).eligibleYears,
    ).toBe(14);
  });

  it('rounds the total, not each spell', () => {
    // Two spells of seven months are fourteen months and one year, not two.
    expect(pensionableService({ serviceMonths: 14 }).eligibleYears).toBe(1);
  });

  it('adds the two-year bonus at twenty years', () => {
    const service = pensionableService({ serviceMonths: 20 * 12 });

    expect(service.eligibleYears).toBe(20);
    expect(service.pensionableYears).toBe(22);
    expect(service.bonusApplied).toBe(true);
  });

  it('does not add it at nineteen', () => {
    const service = pensionableService({ serviceMonths: 19 * 12 });

    expect(service.pensionableYears).toBe(19);
    expect(service.bonusApplied).toBe(false);
  });

  it('never lets the bonus satisfy its own threshold', () => {
    // 18 + 2 = 20, and the answer is still 18. Testing after adding would give
    // a member with eighteen years the twenty-year treatment.
    const service = pensionableService({ serviceMonths: 18 * 12 });

    expect(service.eligibleYears).toBe(18);
    expect(service.pensionableYears).toBe(18);
  });

  it('keeps eligible and pensionable service as separate numbers', () => {
    const service = pensionableService({ serviceMonths: 25 * 12 });

    expect(service.eligibleYears).toBe(25);
    expect(service.pensionableYears).toBe(27);
  });
});

describe('the ten-year threshold', () => {
  it('pays a pension at ten years', () => {
    const result = computePension({
      member: { memberId: 'm1' },
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 10 * 12,
      ageAtDrawing: 58,
    });

    expect(result.outcome).toBe(OUTCOME.PENSION);
    // 15,000 × 10 / 70 = 2,142.86.
    expect(result.monthlyPension).toBe(2142.86);
  });

  it('pays a withdrawal benefit below it', () => {
    const result = computePension({
      member: { memberId: 'm1' },
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 9 * 12,
      ageAtDrawing: 58,
    });

    expect(result.outcome).toBe(OUTCOME.WITHDRAWAL);
    expect(result.monthlyPension).toBe(0);
    // Table D: 9.88 × 15,000.
    expect(result.withdrawalBenefit).toBe(148200);
  });

  it('is tested on eligible service, so the bonus cannot reach it', () => {
    // A member at 9 years and 6 months rounds to 10 and qualifies; one at 9 and
    // 5 does not, and no bonus exists at that level to change it.
    expect(
      computePension({
        member: {},
        wageHistory: monthsOf(60, 15000),
        serviceMonths: 9 * 12 + 6,
        ageAtDrawing: 58,
      }).outcome,
    ).toBe(OUTCOME.PENSION);

    expect(
      computePension({
        member: {},
        wageHistory: monthsOf(60, 15000),
        serviceMonths: 9 * 12 + 5,
        ageAtDrawing: 58,
      }).outcome,
    ).toBe(OUTCOME.WITHDRAWAL);
  });

  it('reports why a withdrawal was paid', () => {
    const result = computePension({
      member: {},
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 6 * 12,
      ageAtDrawing: 58,
    });

    expect(codesOf(result)).toContain(FINDING.BELOW_ELIGIBLE_SERVICE);
  });

  it('caps the withdrawal wage at the ceiling', () => {
    expect(withdrawalBenefit({ eligibleYears: 5, monthlyWage: 40000 })).toEqual(
      {
        amount: round2(5.28 * 15000),
        factor: 5.28,
      },
    );

    function round2(value) {
      return Math.round((value + Number.EPSILON) * 100) / 100;
    }
  });
});

describe('the four per cent runs both ways from fifty-eight', () => {
  it('leaves the pension alone at fifty-eight', () => {
    const result = adjustForAge(10000, 58);

    expect(result.pension).toBe(10000);
    expect(result.adjustmentPercent).toBe(0);
  });

  it('reduces by four per cent a year below it', () => {
    const result = adjustForAge(10000, 55);

    expect(result.adjustmentPercent).toBe(-12);
    expect(result.pension).toBe(8800);
  });

  it('increases by four per cent a year above it', () => {
    const result = adjustForAge(10000, 60);

    expect(result.adjustmentPercent).toBe(8);
    expect(result.pension).toBe(10800);
  });

  it('stops increasing at sixty', () => {
    expect(adjustForAge(10000, 62).pension).toBe(10800);
  });

  it('pays nothing below fifty', () => {
    // There is no early pension to reduce, so a reduced figure would suggest
    // something is payable that is not.
    const result = adjustForAge(10000, 49);

    expect(result.pension).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('pays a reduced pension at exactly fifty', () => {
    const result = adjustForAge(10000, 50);

    expect(result.adjustmentPercent).toBe(-32);
    expect(result.pension).toBe(6800);
  });
});

describe('the minimum pension', () => {
  it('floors a small pension at ₹1,000', () => {
    const result = computePension({
      member: {},
      wageHistory: monthsOf(60, 5000),
      serviceMonths: 10 * 12,
      ageAtDrawing: 58,
    });

    // 5,000 × 10 / 70 = 714.29, floored to 1,000.
    expect(result.monthlyPension).toBe(EPS_ASSUMPTIONS.minimumMonthlyPension);
    expect(codesOf(result)).toContain(FINDING.MINIMUM_PENSION_APPLIED);
  });

  it('applies after the age reduction, not before it', () => {
    // 15,000 × 10 / 70 = 2,142.86, reduced 32% at fifty = 1,457.14 — above the
    // floor. Flooring first would give 2,142.86 and pay too much.
    const result = computePension({
      member: {},
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 10 * 12,
      ageAtDrawing: 50,
    });

    expect(result.monthlyPension).toBe(1457.14);
    expect(codesOf(result)).not.toContain(FINDING.MINIMUM_PENSION_APPLIED);
  });

  it('floors an early pension that falls below it', () => {
    const result = computePension({
      member: {},
      wageHistory: monthsOf(60, 10000),
      serviceMonths: 10 * 12,
      ageAtDrawing: 50,
    });

    // 10,000 × 10 / 70 = 1,428.57, reduced 32% = 971.43.
    expect(result.monthlyPension).toBe(1000);
  });
});

describe('the employer contribution split', () => {
  it('diverts ₹1,250 for a member above the ceiling', () => {
    const split = splitEmployerContribution({ monthlyWage: 40000 });

    expect(split.pensionableWage).toBe(15000);
    expect(split.toPension).toBe(1249.5);
  });

  it('diverts 8.33% of the wage for one below it', () => {
    const split = splitEmployerContribution({ monthlyWage: 12000 });

    expect(split.pensionableWage).toBe(12000);
    expect(split.toPension).toBe(999.6);
  });

  it('leaves the rest of the twelve per cent in the provident fund', () => {
    const split = splitEmployerContribution({ monthlyWage: 40000 });

    // 12% of 40,000 = 4,800, less the 1,249.50 diverted.
    expect(split.toProvidentFund).toBe(3550.5);
  });

  it('contributes on the whole wage under the higher-wage option', () => {
    const split = splitEmployerContribution({
      monthlyWage: 40000,
      higherWageOption: true,
    });

    expect(split.pensionableWage).toBe(40000);
    expect(split.toPension).toBe(3332);
    expect(split.findings.map((f) => f.code)).toContain(
      FINDING.HIGHER_WAGE_OPTION,
    );
  });

  it('uncaps the averaging too under the higher-wage option', () => {
    const result = pensionableSalary(monthsOf(60, 40000), {
      higherWageOption: true,
    });

    expect(result.pensionableSalary).toBe(40000);
  });
});

describe('past service, for a member who joined before November 1995', () => {
  it('takes the Table B amount and the years-to-58 factor', () => {
    const past = pastServiceBenefit({
      pastServiceYears: 12,
      salaryAtCommencement: 3000,
      yearsToSuperannuationAtCommencement: 10,
    });

    // Above ₹2,500, 11 to 15 years → ₹105, times the 10-year factor 1.476.
    expect(past.tableAmount).toBe(105);
    expect(past.factor).toBe(1.476);
    expect(past.amount).toBe(154.98);
  });

  it('uses the lower band at or below ₹2,500', () => {
    const past = pastServiceBenefit({
      pastServiceYears: 12,
      salaryAtCommencement: 2500,
      yearsToSuperannuationAtCommencement: 0,
    });

    expect(past.tableAmount).toBe(95);
    expect(past.amount).toBe(95);
  });

  it('adds it to the formula pension rather than blending it in', () => {
    const result = computePension({
      member: {},
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 20 * 12,
      ageAtDrawing: 58,
      pastService: {
        pastServiceYears: 12,
        salaryAtCommencement: 3000,
        yearsToSuperannuationAtCommencement: 10,
      },
    });

    // 15,000 × 22 / 70 = 4,714.29, plus 154.98.
    expect(result.formulaPension).toBe(4714.29);
    expect(result.pastServiceBenefit).toBe(154.98);
    expect(result.monthlyPension).toBe(4869.27);
  });

  it('is nothing for a member with no pre-1995 service', () => {
    expect(pastServiceBenefit({ pastServiceYears: 0 }).amount).toBe(0);
  });
});

describe('projecting a serving member to superannuation', () => {
  it('adds the remaining years of service', () => {
    const projection = projectToSuperannuation({
      member: {},
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 15 * 12,
      ageNow: 48,
    });

    // 15 years now, 10 more to 58 = 25 eligible, 27 pensionable.
    expect(projection.yearsRemaining).toBe(10);
    expect(projection.pensionableYears).toBe(27);
    expect(projection.monthlyPension).toBe(5785.71);
  });

  it('draws at fifty-eight, so there is no age adjustment', () => {
    const projection = projectToSuperannuation({
      member: {},
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 15 * 12,
      ageNow: 48,
    });

    expect(projection.ageAdjustmentPercent).toBe(0);
  });

  it('adds nothing for somebody already past fifty-eight', () => {
    const projection = projectToSuperannuation({
      member: {},
      wageHistory: monthsOf(60, 15000),
      serviceMonths: 30 * 12,
      ageNow: 60,
    });

    expect(projection.yearsRemaining).toBe(0);
  });
});

describe('the scheme', () => {
  const member = (id, wage, months, extra = {}) => ({
    member: { memberId: id, name: id },
    wageHistory: monthsOf(60, wage),
    serviceMonths: months,
    ageAtDrawing: 58,
    ...extra,
  });

  it('separates pensioners from withdrawals', () => {
    const scheme = valueScheme([
      member('a', 15000, 25 * 12),
      member('b', 15000, 5 * 12),
      member('c', 12000, 30 * 12),
    ]);

    expect(scheme.memberCount).toBe(3);
    expect(scheme.pensionerCount).toBe(2);
    expect(scheme.withdrawalCount).toBe(1);
  });

  it('totals only the monthly pensions actually payable', () => {
    const scheme = valueScheme([
      member('a', 15000, 25 * 12),
      member('b', 15000, 5 * 12),
    ]);

    // Only a: 15,000 × 27 / 70.
    expect(scheme.monthlyPensionTotal).toBe(5785.71);
    expect(scheme.annualPensionTotal).toBe(69428.52);
  });

  it('counts how many members the capping order mattered for', () => {
    const scheme = valueScheme([
      // Every month above the ceiling — the order makes no difference.
      member('a', 40000, 25 * 12),
      // A window with sub-ceiling months in it.
      {
        member: { memberId: 'b', name: 'b' },
        wageHistory: [
          ...monthsOf(5, 9000, 3, 2026),
          ...monthsOf(55, 40000, 10, 2025),
        ],
        serviceMonths: 25 * 12,
        ageAtDrawing: 58,
      },
    ]);

    expect(scheme.affectedByCapOrder).toBe(1);
  });

  it('carries the member onto every finding', () => {
    const scheme = valueScheme([member('Asha', 15000, 25 * 12)]);

    const bonus = scheme.findings.find(
      (entry) => entry.code === FINDING.SERVICE_BONUS_ADDED,
    );

    expect(bonus.memberName).toBe('Asha');
    expect(bonus.paragraph).toBe('paragraph 10(2)');
  });

  it('summarises by code with a distinct member count', () => {
    const scheme = valueScheme([
      member('a', 15000, 25 * 12),
      member('b', 15000, 22 * 12),
    ]);

    const bonus = scheme.summary.find(
      (entry) => entry.code === FINDING.SERVICE_BONUS_ADDED,
    );

    expect(bonus.memberCount).toBe(2);
  });
});

describe('a member with no history at all', () => {
  it('is not a member rather than a pension of zero', () => {
    const result = computePension({
      member: { memberId: 'm1' },
      wageHistory: [],
      serviceMonths: 0,
    });

    expect(result.outcome).toBe(OUTCOME.NOT_A_MEMBER);
    expect(result.monthlyPension).toBe(0);
  });
});
