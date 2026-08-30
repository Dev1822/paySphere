/**
 * Employees' Compensation Act, 1923 (#1699).
 *
 * An employee is injured at work. What does the employer owe them?
 *
 * Every adjacent question already has an answer in the tree and this one has
 * none, because the Act does not compute the way anything else here computes.
 * `settlement.js` works from length of service. `gratuityValuation.js` works
 * from service and salary. This works from **age**, through a commutation
 * factor in Schedule IV that has no closed form.
 *
 * Four heads of compensation with four different bases, one wage cap that is
 * not any of the other wage caps in the product, a set of statutory bars that
 * are disapplied in the two most serious cases, and interest that runs from the
 * accident rather than from the claim. Pure functions and no database access,
 * in the shape `statutoryBonus.js` and `gratuityValuation.js` use.
 */

/**
 * Explanation II to section 4(1): the monthly wages the compensation is
 * computed on are capped here.
 *
 * Deliberately not reused from anywhere else. The ESI wage ceiling, the section
 * 12 bonus floor and the provident fund ceiling are four different numbers for
 * four different purposes, and borrowing one for another is wrong in a way that
 * looks right.
 */
const MONTHLY_WAGE_CAP = 15000;

/** Section 4(1)(a): the share of monthly wages compensated on death. */
const DEATH_WAGE_SHARE = 0.5;

/** Section 4(1)(b): the share for permanent total disablement. */
const PERMANENT_TOTAL_WAGE_SHARE = 0.6;

/** The statutory floors, whatever the factor produces. */
const MINIMUM_DEATH_COMPENSATION = 120000;
const MINIMUM_PERMANENT_TOTAL_COMPENSATION = 140000;

/** Section 4(1B): funeral expenses, payable to whoever incurred them. */
const FUNERAL_EXPENSES = 5000;

/** Section 4(1)(d): the half-monthly payment for temporary disablement. */
const TEMPORARY_HALF_MONTHLY_SHARE = 0.25;

/**
 * Section 4(2): no half-monthly payment for the first three days, unless the
 * incapacity lasts twenty-eight days or more — in which case it is payable
 * from the date of disablement.
 */
const TEMPORARY_WAITING_DAYS = 3;
const TEMPORARY_WAITING_WAIVED_AFTER_DAYS = 28;

/** Section 4(2) proviso: half-monthly payments run for at most five years. */
const TEMPORARY_MAX_YEARS = 5;

/** Section 4A(1): compensation falls due on the date of the accident. */
const PAYMENT_WINDOW_DAYS = 30;

/** Section 4A(3)(a): simple interest on a late payment. */
const LATE_PAYMENT_INTEREST_RATE = 0.12;

/** Section 4A(3)(b): the further penalty the Commissioner may impose. */
const MAX_PENALTY_SHARE = 0.5;

/** Section 3(1) provisos: the acts that bar a claim. */
const BAR = {
  DRINK_OR_DRUGS: 'DRINK_OR_DRUGS',
  WILFUL_DISOBEDIENCE: 'WILFUL_DISOBEDIENCE',
  WILFUL_REMOVAL_OF_SAFEGUARD: 'WILFUL_REMOVAL_OF_SAFEGUARD',
  NOT_ARISING_OUT_OF_EMPLOYMENT: 'NOT_ARISING_OUT_OF_EMPLOYMENT',
  UNDER_THREE_DAYS: 'UNDER_THREE_DAYS',
};

const BAR_REASON = {
  [BAR.DRINK_OR_DRUGS]:
    'section 3(1)(b)(i) — the injury is attributable to the employee having been under the influence of drink or drugs',
  [BAR.WILFUL_DISOBEDIENCE]:
    'section 3(1)(b)(ii) — wilful disobedience of a rule or order expressly framed for securing the safety of employees',
  [BAR.WILFUL_REMOVAL_OF_SAFEGUARD]:
    'section 3(1)(b)(iii) — wilful removal or disregard of a safety guard or device',
  [BAR.NOT_ARISING_OUT_OF_EMPLOYMENT]:
    'section 3(1) — the injury did not arise out of and in the course of the employment',
  [BAR.UNDER_THREE_DAYS]:
    'section 3(1)(a) — the injury did not result in total or partial disablement for more than three days',
};

/** The four heads of compensation. */
const INJURY = {
  DEATH: 'DEATH',
  PERMANENT_TOTAL: 'PERMANENT_TOTAL',
  PERMANENT_PARTIAL: 'PERMANENT_PARTIAL',
  TEMPORARY: 'TEMPORARY',
};

/**
 * Schedule IV — the relevant factor, by completed years of age.
 *
 * This is a commutation factor for a life annuity, not a formula. There is no
 * closed form that reproduces it, and interpolating linearly between the
 * endpoints is off by several percent through the middle of the range, which on
 * a death claim is tens of thousands of rupees. So it is a table.
 *
 * Ages 16 and below all take the age-16 factor; 65 and above all take the
 * age-65 one, which is the floor the Schedule states.
 */
const RELEVANT_FACTORS = {
  16: 228.54,
  17: 227.49,
  18: 226.38,
  19: 225.22,
  20: 224.0,
  21: 222.71,
  22: 221.37,
  23: 219.95,
  24: 218.47,
  25: 216.91,
  26: 215.28,
  27: 213.57,
  28: 211.79,
  29: 209.92,
  30: 207.98,
  31: 205.95,
  32: 203.85,
  33: 201.66,
  34: 199.4,
  35: 197.06,
  36: 194.64,
  37: 192.14,
  38: 189.56,
  39: 186.9,
  40: 184.17,
  41: 181.37,
  42: 178.49,
  43: 175.54,
  44: 172.52,
  45: 169.44,
  46: 166.29,
  47: 163.07,
  48: 159.8,
  49: 156.47,
  50: 153.09,
  51: 149.67,
  52: 146.2,
  53: 142.68,
  54: 139.13,
  55: 135.56,
  56: 131.95,
  57: 128.33,
  58: 124.7,
  59: 121.05,
  60: 117.41,
  61: 113.77,
  62: 110.14,
  63: 106.52,
  64: 102.93,
  65: 99.37,
};

const MIN_FACTOR_AGE = 16;
const MAX_FACTOR_AGE = 65;

/**
 * Schedule I, Part II — injuries deemed to result in permanent partial
 * disablement, with the percentage of loss of earning capacity.
 *
 * A working subset rather than the whole Schedule: these are the entries a
 * payroll product is actually handed, and anything not here is recorded as a
 * medically assessed percentage instead. A closed list that silently refused an
 * unlisted injury would be worse than an open one.
 */
const SCHEDULE_I_INJURIES = {
  LOSS_OF_ARM_ABOVE_ELBOW: {
    percent: 70,
    description: 'Loss of an arm above the elbow',
  },
  LOSS_OF_ARM_BELOW_ELBOW: {
    percent: 60,
    description: 'Loss of an arm below the elbow',
  },
  LOSS_OF_HAND: { percent: 60, description: 'Loss of a hand' },
  LOSS_OF_THUMB: { percent: 30, description: 'Loss of a thumb' },
  LOSS_OF_THUMB_AND_METACARPAL: {
    percent: 40,
    description: 'Loss of a thumb and its metacarpal bone',
  },
  LOSS_OF_INDEX_FINGER: { percent: 14, description: 'Loss of an index finger' },
  LOSS_OF_MIDDLE_FINGER: {
    percent: 12,
    description: 'Loss of a middle finger',
  },
  LOSS_OF_RING_OR_LITTLE_FINGER: {
    percent: 7,
    description: 'Loss of a ring or little finger',
  },
  LOSS_OF_LEG_ABOVE_KNEE: {
    percent: 70,
    description: 'Loss of a leg above the knee',
  },
  LOSS_OF_LEG_BELOW_KNEE: {
    percent: 50,
    description: 'Loss of a leg below the knee',
  },
  LOSS_OF_FOOT: { percent: 50, description: 'Loss of a foot' },
  LOSS_OF_GREAT_TOE: { percent: 14, description: 'Loss of a great toe' },
  LOSS_OF_ONE_EYE: {
    percent: 30,
    description:
      'Loss of one eye, without complications, the other being normal',
  },
  LOSS_OF_SIGHT_BOTH_EYES: {
    percent: 100,
    description: 'Loss of sight in both eyes',
  },
  LOSS_OF_HEARING_BOTH_EARS: { percent: 50, description: 'Absolute deafness' },
  LOSS_OF_HEARING_ONE_EAR: {
    percent: 20,
    description: 'Loss of hearing in one ear',
  },
};

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

/**
 * @param {*} value
 * @returns {number}
 */
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Completed years of age on a date.
 *
 * The date is the *accident*, not today. A claim settled two years after the
 * event is computed on the age at the event, and using today's age would quietly
 * reduce every long-running claim — the factor falls with age.
 *
 * @param {Date|string} dateOfBirth
 * @param {Date|string} onDate
 * @returns {number|null} null when either date is unusable
 */
function completedAge(dateOfBirth, onDate) {
  const born = new Date(dateOfBirth);
  const at = new Date(onDate);

  if (Number.isNaN(born.getTime()) || Number.isNaN(at.getTime())) return null;
  if (at < born) return null;

  let age = at.getUTCFullYear() - born.getUTCFullYear();

  const monthDelta = at.getUTCMonth() - born.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && at.getUTCDate() < born.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

/**
 * The Schedule IV relevant factor for an age.
 *
 * Clamped at both ends rather than returning nothing: the Schedule states a
 * single factor for everyone at or below sixteen and another for everyone at or
 * above sixty-five, so an age outside the table is not missing data.
 *
 * @param {number} age completed years
 * @returns {number}
 */
function relevantFactor(age) {
  const years = Math.floor(toNumber(age));

  if (years <= MIN_FACTOR_AGE) return RELEVANT_FACTORS[MIN_FACTOR_AGE];
  if (years >= MAX_FACTOR_AGE) return RELEVANT_FACTORS[MAX_FACTOR_AGE];

  return RELEVANT_FACTORS[years];
}

/**
 * The monthly wages the computation runs on.
 *
 * Capped by Explanation II. Returned alongside the actual wage so the claim can
 * show both — "why is a ₹60,000 salary compensated on ₹15,000" is the first
 * question anybody asks, and the answer has to be on the page rather than in
 * somebody's head.
 *
 * @param {number} monthlyWages
 * @returns {{actual: number, capped: number, capApplied: boolean}}
 */
function cappedMonthlyWages(monthlyWages) {
  const actual = Math.max(0, round2(toNumber(monthlyWages)));
  const capped = Math.min(actual, MONTHLY_WAGE_CAP);

  return { actual, capped, capApplied: capped < actual };
}

/**
 * Whether section 3 bars the claim.
 *
 * The provisos in section 3(1)(b) do **not** apply where the injury results in
 * death or in permanent total disablement. That exception is the part a
 * hand-computed assessment most often misses, and missing it in this direction
 * denies a dependant a claim the Act allows.
 *
 * `NOT_ARISING_OUT_OF_EMPLOYMENT` is not one of those provisos — it is the
 * substantive test in section 3(1) itself — so it bars every head including
 * death. Same for the three-day rule in 3(1)(a), which is a threshold on the
 * injury rather than a fault-based bar.
 *
 * @param {object} input
 * @param {string} input.injuryType
 * @param {string[]} [input.bars]
 * @returns {{barred: boolean, applied: string[], disapplied: string[], reasons: string[]}}
 */
function applyStatutoryBars({ injuryType, bars = [] }) {
  const claimed = [...new Set(bars)].filter((code) => BAR_REASON[code]);

  const seriousInjury =
    injuryType === INJURY.DEATH || injuryType === INJURY.PERMANENT_TOTAL;

  const faultBars = [
    BAR.DRINK_OR_DRUGS,
    BAR.WILFUL_DISOBEDIENCE,
    BAR.WILFUL_REMOVAL_OF_SAFEGUARD,
  ];

  const applied = [];
  const disapplied = [];

  for (const code of claimed) {
    if (seriousInjury && faultBars.includes(code)) disapplied.push(code);
    else applied.push(code);
  }

  return {
    barred: applied.length > 0,
    applied,
    disapplied,
    reasons: applied.map((code) => BAR_REASON[code]),
  };
}

/**
 * Section 4(1)(a) — death.
 *
 * @param {object} input
 * @param {number} input.monthlyWages
 * @param {number} input.age completed years on the date of the accident
 * @returns {object}
 */
function deathCompensation({ monthlyWages, age }) {
  const wages = cappedMonthlyWages(monthlyWages);
  const factor = relevantFactor(age);

  const computed = round2(wages.capped * DEATH_WAGE_SHARE * factor);
  const compensation = Math.max(computed, MINIMUM_DEATH_COMPENSATION);

  return {
    head: INJURY.DEATH,
    section: 'section 4(1)(a)',
    wages,
    age: Math.floor(toNumber(age)),
    relevantFactor: factor,
    wageShare: DEATH_WAGE_SHARE,
    computed,
    floor: MINIMUM_DEATH_COMPENSATION,
    floorApplied: computed < MINIMUM_DEATH_COMPENSATION,
    compensation: round2(compensation),
  };
}

/**
 * Section 4(1)(b) — permanent total disablement.
 *
 * @param {object} input
 * @param {number} input.monthlyWages
 * @param {number} input.age
 * @returns {object}
 */
function permanentTotalCompensation({ monthlyWages, age }) {
  const wages = cappedMonthlyWages(monthlyWages);
  const factor = relevantFactor(age);

  const computed = round2(wages.capped * PERMANENT_TOTAL_WAGE_SHARE * factor);
  const compensation = Math.max(computed, MINIMUM_PERMANENT_TOTAL_COMPENSATION);

  return {
    head: INJURY.PERMANENT_TOTAL,
    section: 'section 4(1)(b)',
    wages,
    age: Math.floor(toNumber(age)),
    relevantFactor: factor,
    wageShare: PERMANENT_TOTAL_WAGE_SHARE,
    computed,
    floor: MINIMUM_PERMANENT_TOTAL_COMPENSATION,
    floorApplied: computed < MINIMUM_PERMANENT_TOTAL_COMPENSATION,
    compensation: round2(compensation),
  };
}

/**
 * Section 4(1)(c) — permanent partial disablement.
 *
 * The percentage is applied to the **permanent total** figure, not to the
 * wages. A Schedule I injury at 30% pays thirty percent of what a total
 * disablement would have paid — which is materially more than thirty percent of
 * anything else, and is the error that makes a hand-computed partial claim come
 * out roughly half what it should.
 *
 * The floor is *not* carried across. Section 4(1)(b)'s ₹1,40,000 is the minimum
 * for total disablement; applying it to a 7% little-finger claim would pay that
 * claim more than a 60% one computed properly.
 *
 * @param {object} input
 * @param {number} input.monthlyWages
 * @param {number} input.age
 * @param {string} [input.scheduleInjury] a key into SCHEDULE_I_INJURIES
 * @param {number} [input.lossOfEarningCapacityPercent] for an unlisted injury
 * @returns {object}
 */
function permanentPartialCompensation({
  monthlyWages,
  age,
  scheduleInjury,
  lossOfEarningCapacityPercent,
}) {
  const total = permanentTotalCompensation({ monthlyWages, age });

  const listed = SCHEDULE_I_INJURIES[scheduleInjury];
  const percent = listed
    ? listed.percent
    : Math.min(100, Math.max(0, toNumber(lossOfEarningCapacityPercent)));

  // The floor belongs to total disablement. Computing the proportion off the
  // *unfloored* figure keeps a small partial claim proportionate.
  const base = total.computed;
  const compensation = round2((base * percent) / 100);

  return {
    head: INJURY.PERMANENT_PARTIAL,
    section: 'section 4(1)(c)',
    wages: total.wages,
    age: total.age,
    relevantFactor: total.relevantFactor,
    scheduleInjury: listed ? scheduleInjury : null,
    injuryDescription: listed
      ? listed.description
      : 'Assessed loss of earning capacity, not listed in Schedule I',
    lossOfEarningCapacityPercent: percent,
    permanentTotalBasis: base,
    compensation,
  };
}

/**
 * Section 4(1)(d) — temporary disablement, as a half-monthly series.
 *
 * Two rules decide where the series starts and stops, and both are easy to get
 * backwards:
 *
 *   - the first three days are not compensated *unless* the incapacity runs to
 *     twenty-eight days or more, in which case payment runs from the date of
 *     disablement and the waiting period disappears entirely;
 *   - the series is capped at five years, whatever the medical position.
 *
 * @param {object} input
 * @param {number} input.monthlyWages
 * @param {number} input.disablementDays
 * @returns {object}
 */
function temporaryCompensation({ monthlyWages, disablementDays }) {
  const wages = cappedMonthlyWages(monthlyWages);
  const days = Math.max(0, Math.floor(toNumber(disablementDays)));

  const waitingWaived = days >= TEMPORARY_WAITING_WAIVED_AFTER_DAYS;
  const waitingDays = waitingWaived
    ? 0
    : Math.min(days, TEMPORARY_WAITING_DAYS);

  const maxDays = TEMPORARY_MAX_YEARS * 365;
  const cappedDays = Math.min(days, maxDays);
  const compensableDays = Math.max(0, cappedDays - waitingDays);

  const halfMonthly = round2(wages.capped * TEMPORARY_HALF_MONTHLY_SHARE);

  // Half-months rather than whole ones: the Act pays half-monthly, and a series
  // that rounded up to the month would overpay every short incapacity.
  const halfMonths = compensableDays / (365 / 24);
  const compensation = round2(halfMonthly * halfMonths);

  return {
    head: INJURY.TEMPORARY,
    section: 'section 4(1)(d)',
    wages,
    disablementDays: days,
    waitingDays,
    waitingWaived,
    fiveYearCapApplied: days > maxDays,
    compensableDays,
    halfMonthlyPayment: halfMonthly,
    halfMonths: round2(halfMonths),
    compensation,
  };
}

/**
 * Section 4A — what late payment costs.
 *
 * Interest runs from the date the compensation *fell due*, which is the date of
 * the accident, and not from the date the claim was made or admitted. That is
 * the whole force of section 4A: an employer cannot improve its position by
 * being slow to accept liability.
 *
 * The penalty is discretionary — up to fifty percent, imposed by the
 * Commissioner — so it is computed at the rate passed in and returned
 * separately, never folded into the compensation. The two are argued about
 * separately and a single total would make that impossible.
 *
 * @param {object} input
 * @param {number} input.compensation
 * @param {Date|string} input.accidentDate
 * @param {Date|string} [input.paymentDate] defaults to nothing being paid yet
 * @param {number} [input.penaltyShare] 0 to 0.5
 * @param {Date|string} [input.asAt] the date interest is measured to when unpaid
 * @returns {object}
 */
function latePaymentCharges({
  compensation,
  accidentDate,
  paymentDate,
  penaltyShare = 0,
  asAt,
}) {
  const principal = Math.max(0, round2(toNumber(compensation)));

  const dueFrom = new Date(accidentDate);
  const measuredTo = new Date(paymentDate || asAt || Date.now());

  if (Number.isNaN(dueFrom.getTime()) || Number.isNaN(measuredTo.getTime())) {
    return {
      dueBy: null,
      daysLate: 0,
      interest: 0,
      penaltyShare: 0,
      penalty: 0,
      total: principal,
    };
  }

  const dueBy = new Date(dueFrom.getTime());
  dueBy.setUTCDate(dueBy.getUTCDate() + PAYMENT_WINDOW_DAYS);

  const overdueMs = measuredTo.getTime() - dueBy.getTime();
  const daysLate = overdueMs > 0 ? Math.floor(overdueMs / 86400000) : 0;

  // Simple interest, and measured from the accident rather than from the end of
  // the thirty-day window: the window is the grace period for *paying*, while
  // section 4A(3)(a) charges interest on compensation that fell due on the day
  // of the accident.
  const interestDays =
    daysLate > 0
      ? Math.floor((measuredTo.getTime() - dueFrom.getTime()) / 86400000)
      : 0;

  const interest = round2(
    (principal * LATE_PAYMENT_INTEREST_RATE * interestDays) / 365,
  );

  const share = Math.min(
    MAX_PENALTY_SHARE,
    Math.max(0, toNumber(penaltyShare)),
  );
  const penalty = daysLate > 0 ? round2(principal * share) : 0;

  return {
    dueBy,
    daysLate,
    interestDays,
    interestRate: LATE_PAYMENT_INTEREST_RATE,
    interest,
    penaltyShare: share,
    penalty,
    total: round2(principal + interest + penalty),
  };
}

/**
 * Assess a claim end to end.
 *
 * The bars are applied first and the compensation is still computed when a
 * claim is barred — an employer that declines a claim needs to know what it
 * declined, and a barred claim that is contested becomes a payable one without
 * anybody recomputing it.
 *
 * @param {object} input
 * @param {string} input.injuryType
 * @param {number} input.monthlyWages
 * @param {Date|string} input.dateOfBirth
 * @param {Date|string} input.accidentDate
 * @param {string[]} [input.bars]
 * @param {number} [input.disablementDays]
 * @param {string} [input.scheduleInjury]
 * @param {number} [input.lossOfEarningCapacityPercent]
 * @param {boolean} [input.funeralExpensesIncurred]
 * @param {Date|string} [input.paymentDate]
 * @param {number} [input.penaltyShare]
 * @param {Date|string} [input.asAt]
 * @returns {object}
 */
function assessClaim({
  injuryType,
  monthlyWages,
  dateOfBirth,
  accidentDate,
  bars = [],
  disablementDays = 0,
  scheduleInjury,
  lossOfEarningCapacityPercent,
  funeralExpensesIncurred = false,
  paymentDate,
  penaltyShare = 0,
  asAt,
}) {
  const age = completedAge(dateOfBirth, accidentDate);

  const statutoryBars = applyStatutoryBars({ injuryType, bars });

  let head;
  switch (injuryType) {
    case INJURY.DEATH:
      head = deathCompensation({ monthlyWages, age: age ?? MAX_FACTOR_AGE });
      break;
    case INJURY.PERMANENT_TOTAL:
      head = permanentTotalCompensation({
        monthlyWages,
        age: age ?? MAX_FACTOR_AGE,
      });
      break;
    case INJURY.PERMANENT_PARTIAL:
      head = permanentPartialCompensation({
        monthlyWages,
        age: age ?? MAX_FACTOR_AGE,
        scheduleInjury,
        lossOfEarningCapacityPercent,
      });
      break;
    case INJURY.TEMPORARY:
      head = temporaryCompensation({ monthlyWages, disablementDays });
      break;
    default:
      return {
        valid: false,
        message: `Unknown injury type: ${String(injuryType)}`,
      };
  }

  // Funeral expenses are payable to whoever incurred them and are not part of
  // the dependants' compensation, so they sit outside the head rather than
  // being added to it. Section 4A interest does not run on them either.
  const funeral =
    injuryType === INJURY.DEATH && funeralExpensesIncurred
      ? FUNERAL_EXPENSES
      : 0;

  // Age is only unusable when the date of birth is missing or absurd. Reported
  // rather than silently defaulted, because the factor is the single largest
  // lever in the computation.
  const ageWarning =
    age === null && injuryType !== INJURY.TEMPORARY
      ? 'Date of birth is missing or later than the accident — the Schedule IV factor has been taken at age 65, which is the lowest in the Schedule'
      : null;

  const charges = latePaymentCharges({
    compensation: statutoryBars.barred ? 0 : head.compensation,
    accidentDate,
    paymentDate,
    penaltyShare,
    asAt,
  });

  return {
    valid: true,
    injuryType,
    accidentDate,
    age,
    ageWarning,

    bars: statutoryBars,
    payable: !statutoryBars.barred,

    head,
    funeralExpenses: funeral,

    compensation: statutoryBars.barred ? 0 : head.compensation,
    charges,

    // What the employer actually writes a cheque for, assuming the claim is
    // admitted: compensation, plus interest and penalty, plus funeral expenses
    // — which are payable even where the section 4A charges are not.
    totalPayable: statutoryBars.barred ? 0 : round2(charges.total + funeral),
  };
}

module.exports = {
  MONTHLY_WAGE_CAP,
  DEATH_WAGE_SHARE,
  PERMANENT_TOTAL_WAGE_SHARE,
  MINIMUM_DEATH_COMPENSATION,
  MINIMUM_PERMANENT_TOTAL_COMPENSATION,
  FUNERAL_EXPENSES,
  TEMPORARY_HALF_MONTHLY_SHARE,
  TEMPORARY_WAITING_DAYS,
  TEMPORARY_WAITING_WAIVED_AFTER_DAYS,
  TEMPORARY_MAX_YEARS,
  PAYMENT_WINDOW_DAYS,
  LATE_PAYMENT_INTEREST_RATE,
  MAX_PENALTY_SHARE,
  BAR,
  BAR_REASON,
  INJURY,
  RELEVANT_FACTORS,
  SCHEDULE_I_INJURIES,

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
};
