/**
 * Perquisite valuation under Rule 3 (#1770).
 *
 * `taxCalculator.js` computes tax on salary and `tdsEngine.utils.js` withholds
 * it. Both take taxable salary as an input, and neither has any way to arrive at
 * the part of it that section 17(2) calls a perquisite.
 *
 * The gap matters most where the arithmetic is **circular**, and that
 * circularity is why this cannot be a lookup table.
 *
 * The value of employer-owned accommodation is a percentage of *salary*, and
 * "salary" for Rule 3 is basic pay, dearness allowance entering retirement
 * benefits, bonus, commission and **every taxable allowance**. So:
 *
 *   granting an employee a ₹1,000 allowance does not add ₹1,000 to their
 *   taxable income. It adds ₹1,100, because the allowance is inside the base the
 *   accommodation perquisite is a percentage of.
 *
 * A payroll that values perquisites from a table and adds them to salary
 * computes the first ₹1,000 and never the extra ₹100, and no amount of care in
 * the allowance engine can see it, because the dependency runs the other way.
 *
 * The order this module works in is therefore fixed: assemble the Rule 3 salary,
 * excluding perquisites; value the accommodation against it; add the value back.
 * A post-processing step that added the value into the same figure it read would
 * feed itself.
 *
 * Pure functions, no database access.
 */

const MONTHS_PER_YEAR = 12;

/**
 * The notified figures, as the default rule set.
 *
 * The accommodation bands and rates were rewritten by Notification 65/2023 with
 * effect from 1 September 2023 — the old bands were 25 lakh, 10 lakh and below,
 * at 15%, 10% and 7.5% — so a valuation for an earlier year needs the earlier
 * figures and these belong in a rule set rather than in the comparison.
 */
const PERQUISITE_RULES = {
  /** Rule 3(1) — employer-owned accommodation, by city population. */
  ownedAccommodation: {
    /** Population above this, in absolute persons. */
    highPopulation: 4000000,
    highPercent: 10,
    midPopulation: 1500000,
    midPercent: 7.5,
    lowPercent: 5,
  },
  /** Rule 3(1) — leased accommodation: the lower of this and the actual rent. */
  leasedPercent: 15,
  /** Rule 3(1) — hotel accommodation. */
  hotelPercent: 24,
  /** And the stay, in days, beyond which it is valued at all. */
  hotelExemptDays: 15,
  /** Rule 3(1) — furniture owned by the employer, per year of cost. */
  furniturePercent: 10,
  /** Rule 3(2) — motor car, engine capacity in litres and the monthly value. */
  smallCarEngineLitres: 1.6,
  smallCarMonthly: 1800,
  largeCarMonthly: 2400,
  driverMonthly: 900,
  /** Rule 3(7)(i) — a loan aggregate at or below this is not a perquisite. */
  loanExemptAggregate: 20000,
};

const PERQUISITE_KIND = {
  ACCOMMODATION: 'ACCOMMODATION',
  FURNITURE: 'FURNITURE',
  MOTOR_CAR: 'MOTOR_CAR',
  CONCESSIONAL_LOAN: 'CONCESSIONAL_LOAN',
  ESOP: 'ESOP',
};

const PERQUISITE_RULE = {
  [PERQUISITE_KIND.ACCOMMODATION]: 'Rule 3(1)',
  [PERQUISITE_KIND.FURNITURE]: 'Rule 3(1), Explanation 2',
  [PERQUISITE_KIND.MOTOR_CAR]: 'Rule 3(2)',
  [PERQUISITE_KIND.CONCESSIONAL_LOAN]: 'Rule 3(7)(i)',
  [PERQUISITE_KIND.ESOP]: 'Rule 3(8) with section 17(2)(vi)',
};

/** How the accommodation is held. Three formulas, not three rates. */
const ACCOMMODATION_TYPE = {
  OWNED: 'OWNED',
  LEASED: 'LEASED',
  HOTEL: 'HOTEL',
};

const FINDING = {
  ALLOWANCE_COMPOUNDS: 'ALLOWANCE_COMPOUNDS',
  RECOVERY_EXCEEDS_VALUE: 'RECOVERY_EXCEEDS_VALUE',
  HOTEL_BELOW_THRESHOLD: 'HOTEL_BELOW_THRESHOLD',
  LOAN_BELOW_EXEMPT_AGGREGATE: 'LOAN_BELOW_EXEMPT_AGGREGATE',
  LOAN_MEDICAL_EXEMPT: 'LOAN_MEDICAL_EXEMPT',
  PART_YEAR_OCCUPATION: 'PART_YEAR_OCCUPATION',
  NO_RATE_ON_RECORD: 'NO_RATE_ON_RECORD',
};

const FINDING_RULE = {
  [FINDING.ALLOWANCE_COMPOUNDS]: 'Rule 3(1), Explanation 1',
  [FINDING.RECOVERY_EXCEEDS_VALUE]: 'Rule 3(1)',
  [FINDING.HOTEL_BELOW_THRESHOLD]: 'Rule 3(1), proviso',
  [FINDING.LOAN_BELOW_EXEMPT_AGGREGATE]: 'Rule 3(7)(i), proviso',
  [FINDING.LOAN_MEDICAL_EXEMPT]: 'Rule 3(7)(i), proviso',
  [FINDING.PART_YEAR_OCCUPATION]: 'Rule 3(1)',
  [FINDING.NO_RATE_ON_RECORD]: 'Rule 3(7)(i)',
};

const SEVERITY = {
  ADJUSTED: 'ADJUSTED',
  INFORMATIONAL: 'INFORMATIONAL',
};

/**
 * @param {*} value
 * @returns {number}
 */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Merge a rule set over the notified figures.
 *
 * @param {object} [rules]
 * @returns {object}
 */
function resolveRules(rules) {
  return {
    ...PERQUISITE_RULES,
    ...(rules || {}),
    ownedAccommodation: {
      ...PERQUISITE_RULES.ownedAccommodation,
      ...(rules?.ownedAccommodation || {}),
    },
  };
}

/**
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function finding(code, severity, message, context = {}) {
  return {
    code,
    rule: FINDING_RULE[code] || '',
    severity,
    message,
    ...context,
  };
}

/**
 * "Salary" for the purposes of Rule 3.
 *
 * Basic pay, dearness allowance where it enters retirement benefits, bonus,
 * commission, and every taxable allowance — and **no perquisite**. The exclusion
 * is what keeps the arithmetic from feeding itself, since the accommodation
 * value is a percentage of this figure and is itself a perquisite.
 *
 * Exempt allowances are outside it. A house rent allowance exempt under section
 * 10(13A) does not enter, which produces a result worth stating: an employee in
 * employer-owned accommodation cannot claim that exemption at all, so for them
 * the whole of it is taxable and the whole of it is in this base.
 *
 * Computed **for the months the perquisite was provided**, not for the year: an
 * employee given a flat in October is charged a percentage of six months'
 * salary, not of twelve.
 *
 * @param {object} input
 * @param {Array<object>} input.components `{label, amount, taxable, monthly}`
 * @param {number} [input.months] default twelve
 * @returns {{salary: number, months: number, monthly: number, included: Array<object>}}
 */
function ruleThreeSalary(input) {
  const months = Math.max(
    0,
    Math.min(toNumber(input?.months) || MONTHS_PER_YEAR, MONTHS_PER_YEAR),
  );

  const included = (input?.components || []).filter(
    (component) => component && component.taxable !== false,
  );

  // Components are given as monthly figures unless flagged otherwise, because
  // that is how a salary structure holds them and because a part-year
  // computation needs the monthly rate rather than an annual total to prorate.
  const monthly = included.reduce(
    (sum, component) =>
      sum +
      (component.monthly === false
        ? toNumber(component.amount) / MONTHS_PER_YEAR
        : toNumber(component.amount)),
    0,
  );

  return {
    salary: round2(monthly * months),
    months,
    monthly: round2(monthly),
    included: included.map((component) => ({
      label: component.label || '',
      amount: round2(
        component.monthly === false
          ? toNumber(component.amount) / MONTHS_PER_YEAR
          : toNumber(component.amount),
      ),
    })),
  };
}

/**
 * Rule 3(1) — accommodation.
 *
 * Three formulas, not three rates, which is why the type is a required input
 * and not a lookup key. An establishment that switches from owning a flat to
 * leasing one changes what is computed, not merely the percentage:
 *
 *   owned  — a percentage of salary, by the population of the city
 *   leased — the **lower** of 15% of salary and the rent the employer paid
 *   hotel  — the lower of 24% of salary and the actual charge, and only where
 *            the stay exceeded fifteen days, so fourteen days is worth nothing
 *            and sixteen days is worth all sixteen
 *
 * @param {object} input
 * @param {string} input.type an ACCOMMODATION_TYPE
 * @param {number} input.salary the Rule 3 salary for the period
 * @param {number} [input.population] for OWNED
 * @param {number} [input.rentPaidByEmployer] for LEASED
 * @param {number} [input.hotelCharge] for HOTEL
 * @param {number} [input.hotelDays] for HOTEL
 * @param {number} [input.rentRecovered] paid by the employee
 * @param {object} [input.furniture] `{cost, hireCharges}`
 * @param {number} [input.months]
 * @param {object} [input.rules]
 * @returns {object}
 */
function valueAccommodation(input) {
  const rules = resolveRules(input?.rules);
  const findings = [];

  const salary = Math.max(0, toNumber(input?.salary));
  const months = toNumber(input?.months) || MONTHS_PER_YEAR;

  // Assigned in every branch below, and deliberately not pre-set: a default of
  // zero here would let a new accommodation type fall through to a silent
  // nil perquisite instead of failing visibly.
  let gross;
  let basis;
  let percent;

  if (input?.type === ACCOMMODATION_TYPE.HOTEL) {
    const days = toNumber(input?.hotelDays);
    const charge = Math.max(0, toNumber(input?.hotelCharge));

    if (days <= rules.hotelExemptDays) {
      findings.push(
        finding(
          FINDING.HOTEL_BELOW_THRESHOLD,
          SEVERITY.INFORMATIONAL,
          `A hotel stay of ${days} day(s) does not exceed ${rules.hotelExemptDays}, so no perquisite arises. A stay of ${rules.hotelExemptDays + 1} days would be valued in full.`,
          { hotelDays: days },
        ),
      );

      return {
        kind: PERQUISITE_KIND.ACCOMMODATION,
        rule: PERQUISITE_RULE[PERQUISITE_KIND.ACCOMMODATION],
        type: input.type,
        gross: 0,
        furniture: 0,
        rentRecovered: 0,
        value: 0,
        basis: `stay of ${days} days, within the ${rules.hotelExemptDays}-day threshold`,
        findings,
      };
    }

    percent = rules.hotelPercent;
    const onSalary = round2((salary * percent) / 100);
    gross = Math.min(onSalary, charge);
    basis =
      gross === charge
        ? `the actual charge of ₹${round2(charge).toFixed(2)}, lower than ${percent}% of salary`
        : `${percent}% of ₹${salary.toFixed(2)}, lower than the actual charge`;
  } else if (input?.type === ACCOMMODATION_TYPE.LEASED) {
    percent = rules.leasedPercent;
    const rent = Math.max(0, toNumber(input?.rentPaidByEmployer));
    const onSalary = round2((salary * percent) / 100);

    gross = Math.min(onSalary, rent);
    basis =
      gross === rent
        ? `the rent of ₹${round2(rent).toFixed(2)} the employer paid, lower than ${percent}% of salary`
        : `${percent}% of ₹${salary.toFixed(2)}, lower than the rent paid`;
  } else {
    const population = toNumber(input?.population);
    const bands = rules.ownedAccommodation;

    percent =
      population > bands.highPopulation
        ? bands.highPercent
        : population > bands.midPopulation
          ? bands.midPercent
          : bands.lowPercent;

    gross = round2((salary * percent) / 100);
    basis = `${percent}% of ₹${salary.toFixed(2)}, for a city of ${population.toLocaleString('en-IN')}`;

    // The compounding, stated. An extra rupee of taxable allowance raises this
    // value by `percent` per cent of it, so the marginal cost of an allowance to
    // an employee in employer-owned accommodation is more than the allowance.
    findings.push(
      finding(
        FINDING.ALLOWANCE_COMPOUNDS,
        SEVERITY.INFORMATIONAL,
        `The value is a percentage of salary, and salary includes every taxable allowance. A further ₹1,000 of allowance raises taxable income by ₹${round2(1000 * (1 + percent / 100)).toFixed(2)}, not ₹1,000.`,
        { percent, marginalPerThousand: round2(1000 * (1 + percent / 100)) },
      ),
    );
  }

  // Explanation 2. Added to the accommodation value, not blended into it —
  // ten per cent a year of the cost where the employer owns the furniture, the
  // hire charge where it does not.
  const furnitureCost = Math.max(0, toNumber(input?.furniture?.cost));
  const hireCharges = Math.max(0, toNumber(input?.furniture?.hireCharges));

  const furniture = round2(
    hireCharges > 0
      ? (hireCharges * months) / MONTHS_PER_YEAR
      : ((furnitureCost * rules.furniturePercent) / 100) *
          (months / MONTHS_PER_YEAR),
  );

  const rentRecovered = Math.max(0, toNumber(input?.rentRecovered));

  // Concession rather than free: reduce by what the employee paid, floored at
  // zero. A recovery above the value creates no negative perquisite and no
  // deduction — the employee has simply paid rent.
  const beforeRecovery = round2(gross + furniture);
  const value = round2(Math.max(0, beforeRecovery - rentRecovered));

  if (rentRecovered > beforeRecovery + 0.01) {
    findings.push(
      finding(
        FINDING.RECOVERY_EXCEEDS_VALUE,
        SEVERITY.INFORMATIONAL,
        `The employee paid ₹${round2(rentRecovered).toFixed(2)} against a value of ₹${beforeRecovery.toFixed(2)}, so no perquisite arises. The excess is not a deduction.`,
        { rentRecovered: round2(rentRecovered), beforeRecovery },
      ),
    );
  }

  if (months < MONTHS_PER_YEAR) {
    findings.push(
      finding(
        FINDING.PART_YEAR_OCCUPATION,
        SEVERITY.INFORMATIONAL,
        `Valued over ${months} month(s) of occupation, on the salary for those months rather than for the year.`,
        { months },
      ),
    );
  }

  return {
    kind: PERQUISITE_KIND.ACCOMMODATION,
    rule: PERQUISITE_RULE[PERQUISITE_KIND.ACCOMMODATION],
    type: input?.type || ACCOMMODATION_TYPE.OWNED,
    percent,
    gross: round2(gross),
    furniture,
    rentRecovered: round2(rentRecovered),
    value,
    basis,
    findings,
  };
}

/**
 * Rule 3(2) — motor car.
 *
 * Flat monthly figures that do not vary with the cost of the car, the distance
 * driven or the fuel. That flatness is the rule and not a simplification, which
 * is why nothing here reads a running cost.
 *
 * @param {object} input
 * @param {number} input.engineLitres
 * @param {boolean} [input.driverProvided]
 * @param {number} [input.months]
 * @param {boolean} [input.employeeOwned] the car is the employee's own
 * @param {number} [input.reimbursement] where it is
 * @param {object} [input.rules]
 * @returns {object}
 */
function valueMotorCar(input) {
  const rules = resolveRules(input?.rules);

  const months = Math.max(
    0,
    Math.min(toNumber(input?.months) || MONTHS_PER_YEAR, MONTHS_PER_YEAR),
  );

  // The employee's own car reimbursed by the employer is a different case
  // entirely: what is taxable is the reimbursement less the notified amount,
  // not a flat perquisite. Returning the flat figure for it would be wrong in
  // both directions depending on the reimbursement.
  if (input?.employeeOwned) {
    const reimbursement = Math.max(0, toNumber(input?.reimbursement));
    const notified =
      (toNumber(input?.engineLitres) > rules.smallCarEngineLitres
        ? rules.largeCarMonthly
        : rules.smallCarMonthly) * months;

    return {
      kind: PERQUISITE_KIND.MOTOR_CAR,
      rule: PERQUISITE_RULE[PERQUISITE_KIND.MOTOR_CAR],
      employeeOwned: true,
      monthly: 0,
      months,
      value: round2(Math.max(0, reimbursement - notified)),
      basis: `reimbursement of ₹${round2(reimbursement).toFixed(2)} less the notified ₹${round2(notified).toFixed(2)}`,
      findings: [],
    };
  }

  const engineLitres = toNumber(input?.engineLitres);
  const base =
    engineLitres > rules.smallCarEngineLitres
      ? rules.largeCarMonthly
      : rules.smallCarMonthly;

  const monthly = base + (input?.driverProvided ? rules.driverMonthly : 0);

  return {
    kind: PERQUISITE_KIND.MOTOR_CAR,
    rule: PERQUISITE_RULE[PERQUISITE_KIND.MOTOR_CAR],
    employeeOwned: false,
    engineLitres,
    driverProvided: Boolean(input?.driverProvided),
    monthly,
    months,
    value: round2(monthly * months),
    basis: `₹${base} a month for a ${engineLitres > rules.smallCarEngineLitres ? 'car above' : 'car at or below'} ${rules.smallCarEngineLitres} litres${input?.driverProvided ? ` plus ₹${rules.driverMonthly} for a driver` : ''}`,
    findings: [],
  };
}

/**
 * Rule 3(7)(i) — a concessional or interest-free loan.
 *
 * Two things that pull against each other: the rate is **frozen** at the State
 * Bank of India's rate for that class of loan as on the first day of the
 * previous year, and the balance is **not** — the perquisite is computed on the
 * maximum outstanding monthly balance. Every amortisation in the tree does the
 * opposite, applying a moving rate to a scheduled balance, so this is worth
 * reading as a deliberate inversion rather than an oversight.
 *
 * @param {object} input
 * @param {Array<object>} input.balances `{month, year, maximumOutstanding}`
 * @param {number} input.sbiRatePercent the rate as on 1 April
 * @param {number} [input.interestCharged] what the employer actually charged
 * @param {boolean} [input.forSpecifiedMedicalTreatment]
 * @param {object} [input.rules]
 * @returns {object}
 */
function valueConcessionalLoan(input) {
  const rules = resolveRules(input?.rules);
  const findings = [];

  const balances = (input?.balances || []).map((entry) => ({
    month: entry?.month,
    year: entry?.year,
    maximumOutstanding: Math.max(0, toNumber(entry?.maximumOutstanding)),
  }));

  const peak = balances.reduce(
    (highest, entry) => Math.max(highest, entry.maximumOutstanding),
    0,
  );

  if (input?.forSpecifiedMedicalTreatment) {
    findings.push(
      finding(
        FINDING.LOAN_MEDICAL_EXEMPT,
        SEVERITY.INFORMATIONAL,
        'A loan for a specified medical treatment is not a perquisite, whatever its size.',
        {},
      ),
    );

    return {
      kind: PERQUISITE_KIND.CONCESSIONAL_LOAN,
      rule: PERQUISITE_RULE[PERQUISITE_KIND.CONCESSIONAL_LOAN],
      peakBalance: round2(peak),
      notionalInterest: 0,
      interestCharged: 0,
      value: 0,
      findings,
    };
  }

  // The proviso tests the *aggregate*, and it tests it against the highest
  // point rather than a closing balance — a loan that peaked at ₹50,000 and
  // closed at ₹5,000 is not exempt.
  if (peak <= rules.loanExemptAggregate) {
    findings.push(
      finding(
        FINDING.LOAN_BELOW_EXEMPT_AGGREGATE,
        SEVERITY.INFORMATIONAL,
        `The loan never exceeded ₹${rules.loanExemptAggregate}, so no perquisite arises.`,
        { peakBalance: round2(peak) },
      ),
    );

    return {
      kind: PERQUISITE_KIND.CONCESSIONAL_LOAN,
      rule: PERQUISITE_RULE[PERQUISITE_KIND.CONCESSIONAL_LOAN],
      peakBalance: round2(peak),
      notionalInterest: 0,
      interestCharged: 0,
      value: 0,
      findings,
    };
  }

  const rate = toNumber(input?.sbiRatePercent);

  if (rate <= 0) {
    findings.push(
      finding(
        FINDING.NO_RATE_ON_RECORD,
        SEVERITY.ADJUSTED,
        'No State Bank of India rate is on record for 1 April of the previous year, so the perquisite cannot be computed. The rate is frozen for the whole year and has to be recorded once.',
        {},
      ),
    );
  }

  // Month by month on each month's maximum outstanding balance, at one twelfth
  // of the frozen annual rate.
  const notionalInterest = round2(
    balances.reduce(
      (sum, entry) =>
        sum + (entry.maximumOutstanding * rate) / 100 / MONTHS_PER_YEAR,
      0,
    ),
  );

  const interestCharged = Math.max(0, toNumber(input?.interestCharged));

  return {
    kind: PERQUISITE_KIND.CONCESSIONAL_LOAN,
    rule: PERQUISITE_RULE[PERQUISITE_KIND.CONCESSIONAL_LOAN],
    peakBalance: round2(peak),
    sbiRatePercent: rate,
    notionalInterest,
    interestCharged: round2(interestCharged),
    value: round2(Math.max(0, notionalInterest - interestCharged)),
    monthlyBalances: balances,
    findings,
  };
}

/**
 * Rule 3(8) — the ESOP perquisite.
 *
 * Arises on **exercise**, not on vesting. `vestingCalculator.js` computes the
 * vesting and stops there, correctly: a vested option that is never exercised is
 * never a perquisite, and the fair market value that matters is the one on the
 * date the option is exercised rather than the date it vested.
 *
 * @param {object} input
 * @param {Array<object>} input.exercises `{shares, fairMarketValue, exercisePrice, exercisedOn}`
 * @returns {object}
 */
function valueEsopExercise(input) {
  const exercises = (input?.exercises || []).map((entry) => {
    const shares = Math.max(0, toNumber(entry?.shares));
    const fairMarketValue = Math.max(0, toNumber(entry?.fairMarketValue));
    const exercisePrice = Math.max(0, toNumber(entry?.exercisePrice));

    return {
      shares,
      fairMarketValue,
      exercisePrice,
      exercisedOn: entry?.exercisedOn || null,
      // Floored at zero: an underwater exercise is not a negative perquisite.
      // Nobody exercises underwater, but a stale fair market value can make it
      // look as though somebody did, and a negative would reduce salary.
      value: round2(Math.max(0, (fairMarketValue - exercisePrice) * shares)),
    };
  });

  return {
    kind: PERQUISITE_KIND.ESOP,
    rule: PERQUISITE_RULE[PERQUISITE_KIND.ESOP],
    exercises,
    value: round2(exercises.reduce((sum, entry) => sum + entry.value, 0)),
    findings: [],
  };
}

/**
 * One employee's perquisites for a year.
 *
 * The order is the point and is not negotiable:
 *
 *   1. assemble the Rule 3 salary, with perquisites excluded;
 *   2. value the accommodation against it;
 *   3. value everything that does not depend on salary;
 *   4. add them together.
 *
 * Steps 2 and 3 are separated because only the accommodation is a function of
 * salary. Running them together would make the order look arbitrary, and the
 * next person to reorder them would reintroduce the circularity.
 *
 * @param {object} input
 * @param {object} input.employee
 * @param {Array<object>} input.salaryComponents
 * @param {object} [input.accommodation]
 * @param {object} [input.motorCar]
 * @param {Array<object>} [input.loans]
 * @param {object} [input.esop]
 * @param {object} [input.rules]
 * @returns {object}
 */
function valuePerquisites(input) {
  const rules = resolveRules(input?.rules);
  const findings = [];
  const items = [];

  // Step 1. The base, for the months the accommodation was provided, because
  // that is the only perquisite computed on it.
  const months = input?.accommodation
    ? toNumber(input.accommodation.months) || MONTHS_PER_YEAR
    : MONTHS_PER_YEAR;

  const base = ruleThreeSalary({
    components: input?.salaryComponents,
    months,
  });

  // Step 2. Accommodation, against that base.
  if (input?.accommodation) {
    const accommodation = valueAccommodation({
      ...input.accommodation,
      salary: base.salary,
      months,
      rules,
    });

    items.push(accommodation);
    findings.push(...accommodation.findings);
  }

  // Step 3. Everything independent of salary.
  if (input?.motorCar) {
    const car = valueMotorCar({ ...input.motorCar, rules });
    items.push(car);
    findings.push(...car.findings);
  }

  for (const loan of input?.loans || []) {
    const valued = valueConcessionalLoan({ ...loan, rules });
    items.push(valued);
    findings.push(...valued.findings);
  }

  if (input?.esop) {
    const esop = valueEsopExercise(input.esop);
    items.push(esop);
    findings.push(...esop.findings);
  }

  const total = round2(items.reduce((sum, item) => sum + item.value, 0));

  return {
    employeeId: input?.employee?.employeeId || null,
    employeeName: input?.employee?.name || '',

    /** The Rule 3 base, returned so a Form 12BA can show its own working. */
    ruleThreeSalary: base.salary,
    ruleThreeMonths: base.months,
    monthlyRuleThreeSalary: base.monthly,

    items,
    total,

    /**
     * What a further rupee of taxable allowance actually costs.
     *
     * One for an employee with no accommodation perquisite, and more than one
     * for an employee with employer-owned accommodation. This is the number
     * `fbpEngine.utils.js` cannot currently see when it restructures a package.
     */
    marginalAllowanceMultiplier: (() => {
      const accommodation = items.find(
        (item) =>
          item.kind === PERQUISITE_KIND.ACCOMMODATION &&
          item.type === ACCOMMODATION_TYPE.OWNED &&
          item.value > 0,
      );

      return accommodation ? round2(1 + (accommodation.percent || 0) / 100) : 1;
    })(),

    findings,
  };
}

/**
 * Form 12BA line order.
 *
 * The form asks for the value **and** the basis, which is why every item
 * carries a `basis` string and why this returns them rather than a bare total.
 *
 * @param {object} valuation the result of `valuePerquisites`
 * @returns {Array<object>}
 */
function formTwelveBaLines(valuation) {
  const order = [
    PERQUISITE_KIND.ACCOMMODATION,
    PERQUISITE_KIND.MOTOR_CAR,
    PERQUISITE_KIND.CONCESSIONAL_LOAN,
    PERQUISITE_KIND.ESOP,
  ];

  return order
    .flatMap((kind) =>
      (valuation?.items || []).filter((item) => item.kind === kind),
    )
    .map((item, index) => ({
      serial: index + 1,
      kind: item.kind,
      rule: item.rule,
      value: item.value,
      basis: item.basis || '',
      recovered: item.rentRecovered || item.interestCharged || 0,
    }));
}

/**
 * A whole population.
 *
 * @param {Array<object>} employees each in `valuePerquisites` shape
 * @param {object} [options]
 * @param {object} [options.rules]
 * @returns {object}
 */
function valuePopulation(employees, options = {}) {
  const results = (employees || []).map((employee) =>
    valuePerquisites({ ...employee, rules: options.rules }),
  );

  const findings = [];
  const summary = new Map();

  for (const result of results) {
    for (const entry of result.findings) {
      findings.push({
        ...entry,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
      });

      if (!summary.has(entry.code)) {
        summary.set(entry.code, {
          code: entry.code,
          rule: entry.rule,
          severity: entry.severity,
          count: 0,
          employees: new Set(),
        });
      }

      const bucket = summary.get(entry.code);
      bucket.count += 1;
      if (result.employeeId) bucket.employees.add(String(result.employeeId));
    }
  }

  const byKind = new Map();
  for (const result of results) {
    for (const item of result.items) {
      byKind.set(item.kind, round2((byKind.get(item.kind) || 0) + item.value));
    }
  }

  return {
    employeeCount: results.length,
    withPerquisites: results.filter((result) => result.total > 0).length,
    total: round2(results.reduce((sum, result) => sum + result.total, 0)),
    byKind: [...byKind.entries()].map(([kind, value]) => ({
      kind,
      rule: PERQUISITE_RULE[kind],
      value,
    })),
    /**
     * Employees for whom an extra rupee of allowance costs more than a rupee.
     * The population `fbpEngine.utils.js` is currently optimising blind.
     */
    compoundingCount: results.filter(
      (result) => result.marginalAllowanceMultiplier > 1,
    ).length,
    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      rule: bucket.rule,
      severity: bucket.severity,
      count: bucket.count,
      employeeCount: bucket.employees.size,
    })),
    employees: results,
  };
}

module.exports = {
  PERQUISITE_RULES,
  PERQUISITE_KIND,
  PERQUISITE_RULE,
  ACCOMMODATION_TYPE,
  FINDING,
  FINDING_RULE,
  SEVERITY,
  resolveRules,
  ruleThreeSalary,
  valueAccommodation,
  valueMotorCar,
  valueConcessionalLoan,
  valueEsopExercise,
  valuePerquisites,
  formTwelveBaLines,
  valuePopulation,
};
