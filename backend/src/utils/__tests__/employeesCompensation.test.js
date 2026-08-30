/**
 * Employees' Compensation Act, 1923 (#1699).
 *
 * The boundaries worth naming, because each is a place a hand-computed
 * assessment goes wrong in a direction somebody has to live with:
 *
 *   - the Explanation II wage cap, which is not any of the product's other
 *     wage ceilings;
 *   - the Schedule IV factor read at the age on the *accident*, not today;
 *   - a partial claim computed off the permanent total figure rather than off
 *     wages, and without total disablement's floor;
 *   - the three-day waiting period disappearing entirely at twenty-eight days;
 *   - the section 3(1)(b) provisos being disapplied for death and permanent
 *     total disablement;
 *   - and section 4A interest running from the accident, not from the claim.
 */

const {
  MONTHLY_WAGE_CAP,
  MINIMUM_DEATH_COMPENSATION,
  MINIMUM_PERMANENT_TOTAL_COMPENSATION,
  FUNERAL_EXPENSES,
  MAX_PENALTY_SHARE,
  RELEVANT_FACTORS,
  BAR,
  INJURY,
  completedAge,
  relevantFactor,
  cappedMonthlyWages,
  applyStatutoryBars,
  deathCompensation,
  permanentTotalCompensation,
  permanentPartialCompensation,
  temporaryCompensation,
  latePaymentCharges,
  assessClaim,
} = require('../employeesCompensation');

describe('completed age on the date of the accident', () => {
  it('counts completed years, not calendar ones', () => {
    // Born 2 January, accident 1 January: still twenty-nine.
    expect(completedAge('1996-01-02', '2026-01-01')).toBe(29);
    expect(completedAge('1996-01-01', '2026-01-01')).toBe(30);
  });

  it('handles a birthday later in the month', () => {
    expect(completedAge('1990-06-20', '2026-06-19')).toBe(35);
    expect(completedAge('1990-06-20', '2026-06-20')).toBe(36);
  });

  it('is null when the date of birth is missing or after the accident', () => {
    expect(completedAge(undefined, '2026-01-01')).toBeNull();
    expect(completedAge('2027-01-01', '2026-01-01')).toBeNull();
  });
});

describe('Schedule IV relevant factors', () => {
  it('reads the table, not an interpolation', () => {
    expect(relevantFactor(16)).toBe(228.54);
    expect(relevantFactor(40)).toBe(184.17);
    expect(relevantFactor(65)).toBe(99.37);
  });

  it('clamps below sixteen and above sixty-five', () => {
    // The Schedule states one factor for everyone at or below sixteen and
    // another for everyone at or above sixty-five, so this is not missing data.
    expect(relevantFactor(12)).toBe(RELEVANT_FACTORS[16]);
    expect(relevantFactor(72)).toBe(RELEVANT_FACTORS[65]);
  });

  it('falls monotonically with age', () => {
    // The property that makes the table a commutation factor rather than an
    // arbitrary list — and the reason using today's age instead of the age at
    // the accident quietly reduces every long-running claim.
    const ages = Object.keys(RELEVANT_FACTORS)
      .map(Number)
      .sort((a, b) => a - b);

    for (let i = 1; i < ages.length; i += 1) {
      expect(RELEVANT_FACTORS[ages[i]]).toBeLessThan(
        RELEVANT_FACTORS[ages[i - 1]],
      );
    }
  });

  it('covers every age from sixteen to sixty-five with no gaps', () => {
    for (let age = 16; age <= 65; age += 1) {
      expect(typeof RELEVANT_FACTORS[age]).toBe('number');
    }
  });
});

describe('the Explanation II wage cap', () => {
  it('caps the computation wage at ₹15,000', () => {
    expect(cappedMonthlyWages(60000)).toEqual({
      actual: 60000,
      capped: MONTHLY_WAGE_CAP,
      capApplied: true,
    });
  });

  it('leaves a wage below the cap alone', () => {
    expect(cappedMonthlyWages(9000)).toEqual({
      actual: 9000,
      capped: 9000,
      capApplied: false,
    });
  });

  it('treats a negative or unusable wage as zero', () => {
    expect(cappedMonthlyWages(-5000).actual).toBe(0);
    expect(cappedMonthlyWages('not a number').actual).toBe(0);
  });
});

describe('section 4(1)(a) — death', () => {
  it('is half the capped wage times the relevant factor', () => {
    const result = deathCompensation({ monthlyWages: 60000, age: 30 });

    expect(result.wages.capApplied).toBe(true);
    expect(result.relevantFactor).toBe(207.98);
    expect(result.compensation).toBe(
      Math.round(MONTHLY_WAGE_CAP * 0.5 * 207.98 * 100) / 100,
    );
  });

  it('applies the ₹1,20,000 floor to a small claim', () => {
    const result = deathCompensation({ monthlyWages: 1000, age: 65 });

    expect(result.computed).toBeLessThan(MINIMUM_DEATH_COMPENSATION);
    expect(result.floorApplied).toBe(true);
    expect(result.compensation).toBe(MINIMUM_DEATH_COMPENSATION);
  });

  it('pays a younger employee more for the same wage', () => {
    const young = deathCompensation({ monthlyWages: 15000, age: 22 });
    const old = deathCompensation({ monthlyWages: 15000, age: 58 });

    expect(young.compensation).toBeGreaterThan(old.compensation);
  });
});

describe('section 4(1)(b) — permanent total disablement', () => {
  it('is sixty percent rather than fifty', () => {
    const death = deathCompensation({ monthlyWages: 15000, age: 40 });
    const total = permanentTotalCompensation({ monthlyWages: 15000, age: 40 });

    // The one place the Act pays more for a living claimant than for a death.
    expect(total.compensation).toBeGreaterThan(death.compensation);
    expect(total.compensation).toBe(
      Math.round(15000 * 0.6 * 184.17 * 100) / 100,
    );
  });

  it('applies its own ₹1,40,000 floor, not the death one', () => {
    const result = permanentTotalCompensation({ monthlyWages: 1000, age: 65 });

    expect(result.floor).toBe(MINIMUM_PERMANENT_TOTAL_COMPENSATION);
    expect(result.compensation).toBe(MINIMUM_PERMANENT_TOTAL_COMPENSATION);
  });
});

describe('section 4(1)(c) — permanent partial disablement', () => {
  it('applies the Schedule I percentage to the permanent total figure', () => {
    // Not to the wages. Thirty percent of what a total disablement would have
    // paid is materially more than thirty percent of anything else, and getting
    // this wrong halves a partial claim.
    const total = permanentTotalCompensation({ monthlyWages: 15000, age: 35 });
    const partial = permanentPartialCompensation({
      monthlyWages: 15000,
      age: 35,
      scheduleInjury: 'LOSS_OF_ONE_EYE',
    });

    expect(partial.lossOfEarningCapacityPercent).toBe(30);
    expect(partial.compensation).toBe(
      Math.round(total.computed * 0.3 * 100) / 100,
    );
  });

  it('does not carry the total disablement floor across', () => {
    // Otherwise a 7% little-finger claim would pay ₹1,40,000 — more than a
    // properly computed 60% one on the same wage.
    const partial = permanentPartialCompensation({
      monthlyWages: 1000,
      age: 65,
      scheduleInjury: 'LOSS_OF_RING_OR_LITTLE_FINGER',
    });

    expect(partial.compensation).toBeLessThan(
      MINIMUM_PERMANENT_TOTAL_COMPENSATION,
    );
  });

  it('accepts an assessed percentage for an injury not in Schedule I', () => {
    const partial = permanentPartialCompensation({
      monthlyWages: 15000,
      age: 35,
      lossOfEarningCapacityPercent: 22,
    });

    expect(partial.scheduleInjury).toBeNull();
    expect(partial.lossOfEarningCapacityPercent).toBe(22);
    expect(partial.injuryDescription).toMatch(/not listed in Schedule I/);
  });

  it('clamps an assessed percentage to nought and a hundred', () => {
    expect(
      permanentPartialCompensation({
        monthlyWages: 15000,
        age: 35,
        lossOfEarningCapacityPercent: 140,
      }).lossOfEarningCapacityPercent,
    ).toBe(100);

    expect(
      permanentPartialCompensation({
        monthlyWages: 15000,
        age: 35,
        lossOfEarningCapacityPercent: -10,
      }).lossOfEarningCapacityPercent,
    ).toBe(0);
  });

  it('a hundred percent partial equals the unfloored total figure', () => {
    const total = permanentTotalCompensation({ monthlyWages: 15000, age: 45 });
    const partial = permanentPartialCompensation({
      monthlyWages: 15000,
      age: 45,
      scheduleInjury: 'LOSS_OF_SIGHT_BOTH_EYES',
    });

    expect(partial.compensation).toBe(total.computed);
  });

  it('a listed injury wins over an assessed percentage', () => {
    const partial = permanentPartialCompensation({
      monthlyWages: 15000,
      age: 35,
      scheduleInjury: 'LOSS_OF_THUMB',
      lossOfEarningCapacityPercent: 90,
    });

    expect(partial.lossOfEarningCapacityPercent).toBe(30);
  });
});

describe('section 4(1)(d) — temporary disablement', () => {
  it('pays a quarter of the capped wage half-monthly', () => {
    const result = temporaryCompensation({
      monthlyWages: 60000,
      disablementDays: 60,
    });

    expect(result.halfMonthlyPayment).toBe(MONTHLY_WAGE_CAP * 0.25);
  });

  it('withholds the first three days on a short incapacity', () => {
    const result = temporaryCompensation({
      monthlyWages: 15000,
      disablementDays: 10,
    });

    expect(result.waitingWaived).toBe(false);
    expect(result.waitingDays).toBe(3);
    expect(result.compensableDays).toBe(7);
  });

  it('waives the waiting period entirely at twenty-eight days', () => {
    // Not "pays from day four" — section 4(2) makes the payment run from the
    // date of disablement once the incapacity reaches twenty-eight days, which
    // is the rule most often applied backwards.
    const result = temporaryCompensation({
      monthlyWages: 15000,
      disablementDays: 28,
    });

    expect(result.waitingWaived).toBe(true);
    expect(result.waitingDays).toBe(0);
    expect(result.compensableDays).toBe(28);
  });

  it('is still three days at twenty-seven', () => {
    const result = temporaryCompensation({
      monthlyWages: 15000,
      disablementDays: 27,
    });

    expect(result.waitingWaived).toBe(false);
    expect(result.compensableDays).toBe(24);
  });

  it('pays nothing for an incapacity inside the waiting period', () => {
    const result = temporaryCompensation({
      monthlyWages: 15000,
      disablementDays: 2,
    });

    expect(result.compensableDays).toBe(0);
    expect(result.compensation).toBe(0);
  });

  it('caps the series at five years', () => {
    const result = temporaryCompensation({
      monthlyWages: 15000,
      disablementDays: 3000,
    });

    expect(result.fiveYearCapApplied).toBe(true);
    expect(result.compensableDays).toBe(5 * 365);
  });

  it('counts half-months rather than rounding up to whole months', () => {
    // A series rounded to the month would overpay every short incapacity.
    const result = temporaryCompensation({
      monthlyWages: 15000,
      disablementDays: 30,
    });

    expect(result.halfMonths).toBeCloseTo(30 / (365 / 24), 2);
  });
});

describe('section 3 — the statutory bars', () => {
  it('bars a temporary claim for drink', () => {
    const result = applyStatutoryBars({
      injuryType: INJURY.TEMPORARY,
      bars: [BAR.DRINK_OR_DRUGS],
    });

    expect(result.barred).toBe(true);
    expect(result.reasons[0]).toMatch(/3\(1\)\(b\)\(i\)/);
  });

  it('does not bar a death claim for the same conduct', () => {
    // The section 3(1)(b) provisos do not apply where the injury results in
    // death or permanent total disablement. Missing this denies a dependant a
    // claim the Act allows.
    const result = applyStatutoryBars({
      injuryType: INJURY.DEATH,
      bars: [BAR.DRINK_OR_DRUGS, BAR.WILFUL_REMOVAL_OF_SAFEGUARD],
    });

    expect(result.barred).toBe(false);
    expect(result.disapplied).toHaveLength(2);
  });

  it('does not bar permanent total disablement either', () => {
    expect(
      applyStatutoryBars({
        injuryType: INJURY.PERMANENT_TOTAL,
        bars: [BAR.WILFUL_DISOBEDIENCE],
      }).barred,
    ).toBe(false);
  });

  it('still bars permanent partial disablement', () => {
    // The exception names death and *total* disablement only.
    expect(
      applyStatutoryBars({
        injuryType: INJURY.PERMANENT_PARTIAL,
        bars: [BAR.WILFUL_DISOBEDIENCE],
      }).barred,
    ).toBe(true);
  });

  it('bars a death claim that did not arise out of the employment', () => {
    // Not a section 3(1)(b) proviso — it is the substantive test in section
    // 3(1) itself, so the death exception does not reach it.
    const result = applyStatutoryBars({
      injuryType: INJURY.DEATH,
      bars: [BAR.NOT_ARISING_OUT_OF_EMPLOYMENT],
    });

    expect(result.barred).toBe(true);
  });

  it('ignores an unrecognised bar rather than failing on it', () => {
    expect(
      applyStatutoryBars({ injuryType: INJURY.TEMPORARY, bars: ['MADE_UP'] })
        .barred,
    ).toBe(false);
  });

  it('does not count the same bar twice', () => {
    const result = applyStatutoryBars({
      injuryType: INJURY.TEMPORARY,
      bars: [BAR.DRINK_OR_DRUGS, BAR.DRINK_OR_DRUGS],
    });

    expect(result.applied).toHaveLength(1);
  });
});

describe('section 4A — late payment', () => {
  it('is nothing inside the thirty-day window', () => {
    const result = latePaymentCharges({
      compensation: 500000,
      accidentDate: '2026-01-01',
      paymentDate: '2026-01-20',
    });

    expect(result.daysLate).toBe(0);
    expect(result.interest).toBe(0);
    expect(result.total).toBe(500000);
  });

  it('runs interest from the accident, not from the end of the window', () => {
    // The thirty days are the grace period for *paying*. Section 4A(3)(a)
    // charges interest on compensation that fell due on the day of the
    // accident, which is why an employer cannot improve its position by being
    // slow to admit liability.
    const result = latePaymentCharges({
      compensation: 500000,
      accidentDate: '2026-01-01',
      paymentDate: '2026-10-01',
    });

    expect(result.interestDays).toBe(273);
    expect(result.interest).toBe(
      Math.round(((500000 * 0.12 * 273) / 365) * 100) / 100,
    );
  });

  it('adds the Commissioner’s penalty at the share passed in', () => {
    const result = latePaymentCharges({
      compensation: 400000,
      accidentDate: '2026-01-01',
      paymentDate: '2026-12-01',
      penaltyShare: 0.25,
    });

    expect(result.penalty).toBe(100000);
  });

  it('caps the penalty at fifty percent', () => {
    const result = latePaymentCharges({
      compensation: 400000,
      accidentDate: '2026-01-01',
      paymentDate: '2026-12-01',
      penaltyShare: 0.9,
    });

    expect(result.penaltyShare).toBe(MAX_PENALTY_SHARE);
    expect(result.penalty).toBe(200000);
  });

  it('charges no penalty where nothing is late', () => {
    const result = latePaymentCharges({
      compensation: 400000,
      accidentDate: '2026-01-01',
      paymentDate: '2026-01-15',
      penaltyShare: 0.5,
    });

    expect(result.penalty).toBe(0);
  });

  it('measures an unpaid claim to the date given', () => {
    const result = latePaymentCharges({
      compensation: 100000,
      accidentDate: '2026-01-01',
      asAt: '2026-07-01',
    });

    expect(result.daysLate).toBeGreaterThan(0);
    expect(result.interest).toBeGreaterThan(0);
  });

  it('returns the principal untouched on an unusable date', () => {
    const result = latePaymentCharges({
      compensation: 100000,
      accidentDate: 'not a date',
      paymentDate: '2026-07-01',
    });

    expect(result.total).toBe(100000);
    expect(result.dueBy).toBeNull();
  });
});

describe('assessing a claim end to end', () => {
  const base = {
    monthlyWages: 22000,
    dateOfBirth: '1990-03-15',
    accidentDate: '2026-02-01',
  };

  it('computes a death claim with funeral expenses', () => {
    const result = assessClaim({
      ...base,
      injuryType: INJURY.DEATH,
      funeralExpensesIncurred: true,
      paymentDate: '2026-02-20',
    });

    expect(result.payable).toBe(true);
    expect(result.age).toBe(35);
    expect(result.funeralExpenses).toBe(FUNERAL_EXPENSES);
    expect(result.totalPayable).toBe(
      Math.round((result.compensation + FUNERAL_EXPENSES) * 100) / 100,
    );
  });

  it('pays no funeral expenses on a disablement claim', () => {
    const result = assessClaim({
      ...base,
      injuryType: INJURY.PERMANENT_TOTAL,
      funeralExpensesIncurred: true,
    });

    expect(result.funeralExpenses).toBe(0);
  });

  it('still computes the figure for a barred claim', () => {
    // An employer declining a claim needs to know what it declined, and a
    // barred claim that is contested becomes payable without anybody
    // recomputing it.
    const result = assessClaim({
      ...base,
      injuryType: INJURY.TEMPORARY,
      disablementDays: 40,
      bars: [BAR.WILFUL_DISOBEDIENCE],
    });

    expect(result.payable).toBe(false);
    expect(result.compensation).toBe(0);
    expect(result.totalPayable).toBe(0);
    expect(result.head.compensation).toBeGreaterThan(0);
  });

  it('uses the age at the accident, not the age today', () => {
    const atAccident = assessClaim({
      ...base,
      injuryType: INJURY.DEATH,
      accidentDate: '2020-02-01',
    });
    const later = assessClaim({ ...base, injuryType: INJURY.DEATH });

    expect(atAccident.age).toBe(29);
    expect(later.age).toBe(35);
    expect(atAccident.compensation).toBeGreaterThan(later.compensation);
  });

  it('warns rather than guessing when the date of birth is missing', () => {
    const result = assessClaim({
      ...base,
      dateOfBirth: undefined,
      injuryType: INJURY.DEATH,
    });

    expect(result.age).toBeNull();
    expect(result.ageWarning).toMatch(/age 65/);
    expect(result.head.relevantFactor).toBe(RELEVANT_FACTORS[65]);
  });

  it('does not warn about age on a temporary claim, which does not use it', () => {
    const result = assessClaim({
      ...base,
      dateOfBirth: undefined,
      injuryType: INJURY.TEMPORARY,
      disablementDays: 30,
    });

    expect(result.ageWarning).toBeNull();
  });

  it('rejects an unknown injury type instead of computing something', () => {
    const result = assessClaim({ ...base, injuryType: 'SPRAINED_PRIDE' });

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Unknown injury type/);
  });

  it('folds interest and penalty into what is actually written out', () => {
    const result = assessClaim({
      ...base,
      injuryType: INJURY.DEATH,
      funeralExpensesIncurred: true,
      paymentDate: '2027-02-01',
      penaltyShare: 0.5,
    });

    expect(result.charges.interest).toBeGreaterThan(0);
    expect(result.charges.penalty).toBe(
      Math.round(result.compensation * 0.5 * 100) / 100,
    );
    expect(result.totalPayable).toBe(
      Math.round((result.charges.total + FUNERAL_EXPENSES) * 100) / 100,
    );
  });
});
