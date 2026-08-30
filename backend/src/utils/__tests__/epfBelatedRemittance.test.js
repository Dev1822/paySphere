/**
 * EPF belated remittance — section 7Q and section 14B (#1875).
 *
 * The assertions that matter here are about *separation* rather than about
 * arithmetic. The arithmetic is a rate times days and it is easy; what a
 * regression will destroy is the property that interest and damages never
 * merge, and that the member's share deducted and not remitted stays visible
 * after both of them have been waived. Those have their own describe blocks.
 */

const {
  EPF_REMITTANCE_RULES,
  COMPONENT,
  WAIVER_STATE,
  DUE_BASIS,
  FINDING,
  SEVERITY,
  daysBetween,
  dueDateFor,
  wageMonthKey,
  resolveRules,
  damageSlabFor,
  allocateTranches,
  sevenQInterest,
  fourteenBDamages,
  applyWaiver,
  assessWageMonth,
  assessEstablishment,
} = require('../epfBelatedRemittance');

const utc = (iso) => new Date(`${iso}T00:00:00.000Z`);

describe('dueDateFor', () => {
  it('is the fifteenth of the month after the wage month', () => {
    expect(dueDateFor({ year: 2025, month: 1 })).toEqual(utc('2025-02-15'));
    expect(dueDateFor({ year: 2025, month: 12 })).toEqual(utc('2026-01-15'));
  });

  it('carries no grace period by default', () => {
    // Withdrawn with effect from January 2016, and the point of asserting it
    // is that a spreadsheet somewhere still applies it.
    expect(EPF_REMITTANCE_RULES.graceDays).toBe(0);
    expect(dueDateFor({ year: 2025, month: 6 })).toEqual(utc('2025-07-15'));
  });

  it('adds a configured grace period rather than moving the day', () => {
    const rules = resolveRules({ graceDays: 5 });
    expect(dueDateFor({ year: 2025, month: 6 }, rules)).toEqual(
      utc('2025-07-20'),
    );
    expect(rules.dueDayOfNextMonth).toBe(15);
  });

  it('rejects a wage month without numbers on it', () => {
    expect(() => dueDateFor({})).toThrow(TypeError);
  });
});

describe('wageMonthKey', () => {
  it('zero-pads the month so keys sort', () => {
    expect(wageMonthKey({ year: 2025, month: 3 })).toBe('2025-03');
    expect(wageMonthKey({ year: 2025, month: 11 })).toBe('2025-11');
  });
});

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween(utc('2025-02-15'), utc('2025-03-01'))).toBe(14);
  });

  it('floors at zero, because paying early earns nothing back', () => {
    expect(daysBetween(utc('2025-03-01'), utc('2025-02-15'))).toBe(0);
  });

  it('is zero on the due date itself', () => {
    expect(daysBetween(utc('2025-02-15'), utc('2025-02-15'))).toBe(0);
  });
});

describe('damageSlabFor', () => {
  it('places a delay in the paragraph 32A band', () => {
    expect(damageSlabFor(10).ratePercent).toBe(5);
    expect(damageSlabFor(75).ratePercent).toBe(10);
    expect(damageSlabFor(140).ratePercent).toBe(15);
    expect(damageSlabFor(200).ratePercent).toBe(25);
  });

  it('treats the boundary as exclusive on the lower band', () => {
    // "less than two months" — sixty days at the thirty-day convention is two
    // months exactly, so it is in the second band and not the first.
    expect(damageSlabFor(59).ratePercent).toBe(5);
    expect(damageSlabFor(60).ratePercent).toBe(10);
    expect(damageSlabFor(119).ratePercent).toBe(10);
    expect(damageSlabFor(120).ratePercent).toBe(15);
    expect(damageSlabFor(179).ratePercent).toBe(15);
    expect(damageSlabFor(180).ratePercent).toBe(25);
  });

  it('never falls off the end of the table', () => {
    expect(damageSlabFor(100000).code).toBe('SIX_MONTHS_AND_ABOVE');
  });
});

describe('allocateTranches', () => {
  const dueDate = utc('2025-02-15');

  it('splits a part payment into two tranches with different delays', () => {
    // The ordinary case for an establishment short of cash: some on the
    // fifteenth, the rest months later. One arrear, two delays.
    const { tranches, outstanding } = allocateTranches({
      amountDue: 100000,
      dueDate,
      remittances: [
        { paidOn: utc('2025-02-15'), amount: 40000 },
        { paidOn: utc('2025-06-15'), amount: 60000 },
      ],
      asAt: utc('2025-09-01'),
    });

    expect(outstanding).toBe(0);
    expect(tranches).toHaveLength(2);
    expect(tranches[0]).toMatchObject({ amount: 40000, delayDays: 0 });
    expect(tranches[1]).toMatchObject({ amount: 60000, delayDays: 120 });
  });

  it('applies remittances oldest first regardless of the order given', () => {
    const { tranches } = allocateTranches({
      amountDue: 100000,
      dueDate,
      remittances: [
        { paidOn: utc('2025-06-15'), amount: 60000 },
        { paidOn: utc('2025-02-15'), amount: 40000 },
      ],
      asAt: utc('2025-09-01'),
    });

    expect(tranches[0].clearedOn).toEqual(utc('2025-02-15'));
    expect(tranches[1].clearedOn).toEqual(utc('2025-06-15'));
  });

  it('measures an unpaid balance to the assessment date and marks it open', () => {
    const { tranches, outstanding } = allocateTranches({
      amountDue: 100000,
      dueDate,
      remittances: [{ paidOn: utc('2025-03-01'), amount: 25000 }],
      asAt: utc('2025-08-15'),
    });

    expect(outstanding).toBe(75000);
    const stillOpen = tranches.find((tranche) => tranche.open);
    expect(stillOpen.amount).toBe(75000);
    expect(stillOpen.clearedOn).toBeNull();
    expect(stillOpen.delayDays).toBe(daysBetween(dueDate, utc('2025-08-15')));
  });

  it('does not carry an excess into another month', () => {
    // Appropriation across wage months is the Regional Office's decision, and
    // guessing at it here would silently clear a default somewhere else.
    const { excess, outstanding } = allocateTranches({
      amountDue: 50000,
      dueDate,
      remittances: [{ paidOn: utc('2025-02-15'), amount: 80000 }],
      asAt: utc('2025-08-15'),
    });

    expect(outstanding).toBe(0);
    expect(excess).toBe(30000);
  });

  it('ignores remittances with no date or no amount', () => {
    const { tranches } = allocateTranches({
      amountDue: 10000,
      dueDate,
      remittances: [
        { paidOn: null, amount: 5000 },
        { paidOn: utc('2025-02-20'), amount: 0 },
      ],
      asAt: utc('2025-03-01'),
    });

    expect(tranches).toHaveLength(1);
    expect(tranches[0].open).toBe(true);
  });
});

describe('sevenQInterest', () => {
  it('is simple, annual and computed on exact days', () => {
    const tranches = [
      {
        amount: 100000,
        delayDays: 365,
        clearedOn: utc('2026-02-15'),
        open: false,
      },
    ];
    expect(sevenQInterest(tranches).amount).toBe(12000);
  });

  it('does not round the delay to whole months', () => {
    // A month-rounded figure disagrees with the demand notice by up to
    // twenty-nine days of interest on the whole arrear.
    const tranches = [
      {
        amount: 100000,
        delayDays: 45,
        clearedOn: utc('2025-04-01'),
        open: false,
      },
    ];
    expect(sevenQInterest(tranches).amount).toBeCloseTo(1479.45, 2);
  });

  it('ignores tranches paid on or before the due date', () => {
    const tranches = [{ amount: 100000, delayDays: 0, open: false }];
    expect(sevenQInterest(tranches).amount).toBe(0);
    expect(sevenQInterest(tranches).lines).toHaveLength(0);
  });

  it('does not compound across tranches', () => {
    const one = sevenQInterest([
      { amount: 50000, delayDays: 365, open: false },
    ]);
    const two = sevenQInterest([
      { amount: 25000, delayDays: 365, open: false },
      { amount: 25000, delayDays: 365, open: false },
    ]);
    expect(two.amount).toBeCloseTo(one.amount, 2);
  });
});

describe('fourteenBDamages', () => {
  it('picks the slab from the delay on that arrear', () => {
    const { lines } = fourteenBDamages([
      { amount: 100000, delayDays: 30, open: false },
      { amount: 100000, delayDays: 200, open: false },
    ]);

    expect(lines[0].ratePercent).toBe(5);
    expect(lines[1].ratePercent).toBe(25);
  });

  it('does not blend two delays into an average rate', () => {
    // A month eleven days late and a month eight months late are two defaults.
    const blended = fourteenBDamages([
      { amount: 200000, delayDays: 115, open: false },
    ]).amount;

    const separate = fourteenBDamages([
      { amount: 100000, delayDays: 11, open: false },
      { amount: 100000, delayDays: 219, open: false },
    ]).amount;

    expect(separate).not.toBeCloseTo(blended, 2);
  });

  it('caps the total at the arrears and says so', () => {
    // Twenty-five per cent per annum for five years exceeds the arrears.
    const result = fourteenBDamages([
      { amount: 100000, delayDays: 365 * 5, open: false },
    ]);

    expect(result.amount).toBe(100000);
    expect(result.cappedFrom).toBeGreaterThan(100000);
  });

  it('caps on the total rather than per tranche', () => {
    const result = fourteenBDamages([
      { amount: 50000, delayDays: 365 * 5, open: false },
      { amount: 50000, delayDays: 365 * 5, open: false },
    ]);

    expect(result.amount).toBe(100000);
  });

  it('reports no cap where the proviso did not bite', () => {
    expect(
      fourteenBDamages([{ amount: 100000, delayDays: 30, open: false }])
        .cappedFrom,
    ).toBeNull();
  });
});

describe('applyWaiver', () => {
  it('leaves damages payable in full while an application is pending', () => {
    const result = applyWaiver(50000, { state: WAIVER_STATE.APPLIED });
    expect(result.payable).toBe(50000);
    expect(result.contingent).toBe(true);
  });

  it('zeroes the payable damages on a full waiver but keeps the assessment', () => {
    const result = applyWaiver(50000, { state: WAIVER_STATE.GRANTED });
    expect(result.payable).toBe(0);
    expect(result.assessed).toBe(50000);
  });

  it('applies a partial waiver as a percentage of the assessment', () => {
    const result = applyWaiver(50000, {
      state: WAIVER_STATE.GRANTED_IN_PART,
      waivedPercent: 60,
    });
    expect(result.payable).toBe(20000);
    expect(result.assessed).toBe(50000);
  });

  it('does not reduce anything on a refusal', () => {
    expect(applyWaiver(50000, { state: WAIVER_STATE.REFUSED }).payable).toBe(
      50000,
    );
  });
});

describe('assessWageMonth', () => {
  const wageMonth = { year: 2025, month: 1 };

  it('keeps the member share apart from everything else', () => {
    const result = assessWageMonth({
      wageMonth,
      dues: {
        [COMPONENT.EMPLOYEE_SHARE]: 120000,
        [COMPONENT.EMPLOYER_SHARE]: 36700,
      },
      remittances: {},
      asAt: utc('2025-08-15'),
    });

    expect(result.heldInTrust).toBe(120000);
    // The employer's share is in arrears too, and it is not held in trust.
    expect(result.arrears).toBe(156700);
  });

  it('drops the member share out of heldInTrust once it is remitted, late or not', () => {
    const result = assessWageMonth({
      wageMonth,
      dues: { [COMPONENT.EMPLOYEE_SHARE]: 120000 },
      remittances: {
        [COMPONENT.EMPLOYEE_SHARE]: [
          { paidOn: utc('2025-06-15'), amount: 120000 },
        ],
      },
      asAt: utc('2025-08-15'),
    });

    expect(result.heldInTrust).toBe(0);
    expect(result.arrears).toBe(120000);
    expect(result.interest).toBeGreaterThan(0);
  });

  it('skips components with nothing due', () => {
    const result = assessWageMonth({
      wageMonth,
      dues: { [COMPONENT.EMPLOYEE_SHARE]: 100, [COMPONENT.EDLI]: 0 },
      asAt: utc('2025-08-15'),
    });

    expect(result.components.map((row) => row.component)).toEqual([
      COMPONENT.EMPLOYEE_SHARE,
    ]);
  });

  it('carries the due date rather than making the caller derive it', () => {
    const result = assessWageMonth({
      wageMonth,
      dues: { [COMPONENT.EMPLOYEE_SHARE]: 100 },
      asAt: utc('2025-08-15'),
    });

    expect(result.dueDate).toEqual(utc('2025-02-15'));
    expect(result.key).toBe('2025-01');
  });
});

describe('assessEstablishment', () => {
  const lateMonth = {
    wageMonth: { year: 2025, month: 1 },
    dues: {
      [COMPONENT.EMPLOYEE_SHARE]: 120000,
      [COMPONENT.EMPLOYER_SHARE]: 36700,
      [COMPONENT.PENSION]: 83300,
    },
    remittances: {
      [COMPONENT.EMPLOYEE_SHARE]: [
        { paidOn: utc('2025-05-20'), amount: 120000 },
      ],
      [COMPONENT.EMPLOYER_SHARE]: [
        { paidOn: utc('2025-05-20'), amount: 36700 },
      ],
      [COMPONENT.PENSION]: [{ paidOn: utc('2025-05-20'), amount: 83300 }],
    },
  };

  it('returns the two liabilities under separate keys', () => {
    const result = assessEstablishment({
      months: [lateMonth],
      asAt: utc('2025-08-15'),
    });

    expect(result.interestUnderSection7Q).toBeGreaterThan(0);
    expect(result.damagesAssessedUnderSection14B).toBeGreaterThan(0);
  });

  it('exposes no combined liability field', () => {
    // The property this module exists to hold. Interest cannot be waived and
    // damages can be waived to nil; a combined figure would be provided for in
    // full by the first report that read it.
    const result = assessEstablishment({
      months: [lateMonth],
      asAt: utc('2025-08-15'),
    });

    const combined =
      result.interestUnderSection7Q + result.damagesAssessedUnderSection14B;

    for (const [key, value] of Object.entries(result)) {
      if (typeof value !== 'number') continue;
      expect(`${key}=${value}`).not.toBe(`${key}=${combined}`);
    }
    expect(result).not.toHaveProperty('totalLiability');
    expect(result).not.toHaveProperty('totalPenalty');
  });

  it('leaves interest untouched when damages are fully waived', () => {
    const waived = assessEstablishment({
      months: [lateMonth],
      waivers: { '2025-01': { state: WAIVER_STATE.GRANTED } },
      asAt: utc('2025-08-15'),
    });
    const unwaived = assessEstablishment({
      months: [lateMonth],
      asAt: utc('2025-08-15'),
    });

    expect(waived.damagesPayableUnderSection14B).toBe(0);
    expect(waived.damagesAssessedUnderSection14B).toBe(
      unwaived.damagesAssessedUnderSection14B,
    );
    expect(waived.interestUnderSection7Q).toBe(unwaived.interestUnderSection7Q);
  });

  it('keeps a pending waiver payable and reports it as contingent', () => {
    const result = assessEstablishment({
      months: [lateMonth],
      waivers: { '2025-01': { state: WAIVER_STATE.APPLIED } },
      asAt: utc('2025-08-15'),
    });

    expect(result.damagesPayableUnderSection14B).toBe(
      result.damagesAssessedUnderSection14B,
    );
    expect(result.damagesContingentOnWaiver).toBe(
      result.damagesPayableUnderSection14B,
    );
    expect(
      result.findings.some(
        (finding) => finding.code === FINDING.WAIVER_PENDING,
      ),
    ).toBe(true);
  });

  it('keeps the member share visible after a full waiver', () => {
    const result = assessEstablishment({
      months: [
        {
          wageMonth: { year: 2025, month: 1 },
          dues: { [COMPONENT.EMPLOYEE_SHARE]: 120000 },
          remittances: {},
        },
      ],
      waivers: { '2025-01': { state: WAIVER_STATE.GRANTED } },
      asAt: utc('2025-08-15'),
    });

    expect(result.damagesPayableUnderSection14B).toBe(0);
    expect(result.heldInTrust).toBe(120000);
    expect(
      result.findings.some(
        (finding) => finding.code === FINDING.EMPLOYEE_SHARE_WITHHELD,
      ),
    ).toBe(true);
  });

  it('raises the member-share finding as a breach rather than an exposure', () => {
    const result = assessEstablishment({
      months: [
        {
          wageMonth: { year: 2025, month: 1 },
          dues: { [COMPONENT.EMPLOYEE_SHARE]: 5000 },
        },
      ],
      asAt: utc('2025-08-15'),
    });

    const finding = result.findings.find(
      (row) => row.code === FINDING.EMPLOYEE_SHARE_WITHHELD,
    );
    expect(finding.severity).toBe(SEVERITY.BREACH);
  });

  it('flags a section 7A determination as running from the original due date', () => {
    const result = assessEstablishment({
      months: [
        {
          wageMonth: { year: 2022, month: 4 },
          basis: DUE_BASIS.SECTION_7A,
          dues: { [COMPONENT.EMPLOYER_SHARE]: 90000 },
        },
      ],
      asAt: utc('2025-08-15'),
    });

    expect(
      result.findings.some(
        (finding) => finding.code === FINDING.SECTION_7A_DETERMINATION,
      ),
    ).toBe(true);
    expect(result.months[0].dueDate).toEqual(utc('2022-05-15'));
  });

  it('flags a configured grace period, since it was withdrawn in 2016', () => {
    const result = assessEstablishment({
      months: [
        {
          wageMonth: { year: 2025, month: 1 },
          dues: { [COMPONENT.EMPLOYER_SHARE]: 1000 },
        },
      ],
      rules: { graceDays: 5 },
      asAt: utc('2025-08-15'),
    });

    expect(
      result.findings.some((finding) => finding.code === FINDING.GRACE_APPLIED),
    ).toBe(true);
  });

  it('snapshots the rules it computed under', () => {
    const result = assessEstablishment({
      months: [],
      rules: { interestRatePercent: 15 },
    });

    expect(result.rules.interestRatePercent).toBe(15);
    // Untouched defaults survive the override.
    expect(result.rules.damageSlabs).toHaveLength(4);
  });

  it('handles an establishment with nothing in default', () => {
    const result = assessEstablishment({
      months: [
        {
          wageMonth: { year: 2025, month: 1 },
          dues: { [COMPONENT.EMPLOYEE_SHARE]: 1000 },
          remittances: {
            [COMPONENT.EMPLOYEE_SHARE]: [
              { paidOn: utc('2025-02-10'), amount: 1000 },
            ],
          },
        },
      ],
      asAt: utc('2025-08-15'),
    });

    expect(result.interestUnderSection7Q).toBe(0);
    expect(result.damagesAssessedUnderSection14B).toBe(0);
    expect(result.arrears).toBe(0);
    expect(result.heldInTrust).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('survives being called with nothing', () => {
    const result = assessEstablishment();
    expect(result.months).toEqual([]);
    expect(result.interestUnderSection7Q).toBe(0);
  });
});
