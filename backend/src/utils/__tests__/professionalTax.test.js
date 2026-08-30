/**
 * Professional tax — state rules, half-yearly states, ceiling (#1876).
 *
 * The assertions that matter are the ones a state-keyed slab table would fail:
 * that February in Maharashtra is ₹300, that Tamil Nadu aggregates a half-year
 * rather than multiplying a month, that the Article 276 ceiling binds across
 * states rather than within one, and that what section 16(iii) allows is what
 * was paid rather than what was deducted.
 */

const {
  ANNUAL_CEILING,
  PERIODICITY,
  LEVY_LEVEL,
  CATEGORY,
  EXEMPTION,
  FINDING,
  SEVERITY,
  SEED_RULES,
  financialYearMonths,
  halfYearOf,
  resolveRule,
  resolveStateForMonth,
  slabFor,
  slabsFor,
  monthlyLiability,
  halfYearlyLiability,
  attributeHalfYearly,
  applyAnnualCeiling,
  section16iiiDeduction,
  enrolmentLiability,
  computeEmployeeYear,
  assessEstablishment,
} = require('../professionalTax');

const evenYear = (financialYear, salary) =>
  financialYearMonths(financialYear).map((month) => ({ ...month, salary }));

describe('financialYearMonths', () => {
  it('runs April to March', () => {
    const months = financialYearMonths(2025);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2025, month: 4 });
    expect(months[11]).toEqual({ year: 2026, month: 3 });
  });
});

describe('halfYearOf', () => {
  it('splits April-September and October-March', () => {
    expect(halfYearOf({ year: 2025, month: 6 }).key).toBe('2025-H1');
    expect(halfYearOf({ year: 2025, month: 11 }).key).toBe('2025-H2');
  });

  it('puts January into the second half of the previous financial year', () => {
    // The half-year that starts in October 2025 ends in March 2026, and the
    // calendar year changes inside it.
    expect(halfYearOf({ year: 2026, month: 2 }).key).toBe('2025-H2');
  });

  it('carries the six months of the half-year', () => {
    expect(halfYearOf({ year: 2025, month: 5 }).months).toHaveLength(6);
    expect(halfYearOf({ year: 2025, month: 11 }).months).toHaveLength(6);
  });
});

describe('resolveRule', () => {
  it('picks the rule in force on the date, not the latest one', () => {
    const ruleSets = [
      {
        state: 'KA',
        effectiveFrom: '2015-04-01',
        periodicity: PERIODICITY.MONTHLY,
        slabs: [
          { upTo: 14999, amount: 0 },
          { upTo: null, amount: 200 },
        ],
      },
      {
        state: 'KA',
        effectiveFrom: '2023-04-01',
        periodicity: PERIODICITY.MONTHLY,
        slabs: [
          { upTo: 24999, amount: 0 },
          { upTo: null, amount: 200 },
        ],
      },
    ];

    expect(resolveRule('KA', '2023-03-01', ruleSets).effectiveFrom).toBe(
      '2015-04-01',
    );
    expect(resolveRule('KA', '2023-04-01', ruleSets).effectiveFrom).toBe(
      '2023-04-01',
    );
  });

  it('is case-insensitive on the state code', () => {
    expect(resolveRule('mh', '2025-06-01')).toBeTruthy();
  });

  it('returns null where no rule takes effect before the date', () => {
    expect(resolveRule('MH', '1990-01-01')).toBeNull();
  });

  it('returns null for a state it has never heard of', () => {
    expect(resolveRule('ZZ', '2025-06-01')).toBeNull();
  });

  it('carries the states that do not levy it, rather than omitting them', () => {
    // "No rule for this state" and "this state does not levy it" are different
    // answers, and only the first is a problem to be fixed.
    const delhi = resolveRule('DL', '2025-06-01');
    expect(delhi.periodicity).toBe(PERIODICITY.NOT_LEVIED);
  });
});

describe('slabFor', () => {
  const slabs = [
    { upTo: 7500, amount: 0 },
    { upTo: 10000, amount: 175 },
    { upTo: null, amount: 200 },
  ];

  it('treats upTo as inclusive', () => {
    expect(slabFor(7500, slabs).amount).toBe(0);
    expect(slabFor(7501, slabs).amount).toBe(175);
    expect(slabFor(10000, slabs).amount).toBe(175);
    expect(slabFor(10001, slabs).amount).toBe(200);
  });

  it('does not let a high earner fall off the end of the table', () => {
    expect(slabFor(10000000, slabs).amount).toBe(200);
  });

  it('returns null on an empty table', () => {
    expect(slabFor(1000, [])).toBeNull();
  });
});

describe('slabsFor', () => {
  it('uses the category table where the state has one', () => {
    const maharashtra = SEED_RULES.find((rule) => rule.state === 'MH');
    const women = slabsFor(maharashtra, CATEGORY.WOMAN);
    expect(women[0].upTo).toBe(25000);
  });

  it('falls back to the default table', () => {
    const karnataka = SEED_RULES.find((rule) => rule.state === 'KA');
    expect(slabsFor(karnataka, CATEGORY.WOMAN)).toBe(karnataka.slabs);
  });
});

describe('monthlyLiability', () => {
  const maharashtra = SEED_RULES.find((rule) => rule.state === 'MH');

  it('charges the February amount rather than the ordinary one', () => {
    // Not a rounding. Eleven months at 200 plus 300 lands on the ceiling.
    expect(
      monthlyLiability({
        rule: maharashtra,
        period: { year: 2026, month: 2 },
        salary: 50000,
      }).amount,
    ).toBe(300);

    expect(
      monthlyLiability({
        rule: maharashtra,
        period: { year: 2025, month: 6 },
        salary: 50000,
      }).amount,
    ).toBe(200);
  });

  it('does not charge the February amount to somebody below the threshold', () => {
    expect(
      monthlyLiability({
        rule: maharashtra,
        period: { year: 2026, month: 2 },
        salary: 5000,
      }).amount,
    ).toBe(0);
  });

  it('applies the women’s threshold as a different table', () => {
    const woman = monthlyLiability({
      rule: maharashtra,
      period: { year: 2025, month: 6 },
      salary: 20000,
      category: CATEGORY.WOMAN,
    });
    const man = monthlyLiability({
      rule: maharashtra,
      period: { year: 2025, month: 6 },
      salary: 20000,
    });

    expect(woman.amount).toBe(0);
    expect(man.amount).toBe(200);
  });

  it('exempts the person rather than moving the slab', () => {
    const result = monthlyLiability({
      rule: maharashtra,
      period: { year: 2025, month: 6 },
      salary: 50000,
      exemptions: [EXEMPTION.DISABILITY],
    });

    expect(result.amount).toBe(0);
    expect(result.exempt).toBe(true);
  });

  it('returns nothing for a half-yearly state', () => {
    const tamilNadu = SEED_RULES.find((rule) => rule.state === 'TN');
    expect(
      monthlyLiability({
        rule: tamilNadu,
        period: { year: 2025, month: 6 },
        salary: 50000,
      }).amount,
    ).toBe(0);
  });
});

describe('halfYearlyLiability', () => {
  const tamilNadu = SEED_RULES.find((rule) => rule.state === 'TN');

  it('charges on the aggregate of the half-year', () => {
    expect(
      halfYearlyLiability({ rule: tamilNadu, aggregateSalary: 50000 }).amount,
    ).toBe(690);
  });

  it('gives the same answer for the same total earned unevenly', () => {
    // This is the property a monthly engine with a multiplier cannot hold.
    const even = halfYearlyLiability({
      rule: tamilNadu,
      aggregateSalary: 90000,
    }).amount;
    const lumpy = halfYearlyLiability({
      rule: tamilNadu,
      aggregateSalary: 90000,
    }).amount;

    expect(even).toBe(lumpy);
    expect(even).toBe(1250);
  });
});

describe('attributeHalfYearly', () => {
  it('spreads evenly with the remainder on the last month', () => {
    const months = financialYearMonths(2025).slice(0, 6);
    const lines = attributeHalfYearly(1025, months);

    expect(lines).toHaveLength(6);
    expect(lines.slice(0, 5).every((line) => line.amount === 170)).toBe(true);
    expect(lines[5].amount).toBe(175);
    expect(lines.reduce((total, line) => total + line.amount, 0)).toBe(1025);
  });

  it('marks every line as an attribution', () => {
    const lines = attributeHalfYearly(
      600,
      financialYearMonths(2025).slice(0, 6),
    );
    expect(lines.every((line) => line.attributed === true)).toBe(true);
  });
});

describe('applyAnnualCeiling', () => {
  it('is the Article 276 figure', () => {
    expect(ANNUAL_CEILING).toBe(2500);
  });

  it('caps and reports what it capped from', () => {
    const result = applyAnnualCeiling(3200);
    expect(result.amount).toBe(2500);
    expect(result.cappedFrom).toBe(3200);
  });

  it('leaves an amount under the ceiling alone', () => {
    expect(applyAnnualCeiling(2400)).toEqual({
      amount: 2400,
      capped: false,
      cappedFrom: null,
    });
  });
});

describe('section16iiiDeduction', () => {
  it('reads payments and not accruals', () => {
    const result = section16iiiDeduction(
      [
        { paidOn: '2025-05-10', amount: 200 },
        { paidOn: '2025-06-10', amount: 200 },
      ],
      { from: '2025-04-01', to: '2026-03-31' },
    );

    expect(result.amount).toBe(400);
  });

  it('excludes a payment made outside the window', () => {
    // Deducted in March and remitted in April belongs to the following year.
    const result = section16iiiDeduction(
      [{ paidOn: '2026-04-10', amount: 300 }],
      { from: '2025-04-01', to: '2026-03-31' },
    );

    expect(result.amount).toBe(0);
  });

  it('ignores rows with no date', () => {
    expect(
      section16iiiDeduction([{ amount: 500 }], {
        from: '2025-04-01',
        to: '2026-03-31',
      }).amount,
    ).toBe(0);
  });
});

describe('enrolmentLiability', () => {
  it('is the employer’s own tax, capped at the Article 276 ceiling', () => {
    const rule = SEED_RULES.find((entry) => entry.state === 'MH');
    expect(enrolmentLiability({ rule, annualAmount: 2500 }).amount).toBe(2500);
    expect(enrolmentLiability({ rule, annualAmount: 9999 }).amount).toBe(2500);
  });

  it('is nil in a state that does not levy', () => {
    const rule = SEED_RULES.find((entry) => entry.state === 'DL');
    expect(enrolmentLiability({ rule, annualAmount: 2500 }).amount).toBe(0);
  });
});

describe('computeEmployeeYear', () => {
  it('lands Maharashtra on the ceiling exactly', () => {
    const result = computeEmployeeYear({
      employee: { employeeId: '1', name: 'A', workState: 'MH' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 50000),
    });

    // Eleven months at 200 and February at 300.
    expect(result.accrued).toBe(2500);
    expect(result.lines.find((line) => line.month === 2).amount).toBe(300);
  });

  it('would be short by a hundred without the February rule', () => {
    const result = computeEmployeeYear({
      employee: { employeeId: '1', name: 'A', workState: 'MH' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 50000),
    });

    const twelveTimesTwoHundred = 2400;
    expect(result.accrued).toBe(twelveTimesTwoHundred + 100);
  });

  it('aggregates a Tamil Nadu half-year rather than multiplying a month', () => {
    const result = computeEmployeeYear({
      employee: { employeeId: '2', name: 'B', workState: 'TN' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 30000),
    });

    expect(result.periodicity).toBe(PERIODICITY.HALF_YEARLY);
    // 180,000 in each half is the top band, twice.
    expect(result.accrued).toBe(2500);
    expect(result.lines.every((line) => line.attributed)).toBe(true);
  });

  it('gives an uneven Tamil Nadu earner the same half-year as an even one', () => {
    const even = computeEmployeeYear({
      employee: { employeeId: '2', workState: 'TN' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 5000),
    });

    const lumpy = computeEmployeeYear({
      employee: { employeeId: '3', workState: 'TN' },
      financialYear: 2025,
      wageMonths: financialYearMonths(2025).map((month, index) => ({
        ...month,
        salary: index % 6 === 0 ? 30000 : 0,
      })),
    });

    expect(even.accrued).toBe(lumpy.accrued);
  });

  it('charges nothing in a state that does not levy', () => {
    const result = computeEmployeeYear({
      employee: { employeeId: '4', workState: 'DL' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 200000),
    });

    expect(result.accrued).toBe(0);
    expect(result.issues.map((issue) => issue.code)).toContain(
      FINDING.NOT_LEVIED_IN_STATE,
    );
  });

  it('refuses to guess a work state', () => {
    // The address gives the wrong state for anyone working away from where
    // they live, and the error is invisible because the deduction still looks
    // reasonable.
    const result = computeEmployeeYear({
      employee: { employeeId: '5', name: 'E' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 50000),
    });

    expect(result.accrued).toBe(0);
    expect(result.issues.map((issue) => issue.code)).toContain(
      FINDING.WORK_STATE_MISSING,
    );
  });

  it('flags Kerala without a local body', () => {
    const result = computeEmployeeYear({
      employee: { employeeId: '6', workState: 'KL' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 20000),
    });

    expect(result.levyLevel).toBe(LEVY_LEVEL.LOCAL_BODY);
    expect(result.issues.map((issue) => issue.code)).toContain(
      FINDING.LOCAL_BODY_NOT_SET,
    );
  });

  it('uses the table in force in each month when a state amends mid-year', () => {
    const ruleSets = [
      {
        state: 'XX',
        effectiveFrom: '2020-04-01',
        periodicity: PERIODICITY.MONTHLY,
        slabs: [{ upTo: null, amount: 100 }],
      },
      {
        state: 'XX',
        effectiveFrom: '2025-10-01',
        periodicity: PERIODICITY.MONTHLY,
        slabs: [{ upTo: null, amount: 200 }],
      },
    ];

    const result = computeEmployeeYear({
      employee: { employeeId: '7', workState: 'XX' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 50000),
      ruleSets,
    });

    // April to September at 100, October to March at 200.
    expect(result.lines.find((line) => line.month === 5).amount).toBe(100);
    expect(result.lines.find((line) => line.month === 11).amount).toBe(200);
  });

  it('caps a person at the ceiling and says it did', () => {
    const ruleSets = [
      {
        state: 'XX',
        effectiveFrom: '2020-04-01',
        periodicity: PERIODICITY.MONTHLY,
        slabs: [{ upTo: null, amount: 400 }],
      },
    ];

    const result = computeEmployeeYear({
      employee: { employeeId: '8', workState: 'XX' },
      financialYear: 2025,
      wageMonths: evenYear(2025, 50000),
      ruleSets,
    });

    expect(result.accruedBeforeCeiling).toBe(4800);
    expect(result.accrued).toBe(2500);
    expect(result.ceilingApplied).toBe(true);
  });
});

describe('assessEstablishment', () => {
  const twoStates = {
    financialYear: 2025,
    employees: [
      {
        employee: { employeeId: '1', name: 'Mumbai', workState: 'MH' },
        wageMonths: evenYear(2025, 50000),
      },
      {
        employee: { employeeId: '2', name: 'Bengaluru', workState: 'KA' },
        wageMonths: evenYear(2025, 50000),
      },
    ],
  };

  it('returns one remittance per registration certificate', () => {
    const result = assessEstablishment(twoStates);

    expect(result.registrations).toHaveLength(2);
    expect(result.registrations.map((row) => row.state).sort()).toEqual([
      'KA',
      'MH',
    ]);
  });

  it('keeps the employer’s enrolment liability apart from the deduction', () => {
    const result = assessEstablishment({
      ...twoStates,
      enrolments: [{ state: 'MH', annualAmount: 2500, enrolled: true }],
    });

    const maharashtra = result.registrations.find((row) => row.state === 'MH');
    expect(maharashtra.employerEnrolmentLiability).toBe(2500);
    expect(maharashtra.deductedFromEmployees).toBe(2500);
    // Two different certificates. Nothing adds them.
    expect(maharashtra).not.toHaveProperty('total');
  });

  it('flags a state with no recorded enrolment certificate', () => {
    const result = assessEstablishment(twoStates);
    expect(
      result.findings.some(
        (finding) => finding.code === FINDING.ENROLMENT_NOT_RECORDED,
      ),
    ).toBe(true);
  });

  it('reports what was paid separately from what was accrued', () => {
    const result = assessEstablishment({
      ...twoStates,
      payments: [{ paidOn: '2025-06-10', amount: 1000 }],
    });

    // Maharashtra lands on 2,500 because of February; Karnataka is a flat
    // 200 for twelve months and lands on 2,400. The hundred rupees between
    // them is the whole reason the special month is a rule.
    expect(result.accrued).toBe(4900);
    expect(result.paidForSection16iii).toBe(1000);
    expect(
      result.findings.some(
        (finding) => finding.code === FINDING.DEDUCTED_NOT_REMITTED,
      ),
    ).toBe(true);
  });

  it('raises a missing work state as a breach', () => {
    const result = assessEstablishment({
      financialYear: 2025,
      employees: [
        { employee: { employeeId: '9' }, wageMonths: evenYear(2025, 50000) },
      ],
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.WORK_STATE_MISSING,
    );
    expect(finding.severity).toBe(SEVERITY.BREACH);
  });

  it('leaves a not-levied state out of the registrations', () => {
    const result = assessEstablishment({
      financialYear: 2025,
      employees: [
        {
          employee: { employeeId: '10', workState: 'DL' },
          wageMonths: evenYear(2025, 50000),
        },
      ],
    });

    expect(result.registrations).toHaveLength(0);
    expect(result.accrued).toBe(0);
  });

  it('survives being called with nothing', () => {
    const result = assessEstablishment();
    expect(result.employees).toEqual([]);
    expect(result.registrations).toEqual([]);
  });
});

describe('State Transfer and Location History Handler', () => {
  it('resolves majority state correctly for mid-month transfers', () => {
    const employee = {
      workState: 'MH',
      workStateHistory: [
        { state: 'MH', startDate: '2026-08-01', endDate: '2026-08-20' }, // 20 days
        { state: 'KA', startDate: '2026-08-21', endDate: '2026-08-31' }, // 11 days
      ],
    };

    const state = resolveStateForMonth(employee, 2026, 8);
    expect(state).toBe('MH');

    const employee2 = {
      workState: 'MH',
      workStateHistory: [
        { state: 'MH', startDate: '2026-08-01', endDate: '2026-08-10' }, // 10 days
        { state: 'KA', startDate: '2026-08-11', endDate: '2026-08-31' }, // 21 days
      ],
    };

    const state2 = resolveStateForMonth(employee2, 2026, 8);
    expect(state2).toBe('KA');
  });

  it('prorates/splits PT lines correctly based on state history across the year', () => {
    const employee = {
      employeeId: 'emp-transfer',
      name: 'Transferred Worker',
      workState: 'MH',
      workStateHistory: [
        { state: 'MH', startDate: '2025-04-01', endDate: '2025-09-30' }, // First half in MH (monthly)
        { state: 'KA', startDate: '2025-10-01', endDate: '2026-03-31' }, // Second half in KA (monthly)
      ],
    };

    const result = computeEmployeeYear({
      employee,
      financialYear: 2025,
      wageMonths: evenYear(2025, 30000), // Salary ₹30,000 every month
    });

    // Check lines for first 6 months (April-September) should be MH
    const mhLines = result.lines.slice(0, 6);
    for (const line of mhLines) {
      expect(line.workState).toBe('MH');
      expect(line.amount).toBe(200); // MH slab for ₹30k is ₹200 (except Feb)
    }

    // Check lines for remaining months (October-March) should be KA
    const kaLines = result.lines.slice(6, 12);
    for (const line of kaLines) {
      expect(line.workState).toBe('KA');
      expect(line.amount).toBe(200); // KA slab for ₹30k is ₹200
    }
  });

  it('prevents double-deductions within the same calendar month by selecting majority state', () => {
    const employee = {
      employeeId: 'emp-mid-month',
      workState: 'MH',
      workStateHistory: [
        { state: 'MH', startDate: '2025-04-01', endDate: '2025-04-10' }, // 10 days
        { state: 'KA', startDate: '2025-04-11', endDate: '2025-04-30' }, // 20 days (majority)
      ],
    };

    const result = computeEmployeeYear({
      employee,
      financialYear: 2025,
      wageMonths: [{ year: 2025, month: 4, salary: 30000 }],
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].workState).toBe('KA');
    expect(result.lines[0].amount).toBe(200); // Single deduction applied
  });
});
