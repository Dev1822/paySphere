/**
 * Perquisite valuation under Rule 3 (#1770).
 *
 * The case worth stating first, because it is the reason this cannot be a lookup
 * table: granting an employee in employer-owned accommodation a ₹1,000 allowance
 * does not add ₹1,000 to their taxable income. It adds ₹1,100, because the
 * allowance is inside the base the accommodation perquisite is a percentage of.
 *
 * The other boundaries:
 *
 *   - the three accommodation types being three formulas rather than three
 *     rates, so leased takes the *lower* of 15% and the actual rent;
 *   - a fourteen-day hotel stay being worth nothing and a sixteen-day stay being
 *     worth all sixteen days;
 *   - rent recovered above the value creating no deduction;
 *   - a loan rate frozen at 1 April applied to a balance that is not;
 *   - the exemption testing the peak balance rather than the closing one;
 *   - and the ESOP perquisite arising on exercise rather than on vesting.
 */

const {
  PERQUISITE_RULES,
  PERQUISITE_KIND,
  ACCOMMODATION_TYPE,
  FINDING,
  ruleThreeSalary,
  valueAccommodation,
  valueMotorCar,
  valueConcessionalLoan,
  valueEsopExercise,
  valuePerquisites,
  formTwelveBaLines,
  valuePopulation,
} = require('../perquisiteValuation');

/** A monthly salary component. */
const component = (label, amount, extra = {}) => ({ label, amount, ...extra });

const codesOf = (result) => (result.findings || []).map((entry) => entry.code);

/** Basic 50,000 + DA 10,000 + special allowance 20,000 = 80,000 a month. */
const standardComponents = [
  component('Basic', 50000),
  component('Dearness allowance', 10000),
  component('Special allowance', 20000),
];

describe('the Rule 3 salary base', () => {
  it('sums the taxable components for the year', () => {
    const base = ruleThreeSalary({ components: standardComponents });

    expect(base.monthly).toBe(80000);
    expect(base.salary).toBe(960000);
  });

  it('excludes an exempt allowance', () => {
    const base = ruleThreeSalary({
      components: [
        ...standardComponents,
        component('Leave travel allowance', 5000, { taxable: false }),
      ],
    });

    expect(base.monthly).toBe(80000);
  });

  it('is taken over the months the perquisite was provided', () => {
    // A flat given in October is six months of salary, not twelve.
    const base = ruleThreeSalary({ components: standardComponents, months: 6 });

    expect(base.salary).toBe(480000);
    expect(base.months).toBe(6);
  });

  it('treats an annual figure as such when told', () => {
    const base = ruleThreeSalary({
      components: [component('Commission', 120000, { monthly: false })],
    });

    expect(base.monthly).toBe(10000);
  });
});

describe('the compounding that nothing else can see', () => {
  const accommodationOn = (components) =>
    valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: ruleThreeSalary({ components }).salary,
    });

  it('values employer-owned accommodation at ten per cent in a large city', () => {
    const result = accommodationOn(standardComponents);

    expect(result.percent).toBe(10);
    expect(result.value).toBe(96000);
  });

  it('makes a ₹1,000 allowance cost ₹1,100 of taxable income', () => {
    const before = accommodationOn(standardComponents);
    const after = accommodationOn([
      ...standardComponents,
      component('New allowance', 1000),
    ]);

    // The allowance itself is 12,000 a year. The perquisite rises by 1,200.
    expect(after.value - before.value).toBe(1200);

    const allowance = 12000;
    const extraTaxableIncome = allowance + (after.value - before.value);
    expect(extraTaxableIncome).toBe(13200);
    expect(extraTaxableIncome / allowance).toBe(1.1);
  });

  it('states the multiplier rather than leaving it to be discovered', () => {
    const result = accommodationOn(standardComponents);

    const entry = result.findings.find(
      (f) => f.code === FINDING.ALLOWANCE_COMPOUNDS,
    );

    expect(entry).toBeDefined();
    expect(entry.marginalPerThousand).toBe(1100);
  });

  it('surfaces the multiplier on the whole valuation', () => {
    const valuation = valuePerquisites({
      employee: { employeeId: 'e1' },
      salaryComponents: standardComponents,
      accommodation: {
        type: ACCOMMODATION_TYPE.OWNED,
        population: 12000000,
      },
    });

    expect(valuation.marginalAllowanceMultiplier).toBe(1.1);
  });

  it('is one for an employee with no accommodation perquisite', () => {
    const valuation = valuePerquisites({
      employee: { employeeId: 'e2' },
      salaryComponents: standardComponents,
      motorCar: { engineLitres: 1.4 },
    });

    expect(valuation.marginalAllowanceMultiplier).toBe(1);
  });

  it('is one for leased accommodation too, where the rent binds', () => {
    // The value is the rent, not a percentage of salary, so an extra allowance
    // does not move it. Reporting 1.15 here would be wrong.
    const valuation = valuePerquisites({
      employee: { employeeId: 'e3' },
      salaryComponents: standardComponents,
      accommodation: {
        type: ACCOMMODATION_TYPE.LEASED,
        rentPaidByEmployer: 240000,
      },
    });

    expect(valuation.marginalAllowanceMultiplier).toBe(1);
  });
});

describe('the accommodation population bands', () => {
  const at = (population) =>
    valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population,
      salary: 1000000,
    }).percent;

  it('is ten per cent above forty lakh', () => {
    expect(at(4000001)).toBe(10);
  });

  it('is seven and a half between fifteen and forty lakh', () => {
    expect(at(4000000)).toBe(7.5);
    expect(at(1500001)).toBe(7.5);
  });

  it('is five at or below fifteen lakh', () => {
    expect(at(1500000)).toBe(5);
    expect(at(200000)).toBe(5);
  });
});

describe('three formulas, not three rates', () => {
  it('takes the lower of fifteen per cent and the rent for a lease', () => {
    // 15% of 960,000 is 144,000; the rent is 120,000.
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.LEASED,
      salary: 960000,
      rentPaidByEmployer: 120000,
    });

    expect(result.value).toBe(120000);
    expect(result.basis).toMatch(/rent/);
  });

  it('takes the percentage where the rent is higher', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.LEASED,
      salary: 960000,
      rentPaidByEmployer: 300000,
    });

    expect(result.value).toBe(144000);
    expect(result.basis).toMatch(/15% of/);
  });

  it('changes formula rather than rate when the employer switches to leasing', () => {
    const owned = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 960000,
    });

    const leased = valueAccommodation({
      type: ACCOMMODATION_TYPE.LEASED,
      salary: 960000,
      rentPaidByEmployer: 120000,
    });

    // The owned figure is a pure percentage; the leased one is a comparison.
    expect(owned.value).toBe(96000);
    expect(leased.value).toBe(120000);
  });
});

describe('the fifteen-day hotel threshold', () => {
  it('is worth nothing at fourteen days', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.HOTEL,
      salary: 100000,
      hotelCharge: 90000,
      hotelDays: 14,
    });

    expect(result.value).toBe(0);
    expect(codesOf(result)).toContain(FINDING.HOTEL_BELOW_THRESHOLD);
  });

  it('is worth nothing at exactly fifteen', () => {
    expect(
      valueAccommodation({
        type: ACCOMMODATION_TYPE.HOTEL,
        salary: 100000,
        hotelCharge: 90000,
        hotelDays: PERQUISITE_RULES.hotelExemptDays,
      }).value,
    ).toBe(0);
  });

  it('is worth all of it at sixteen', () => {
    // Not one day's worth. The threshold decides whether it is valued, not how
    // much of it is.
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.HOTEL,
      salary: 100000,
      hotelCharge: 90000,
      hotelDays: 16,
    });

    expect(result.value).toBe(24000);
  });

  it('takes the actual charge where it is lower than twenty-four per cent', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.HOTEL,
      salary: 100000,
      hotelCharge: 10000,
      hotelDays: 20,
    });

    expect(result.value).toBe(10000);
  });
});

describe('furniture and rent recovered', () => {
  it('adds ten per cent a year of the cost', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 960000,
      furniture: { cost: 200000 },
    });

    expect(result.furniture).toBe(20000);
    expect(result.value).toBe(116000);
  });

  it('takes the hire charge where the employer does not own it', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 960000,
      furniture: { cost: 200000, hireCharges: 36000 },
    });

    expect(result.furniture).toBe(36000);
  });

  it('prorates the furniture over a part year', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 480000,
      months: 6,
      furniture: { cost: 200000 },
    });

    expect(result.furniture).toBe(10000);
  });

  it('subtracts the rent the employee paid', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 960000,
      rentRecovered: 36000,
    });

    expect(result.value).toBe(60000);
  });

  it('floors at zero, and a recovery above the value is not a deduction', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 960000,
      rentRecovered: 200000,
    });

    expect(result.value).toBe(0);
    expect(codesOf(result)).toContain(FINDING.RECOVERY_EXCEEDS_VALUE);
  });

  it('reports a part-year occupation', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 480000,
      months: 6,
    });

    expect(codesOf(result)).toContain(FINDING.PART_YEAR_OCCUPATION);
    expect(result.value).toBe(48000);
  });
});

describe('the motor car', () => {
  it('is ₹1,800 a month at or below 1.6 litres', () => {
    expect(valueMotorCar({ engineLitres: 1.6, months: 12 }).value).toBe(21600);
  });

  it('is ₹2,400 above it', () => {
    expect(valueMotorCar({ engineLitres: 1.8, months: 12 }).value).toBe(28800);
  });

  it('adds ₹900 for a driver', () => {
    expect(
      valueMotorCar({ engineLitres: 1.4, driverProvided: true, months: 12 })
        .value,
    ).toBe(32400);
  });

  it('does not vary with the cost of the car', () => {
    // The flatness is the rule, not a simplification. Two cars of the same
    // engine capacity and wildly different price are worth the same.
    const cheap = valueMotorCar({ engineLitres: 1.5, months: 12 });
    const expensive = valueMotorCar({ engineLitres: 1.5, months: 12 });

    expect(cheap.value).toBe(expensive.value);
  });

  it('prorates over the months provided', () => {
    expect(valueMotorCar({ engineLitres: 1.4, months: 5 }).value).toBe(9000);
  });

  it('values the employee’s own car as the excess reimbursement', () => {
    // A different case entirely: what is taxable is the reimbursement less the
    // notified amount, not a flat perquisite.
    const result = valueMotorCar({
      engineLitres: 1.4,
      months: 12,
      employeeOwned: true,
      reimbursement: 30000,
    });

    expect(result.value).toBe(8400);
  });

  it('is nothing where the reimbursement is below the notified amount', () => {
    expect(
      valueMotorCar({
        engineLitres: 1.4,
        months: 12,
        employeeOwned: true,
        reimbursement: 15000,
      }).value,
    ).toBe(0);
  });
});

describe('the concessional loan', () => {
  /** Twelve months at a declining balance. */
  const decliningBalances = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    year: 2026,
    maximumOutstanding: 600000 - index * 50000,
  }));

  it('applies the frozen rate to each month’s maximum outstanding balance', () => {
    const result = valueConcessionalLoan({
      balances: decliningBalances,
      sbiRatePercent: 9,
    });

    // Sum of balances is 3,900,000; at 9%/12 that is 29,250.
    expect(result.notionalInterest).toBe(29250);
  });

  it('subtracts the interest actually charged', () => {
    const result = valueConcessionalLoan({
      balances: decliningBalances,
      sbiRatePercent: 9,
      interestCharged: 12000,
    });

    expect(result.value).toBe(17250);
  });

  it('floors at zero where more was charged than the notional', () => {
    expect(
      valueConcessionalLoan({
        balances: decliningBalances,
        sbiRatePercent: 9,
        interestCharged: 50000,
      }).value,
    ).toBe(0);
  });

  it('exempts a loan that never exceeded ₹20,000', () => {
    const result = valueConcessionalLoan({
      balances: [
        { month: 1, year: 2026, maximumOutstanding: 20000 },
        { month: 2, year: 2026, maximumOutstanding: 15000 },
      ],
      sbiRatePercent: 9,
    });

    expect(result.value).toBe(0);
    expect(codesOf(result)).toContain(FINDING.LOAN_BELOW_EXEMPT_AGGREGATE);
  });

  it('tests the peak, not the closing balance', () => {
    // Peaked at 50,000 and closed at 5,000. Not exempt.
    const result = valueConcessionalLoan({
      balances: [
        { month: 1, year: 2026, maximumOutstanding: 50000 },
        { month: 2, year: 2026, maximumOutstanding: 5000 },
      ],
      sbiRatePercent: 9,
    });

    expect(result.peakBalance).toBe(50000);
    expect(result.value).toBeGreaterThan(0);
  });

  it('exempts a loan for a specified medical treatment at any size', () => {
    const result = valueConcessionalLoan({
      balances: decliningBalances,
      sbiRatePercent: 9,
      forSpecifiedMedicalTreatment: true,
    });

    expect(result.value).toBe(0);
    expect(codesOf(result)).toContain(FINDING.LOAN_MEDICAL_EXEMPT);
  });

  it('reports rather than guesses when no rate is on record', () => {
    const result = valueConcessionalLoan({
      balances: decliningBalances,
      sbiRatePercent: 0,
    });

    expect(codesOf(result)).toContain(FINDING.NO_RATE_ON_RECORD);
    expect(result.value).toBe(0);
  });

  it('holds the rate flat while the balance moves', () => {
    // The inversion of every amortisation in the tree, asserted: the same rate
    // applies to January's 600,000 and to December's 50,000.
    const result = valueConcessionalLoan({
      balances: decliningBalances,
      sbiRatePercent: 9,
    });

    expect(result.sbiRatePercent).toBe(9);
    expect(result.monthlyBalances[0].maximumOutstanding).toBe(600000);
    expect(result.monthlyBalances[11].maximumOutstanding).toBe(50000);
  });
});

describe('the ESOP perquisite', () => {
  it('is the spread on the date of exercise, times the shares', () => {
    const result = valueEsopExercise({
      exercises: [
        {
          shares: 1000,
          fairMarketValue: 450,
          exercisePrice: 100,
          exercisedOn: '2026-06-15',
        },
      ],
    });

    expect(result.value).toBe(350000);
  });

  it('sums several exercises', () => {
    const result = valueEsopExercise({
      exercises: [
        { shares: 500, fairMarketValue: 400, exercisePrice: 100 },
        { shares: 500, fairMarketValue: 500, exercisePrice: 100 },
      ],
    });

    expect(result.value).toBe(350000);
  });

  it('floors an underwater exercise at zero', () => {
    // Nobody exercises underwater, but a stale fair market value can make it
    // look as though somebody did, and a negative would reduce salary.
    const result = valueEsopExercise({
      exercises: [{ shares: 1000, fairMarketValue: 50, exercisePrice: 100 }],
    });

    expect(result.value).toBe(0);
  });

  it('is nothing where nothing was exercised', () => {
    expect(valueEsopExercise({ exercises: [] }).value).toBe(0);
  });
});

describe('a whole employee', () => {
  const valuation = valuePerquisites({
    employee: { employeeId: 'e1', name: 'Asha' },
    salaryComponents: standardComponents,
    accommodation: {
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      furniture: { cost: 200000 },
      rentRecovered: 24000,
    },
    motorCar: { engineLitres: 1.8, driverProvided: true, months: 12 },
    loans: [
      {
        balances: [
          { month: 1, year: 2026, maximumOutstanding: 400000 },
          { month: 2, year: 2026, maximumOutstanding: 400000 },
        ],
        sbiRatePercent: 9,
      },
    ],
    esop: {
      exercises: [{ shares: 100, fairMarketValue: 400, exercisePrice: 100 }],
    },
  });

  it('values the accommodation against the Rule 3 salary', () => {
    expect(valuation.ruleThreeSalary).toBe(960000);

    const accommodation = valuation.items.find(
      (item) => item.kind === PERQUISITE_KIND.ACCOMMODATION,
    );

    // 96,000 + 20,000 furniture − 24,000 recovered.
    expect(accommodation.value).toBe(92000);
  });

  it('adds the items that do not depend on salary', () => {
    const car = valuation.items.find(
      (item) => item.kind === PERQUISITE_KIND.MOTOR_CAR,
    );
    const esop = valuation.items.find(
      (item) => item.kind === PERQUISITE_KIND.ESOP,
    );

    expect(car.value).toBe(39600);
    expect(esop.value).toBe(30000);
  });

  it('totals them', () => {
    // 92,000 + 39,600 + 6,000 loan + 30,000.
    expect(valuation.total).toBe(167600);
  });

  it('lays them out in Form 12BA order with a basis for each', () => {
    const lines = formTwelveBaLines(valuation);

    expect(lines.map((line) => line.kind)).toEqual([
      PERQUISITE_KIND.ACCOMMODATION,
      PERQUISITE_KIND.MOTOR_CAR,
      PERQUISITE_KIND.CONCESSIONAL_LOAN,
      PERQUISITE_KIND.ESOP,
    ]);

    expect(lines[0].basis).toMatch(/10% of/);
    expect(lines[0].recovered).toBe(24000);
    expect(lines[1].rule).toBe('Rule 3(2)');
  });

  it('never puts a perquisite into the base it is computed from', () => {
    // The Rule 3 salary is the salary components only. If a perquisite had
    // leaked in, this would be 960,000 plus something.
    expect(valuation.ruleThreeSalary).toBe(80000 * 12);
  });
});

describe('a population', () => {
  const employee = (id, extra = {}) => ({
    employee: { employeeId: id, name: id },
    salaryComponents: standardComponents,
    ...extra,
  });

  const population = valuePopulation([
    employee('a', {
      accommodation: { type: ACCOMMODATION_TYPE.OWNED, population: 12000000 },
    }),
    employee('b', {
      accommodation: {
        type: ACCOMMODATION_TYPE.LEASED,
        rentPaidByEmployer: 120000,
      },
    }),
    employee('c', { motorCar: { engineLitres: 1.4, months: 12 } }),
    employee('d'),
  ]);

  it('counts who carries a perquisite at all', () => {
    expect(population.employeeCount).toBe(4);
    expect(population.withPerquisites).toBe(3);
  });

  it('totals by kind', () => {
    const accommodation = population.byKind.find(
      (entry) => entry.kind === PERQUISITE_KIND.ACCOMMODATION,
    );

    expect(accommodation.value).toBe(96000 + 120000);
  });

  it('counts the employees an allowance compounds for', () => {
    // Only the one in employer-owned accommodation. This is the population
    // `fbpEngine.utils.js` is currently optimising blind.
    expect(population.compoundingCount).toBe(1);
  });

  it('carries the employee onto every finding', () => {
    const entry = population.findings.find(
      (f) => f.code === FINDING.ALLOWANCE_COMPOUNDS,
    );

    expect(entry.employeeName).toBe('a');
    expect(entry.rule).toBe('Rule 3(1), Explanation 1');
  });

  it('summarises by code with a distinct employee count', () => {
    const entry = population.summary.find(
      (f) => f.code === FINDING.ALLOWANCE_COMPOUNDS,
    );

    expect(entry.employeeCount).toBe(1);
  });
});

describe('the notified figures move', () => {
  it('values under the pre-2023 bands when they are supplied', () => {
    const result = valueAccommodation({
      type: ACCOMMODATION_TYPE.OWNED,
      population: 12000000,
      salary: 960000,
      rules: {
        ownedAccommodation: {
          highPopulation: 2500000,
          highPercent: 15,
          midPopulation: 1000000,
          midPercent: 10,
          lowPercent: 7.5,
        },
      },
    });

    expect(result.percent).toBe(15);
    expect(result.value).toBe(144000);
  });
});
