/**
 * Minimum Wages Act, 1948 (#1698).
 *
 * The product could already build a salary structure and tax the result, and
 * nothing in between asked whether the structure clears the rate notified for
 * the employee's scheduled employment, state, area class and skill category.
 *
 * Three things make that a module rather than a comparison:
 *
 *   - The notified rate is a matrix, not a number. State × scheduled employment
 *     × area class × skill category, and the schedules do not agree between
 *     states on what any of those columns contain.
 *   - Half the rate moves twice a year. A notification is basic + VDA, and the
 *     VDA is a function of the consumer price index at the time, revised each
 *     April and October in most states.
 *   - The comparison is not against gross pay. Section 2(h) defines wages for
 *     this purpose and excludes house rent allowance, the employer's provident
 *     fund and insurance contributions, bonus, overtime and travelling
 *     concessions. A structure paying ₹18,000 gross with ₹7,000 of it as HRA
 *     offers ₹11,000 against the notified rate.
 *
 * Pure functions and no database access, in the shape `statutoryBonus.js` and
 * `gratuityValuation.js` use: an assessment is a figure that gets defended in
 * front of an inspector, so every step of it has to be reachable from a test.
 */

/**
 * Section 2(h): what counts as wages, and what is carved out of it.
 *
 * The exclusions are the whole difficulty. Each is a component a payroll
 * structure routinely carries, each is excluded for its own reason, and leaving
 * any of them in overstates what the employer is offering — which is the error
 * that reads as compliant right up until it is assessed.
 */
const EXCLUDED_COMPONENT = {
  /** Explicitly carved out by the proviso to section 2(h)(i). */
  HOUSE_RENT_ALLOWANCE: 'HOUSE_RENT_ALLOWANCE',
  /** Section 2(h)(ii) — the *employer's* share only. */
  EMPLOYER_PF_CONTRIBUTION: 'EMPLOYER_PF_CONTRIBUTION',
  EMPLOYER_ESI_CONTRIBUTION: 'EMPLOYER_ESI_CONTRIBUTION',
  /** Section 2(h)(iii) — travelling allowance or the value of a concession. */
  TRAVEL_CONCESSION: 'TRAVEL_CONCESSION',
  /** Section 2(h)(iv) — a sum paid to defray special expenses of the job. */
  SPECIAL_EXPENSE_REIMBURSEMENT: 'SPECIAL_EXPENSE_REIMBURSEMENT',
  /** Section 2(h)(v) — gratuity payable on discharge. */
  GRATUITY: 'GRATUITY',
  /**
   * Not named in section 2(h), and excluded anyway: a bonus is a share of
   * surplus for a year that has closed, and admitting it would let last year's
   * profit discharge this month's wage obligation.
   */
  BONUS: 'BONUS',
  /**
   * Overtime is the premium for hours beyond the normal working day. Counting
   * it toward the minimum would mean an employee could be brought up to the
   * notified rate by being made to work longer, which inverts the Act.
   */
  OVERTIME: 'OVERTIME',
};

/**
 * The default mapping from a component name to its exclusion.
 *
 * A starting point rather than the answer: component naming is a tenant
 * decision and `ClientInvoices`-era structures carry names like `hra_special`
 * and `conveyance_fixed`. The controller lets a tenant override this, and the
 * assessment records which mapping produced each figure.
 */
const DEFAULT_EXCLUSION_PATTERNS = [
  [/^h\.?r\.?a/i, EXCLUDED_COMPONENT.HOUSE_RENT_ALLOWANCE],
  [/house\s*rent/i, EXCLUDED_COMPONENT.HOUSE_RENT_ALLOWANCE],
  [/employer.*(pf|provident)/i, EXCLUDED_COMPONENT.EMPLOYER_PF_CONTRIBUTION],
  [/(pf|provident).*employer/i, EXCLUDED_COMPONENT.EMPLOYER_PF_CONTRIBUTION],
  [/employer.*(esi|insurance)/i, EXCLUDED_COMPONENT.EMPLOYER_ESI_CONTRIBUTION],
  [/(esi).*employer/i, EXCLUDED_COMPONENT.EMPLOYER_ESI_CONTRIBUTION],
  [/convey|travel|lta|transport/i, EXCLUDED_COMPONENT.TRAVEL_CONCESSION],
  [/reimburse/i, EXCLUDED_COMPONENT.SPECIAL_EXPENSE_REIMBURSEMENT],
  [/gratuity/i, EXCLUDED_COMPONENT.GRATUITY],
  [/bonus|ex.?gratia/i, EXCLUDED_COMPONENT.BONUS],
  [/overtime|^ot$|ot\s*pay/i, EXCLUDED_COMPONENT.OVERTIME],
];

/** The four skill categories every state schedule is written in terms of. */
const SKILL_CATEGORY = {
  UNSKILLED: 'UNSKILLED',
  SEMI_SKILLED: 'SEMI_SKILLED',
  SKILLED: 'SKILLED',
  HIGHLY_SKILLED: 'HIGHLY_SKILLED',
};

/**
 * Area classes.
 *
 * States name these differently — Zone I/II/III in Maharashtra, Area A/B/C in
 * Karnataka, and a plain metro/non-metro split elsewhere — but they are always
 * an ordered classification of where the establishment is, so one vocabulary
 * with the state's own label carried on the notification is enough.
 */
const AREA_CLASS = {
  ZONE_I: 'ZONE_I',
  ZONE_II: 'ZONE_II',
  ZONE_III: 'ZONE_III',
};

/** The wage period a notified rate is expressed for. */
const RATE_BASIS = {
  MONTHLY: 'MONTHLY',
  DAILY: 'DAILY',
};

/**
 * The divisor turning a monthly notified rate into a day's wage.
 *
 * Twenty-six, which is the divisor the gratuity formula, the settlement
 * calculator and `statutoryBonus.controller.js` all already use. The Act itself
 * is silent; twenty-six is the convention every state inspectorate applies, and
 * a product that used thirty here and twenty-six three modules away would
 * produce two different day rates for the same salary.
 */
const WORKING_DAYS_PER_MONTH = 26;

/** Section 14: overtime is paid at twice the ordinary rate. */
const OVERTIME_MULTIPLIER = 2;

/** The normal working day beyond which section 14 engages. */
const NORMAL_WORKING_HOURS = 8;

/**
 * Why an employee is not assessed.
 *
 * Same shape as the bonus register's exclusion codes, for the same reason:
 * "why was this person not looked at" is the second question an inspection
 * asks, and a silently dropped row cannot answer it.
 */
const EXCLUSION = {
  NO_NOTIFICATION: 'NO_NOTIFICATION',
  NO_WAGE_DATA: 'NO_WAGE_DATA',
  NO_DAYS_WORKED: 'NO_DAYS_WORKED',
  OUTSIDE_SCHEDULED_EMPLOYMENT: 'OUTSIDE_SCHEDULED_EMPLOYMENT',
};

const EXCLUSION_REASON = {
  [EXCLUSION.NO_NOTIFICATION]:
    'no notification on record for this state, employment, area class and skill category on the wage period',
  [EXCLUSION.NO_WAGE_DATA]:
    'no payroll components recorded for the wage period',
  [EXCLUSION.NO_DAYS_WORKED]: 'no days worked in the wage period',
  [EXCLUSION.OUTSIDE_SCHEDULED_EMPLOYMENT]:
    'the employment is not a scheduled employment in this state',
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
 * Classify a payroll component against section 2(h).
 *
 * @param {string} name
 * @param {Array<[RegExp, string]>} [patterns]
 * @returns {string|null} the exclusion code, or null if the component counts
 */
function classifyComponent(name, patterns = DEFAULT_EXCLUSION_PATTERNS) {
  const label = String(name || '');
  if (!label.trim()) return null;

  for (const [pattern, code] of patterns) {
    if (pattern.test(label)) return code;
  }

  return null;
}

/**
 * The variable dearness allowance on a notification.
 *
 * `(currentCPI − baseCPI) × ratePerPoint`, floored at zero. The floor matters:
 * the index does fall, and a negative VDA would reduce the notified rate below
 * the basic, which no state notification permits — the rate is a floor that
 * ratchets, and a fall in the index freezes it rather than reversing it.
 *
 * The rounding is the notification's own. Most states round the VDA up to the
 * next rupee; a few round to the nearest ten paise. `vdaRounding` carries the
 * step so an assessment reproduces the gazetted figure rather than one that is
 * a rupee off and therefore arguable.
 *
 * @param {object} notification
 * @param {number} currentCpiPoints
 * @returns {{points: number, vda: number, applied: boolean}}
 */
function computeVda(notification, currentCpiPoints) {
  const basePoints = toNumber(notification.vdaBaseCpiPoints);
  const ratePerPoint = toNumber(notification.vdaRatePerPoint);
  const current = toNumber(currentCpiPoints);

  if (ratePerPoint <= 0) {
    return { points: 0, vda: 0, applied: false };
  }

  const points = Math.max(0, current - basePoints);
  const raw = points * ratePerPoint;

  const step = toNumber(notification.vdaRounding) || 1;
  const vda = Math.ceil(raw / step) * step;

  return { points, vda: round2(vda), applied: true };
}

/**
 * The notified rate for a wage period, expressed monthly.
 *
 * A daily notification is multiplied by twenty-six rather than by the days in
 * the calendar month, so that February and March produce the same monthly rate
 * for the same notification. Comparing a February salary against a
 * twenty-eight-day rate and a March salary against a thirty-one-day one would
 * report a shortfall in March for an employee whose pay never changed.
 *
 * @param {object} notification
 * @param {number} currentCpiPoints
 * @returns {{basic: number, vda: number, vdaPoints: number, monthlyRate: number, dailyRate: number, hourlyRate: number}}
 */
function notifiedRate(notification, currentCpiPoints) {
  const basic = toNumber(notification.basicRate);
  const { vda, points } = computeVda(notification, currentCpiPoints);

  const perBasis = basic + vda;

  const monthlyRate =
    notification.rateBasis === RATE_BASIS.DAILY
      ? perBasis * WORKING_DAYS_PER_MONTH
      : perBasis;

  const dailyRate =
    notification.rateBasis === RATE_BASIS.DAILY
      ? perBasis
      : perBasis / WORKING_DAYS_PER_MONTH;

  return {
    basic: round2(basic),
    vda: round2(vda),
    vdaPoints: points,
    monthlyRate: round2(monthlyRate),
    dailyRate: round2(dailyRate),
    hourlyRate: round2(dailyRate / NORMAL_WORKING_HOURS),
  };
}

/**
 * Pick the notification in force on a date.
 *
 * The latest `effectiveFrom` that is not in the future relative to the wage
 * period, which is not the same as the latest notification on file. A
 * notification published in July with effect from April is in force for April,
 * May and June; an assessment of May run in August has to use it, and an
 * assessment of March must not.
 *
 * Superseded notifications are kept rather than replaced for exactly this
 * reason — reassessing a closed period against today's rate produces arrears
 * that were never owed.
 *
 * @param {Array<object>} notifications
 * @param {{state: string, scheduledEmployment: string, areaClass: string, skillCategory: string}} key
 * @param {Date} asAt
 * @returns {object|null}
 */
function notificationInForce(notifications, key, asAt) {
  const when = asAt instanceof Date ? asAt.getTime() : new Date(asAt).getTime();
  if (!Number.isFinite(when)) return null;

  const candidates = (notifications || []).filter(
    (n) =>
      n &&
      n.state === key.state &&
      n.scheduledEmployment === key.scheduledEmployment &&
      n.areaClass === key.areaClass &&
      n.skillCategory === key.skillCategory &&
      new Date(n.effectiveFrom).getTime() <= when,
  );

  if (!candidates.length) return null;

  return candidates.reduce((latest, n) =>
    new Date(n.effectiveFrom).getTime() >
    new Date(latest.effectiveFrom).getTime()
      ? n
      : latest,
  );
}

/**
 * The comparable wage under section 2(h).
 *
 * Returns both halves — what counts and what was set aside — because the
 * shortfall on its own is not an answer anybody accepts. "You are ₹2,300 short"
 * is met with "we pay ₹18,000", and the only useful reply is the list of
 * components that do not count and why.
 *
 * @param {Array<{name: string, amount: number}>} components
 * @param {Array<[RegExp, string]>} [patterns]
 * @returns {{comparableWage: number, counted: Array<object>, excluded: Array<object>}}
 */
function comparableWage(components, patterns = DEFAULT_EXCLUSION_PATTERNS) {
  const counted = [];
  const excluded = [];

  for (const component of components || []) {
    const amount = round2(toNumber(component.amount));
    const code = classifyComponent(component.name, patterns);

    if (code) {
      excluded.push({ name: component.name, amount, code });
    } else {
      counted.push({ name: component.name, amount });
    }
  }

  const total = counted.reduce((sum, c) => sum + c.amount, 0);

  return { comparableWage: round2(total), counted, excluded };
}

/**
 * Section 14 overtime.
 *
 * "Twice the ordinary rate of wages" and the ordinary rate is the *higher* of
 * the notified rate and what the employee is actually paid. An employee paid
 * above the minimum does not have their overtime priced at the minimum — the
 * Act sets a floor on the ordinary rate, not a ceiling — and an employee paid
 * at or below it gets the notified one.
 *
 * @param {object} input
 * @param {number} input.overtimeHours
 * @param {number} input.comparableWage      the month's comparable wage
 * @param {number} input.notifiedMonthlyRate
 * @param {number} input.overtimePaid        what payroll actually paid
 * @returns {object}
 */
function overtimeEntitlement({
  overtimeHours,
  comparableWage: wage,
  notifiedMonthlyRate,
  overtimePaid,
}) {
  const hours = Math.max(0, toNumber(overtimeHours));

  const paidHourly =
    toNumber(wage) / (WORKING_DAYS_PER_MONTH * NORMAL_WORKING_HOURS);
  const notifiedHourly =
    toNumber(notifiedMonthlyRate) /
    (WORKING_DAYS_PER_MONTH * NORMAL_WORKING_HOURS);

  const ordinaryRate = Math.max(paidHourly, notifiedHourly);
  const entitlement = round2(hours * ordinaryRate * OVERTIME_MULTIPLIER);
  const paid = round2(toNumber(overtimePaid));

  return {
    hours: round2(hours),
    ordinaryHourlyRate: round2(ordinaryRate),
    multiplier: OVERTIME_MULTIPLIER,
    entitlement,
    paid,
    shortfall: round2(Math.max(0, entitlement - paid)),
  };
}

/**
 * Assess one employee for one wage period.
 *
 * The pro-rating is the part that decides whether the register is usable. The
 * notified rate is for a full wage period; an employee who worked eighteen of
 * twenty-six days is owed eighteen twenty-sixths of it. Comparing a part-month
 * salary against a full-month rate reports a shortfall against every joiner and
 * every leaver, and a register where a third of the lines are wrong is a
 * register nobody reads.
 *
 * @param {object} input
 * @param {object} input.employee
 * @param {Array<object>} input.notifications
 * @param {Date} input.periodStart
 * @param {Date} input.periodEnd
 * @param {number} input.cpiPoints
 * @param {Array<[RegExp, string]>} [input.exclusionPatterns]
 * @returns {object}
 */
function assessEmployee({
  employee,
  notifications,
  periodStart,
  periodEnd,
  cpiPoints,
  exclusionPatterns = DEFAULT_EXCLUSION_PATTERNS,
}) {
  const base = {
    employeeId: employee.employeeId,
    name: employee.name || '',
    designation: employee.designation || '',
    state: employee.state,
    scheduledEmployment: employee.scheduledEmployment,
    areaClass: employee.areaClass,
    skillCategory: employee.skillCategory,
  };

  const daysWorked = Math.max(0, toNumber(employee.daysWorked));
  const daysInPeriod =
    Math.max(1, toNumber(employee.daysInPeriod)) || WORKING_DAYS_PER_MONTH;

  const notification = notificationInForce(
    notifications,
    {
      state: employee.state,
      scheduledEmployment: employee.scheduledEmployment,
      areaClass: employee.areaClass,
      skillCategory: employee.skillCategory,
    },
    periodEnd || periodStart,
  );

  if (!notification) {
    return {
      ...base,
      assessed: false,
      code: EXCLUSION.NO_NOTIFICATION,
      reason: EXCLUSION_REASON[EXCLUSION.NO_NOTIFICATION],
    };
  }

  const components = Array.isArray(employee.components)
    ? employee.components
    : [];
  if (!components.length) {
    return {
      ...base,
      assessed: false,
      code: EXCLUSION.NO_WAGE_DATA,
      reason: EXCLUSION_REASON[EXCLUSION.NO_WAGE_DATA],
    };
  }

  if (daysWorked === 0) {
    return {
      ...base,
      assessed: false,
      code: EXCLUSION.NO_DAYS_WORKED,
      reason: EXCLUSION_REASON[EXCLUSION.NO_DAYS_WORKED],
    };
  }

  const rate = notifiedRate(notification, cpiPoints);
  const wage = comparableWage(components, exclusionPatterns);

  // Capped at one: an employee who worked twenty-eight days in a month whose
  // notional twenty-six have already been paid for is not owed more than the
  // full notified rate. The extra days are overtime, and section 14 prices
  // them separately below.
  const proRataFraction = Math.min(1, daysWorked / daysInPeriod);
  const entitlement = round2(rate.monthlyRate * proRataFraction);

  const shortfall = round2(Math.max(0, entitlement - wage.comparableWage));

  const overtime = overtimeEntitlement({
    overtimeHours: employee.overtimeHours,
    comparableWage: wage.comparableWage,
    notifiedMonthlyRate: rate.monthlyRate,
    overtimePaid: employee.overtimePaid,
  });

  return {
    ...base,
    assessed: true,
    notificationId: notification._id || notification.id || null,
    notificationRef: notification.notificationRef || '',
    effectiveFrom: notification.effectiveFrom,
    rateBasis: notification.rateBasis,

    basicRate: rate.basic,
    vda: rate.vda,
    vdaPoints: rate.vdaPoints,
    notifiedMonthlyRate: rate.monthlyRate,
    notifiedDailyRate: rate.dailyRate,

    daysWorked: round2(daysWorked),
    daysInPeriod: round2(daysInPeriod),
    proRataFraction: round2(proRataFraction),
    entitlement,

    grossPaid: round2(
      components.reduce((sum, c) => sum + toNumber(c.amount), 0),
    ),
    comparableWage: wage.comparableWage,
    countedComponents: wage.counted,
    excludedComponents: wage.excluded,

    shortfall,
    compliant: shortfall === 0,

    overtime,
    totalShortfall: round2(shortfall + overtime.shortfall),
  };
}

/**
 * Assess a workforce for one wage period.
 *
 * @param {object} input
 * @param {Array<object>} input.employees
 * @param {Array<object>} input.notifications
 * @param {Date} input.periodStart
 * @param {Date} input.periodEnd
 * @param {number} input.cpiPoints
 * @param {Array<[RegExp, string]>} [input.exclusionPatterns]
 * @returns {object}
 */
function assessPeriod({
  employees,
  notifications,
  periodStart,
  periodEnd,
  cpiPoints,
  exclusionPatterns = DEFAULT_EXCLUSION_PATTERNS,
}) {
  const lines = [];
  const exclusions = [];

  for (const employee of employees || []) {
    const result = assessEmployee({
      employee,
      notifications,
      periodStart,
      periodEnd,
      cpiPoints,
      exclusionPatterns,
    });

    if (result.assessed) lines.push(result);
    else exclusions.push(result);
  }

  const shortfallLines = lines.filter((line) => line.totalShortfall > 0);

  const byState = new Map();
  for (const line of lines) {
    const key = line.state || 'UNSPECIFIED';
    const bucket = byState.get(key) || {
      state: key,
      assessed: 0,
      shortfallCount: 0,
      shortfall: 0,
    };

    bucket.assessed += 1;
    if (line.totalShortfall > 0) {
      bucket.shortfallCount += 1;
      bucket.shortfall = round2(bucket.shortfall + line.totalShortfall);
    }

    byState.set(key, bucket);
  }

  return {
    periodStart,
    periodEnd,
    cpiPoints: toNumber(cpiPoints),

    assessedCount: lines.length,
    excludedCount: exclusions.length,
    shortfallCount: shortfallLines.length,

    wageShortfall: round2(lines.reduce((sum, line) => sum + line.shortfall, 0)),
    overtimeShortfall: round2(
      lines.reduce((sum, line) => sum + line.overtime.shortfall, 0),
    ),
    totalShortfall: round2(
      lines.reduce((sum, line) => sum + line.totalShortfall, 0),
    ),

    compliant: shortfallLines.length === 0,

    lines,
    exclusions,
    byState: [...byState.values()].sort((a, b) => b.shortfall - a.shortfall),
  };
}

/**
 * Arrears owed when a notification is published with a past effective date.
 *
 * This is the routine case rather than the exceptional one: states publish in
 * July with effect from April, and the employer owes the difference for the
 * elapsed wage periods. The arrear for a period is the shortfall recomputed
 * against the new rate *less* whatever shortfall was already recognised against
 * the old one, so running this twice does not bill the employer twice.
 *
 * @param {object} input
 * @param {Array<object>} input.periods    prior assessments, oldest first
 * @param {object} input.notification      the newly published notification
 * @param {number} input.cpiPoints
 * @returns {object}
 */
function retrospectiveArrears({ periods, notification, cpiPoints }) {
  const effectiveFrom = new Date(notification.effectiveFrom).getTime();
  const rate = notifiedRate(notification, cpiPoints);

  const affected = [];

  for (const period of periods || []) {
    const periodEnd = new Date(period.periodEnd).getTime();
    if (!Number.isFinite(periodEnd) || periodEnd < effectiveFrom) continue;

    const lines = [];

    for (const line of period.lines || []) {
      if (
        line.state !== notification.state ||
        line.scheduledEmployment !== notification.scheduledEmployment ||
        line.areaClass !== notification.areaClass ||
        line.skillCategory !== notification.skillCategory
      ) {
        continue;
      }

      const revisedEntitlement = round2(
        rate.monthlyRate * toNumber(line.proRataFraction),
      );
      const revisedShortfall = Math.max(
        0,
        round2(revisedEntitlement - toNumber(line.comparableWage)),
      );

      const arrear = round2(
        Math.max(0, revisedShortfall - toNumber(line.shortfall)),
      );
      if (arrear === 0) continue;

      lines.push({
        employeeId: line.employeeId,
        name: line.name,
        previousEntitlement: toNumber(line.entitlement),
        revisedEntitlement,
        previousShortfall: toNumber(line.shortfall),
        revisedShortfall,
        arrear,
      });
    }

    if (!lines.length) continue;

    affected.push({
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      lines,
      arrear: round2(lines.reduce((sum, line) => sum + line.arrear, 0)),
    });
  }

  return {
    notificationRef: notification.notificationRef || '',
    effectiveFrom: notification.effectiveFrom,
    revisedMonthlyRate: rate.monthlyRate,
    periods: affected,
    employeeCount: new Set(
      affected.flatMap((p) => p.lines.map((line) => String(line.employeeId))),
    ).size,
    totalArrear: round2(affected.reduce((sum, p) => sum + p.arrear, 0)),
  };
}

/**
 * The section 12 floor `statutoryBonus.js` needs.
 *
 * Section 12 of the Payment of Bonus Act computes on
 * `min(actual, max(₹7,000, applicable minimum wage))`, and until now the
 * applicable minimum wage arrived on the request body because there was nothing
 * to ask. Exposed here rather than reached for through the model so the bonus
 * engine keeps its no-database property.
 *
 * @param {Array<object>} notifications
 * @param {object} key
 * @param {Date} asAt
 * @param {number} cpiPoints
 * @returns {number} 0 when nothing is notified, which the caller reads as
 *                   "fall back to the statutory ₹7,000"
 */
function applicableMinimumWage(notifications, key, asAt, cpiPoints) {
  const notification = notificationInForce(notifications, key, asAt);
  if (!notification) return 0;

  return notifiedRate(notification, cpiPoints).monthlyRate;
}

module.exports = {
  EXCLUDED_COMPONENT,
  DEFAULT_EXCLUSION_PATTERNS,
  SKILL_CATEGORY,
  AREA_CLASS,
  RATE_BASIS,
  EXCLUSION,
  EXCLUSION_REASON,
  WORKING_DAYS_PER_MONTH,
  NORMAL_WORKING_HOURS,
  OVERTIME_MULTIPLIER,

  classifyComponent,
  computeVda,
  notifiedRate,
  notificationInForce,
  comparableWage,
  overtimeEntitlement,
  assessEmployee,
  assessPeriod,
  retrospectiveArrears,
  applicableMinimumWage,
};
