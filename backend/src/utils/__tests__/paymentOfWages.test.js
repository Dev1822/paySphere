/**
 * Payment of Wages Act, 1936 (#1767).
 *
 * The case worth stating first, because it is the reason the module takes the
 * whole deduction set rather than one deduction: five individually lawful
 * deductions summing to more than half the wages. There is no deduction to
 * reject, and every engine that produced one of them was right.
 *
 * The other boundaries:
 *
 *   - the seventy-five per cent ceiling being reached by the facts rather than
 *     chosen, and a one-rupee co-operative payment reaching it;
 *   - a deduction for absence coming out of the base rather than counting
 *     toward the ceiling;
 *   - two lawful fines of two per cent each being an unlawful four together;
 *   - a fine disallowed under section 8 not consuming ceiling headroom;
 *   - the termination deadline being two *working* days from the termination,
 *     not two days from the wage period;
 *   - and an unabatable set that cannot be brought within the ceiling at all.
 */

const {
  PAYMENT_OF_WAGES_LIMITS,
  DEDUCTION_KIND,
  FINDING,
  SEVERITY,
  classifyDeduction,
  resolveCeiling,
  evaluateFines,
  evaluateAbsenceDeduction,
  evaluateDamageDeductions,
  evaluatePaymentDeadline,
  evaluateWagePeriod,
  abateToCeiling,
  assessWagePeriod,
  assessRegister,
} = require('../paymentOfWages');

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

const findingFor = (result, code) =>
  (result.findings || []).find((entry) => entry.code === code);

const deduction = (label, amount, extra = {}) => ({
  label,
  amount,
  ...extra,
});

describe('classifying a deduction into a section 7(2) clause', () => {
  it('takes a declared kind over the label', () => {
    expect(
      classifyDeduction({
        label: 'monthly loan',
        kind: 'CO_OPERATIVE_SOCIETY',
      }),
    ).toBe(DEDUCTION_KIND.CO_OPERATIVE_SOCIETY);
  });

  it('reads the labels the existing deduction engines already write', () => {
    expect(classifyDeduction({ label: 'PF' })).toBe(
      DEDUCTION_KIND.PROVIDENT_FUND,
    );
    expect(classifyDeduction({ label: 'TDS' })).toBe(DEDUCTION_KIND.INCOME_TAX);
    expect(classifyDeduction({ label: 'Loan EMI' })).toBe(
      DEDUCTION_KIND.LOAN_RECOVERY,
    );
    expect(classifyDeduction({ label: 'Court attachment' })).toBe(
      DEDUCTION_KIND.COURT_ORDER,
    );
  });

  it('reads a co-operative society loan as a co-operative payment, not a loan', () => {
    // The 75% ceiling turns on this difference, so the co-operative test has to
    // run before the loan one.
    expect(classifyDeduction({ label: 'Co-operative society loan' })).toBe(
      DEDUCTION_KIND.CO_OPERATIVE_SOCIETY,
    );
  });

  it('treats professional tax and ESI as deductions required by law', () => {
    // Neither is named in section 7(2) because both post-date it. Reporting
    // them as withholdings would put a breach on every payslip in the country.
    expect(classifyDeduction({ label: 'Professional Tax' })).toBe(
      DEDUCTION_KIND.INCOME_TAX,
    );
    expect(classifyDeduction({ label: 'ESI' })).toBe(
      DEDUCTION_KIND.PROVIDENT_FUND,
    );
  });

  it('falls to unauthorised rather than guessing a clause', () => {
    expect(classifyDeduction({ label: 'Miscellaneous adjustment' })).toBe(
      DEDUCTION_KIND.UNAUTHORISED,
    );
    expect(classifyDeduction({ label: '' })).toBe(DEDUCTION_KIND.UNAUTHORISED);
    expect(classifyDeduction({})).toBe(DEDUCTION_KIND.UNAUTHORISED);
  });
});

describe('the section 7(3) ceiling', () => {
  it('is fifty per cent by default', () => {
    const ceiling = resolveCeiling(
      [{ kind: DEDUCTION_KIND.LOAN_RECOVERY, amount: 100 }],
      18000,
    );

    expect(ceiling.percent).toBe(50);
    expect(ceiling.amount).toBe(9000);
    expect(ceiling.raised).toBe(false);
  });

  it('rises to seventy-five because a co-operative payment is present', () => {
    const ceiling = resolveCeiling(
      [
        { kind: DEDUCTION_KIND.LOAN_RECOVERY, amount: 4000 },
        { kind: DEDUCTION_KIND.CO_OPERATIVE_SOCIETY, amount: 500 },
      ],
      18000,
    );

    expect(ceiling.percent).toBe(75);
    expect(ceiling.amount).toBe(13500);
    expect(ceiling.raised).toBe(true);
  });

  it('reaches seventy-five on a single rupee', () => {
    // Reads as a loophole and is what the proviso says: the ceiling rises where
    // the deductions are "wholly or partly" payments to co-operative societies,
    // and it sets no threshold. Asserted so that nobody quietly adds one.
    const ceiling = resolveCeiling(
      [
        { kind: DEDUCTION_KIND.LOAN_RECOVERY, amount: 9000 },
        { kind: DEDUCTION_KIND.CO_OPERATIVE_SOCIETY, amount: 1 },
      ],
      18000,
    );

    expect(ceiling.percent).toBe(75);
  });

  it('does not rise on a co-operative row of zero', () => {
    const ceiling = resolveCeiling(
      [{ kind: DEDUCTION_KIND.CO_OPERATIVE_SOCIETY, amount: 0 }],
      18000,
    );

    expect(ceiling.percent).toBe(50);
  });
});

describe('the aggregate nothing else catches', () => {
  /**
   * Five deductions, five different engines, every one of them lawful.
   *
   *   provident fund      2,160   section 7(2)(i)   — statutory
   *   professional tax      200   section 7(2)(g)   — statutory
   *   tax deducted        1,400   section 7(2)(g)   — statutory
   *   loan instalment     4,000   section 7(2)(fff) — contractual
   *   court attachment    1,500   section 7(2)(h)   — an order
   *                       -----
   *                       9,260   on wages of 18,000 = 51.4%
   */
  const fiveLawfulDeductions = [
    deduction('PF', 2160),
    deduction('Professional Tax', 200),
    deduction('TDS', 1400),
    deduction('Loan EMI', 4000),
    deduction('Court attachment', 1500),
  ];

  it('reports the breach although no single deduction is unlawful', () => {
    const result = assessWagePeriod({
      grossWages: 18000,
      deductions: fiveLawfulDeductions,
    });

    expect(codesOf(result)).not.toContain(FINDING.UNAUTHORISED_DEDUCTION);
    expect(codesOf(result)).toContain(FINDING.AGGREGATE_CEILING);

    const breach = findingFor(result, FINDING.AGGREGATE_CEILING);
    expect(breach.severity).toBe(SEVERITY.BREACH);
    expect(breach.total).toBe(9260);
    expect(breach.ceiling).toBe(9000);
  });

  it('abates the loan instalment and leaves the statutory deductions alone', () => {
    const result = assessWagePeriod({
      grossWages: 18000,
      deductions: fiveLawfulDeductions,
    });

    const byLabel = Object.fromEntries(
      result.deductions.map((entry) => [entry.label, entry]),
    );

    // 260 over the ceiling, and the loan is the highest-ranked abatable row.
    expect(byLabel['Loan EMI'].payable).toBe(3740);
    expect(byLabel['Loan EMI'].carryForward).toBe(260);

    expect(byLabel.PF.payable).toBe(2160);
    expect(byLabel.TDS.payable).toBe(1400);
    expect(byLabel['Court attachment'].payable).toBe(1500);

    expect(result.totals.deducted).toBe(9000);
    expect(result.totals.carryForward).toBe(260);
  });

  it('brings the same set inside the ceiling once a co-operative payment is added', () => {
    // The extra deduction makes the total larger and the position lawful,
    // because it moves the ceiling further than it moves the total.
    const result = assessWagePeriod({
      grossWages: 18000,
      deductions: [
        ...fiveLawfulDeductions,
        deduction('Co-operative society', 500),
      ],
    });

    expect(codesOf(result)).not.toContain(FINDING.AGGREGATE_CEILING);
    expect(result.totals.ceilingPercent).toBe(75);
    expect(result.totals.deducted).toBe(9760);
    expect(result.totals.carryForward).toBe(0);
  });
});

describe('absence comes out of the base, not out of the ceiling', () => {
  it('measures the fifty per cent against what was actually earned', () => {
    // Three days absent on a 30-day period against ₹18,000 is ₹1,800 of wages
    // never earned. The ceiling is half of ₹16,200, not half of ₹18,000.
    const result = assessWagePeriod({
      grossWages: 18000,
      absence: { periodDays: 30, absentDays: 3 },
      deductions: [deduction('Loss of pay', 1800), deduction('Loan EMI', 8000)],
    });

    expect(result.earnedWages).toBe(16200);
    expect(result.totals.ceiling).toBe(8100);
    expect(codesOf(result)).not.toContain(FINDING.AGGREGATE_CEILING);
  });

  it('would have permitted more than half the wages actually owed if it did not', () => {
    // Half of the *gross* is ₹9,000, and ₹8,500 sits below it — so the naive
    // reading passes this payslip. Against ₹16,200 of earned wages it is 52.5%.
    const result = assessWagePeriod({
      grossWages: 18000,
      absence: { periodDays: 30, absentDays: 3 },
      deductions: [deduction('Loss of pay', 1800), deduction('Loan EMI', 8500)],
    });

    expect(8500).toBeLessThan(18000 * 0.5);
    expect(codesOf(result)).toContain(FINDING.AGGREGATE_CEILING);
    expect(result.totals.deducted).toBe(8100);
    expect(result.netWages).toBe(8100);
  });

  it('is never abated, because it is not a deduction from earned wages', () => {
    const abatement = abateToCeiling(
      [
        { label: 'Loss of pay', kind: DEDUCTION_KIND.ABSENCE, amount: 5000 },
        { label: 'Loan', kind: DEDUCTION_KIND.LOAN_RECOVERY, amount: 5000 },
      ],
      6000,
    );

    const byLabel = Object.fromEntries(
      abatement.deductions.map((entry) => [entry.label, entry]),
    );

    expect(byLabel['Loss of pay'].carryForward).toBe(0);
    expect(byLabel.Loan.carryForward).toBe(4000);
  });
});

describe('section 9 — deduction for absence', () => {
  it('is proportionate to the period', () => {
    const result = evaluateAbsenceDeduction({
      wages: 30000,
      periodDays: 30,
      absentDays: 4,
      deducted: 4000,
    });

    expect(result.proportionate).toBe(4000);
    expect(result.findings).toHaveLength(0);
  });

  it('reports a deduction larger than the time lost', () => {
    const result = evaluateAbsenceDeduction({
      wages: 30000,
      periodDays: 30,
      absentDays: 2,
      deducted: 4000,
    });

    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.ABSENCE_DISPROPORTIONATE,
    );
    expect(result.excess).toBe(2000);
  });

  it('permits eight days for a concerted absence of ten or more', () => {
    // The only place in the Act where a deduction may exceed the time lost.
    const result = evaluateAbsenceDeduction({
      wages: 30000,
      periodDays: 30,
      absentDays: 2,
      deducted: 8000,
      concerted: true,
      participantCount: 12,
    });

    expect(result.permitted).toBe(8000);
    expect(result.findings.map((f) => f.code)).not.toContain(
      FINDING.ABSENCE_DISPROPORTIONATE,
    );
  });

  it('does not permit it for nine, however concerted', () => {
    const result = evaluateAbsenceDeduction({
      wages: 30000,
      periodDays: 30,
      absentDays: 2,
      deducted: 8000,
      concerted: true,
      participantCount: 9,
    });

    expect(result.permitted).toBe(2000);
    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.ABSENCE_DISPROPORTIONATE,
    );
  });

  it('caps the concerted deduction at eight days even for a longer strike', () => {
    const result = evaluateAbsenceDeduction({
      wages: 30000,
      periodDays: 30,
      absentDays: 15,
      deducted: 15000,
      concerted: true,
      participantCount: 40,
    });

    expect(result.permitted).toBe(8000);
    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.ABSENCE_DISPROPORTIONATE,
    );
  });
});

describe('section 8 — fines', () => {
  const periodEnd = new Date('2026-06-30T00:00:00Z');

  it('allows a fine within three per cent of the period', () => {
    const result = evaluateFines(
      [{ amount: 300, act: 'Late attendance' }],
      20000,
      {
        periodEnd,
      },
    );

    expect(result.ceiling).toBe(600);
    expect(result.recoverable).toBe(300);
    expect(result.findings).toHaveLength(0);
  });

  it('two lawful fines of two per cent are an unlawful four together', () => {
    // The same aggregation problem as section 7(3), one level down: the ceiling
    // is on the wage period, not on the fine.
    const result = evaluateFines(
      [
        { amount: 400, act: 'Late attendance' },
        { amount: 400, act: 'Late attendance' },
      ],
      20000,
      { periodEnd },
    );

    expect(result.ceiling).toBe(600);
    expect(result.recoverable).toBe(600);
    expect(result.disallowed).toBe(200);
    expect(result.findings.map((f) => f.code)).toContain(FINDING.FINE_CEILING);
  });

  it('disallows a fine for an act not on the approved list', () => {
    const result = evaluateFines([{ amount: 200, act: 'Untidy desk' }], 20000, {
      periodEnd,
      approvedActs: ['Late attendance', 'Absence without leave'],
    });

    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.FINE_UNAPPROVED_ACT,
    );
    expect(result.recoverable).toBe(0);
  });

  it('does not check the list when the establishment has not declared one', () => {
    // An empty list is "not recorded", not "nothing is approved". Reading it the
    // other way would disallow every fine in a fresh tenant.
    const result = evaluateFines([{ amount: 200, act: 'Untidy desk' }], 20000, {
      periodEnd,
    });

    expect(result.findings.map((f) => f.code)).not.toContain(
      FINDING.FINE_UNAPPROVED_ACT,
    );
  });

  it('disallows every fine on an employee under fifteen', () => {
    const result = evaluateFines(
      [
        { amount: 100, act: 'Late attendance' },
        { amount: 100, act: 'Late attendance' },
      ],
      20000,
      { periodEnd, age: 14 },
    );

    expect(result.recoverable).toBe(0);
    expect(
      result.findings.filter((f) => f.code === FINDING.FINE_ON_MINOR),
    ).toHaveLength(2);
  });

  it('bars a fine for an act more than sixty days old', () => {
    const result = evaluateFines(
      [{ amount: 200, act: 'Late attendance', imposedOn: '2026-04-01' }],
      20000,
      { periodEnd },
    );

    const bar = result.findings.find(
      (f) => f.code === FINDING.FINE_TIME_BARRED,
    );
    expect(bar).toBeDefined();
    expect(bar.daysSinceAct).toBe(90);
    expect(result.recoverable).toBe(0);
  });

  it('allows one at exactly sixty days', () => {
    const result = evaluateFines(
      [{ amount: 200, act: 'Late attendance', imposedOn: '2026-05-01' }],
      20000,
      { periodEnd },
    );

    expect(result.findings.map((f) => f.code)).not.toContain(
      FINDING.FINE_TIME_BARRED,
    );
  });

  it('forbids recovery by instalments', () => {
    const result = evaluateFines(
      [{ amount: 600, act: 'Late attendance', instalments: 3 }],
      20000,
      { periodEnd },
    );

    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.FINE_IN_INSTALMENTS,
    );
    expect(result.recoverable).toBe(0);
  });

  it('does not let a disallowed fine consume the ceiling headroom', () => {
    // ₹600 of headroom. The first fine is barred by age and must not eat it —
    // otherwise an unlawful fine crowds out a lawful one.
    const result = evaluateFines(
      [
        { amount: 500, act: 'Late attendance', imposedOn: '2026-01-01' },
        { amount: 500, act: 'Late attendance', imposedOn: '2026-06-20' },
      ],
      20000,
      { periodEnd },
    );

    expect(result.recoverable).toBe(500);
    expect(result.entries[1].recoverable).toBe(500);
  });
});

describe('section 10 — damage or loss', () => {
  it('caps the deduction at the assessed loss', () => {
    const findings = evaluateDamageDeductions([
      {
        label: 'Breakage',
        amount: 3000,
        assessedLoss: 1200,
        showCauseRecordedOn: '2026-06-10',
      },
    ]);

    expect(findings.map((f) => f.code)).toContain(FINDING.DAMAGE_EXCEEDS_LOSS);
  });

  it('is a breach without a show-cause even at an amount below the loss', () => {
    const findings = evaluateDamageDeductions([
      { label: 'Shortage', amount: 500, assessedLoss: 5000 },
    ]);

    expect(findings.map((f) => f.code)).toEqual([
      FINDING.DAMAGE_WITHOUT_SHOW_CAUSE,
    ]);
  });

  it('passes a recorded show-cause within the loss', () => {
    expect(
      evaluateDamageDeductions([
        {
          label: 'Breakage',
          amount: 800,
          assessedLoss: 1000,
          showCauseRecordedOn: '2026-06-10',
        },
      ]),
    ).toHaveLength(0);
  });
});

describe('section 5 — when the wages had to be paid', () => {
  it('allows seven days below a thousand employees', () => {
    const result = evaluatePaymentDeadline({
      periodEnd: '2026-06-30',
      paidOn: '2026-07-07',
      headcount: 40,
    });

    expect(result.dueOn.toISOString().slice(0, 10)).toBe('2026-07-07');
    expect(result.daysLate).toBe(0);
  });

  it('allows ten at a thousand or more', () => {
    const result = evaluatePaymentDeadline({
      periodEnd: '2026-06-30',
      paidOn: '2026-07-10',
      headcount: 1000,
    });

    expect(result.findings).toHaveLength(0);
  });

  it('reports the days late', () => {
    const result = evaluatePaymentDeadline({
      periodEnd: '2026-06-30',
      paidOn: '2026-07-12',
      headcount: 40,
    });

    expect(result.daysLate).toBe(5);
    expect(result.findings.map((f) => f.code)).toEqual([FINDING.PAYMENT_LATE]);
  });

  it('gives a terminated employee two working days from the termination', () => {
    // Not two days from the wage period. Friday 26 June, Saturday and Sunday
    // closed, so the two working days are Monday and Tuesday.
    const result = evaluatePaymentDeadline({
      periodEnd: '2026-06-30',
      terminatedOn: '2026-06-26',
      paidOn: '2026-06-30',
      weeklyOffDays: [0, 6],
    });

    expect(result.dueOn.toISOString().slice(0, 10)).toBe('2026-06-30');
    expect(result.findings).toHaveLength(0);
  });

  it('skips a declared holiday when counting the two working days', () => {
    const result = evaluatePaymentDeadline({
      periodEnd: '2026-06-30',
      terminatedOn: '2026-06-26',
      paidOn: '2026-06-30',
      weeklyOffDays: [0, 6],
      holidays: ['2026-06-29'],
    });

    expect(result.dueOn.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('cites section 5(4) rather than 5(1) for a termination', () => {
    const result = evaluatePaymentDeadline({
      periodEnd: '2026-06-30',
      terminatedOn: '2026-06-26',
      paidOn: '2026-07-06',
      weeklyOffDays: [0, 6],
    });

    expect(result.findings[0].code).toBe(FINDING.TERMINATION_PAYMENT_LATE);
    expect(result.findings[0].section).toBe('section 5(4)');
  });
});

describe('section 4 — the wage period', () => {
  it('accepts a calendar month', () => {
    expect(evaluateWagePeriod('2026-06-01', '2026-06-30')).toHaveLength(0);
  });

  it('accepts a thirty-one day month', () => {
    expect(evaluateWagePeriod('2026-07-01', '2026-07-31')).toHaveLength(0);
  });

  it('rejects a period longer than a month', () => {
    const findings = evaluateWagePeriod('2026-06-01', '2026-07-15');
    expect(findings.map((f) => f.code)).toEqual([FINDING.WAGE_PERIOD_TOO_LONG]);
    expect(findings[0].lengthDays).toBe(45);
  });
});

describe('abatement', () => {
  it('takes from the fine before the loan', () => {
    const result = abateToCeiling(
      [
        { label: 'Fine', kind: DEDUCTION_KIND.FINE, amount: 500 },
        { label: 'Loan', kind: DEDUCTION_KIND.LOAN_RECOVERY, amount: 5000 },
      ],
      5000,
    );

    const byLabel = Object.fromEntries(
      result.deductions.map((entry) => [entry.label, entry]),
    );

    expect(byLabel.Fine.carryForward).toBe(500);
    expect(byLabel.Loan.carryForward).toBe(0);
  });

  it('takes from the advance before the co-operative payment', () => {
    const result = abateToCeiling(
      [
        {
          label: 'Advance',
          kind: DEDUCTION_KIND.ADVANCE_RECOVERY,
          amount: 2000,
        },
        {
          label: 'Society',
          kind: DEDUCTION_KIND.CO_OPERATIVE_SOCIETY,
          amount: 2000,
        },
      ],
      3000,
    );

    const byLabel = Object.fromEntries(
      result.deductions.map((entry) => [entry.label, entry]),
    );

    expect(byLabel.Advance.carryForward).toBe(1000);
    expect(byLabel.Society.carryForward).toBe(0);
  });

  it('cannot bring an unabatable set within the ceiling, and says so', () => {
    // A large attachment against a small wage. There is nothing lawful the
    // employer may do, and the module must not abate what it may not abate.
    const result = abateToCeiling(
      [
        {
          label: 'Court attachment',
          kind: DEDUCTION_KIND.COURT_ORDER,
          amount: 8000,
        },
        { label: 'PF', kind: DEDUCTION_KIND.PROVIDENT_FUND, amount: 1200 },
      ],
      6000,
    );

    expect(result.abated).toBe(0);
    expect(result.findings.map((f) => f.code)).toContain(
      FINDING.ABATEMENT_INSUFFICIENT,
    );

    const residual = result.findings.find(
      (f) => f.code === FINDING.ABATEMENT_INSUFFICIENT,
    );
    expect(residual.residual).toBe(3200);
    expect(residual.unabatable).toBe(9200);
  });

  it('abates what it can and reports the rest', () => {
    const result = abateToCeiling(
      [
        {
          label: 'Court attachment',
          kind: DEDUCTION_KIND.COURT_ORDER,
          amount: 8000,
        },
        { label: 'Loan', kind: DEDUCTION_KIND.LOAN_RECOVERY, amount: 1000 },
      ],
      6000,
    );

    expect(result.abated).toBe(1000);
    expect(result.findings.map((f) => f.code)).toEqual([
      FINDING.ABATEMENT_APPLIED,
      FINDING.ABATEMENT_INSUFFICIENT,
    ]);
  });
});

describe('section 7(2) is a closed list', () => {
  it('reports an unrecognised deduction as a withholding of wages', () => {
    const result = assessWagePeriod({
      grossWages: 20000,
      deductions: [deduction('Notice shortfall recovery', 2000)],
    });

    const entry = findingFor(result, FINDING.UNAUTHORISED_DEDUCTION);
    expect(entry).toBeDefined();
    expect(entry.severity).toBe(SEVERITY.BREACH);
    expect(entry.message).toMatch(/Section 23/);
  });

  it('still reports it when the total is comfortably inside the ceiling', () => {
    // The ceiling has nothing to do with it. An unauthorised deduction of one
    // rupee is unlawful at any total.
    const result = assessWagePeriod({
      grossWages: 20000,
      deductions: [deduction('Miscellaneous adjustment', 1)],
    });

    expect(codesOf(result)).toContain(FINDING.UNAUTHORISED_DEDUCTION);
    expect(codesOf(result)).not.toContain(FINDING.AGGREGATE_CEILING);
  });
});

describe('applicability', () => {
  it('does not apply above the section 1(6) ceiling', () => {
    const result = assessWagePeriod({
      grossWages: 90000,
      employee: { monthlyWage: 90000 },
      deductions: [deduction('Loan EMI', 60000)],
    });

    expect(result.covered).toBe(false);
    expect(result.findings[0].code).toBe(FINDING.ACT_NOT_APPLICABLE);
    expect(result.findings[0].severity).toBe(SEVERITY.INFORMATIONAL);
    expect(result.totals.deducted).toBe(0);
  });

  it('applies at exactly the ceiling', () => {
    const result = assessWagePeriod({
      grossWages: PAYMENT_OF_WAGES_LIMITS.applicabilityWageCeiling,
      employee: {
        monthlyWage: PAYMENT_OF_WAGES_LIMITS.applicabilityWageCeiling,
      },
      deductions: [deduction('Loan EMI', 20000)],
    });

    expect(result.covered).toBe(true);
    expect(codesOf(result)).toContain(FINDING.AGGREGATE_CEILING);
  });
});

describe('the register', () => {
  const rows = [
    {
      employee: { employeeId: 'e1', name: 'Asha', monthlyWage: 18000 },
      grossWages: 18000,
      deductions: [deduction('PF', 2160), deduction('Loan EMI', 7000)],
      payment: { periodEnd: '2026-06-30', paidOn: '2026-07-05', headcount: 40 },
    },
    {
      employee: { employeeId: 'e2', name: 'Bhaskar', monthlyWage: 22000 },
      grossWages: 22000,
      deductions: [deduction('PF', 2640), deduction('Adjustment', 500)],
      payment: { periodEnd: '2026-06-30', paidOn: '2026-07-05', headcount: 40 },
    },
    {
      employee: { employeeId: 'e3', name: 'Chitra', monthlyWage: 60000 },
      grossWages: 60000,
      deductions: [deduction('Loan EMI', 40000)],
      payment: { periodEnd: '2026-06-30', paidOn: '2026-07-05', headcount: 40 },
    },
  ];

  it('counts only the employees the Act reaches', () => {
    const register = assessRegister(rows);

    expect(register.employeeCount).toBe(3);
    expect(register.coveredCount).toBe(2);
  });

  it('carries the employee onto every finding', () => {
    const register = assessRegister(rows);

    const unauthorised = register.findings.find(
      (entry) => entry.code === FINDING.UNAUTHORISED_DEDUCTION,
    );

    expect(unauthorised.employeeName).toBe('Bhaskar');
  });

  it('summarises by code with a distinct employee count', () => {
    const register = assessRegister(rows);

    const ceiling = register.summary.find(
      (entry) => entry.code === FINDING.AGGREGATE_CEILING,
    );

    expect(ceiling.employeeCount).toBe(1);
    expect(ceiling.section).toBe('section 7(3)');
  });

  it('excludes the uncovered employee from the money totals', () => {
    const register = assessRegister(rows);

    // 18,000 + 22,000. Chitra's 60,000 is outside the Act.
    expect(register.totalWages).toBe(40000);
  });

  it('totals the amounts deferred into the next period', () => {
    const register = assessRegister(rows);

    // Asha: 9,160 against a ceiling of 9,000 — 160 carried.
    expect(register.totalCarryForward).toBe(160);
  });
});
