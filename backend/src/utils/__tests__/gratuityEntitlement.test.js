/**
 * Payment of Gratuity Act, 1972 — the entitlement (#2031).
 *
 * Grouped around the five things this module exists to get right, and written
 * so the answer `settlement.js` gives today fails:
 *
 *   - an employee who died at three years' service must be payable;
 *   - section 7(3A) interest must accrue by default and clear only on both
 *     limbs of the proviso;
 *   - interest must run from the date gratuity became payable, not from day
 *     thirty-one;
 *   - a ₹4,000 breakage must not forfeit ₹6,00,000;
 *   - 4(6)(b) must fail where the termination was not for the act.
 */

const {
  CESSATION_GROUND,
  PAYABILITY,
  OBLIGATION_STATE,
  FORFEITURE_GROUND,
  FORFEITURE_VERDICT,
  DEFAULT_RULES,
  resolveRules,
  payability,
  assessNomination,
  assessForfeiture,
  interestPosition,
  noticePosition,
  betterTerms,
  assessClaim,
  orderQueue,
} = require('../gratuityEntitlement');

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);

describe('the grounds of cessation', () => {
  it('carries the six grounds the Act distinguishes', () => {
    expect(Object.keys(CESSATION_GROUND).sort()).toEqual([
      'DEATH',
      'DISABLEMENT',
      'RESIGNATION',
      'RETIREMENT',
      'SUPERANNUATION',
      'TERMINATION',
    ]);
  });

  it('carries the proviso to section 4(1) as data on the two grounds it reaches', () => {
    expect(CESSATION_GROUND.DEATH.gateApplies).toBe(false);
    expect(CESSATION_GROUND.DISABLEMENT.gateApplies).toBe(false);
    expect(CESSATION_GROUND.RESIGNATION.gateApplies).toBe(true);
    expect(CESSATION_GROUND.TERMINATION.gateApplies).toBe(true);
  });

  it('sends death to the nominee and disablement to the employee', () => {
    expect(CESSATION_GROUND.DEATH.payableTo).toBe('NOMINEE_OR_HEIR');
    expect(CESSATION_GROUND.DISABLEMENT.payableTo).toBe('EMPLOYEE');
  });
});

describe('payability', () => {
  it('pays an employee who died at three years’ service', () => {
    // settlement.js today returns eligible: false, amount: 0 with an
    // explanation counting the years they did not live to complete.
    const result = payability({ ground: 'DEATH', completedYears: 3 });
    expect(result.verdict).toBe(PAYABILITY.PAYABLE_TO_NOMINEE);
    expect(result.gateWaived).toBe(true);
  });

  it('pays on disablement at two years, to the employee', () => {
    const result = payability({ ground: 'DISABLEMENT', completedYears: 2 });
    expect(result.verdict).toBe(PAYABILITY.PAYABLE);
    expect(result.payableTo).toBe('EMPLOYEE');
  });

  it('refuses a resignation at four years', () => {
    const result = payability({ ground: 'RESIGNATION', completedYears: 4 });
    expect(result.verdict).toBe(PAYABILITY.NOT_PAYABLE_SERVICE_SHORT);
    expect(result.reason).toMatch(/4 completed years/);
  });

  it('pays a resignation at exactly five years', () => {
    expect(
      payability({ ground: 'RESIGNATION', completedYears: 5 }).verdict,
    ).toBe(PAYABILITY.PAYABLE);
  });

  it('sends death without a nomination to the heirs, and says it is a determination', () => {
    const result = payability({
      ground: 'DEATH',
      completedYears: 9,
      hasNomination: false,
    });
    expect(result.payableTo).toBe('HEIRS');
    expect(result.reason).toMatch(/somebody has to make/);
  });

  it('sends death with a nomination to the nominee, not to a payroll contact', () => {
    const result = payability({
      ground: 'DEATH',
      completedYears: 9,
      hasNomination: true,
    });
    expect(result.payableTo).toBe('NOMINEE');
    expect(result.reason).toMatch(/not to the estate/);
  });

  it('treats an unrecognised ground as a question, not a refusal', () => {
    const result = payability({ ground: 'ABSCONDED', completedYears: 8 });
    expect(result.verdict).toBe(PAYABILITY.UNDETERMINED);
    expect(result.grounds).toContain('DEATH');
  });

  it('will not guess at missing service', () => {
    expect(payability({ ground: 'RESIGNATION' }).verdict).toBe(
      PAYABILITY.UNDETERMINED,
    );
  });

  it('honours an overridden eligibility period', () => {
    const result = payability(
      { ground: 'RESIGNATION', completedYears: 4 },
      { eligibilityYears: 3 },
    );
    expect(result.verdict).toBe(PAYABILITY.PAYABLE);
  });
});

describe('assessNomination', () => {
  const family = (share) => ({
    name: 'A',
    relationship: 'spouse',
    sharePercent: share,
    isFamily: true,
  });

  it('rejects an absent nomination and says what follows', () => {
    const result = assessNomination(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/payable to the heirs/);
  });

  it('rejects shares that do not total a hundred', () => {
    const result = assessNomination({
      nominees: [family(60)],
      hadFamilyWhenMade: true,
    });
    expect(result.valid).toBe(false);
    expect(result.totalShare).toBe(60);
    expect(result.reason).toMatch(/no payee/);
  });

  it('accepts shares that total a hundred across several nominees', () => {
    const result = assessNomination({
      nominees: [family(40), { ...family(60), name: 'B' }],
      hadFamilyWhenMade: true,
    });
    expect(result.valid).toBe(true);
    expect(result.nominees).toHaveLength(2);
  });

  it('voids a nomination in favour of a non-family member where there was a family', () => {
    const result = assessNomination({
      nominees: [
        family(50),
        { name: 'Friend', sharePercent: 50, isFamily: false },
      ],
      hadFamilyWhenMade: true,
    });
    expect(result.valid).toBe(false);
    expect(result.voidUnderRule6).toBe(true);
    expect(result.reason).toMatch(/Friend/);
  });

  it('allows a non-family nomination where the employee had no family', () => {
    const result = assessNomination({
      nominees: [{ name: 'Friend', sharePercent: 100, isFamily: false }],
      hadFamilyWhenMade: false,
    });
    expect(result.valid).toBe(true);
  });

  it('voids that nomination once a family is acquired and no fresh one is made', () => {
    const result = assessNomination({
      nominees: [{ name: 'Friend', sharePercent: 100, isFamily: false }],
      hadFamilyWhenMade: false,
      madeOn: d('2019-04-01'),
      acquiredFamilyOn: d('2022-11-20'),
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/void one/);
  });

  it('stands where a fresh nomination was made after the family was acquired', () => {
    const result = assessNomination({
      nominees: [{ name: 'Friend', sharePercent: 100, isFamily: false }],
      hadFamilyWhenMade: false,
      madeOn: d('2019-04-01'),
      acquiredFamilyOn: d('2022-11-20'),
      freshNominationMade: true,
    });
    expect(result.valid).toBe(true);
  });

  it('carries the guardian for a minor nominee and not for others', () => {
    const result = assessNomination({
      nominees: [
        {
          name: 'Child',
          sharePercent: 100,
          isFamily: true,
          isMinor: true,
          guardian: 'Mother',
        },
      ],
      hadFamilyWhenMade: true,
    });
    expect(result.nominees[0].guardian).toBe('Mother');
  });
});

describe('assessForfeiture', () => {
  const GROSS = 600000;

  it('forfeits nothing where nothing is claimed', () => {
    const result = assessForfeiture(null, GROSS);
    expect(result.verdict).toBe(FORFEITURE_VERDICT.NONE);
    expect(result.payable).toBe(GROSS);
  });

  it('caps a 4(6)(a) forfeiture at the damage — a ₹4,000 breakage is ₹4,000', () => {
    const result = assessForfeiture(
      {
        ground: FORFEITURE_GROUND.DAMAGE_OR_LOSS,
        damageAmount: 4000,
        amount: 600000,
      },
      GROSS,
    );
    expect(result.verdict).toBe(FORFEITURE_VERDICT.EXCESSIVE);
    expect(result.forfeited).toBe(4000);
    expect(result.payable).toBe(596000);
  });

  it('applies a 4(6)(a) forfeiture inside the damage without complaint', () => {
    const result = assessForfeiture(
      {
        ground: FORFEITURE_GROUND.DAMAGE_OR_LOSS,
        damageAmount: 25000,
        amount: 25000,
      },
      GROSS,
    );
    expect(result.verdict).toBe(FORFEITURE_VERDICT.APPLIED);
    expect(result.payable).toBe(575000);
  });

  it('refuses a 4(6)(a) forfeiture with no quantified damage', () => {
    const result = assessForfeiture(
      { ground: FORFEITURE_GROUND.DAMAGE_OR_LOSS, amount: 100000 },
      GROSS,
    );
    expect(result.verdict).toBe(FORFEITURE_VERDICT.NOT_PERMITTED);
    expect(result.payable).toBe(GROSS);
    expect(result.reason).toMatch(/there is no extent/);
  });

  it('caps the damage at the gratuity where the damage exceeds it', () => {
    const result = assessForfeiture(
      { ground: FORFEITURE_GROUND.DAMAGE_OR_LOSS, damageAmount: 900000 },
      GROSS,
    );
    expect(result.forfeited).toBe(GROSS);
    expect(result.payable).toBe(0);
  });

  it('permits a whole 4(6)(b) forfeiture where termination was for the act', () => {
    const result = assessForfeiture(
      {
        ground: FORFEITURE_GROUND.RIOTOUS_OR_VIOLENT_CONDUCT,
        terminatedForTheAct: true,
        amount: GROSS,
      },
      GROSS,
    );
    expect(result.verdict).toBe(FORFEITURE_VERDICT.APPLIED);
    expect(result.payable).toBe(0);
    expect(result.reason).toMatch(/discretionary/);
  });

  it('refuses 4(6)(b) where the termination was not for the act', () => {
    const result = assessForfeiture(
      {
        ground: FORFEITURE_GROUND.RIOTOUS_OR_VIOLENT_CONDUCT,
        terminatedForTheAct: false,
        amount: GROSS,
      },
      GROSS,
    );
    expect(result.verdict).toBe(FORFEITURE_VERDICT.NOT_PERMITTED);
    expect(result.payable).toBe(GROSS);
    expect(result.reason).toMatch(/were terminated for/);
  });

  it('refuses moral turpitude outside the course of employment', () => {
    const result = assessForfeiture(
      {
        ground: FORFEITURE_GROUND.MORAL_TURPITUDE,
        terminatedForTheAct: true,
        inCourseOfEmployment: false,
        amount: GROSS,
      },
      GROSS,
    );
    expect(result.verdict).toBe(FORFEITURE_VERDICT.NOT_PERMITTED);
    expect(result.reason).toMatch(/in the course of his employment/);
  });

  it('permits a partial 4(6)(b) forfeiture', () => {
    const result = assessForfeiture(
      {
        ground: FORFEITURE_GROUND.MORAL_TURPITUDE,
        terminatedForTheAct: true,
        inCourseOfEmployment: true,
        amount: 200000,
      },
      GROSS,
    );
    expect(result.forfeited).toBe(200000);
    expect(result.payable).toBe(400000);
  });

  it('rejects a ground that is not in section 4(6) at all', () => {
    const result = assessForfeiture(
      { ground: 'POOR_PERFORMANCE', amount: GROSS },
      GROSS,
    );
    expect(result.verdict).toBe(FORFEITURE_VERDICT.NOT_PERMITTED);
    expect(result.payable).toBe(GROSS);
  });
});

describe('interestPosition', () => {
  const AMOUNT = 365000;

  it('reports the countdown before anything is breached', () => {
    const result = interestPosition({
      payableFrom: d('2026-06-01'),
      asOf: d('2026-06-10'),
      amount: AMOUNT,
    });
    expect(result.state).toBe(OBLIGATION_STATE.WITHIN_PAYMENT_PERIOD);
    expect(result.dueBy.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(result.interest).toBe(0);
    expect(result.daysRemaining).toBe(21);
  });

  it('runs interest from the date gratuity became payable, not from day thirty-one', () => {
    // 60 days from 1 June to 31 July. At 10% on ₹365,000 that is ₹6,000 —
    // running it from day 31 would give ₹3,000 and understate every late
    // payment by a month.
    const result = interestPosition({
      payableFrom: d('2026-06-01'),
      paidOn: d('2026-07-31'),
      amount: AMOUNT,
    });
    expect(result.daysOfInterest).toBe(60);
    expect(result.interest).toBe(6000);
    expect(result.state).toBe(OBLIGATION_STATE.PAID_LATE);
  });

  it('charges nothing where payment was inside the thirty days', () => {
    const result = interestPosition({
      payableFrom: d('2026-06-01'),
      paidOn: d('2026-06-28'),
      amount: AMOUNT,
    });
    expect(result.state).toBe(OBLIGATION_STATE.PAID_IN_TIME);
    expect(result.interest).toBe(0);
  });

  it('treats payment on the thirtieth day as in time', () => {
    const result = interestPosition({
      payableFrom: d('2026-06-01'),
      paidOn: d('2026-07-01'),
      amount: AMOUNT,
    });
    expect(result.state).toBe(OBLIGATION_STATE.PAID_IN_TIME);
  });

  it('accrues on an unpaid overdue gratuity as at today', () => {
    const result = interestPosition({
      payableFrom: d('2026-01-01'),
      asOf: d('2026-07-01'),
      amount: AMOUNT,
    });
    expect(result.state).toBe(OBLIGATION_STATE.OVERDUE);
    expect(result.interest).toBeGreaterThan(0);
    expect(result.daysLate).toBe(151);
  });

  it('does not clear on employee fault alone', () => {
    const result = interestPosition({
      payableFrom: d('2026-01-01'),
      asOf: d('2026-07-01'),
      amount: AMOUNT,
      relief: { delayDueToEmployeeFault: true },
    });
    expect(result.reliefApplied).toBe(false);
    expect(result.interest).toBeGreaterThan(0);
    expect(result.reason).toMatch(/the proviso needs both/);
  });

  it('clears on both limbs, and says what would otherwise have been due', () => {
    const result = interestPosition({
      payableFrom: d('2026-01-01'),
      asOf: d('2026-07-01'),
      amount: AMOUNT,
      relief: {
        delayDueToEmployeeFault: true,
        controllingAuthorityPermission: 'order dated 2026-03-04',
      },
    });
    expect(result.reliefApplied).toBe(true);
    expect(result.interest).toBe(0);
    expect(result.interestBeforeRelief).toBeGreaterThan(0);
  });

  it('has no clock without a date gratuity became payable', () => {
    const result = interestPosition({ amount: AMOUNT, asOf: d('2026-07-01') });
    expect(result.dueBy).toBeNull();
    expect(result.reason).toMatch(/defaulting it to today/);
  });

  it('honours an overridden rate and period', () => {
    const result = interestPosition(
      {
        payableFrom: d('2026-06-01'),
        paidOn: d('2026-07-31'),
        amount: AMOUNT,
      },
      { interestRatePercent: 12 },
    );
    expect(result.ratePercent).toBe(12);
    expect(result.interest).toBe(7200);
  });
});

describe('noticePosition', () => {
  it('reports both notices as outstanding', () => {
    const result = noticePosition({});
    expect(result.complete).toBe(false);
    expect(result.outstanding).toHaveLength(2);
  });

  it('reports the controlling authority notice as outstanding on its own', () => {
    const result = noticePosition({ noticeToPayeeOn: d('2026-06-05') });
    expect(result.complete).toBe(false);
    expect(result.outstanding).toEqual(['the controlling authority']);
  });

  it('is complete only when both are given', () => {
    const result = noticePosition({
      noticeToPayeeOn: d('2026-06-05'),
      noticeToControllingAuthorityOn: d('2026-06-06'),
    });
    expect(result.complete).toBe(true);
  });
});

describe('betterTerms', () => {
  it('takes the contractual figure where it is higher', () => {
    const result = betterTerms(480000, 650000);
    expect(result.governing).toBe('CONTRACTUAL');
    expect(result.amount).toBe(650000);
    expect(result.difference).toBe(170000);
  });

  it('keeps the statutory figure where the contract is not better', () => {
    const result = betterTerms(480000, 300000);
    expect(result.governing).toBe('STATUTORY');
    expect(result.amount).toBe(480000);
  });

  it('reports the statutory figure where there is no contractual term', () => {
    const result = betterTerms(480000, null);
    expect(result.governing).toBe('STATUTORY');
    expect(result.contractual).toBeNull();
  });
});

describe('assessClaim', () => {
  const base = {
    employeeId: 'e1',
    ground: 'SUPERANNUATION',
    completedYears: 22,
    statutoryAmount: 600000,
    payableFrom: d('2026-01-31'),
  };

  it('stops at the payability answer where service is short', () => {
    const result = assessClaim(
      { ...base, ground: 'RESIGNATION', completedYears: 3 },
      { asOf: d('2026-07-01') },
    );
    expect(result.payability.verdict).toBe(
      PAYABILITY.NOT_PAYABLE_SERVICE_SHORT,
    );
    expect(result.obligation).toBeNull();
    expect(result.amountPayable).toBe(0);
  });

  it('does not stop there on death', () => {
    const result = assessClaim(
      { ...base, ground: 'DEATH', completedYears: 3 },
      { asOf: d('2026-07-01') },
    );
    expect(result.payability.verdict).toBe(PAYABILITY.PAYABLE_TO_NOMINEE);
    expect(result.obligation).not.toBeNull();
    expect(result.amountPayable).toBeGreaterThan(600000);
  });

  it('runs the clock against what is payable after forfeiture, not the gross', () => {
    const withForfeiture = assessClaim(
      {
        ...base,
        forfeiture: {
          ground: FORFEITURE_GROUND.DAMAGE_OR_LOSS,
          damageAmount: 100000,
        },
      },
      { asOf: d('2026-07-01') },
    );
    const without = assessClaim(base, { asOf: d('2026-07-01') });
    expect(withForfeiture.forfeiture.payable).toBe(500000);
    expect(withForfeiture.obligation.interest).toBeLessThan(
      without.obligation.interest,
    );
  });

  it('applies the contractual figure before forfeiture is measured against it', () => {
    const result = assessClaim(
      { ...base, contractualAmount: 800000 },
      { asOf: d('2026-07-01') },
    );
    expect(result.terms.governing).toBe('CONTRACTUAL');
    expect(result.forfeiture.payable).toBe(800000);
  });

  it('adds the accrued interest into what is payable', () => {
    const result = assessClaim(base, { asOf: d('2026-07-01') });
    expect(result.obligation.state).toBe(OBLIGATION_STATE.OVERDUE);
    expect(result.amountPayable).toBe(600000 + result.obligation.interest);
  });

  it('carries the five notes a reader needs', () => {
    const result = assessClaim(base, { asOf: d('2026-07-01') });
    expect(Object.keys(result.notes)).toHaveLength(5);
  });
});

describe('orderQueue', () => {
  it('puts overdue unpaid claims first and paid-in-time last', () => {
    const ordered = orderQueue([
      { obligation: { state: OBLIGATION_STATE.PAID_IN_TIME } },
      { obligation: { state: OBLIGATION_STATE.OVERDUE, interest: 100 } },
      { obligation: { state: OBLIGATION_STATE.PAID_LATE, interest: 9000 } },
      { obligation: { state: OBLIGATION_STATE.WITHIN_PAYMENT_PERIOD } },
    ]);
    expect(ordered.map((r) => r.obligation.state)).toEqual([
      OBLIGATION_STATE.OVERDUE,
      OBLIGATION_STATE.WITHIN_PAYMENT_PERIOD,
      OBLIGATION_STATE.PAID_LATE,
      OBLIGATION_STATE.PAID_IN_TIME,
    ]);
  });

  it('orders overdue claims by interest already accrued', () => {
    const ordered = orderQueue([
      { obligation: { state: OBLIGATION_STATE.OVERDUE, interest: 400 } },
      { obligation: { state: OBLIGATION_STATE.OVERDUE, interest: 9000 } },
      { obligation: { state: OBLIGATION_STATE.OVERDUE, interest: 2500 } },
    ]);
    expect(ordered.map((r) => r.obligation.interest)).toEqual([
      9000, 2500, 400,
    ]);
  });

  it('does not mutate the array it is given', () => {
    const input = [
      { obligation: { state: OBLIGATION_STATE.PAID_IN_TIME } },
      { obligation: { state: OBLIGATION_STATE.OVERDUE, interest: 1 } },
    ];
    orderQueue(input);
    expect(input[0].obligation.state).toBe(OBLIGATION_STATE.PAID_IN_TIME);
  });
});

describe('resolveRules', () => {
  it('defaults to the statutory figures', () => {
    const rules = resolveRules();
    expect(rules.eligibilityYears).toBe(5);
    expect(rules.paymentPeriodDays).toBe(30);
    expect(rules.interestRatePercent).toBe(10);
    expect(rules.nominationForm).toBe('Form F');
  });

  it('lets a notified rate change without editing the engine', () => {
    expect(resolveRules({ interestRatePercent: 12 }).interestRatePercent).toBe(
      12,
    );
    expect(resolveRules({ interestRatePercent: 12 }).paymentPeriodDays).toBe(
      DEFAULT_RULES.paymentPeriodDays,
    );
  });
});
