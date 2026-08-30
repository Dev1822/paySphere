/**
 * Section 89(1) relief on salary arrears (#1969).
 *
 * The assertions that matter are the ones a single current slab table cannot
 * make: that a relation year is priced at *its own* year's rates, that a year
 * with no table on file is refused rather than treated as nil, that the relief
 * is floored at nil rather than becoming a recovery, and that the relief and
 * the employer's authority to give it are two different answers.
 *
 * `RELIEF_IS_CONDITIONAL` has its own block. Section 192(2A) is the part that
 * costs the employer money when it is missed, and a relief figure shown without
 * it invites exactly that.
 */

const {
  RELIEF_RULES,
  REGIME,
  GAP,
  FINDING,
  SEVERITY,
  RELIEF_IS_CONDITIONAL,
  financialYearOf,
  assessmentYearOf,
  yearLabel,
  financialYearsBetween,
  daysOfYearInPeriod,
  resolveRateTable,
  taxOn,
  allocateArrear,
  relationYearTerm,
  computeRelief,
  formTenE,
  applicability,
  assessArrear,
  assessEmployee,
} = require('../sectionEightyNineRelief');

const utc = (iso) => new Date(`${iso}T00:00:00.000Z`);
const codesOf = (findings) => findings.map((finding) => finding.code);

/**
 * Two deliberately *different* rate environments. The whole module is the
 * difference between them, so a fixture where they agree would prove nothing.
 */
const OLD_2022 = {
  assessmentYear: 2022,
  regime: REGIME.OLD,
  slabs: [
    { from: 0, upto: 250000, rate: 0 },
    { from: 250000, upto: 500000, rate: 0.05 },
    { from: 500000, upto: 1000000, rate: 0.2 },
    { from: 1000000, upto: null, rate: 0.3 },
  ],
  rebateIncomeLimit: 500000,
  rebateCap: 12500,
  cessRate: 0.04,
};

const OLD_2023 = { ...OLD_2022, assessmentYear: 2023 };

const NEW_2027 = {
  assessmentYear: 2027,
  regime: REGIME.NEW,
  slabs: [
    { from: 0, upto: 300000, rate: 0 },
    { from: 300000, upto: 700000, rate: 0.05 },
    { from: 700000, upto: 1000000, rate: 0.1 },
    { from: 1000000, upto: 1200000, rate: 0.15 },
    { from: 1200000, upto: 1500000, rate: 0.2 },
    { from: 1500000, upto: null, rate: 0.3 },
  ],
  rebateIncomeLimit: 700000,
  rebateCap: 25000,
  cessRate: 0.04,
  surcharge: [
    { above: 5000000, rate: 0.1 },
    { above: 10000000, rate: 0.15 },
  ],
};

const TABLES = [OLD_2022, OLD_2023, NEW_2027];

describe('financialYearOf', () => {
  it('runs April to March', () => {
    expect(financialYearOf('2026-04-01')).toBe(2026);
    expect(financialYearOf('2027-03-31')).toBe(2026);
    expect(financialYearOf('2026-03-31')).toBe(2025);
  });

  it('is null for an unparseable date rather than this year', () => {
    // A silent fallback to the current year would price an unknown relation
    // year against today's table, which is the one thing this module exists to
    // prevent.
    expect(financialYearOf('not a date')).toBeNull();
    expect(financialYearOf(null)).toBeNull();
  });
});

describe('assessmentYearOf and yearLabel', () => {
  it('FY 2021-22 is AY 2022-23', () => {
    expect(assessmentYearOf(2021)).toBe(2022);
    expect(yearLabel(2021)).toBe('2021-22');
  });

  it('pads the century rollover', () => {
    expect(yearLabel(2099)).toBe('2099-00');
    expect(yearLabel(2009)).toBe('2009-10');
  });
});

describe('financialYearsBetween', () => {
  it('lists every year a period touches', () => {
    expect(financialYearsBetween('2024-11-01', '2026-06-30')).toEqual([
      2024, 2025, 2026,
    ]);
  });

  it('is empty for an inverted period', () => {
    expect(financialYearsBetween('2026-06-30', '2024-11-01')).toEqual([]);
  });
});

describe('daysOfYearInPeriod', () => {
  it('counts only the overlap', () => {
    // 1 November to 31 March inclusive: 30 + 31 + 31 + 28 + 31 = 151.
    expect(daysOfYearInPeriod(2024, '2024-11-01', '2026-06-30')).toBe(151);
  });

  it('is nought where the year is outside the period', () => {
    expect(daysOfYearInPeriod(2020, '2024-11-01', '2026-06-30')).toBe(0);
  });
});

describe('resolveRateTable', () => {
  it('matches on the year and the regime together', () => {
    expect(resolveRateTable(TABLES, 2022, REGIME.OLD)).toBe(OLD_2022);
    expect(resolveRateTable(TABLES, 2027, REGIME.NEW)).toBe(NEW_2027);
  });

  it('returns null rather than the nearest table', () => {
    // The nearest table is the entire bug. Relief is the difference between two
    // rate environments; substituting one for the other is confidently wrong
    // rather than visibly absent.
    expect(resolveRateTable(TABLES, 2019, REGIME.OLD)).toBeNull();
    expect(resolveRateTable(TABLES, 2022, REGIME.NEW)).toBeNull();
  });
});

describe('taxOn', () => {
  it('applies the slabs marginally', () => {
    // 2,50,000 at nil, 2,50,000 at 5% = 12,500, 2,00,000 at 20% = 40,000.
    const result = taxOn({ totalIncome: 700000, table: OLD_2022 });
    expect(result.tax).toBe(52500);
    expect(result.rebate).toBe(0);
    expect(result.cess).toBe(2100);
    expect(result.total).toBe(54600);
  });

  it('gives the section 87A rebate below the limit and caps it', () => {
    const result = taxOn({ totalIncome: 480000, table: OLD_2022 });
    expect(result.tax).toBe(11500);
    expect(result.rebate).toBe(11500);
    expect(result.total).toBe(0);
  });

  it('withdraws the rebate a rupee above the limit', () => {
    const result = taxOn({ totalIncome: 500001, table: OLD_2022 });
    expect(result.rebate).toBe(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('charges cess on tax plus surcharge after the rebate', () => {
    const result = taxOn({ totalIncome: 6000000, table: NEW_2027 });
    expect(result.surcharge).toBe(Math.round(result.tax * 0.1));
    expect(result.cess).toBe(
      Math.round((result.tax + result.surcharge) * 0.04),
    );
  });
});

describe('allocateArrear', () => {
  it('splits by days rather than evenly', () => {
    // 1 November 2024 to 30 June 2026. An even three-way split would move
    // relief between years with different rates, which is the only variable the
    // computation turns on.
    const rows = allocateArrear({
      total: 1200000,
      relatesFrom: '2024-11-01',
      relatesTo: '2026-06-30',
    });

    expect(rows.map((r) => r.financialYear)).toEqual([2024, 2025, 2026]);
    expect(rows[0].amount).toBeLessThan(rows[1].amount);
    expect(rows[2].amount).toBeLessThan(rows[1].amount);
    expect(rows.every((r) => r.basis === 'DAYS')).toBe(true);
  });

  it('reconciles exactly to the arrear', () => {
    const rows = allocateArrear({
      total: 1000001,
      relatesFrom: '2024-11-01',
      relatesTo: '2026-06-30',
    });

    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(1000001);
  });

  it('prefers a recorded allocation over the derived one', () => {
    // A backdated bonus referable to a single year is not proportional to time,
    // and the caller knows that where the module cannot.
    const rows = allocateArrear({
      total: 500000,
      relatesFrom: '2024-11-01',
      relatesTo: '2026-06-30',
      explicit: [{ financialYear: 2025, amount: 500000 }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].basis).toBe('RECORDED');
    expect(rows[0].amount).toBe(500000);
  });
});

describe('relationYearTerm', () => {
  const assessed = {
    financialYear: 2021,
    totalIncome: 700000,
    regime: REGIME.OLD,
  };

  it('prices the year at its own rates', () => {
    const term = relationYearTerm({
      allocation: { financialYear: 2021, amount: 200000 },
      assessed,
      rateTables: TABLES,
    });

    expect(term.assessmentYear).toBe(2022);
    // 7,00,000 to 9,00,000 is all in the 20% band under the 2022 table.
    expect(term.additionalTax).toBe(Math.round(200000 * 0.2 * 1.04));
    expect(term.gap).toBeNull();
  });

  it('refuses a year with no table rather than reporting nil', () => {
    const term = relationYearTerm({
      allocation: { financialYear: 2018, amount: 200000 },
      assessed: {
        financialYear: 2018,
        totalIncome: 700000,
        regime: REGIME.OLD,
      },
      rateTables: TABLES,
    });

    expect(term.gap).toBe(GAP.NO_RATE_TABLE);
    expect(term.additionalTax).toBeNull();
    expect(term.reason).toMatch(/cannot be computed at that year/i);
  });

  it('refuses a year with no recorded regime', () => {
    // The relation-year term must be computed on the basis the employee was
    // actually assessed on, and there is no safe default for that.
    const term = relationYearTerm({
      allocation: { financialYear: 2021, amount: 200000 },
      assessed: { financialYear: 2021, totalIncome: 700000 },
      rateTables: TABLES,
    });

    expect(term.gap).toBe(GAP.REGIME_NOT_RECORDED);
    expect(term.additionalTax).toBeNull();
  });

  it('refuses a year with no assessed income', () => {
    const term = relationYearTerm({
      allocation: { financialYear: 2021, amount: 200000 },
      assessed: null,
      rateTables: TABLES,
    });

    expect(term.gap).toBe(GAP.NO_ASSESSED_INCOME);
  });
});

describe('computeRelief', () => {
  const assessedYears = [
    { financialYear: 2021, totalIncome: 700000, regime: REGIME.OLD },
    { financialYear: 2022, totalIncome: 750000, regime: REGIME.OLD },
  ];

  it('keeps all four terms of Rule 21A(2)', () => {
    const relief = computeRelief({
      receipt: {
        financialYear: 2026,
        regime: REGIME.NEW,
        totalIncomeExcludingArrears: 1400000,
      },
      allocations: [
        { financialYear: 2021, amount: 300000 },
        { financialYear: 2022, amount: 300000 },
      ],
      assessedYears,
      rateTables: TABLES,
    });

    // The employee defends this number personally, so every term is on it.
    expect(relief.taxIncludingArrears).toBeGreaterThan(
      relief.taxExcludingArrears,
    );
    expect(relief.taxOnBunching).toBe(
      relief.taxIncludingArrears - relief.taxExcludingArrears,
    );
    expect(relief.relationYearAdditionalTax).toBeGreaterThan(0);
    expect(relief.relief).toBe(
      relief.taxOnBunching - relief.relationYearAdditionalTax,
    );
  });

  it('gives relief where the bunching crossed a band the relation years did not', () => {
    const relief = computeRelief({
      receipt: {
        financialYear: 2026,
        regime: REGIME.NEW,
        totalIncomeExcludingArrears: 1400000,
      },
      allocations: [
        { financialYear: 2021, amount: 300000 },
        { financialYear: 2022, amount: 300000 },
      ],
      assessedYears,
      rateTables: TABLES,
    });

    expect(relief.relief).toBeGreaterThan(0);
  });

  it('floors at nil instead of producing a recovery', () => {
    // Relation years assessed high and a year of receipt assessed low: spreading
    // the arrear back costs more than bunching it. Section 89 gives relief; it
    // does not create a liability.
    const relief = computeRelief({
      receipt: {
        financialYear: 2026,
        regime: REGIME.NEW,
        totalIncomeExcludingArrears: 200000,
      },
      allocations: [{ financialYear: 2021, amount: 300000 }],
      assessedYears: [
        { financialYear: 2021, totalIncome: 2000000, regime: REGIME.OLD },
      ],
      rateTables: TABLES,
    });

    expect(relief.reliefBeforeFloor).toBeLessThan(0);
    expect(relief.relief).toBe(0);
    expect(relief.floored).toBe(true);
  });

  it('reports the year of receipt having no table as a gap, not as nil relief', () => {
    const relief = computeRelief({
      receipt: {
        financialYear: 2019,
        regime: REGIME.OLD,
        totalIncomeExcludingArrears: 900000,
      },
      allocations: [{ financialYear: 2021, amount: 300000 }],
      assessedYears,
      rateTables: TABLES,
    });

    expect(relief.gap).toBe(GAP.NO_RATE_TABLE);
    expect(relief.relief).toBeNull();
  });

  it('counts incomplete relation years rather than absorbing them', () => {
    const relief = computeRelief({
      receipt: {
        financialYear: 2026,
        regime: REGIME.NEW,
        totalIncomeExcludingArrears: 1400000,
      },
      allocations: [
        { financialYear: 2021, amount: 300000 },
        { financialYear: 2018, amount: 300000 },
      ],
      assessedYears,
      rateTables: TABLES,
    });

    // A relief computed over a subset of the years it relates to is not a
    // smaller relief. It is a wrong one, and it has to say so.
    expect(relief.incompleteRelationYears).toBe(1);
  });
});

describe('applicability', () => {
  it('refuses without Form 10E', () => {
    const result = applicability({ furnishing: null, assessmentYear: 2027 });
    expect(result.mayApply).toBe(false);
    expect(result.reason).toMatch(/section 192\(2A\)/i);
  });

  it('allows once the particulars are furnished', () => {
    const result = applicability({
      furnishing: { furnishedOn: '2027-05-01' },
      assessmentYear: 2027,
    });
    expect(result.mayApply).toBe(true);
  });

  it('refuses where the form followed the return', () => {
    const result = applicability({
      furnishing: { furnishedOn: '2027-08-01' },
      assessmentYear: 2027,
      returnFiledOn: '2027-07-15',
    });

    expect(result.mayApply).toBe(false);
    expect(result.lateAgainstReturn).toBe(true);
  });

  it('does not impose the condition on a year before it existed', () => {
    const result = applicability({
      furnishing: null,
      assessmentYear: RELIEF_RULES.formTenEMandatoryFromAssessmentYear - 1,
    });
    expect(result.mayApply).toBe(true);
  });
});

describe('formTenE', () => {
  it('builds Table A from the same result as the summary', () => {
    const relief = computeRelief({
      receipt: {
        financialYear: 2026,
        regime: REGIME.NEW,
        totalIncomeExcludingArrears: 1400000,
      },
      allocations: [{ financialYear: 2021, amount: 300000 }],
      assessedYears: [
        { financialYear: 2021, totalIncome: 700000, regime: REGIME.OLD },
      ],
      rateTables: TABLES,
    });

    const form = formTenE(relief);

    expect(form.tableA).toHaveLength(1);
    expect(form.annexureI.relief).toBe(relief.relief);
    expect(form.tableA[0].difference).toBe(
      relief.relationYears[0].additionalTax,
    );
    expect(form.complete).toBe(true);
  });

  it('carries an unpriced year onto the form as a gap rather than a zero', () => {
    // A zero in the "difference" column is a claim, and this module has not
    // made it.
    const relief = computeRelief({
      receipt: {
        financialYear: 2026,
        regime: REGIME.NEW,
        totalIncomeExcludingArrears: 1400000,
      },
      allocations: [{ financialYear: 2018, amount: 300000 }],
      assessedYears: [
        { financialYear: 2018, totalIncome: 700000, regime: REGIME.OLD },
      ],
      rateTables: TABLES,
    });

    const form = formTenE(relief);
    expect(form.tableA[0].gap).toBe(GAP.NO_RATE_TABLE);
    expect(form.tableA[0].difference).toBeNull();
    expect(form.complete).toBe(false);
  });
});

describe('assessArrear', () => {
  const arrear = {
    amount: 600000,
    paidOn: '2026-09-30',
    relatesFrom: '2021-04-01',
    relatesTo: '2023-03-31',
    regime: REGIME.NEW,
    totalIncomeExcludingArrears: 1400000,
    allocation: [
      { financialYear: 2021, amount: 300000 },
      { financialYear: 2022, amount: 300000 },
    ],
  };

  const assessedYears = [
    { financialYear: 2021, totalIncome: 700000, regime: REGIME.OLD },
    { financialYear: 2022, totalIncome: 750000, regime: REGIME.OLD },
  ];

  it('reports the relief and the applicable relief separately', () => {
    const result = assessArrear({ arrear, assessedYears, rateTables: TABLES });

    // A relief of ₹40,000 that cannot yet be applied is not a relief of nil,
    // and a page that showed it as nil would tell the employee they have
    // nothing to claim.
    expect(result.reliefComputed).toBeGreaterThan(0);
    expect(result.reliefApplicable).toBe(0);
    expect(codesOf(result.findings)).toContain(FINDING.FORM_10E_NOT_FURNISHED);
  });

  it('makes the relief applicable once Form 10E is on file', () => {
    const result = assessArrear({
      arrear,
      assessedYears,
      rateTables: TABLES,
      furnishing: { furnishedOn: '2027-04-15' },
    });

    expect(result.reliefApplicable).toBe(result.reliefComputed);
    expect(codesOf(result.findings)).toContain(
      FINDING.RELIEF_AVAILABLE_NOT_APPLIED,
    );
  });

  it('is quiet once the relief has been given', () => {
    const result = assessArrear({
      arrear,
      assessedYears,
      rateTables: TABLES,
      furnishing: { furnishedOn: '2027-04-15' },
      applied: true,
    });

    expect(codesOf(result.findings)).not.toContain(
      FINDING.RELIEF_AVAILABLE_NOT_APPLIED,
    );
    expect(codesOf(result.findings)).not.toContain(
      FINDING.FORM_10E_NOT_FURNISHED,
    );
  });

  it('flags a regime change across the years as informational, not as an error', () => {
    const result = assessArrear({ arrear, assessedYears, rateTables: TABLES });
    const finding = result.findings.find(
      (row) => row.code === FINDING.REGIME_CHANGED_ACROSS_YEARS,
    );

    expect(finding).toBeDefined();
    expect(finding.severity).toBe(SEVERITY.INFORMATIONAL);
  });

  it('flags an allocation that does not add back to the arrear', () => {
    const result = assessArrear({
      arrear: {
        ...arrear,
        allocation: [{ financialYear: 2021, amount: 100000 }],
      },
      assessedYears,
      rateTables: TABLES,
    });

    expect(codesOf(result.findings)).toContain(
      FINDING.ALLOCATION_DOES_NOT_RECONCILE,
    );
  });
});

describe('assessEmployee', () => {
  it('names the years holding more than one arrear rather than summing them', () => {
    // Two arrears paid in one financial year are one bunching. Computing them
    // separately double-counts the year-of-receipt term, so the roll-up says so
    // instead of adding the two figures together.
    const result = assessEmployee({
      arrears: [
        {
          amount: 300000,
          paidOn: '2026-06-30',
          allocation: [{ financialYear: 2021, amount: 300000 }],
          regime: REGIME.NEW,
          totalIncomeExcludingArrears: 1400000,
        },
        {
          amount: 200000,
          paidOn: '2026-11-30',
          allocation: [{ financialYear: 2022, amount: 200000 }],
          regime: REGIME.NEW,
          totalIncomeExcludingArrears: 1400000,
        },
      ],
      assessedYears: [
        { financialYear: 2021, totalIncome: 700000, regime: REGIME.OLD },
        { financialYear: 2022, totalIncome: 750000, regime: REGIME.OLD },
      ],
      rateTables: TABLES,
    });

    expect(result.receiptYearsWithMoreThanOneArrear).toEqual([2026]);
    expect(result.assessments).toHaveLength(2);
  });

  it('counts findings by severity', () => {
    const result = assessEmployee({
      arrears: [
        {
          amount: 300000,
          paidOn: '2026-06-30',
          allocation: [{ financialYear: 2021, amount: 300000 }],
          regime: REGIME.NEW,
          totalIncomeExcludingArrears: 1400000,
        },
      ],
      assessedYears: [
        { financialYear: 2021, totalIncome: 700000, regime: REGIME.OLD },
      ],
      rateTables: TABLES,
    });

    expect(result.severityCounts.DUE).toBeGreaterThan(0);
  });
});

describe('RELIEF_IS_CONDITIONAL', () => {
  it('names section 192(2A) and says whose money is at risk', () => {
    // A payroll that shows a relief figure without this invites somebody to
    // reduce the TDS on the strength of the figure alone, and the section
    // 201(1A) interest for doing so is the employer's.
    expect(RELIEF_IS_CONDITIONAL).toMatch(/Form 10E/);
    expect(RELIEF_IS_CONDITIONAL).toMatch(/201\(1A\)/);
    expect(RELIEF_IS_CONDITIONAL).toMatch(/employer/i);
  });

  it('travels on every relief result', () => {
    const result = assessArrear({
      arrear: {
        amount: 300000,
        paidOn: '2026-06-30',
        allocation: [{ financialYear: 2021, amount: 300000 }],
        regime: REGIME.NEW,
        totalIncomeExcludingArrears: 1400000,
      },
      assessedYears: [
        { financialYear: 2021, totalIncome: 700000, regime: REGIME.OLD },
      ],
      rateTables: TABLES,
    });

    expect(result.conditional).toBe(RELIEF_IS_CONDITIONAL);
    expect(result.relief.conditional).toBe(RELIEF_IS_CONDITIONAL);
  });
});
