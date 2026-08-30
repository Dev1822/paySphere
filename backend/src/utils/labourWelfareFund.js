/**
 * Labour Welfare Fund (#1701).
 *
 * `statutoryChallan.model.js` has an `LWF` entry in an enum. That was the whole
 * of the product's LWF support: a string a challan could be tagged with, and
 * nothing computing what goes on it.
 *
 * LWF is the smallest statutory deduction in Indian payroll and the one most
 * likely to be wrong, for a reason that is structural rather than careless:
 * **there is no central Act.** There are fifteen or so state enactments and they
 * agree on almost nothing — not the periodicity, not the amounts, not who is
 * liable, not the establishment threshold.
 *
 * The state rule is therefore data, and the engine is a calendar plus an
 * eligibility test. Two things about it are the opposite of every other
 * deduction in payroll, and are where a hand-rolled implementation goes wrong:
 *
 *   - LWF does not pro-rate. A joiner in November owes the *full* amount for a
 *     half-year ending in December, and a leaver in November owes nothing.
 *   - Liability is decided on the last day of the contribution period, not on
 *     the days worked in it.
 *
 * Pure functions, no database access.
 */

/** How often a state collects. */
const PERIODICITY = {
  MONTHLY: 'MONTHLY',
  HALF_YEARLY: 'HALF_YEARLY',
  ANNUAL: 'ANNUAL',
};

/**
 * Why an employee does not contribute.
 *
 * Same shape as the bonus register's exclusion codes, because "why was nothing
 * deducted for this person" is an inspection question here too, and a silently
 * dropped row cannot answer it.
 */
const EXCLUSION = {
  NO_STATE_RULE: 'NO_STATE_RULE',
  BELOW_ESTABLISHMENT_THRESHOLD: 'BELOW_ESTABLISHMENT_THRESHOLD',
  NOT_ON_ROLLS_AT_PERIOD_END: 'NOT_ON_ROLLS_AT_PERIOD_END',
  MANAGERIAL_ABOVE_THRESHOLD: 'MANAGERIAL_ABOVE_THRESHOLD',
  NOT_A_CONTRIBUTION_MONTH: 'NOT_A_CONTRIBUTION_MONTH',
  NO_APPLICABLE_SLAB: 'NO_APPLICABLE_SLAB',
};

const EXCLUSION_REASON = {
  [EXCLUSION.NO_STATE_RULE]:
    'no labour welfare fund rule on record for this state',
  [EXCLUSION.BELOW_ESTABLISHMENT_THRESHOLD]:
    'the establishment is below the headcount at which the state Act applies',
  [EXCLUSION.NOT_ON_ROLLS_AT_PERIOD_END]:
    'not on the rolls on the last day of the contribution period',
  [EXCLUSION.MANAGERIAL_ABOVE_THRESHOLD]:
    'employed in a managerial or supervisory capacity above the wage threshold the state excludes',
  [EXCLUSION.NOT_A_CONTRIBUTION_MONTH]:
    'this month is not a contribution month for the state',
  [EXCLUSION.NO_APPLICABLE_SLAB]:
    'no wage slab in the state rule covers this employee’s wages',
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
 * The contribution period a date falls in, for a state.
 *
 * This is the fiddly part and the part every hand-rolled implementation gets
 * wrong at year boundaries. A half-yearly state collecting in June and December
 * has periods January–June and July–December; an annual state collecting in
 * December has one period a year; a monthly state has twelve.
 *
 * `contributionMonths` on the rule is the list of months in which the deduction
 * is *made* — the period each one closes is derived from it rather than stated
 * separately, so a rule cannot describe a June collection for a period ending in
 * September.
 *
 * @param {object} rule
 * @param {number} month 1-12
 * @param {number} year
 * @returns {object|null} null when the state does not collect in this month
 */
function resolveContributionPeriod(rule, month, year) {
  if (!rule) return null;

  const months = Array.isArray(rule.contributionMonths)
    ? [...rule.contributionMonths].map(Number).sort((a, b) => a - b)
    : [];

  if (!months.includes(Number(month))) return null;

  const monthsInPeriod =
    rule.periodicity === PERIODICITY.MONTHLY
      ? 1
      : rule.periodicity === PERIODICITY.HALF_YEARLY
        ? 6
        : 12;

  // The period ends with the collection month and runs back from it. December
  // in a half-yearly state is July–December; June is January–June.
  const endMonth = Number(month);
  const startMonthRaw = endMonth - monthsInPeriod + 1;

  const startYear = startMonthRaw > 0 ? year : year - 1;
  const startMonth = startMonthRaw > 0 ? startMonthRaw : startMonthRaw + 12;

  return {
    periodicity: rule.periodicity,
    monthsInPeriod,
    startMonth,
    startYear,
    endMonth,
    endYear: year,
    periodStart: new Date(Date.UTC(startYear, startMonth - 1, 1)),
    // Day 0 of the next month is the last day of this one, which gets February
    // right in a leap year without hard-coding anything.
    periodEnd: new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999)),
    label: `${startYear}-${String(startMonth).padStart(2, '0')} to ${year}-${String(endMonth).padStart(2, '0')}`,
  };
}

/**
 * The slab covering a wage.
 *
 * Slabs are `{ upTo, employee, employer }` with `upTo: null` meaning "and
 * above". Inclusive of the boundary, because the notifications are written that
 * way — Maharashtra's lower slab is "wages not exceeding ₹3,000", so an employee
 * on exactly ₹3,000 is in it.
 *
 * @param {object} rule
 * @param {number} wages
 * @returns {object|null}
 */
function resolveSlab(rule, wages) {
  const slabs = Array.isArray(rule && rule.slabs) ? rule.slabs : [];
  if (!slabs.length) return null;

  const wage = toNumber(wages);

  const ordered = [...slabs].sort((a, b) => {
    if (a.upTo === null || typeof a.upTo === 'undefined') return 1;
    if (b.upTo === null || typeof b.upTo === 'undefined') return -1;
    return toNumber(a.upTo) - toNumber(b.upTo);
  });

  for (const slab of ordered) {
    const ceiling = slab.upTo;
    if (ceiling === null || typeof ceiling === 'undefined') return slab;
    if (wage <= toNumber(ceiling)) return slab;
  }

  return null;
}

/**
 * Whether an employee contributes for a period, and what they contribute.
 *
 * @param {object} input
 * @param {object} input.employee
 * @param {object} input.rule
 * @param {object} input.period
 * @param {number} input.stateHeadcount employees in this state at period end
 * @returns {object}
 */
function assessEmployee({ employee, rule, period, stateHeadcount }) {
  const base = {
    employeeId: employee.employeeId,
    name: employee.name || '',
    designation: employee.designation || '',
    state: employee.state || '',
    wages: round2(toNumber(employee.wages)),
  };

  if (!rule) {
    return {
      ...base,
      liable: false,
      code: EXCLUSION.NO_STATE_RULE,
      reason: EXCLUSION_REASON[EXCLUSION.NO_STATE_RULE],
    };
  }

  const threshold = toNumber(rule.establishmentThreshold);
  if (threshold > 0 && toNumber(stateHeadcount) < threshold) {
    return {
      ...base,
      liable: false,
      code: EXCLUSION.BELOW_ESTABLISHMENT_THRESHOLD,
      reason: `${EXCLUSION_REASON[EXCLUSION.BELOW_ESTABLISHMENT_THRESHOLD]} (${stateHeadcount} against a threshold of ${threshold})`,
    };
  }

  // The rule that is the opposite of every other deduction in payroll. LWF does
  // not pro-rate: liability is decided on the last day of the period, so a
  // joiner in November owes the *full* amount for a half-year ending in
  // December and a leaver in November owes nothing at all.
  const joined = employee.joinedOn ? new Date(employee.joinedOn) : null;
  const left = employee.leftOn ? new Date(employee.leftOn) : null;

  const onRolls =
    (!joined || joined <= period.periodEnd) &&
    (!left || left >= period.periodEnd);

  if (!onRolls) {
    return {
      ...base,
      liable: false,
      code: EXCLUSION.NOT_ON_ROLLS_AT_PERIOD_END,
      reason: EXCLUSION_REASON[EXCLUSION.NOT_ON_ROLLS_AT_PERIOD_END],
    };
  }

  // The exclusion is by capacity *and* wage together, not by either alone. A
  // senior engineer on ₹90,000 who supervises nobody is still liable, and a
  // supervisor on ₹3,000 is too. Both halves have to be true.
  const managerialThreshold = toNumber(rule.managerialWageThreshold);
  if (
    employee.managerial &&
    managerialThreshold > 0 &&
    base.wages > managerialThreshold
  ) {
    return {
      ...base,
      liable: false,
      code: EXCLUSION.MANAGERIAL_ABOVE_THRESHOLD,
      reason: `${EXCLUSION_REASON[EXCLUSION.MANAGERIAL_ABOVE_THRESHOLD]} (over ${managerialThreshold})`,
    };
  }

  const slab = resolveSlab(rule, base.wages);
  if (!slab) {
    return {
      ...base,
      liable: false,
      code: EXCLUSION.NO_APPLICABLE_SLAB,
      reason: EXCLUSION_REASON[EXCLUSION.NO_APPLICABLE_SLAB],
    };
  }

  const employeeShare = round2(toNumber(slab.employee));
  const employerShare = round2(toNumber(slab.employer));

  return {
    ...base,
    liable: true,
    slabUpTo: typeof slab.upTo === 'undefined' ? null : slab.upTo,
    employeeShare,
    employerShare,
    total: round2(employeeShare + employerShare),
  };
}

/**
 * When a contribution is due, and what the delay costs.
 *
 * `remittanceDueDays` is an offset from the period end rather than a fixed
 * calendar date, because the states express it that way — "within fifteen days
 * of the end of the contribution period" — and a fixed date would be wrong for
 * every state but the one it was copied from.
 *
 * @param {object} rule
 * @param {object} period
 * @param {Date|string} [paidOn]
 * @param {Date|string} [asAt]
 * @param {number} amount
 * @returns {object}
 */
function remittanceSchedule(rule, period, paidOn, asAt, amount) {
  const dueBy = new Date(period.periodEnd.getTime());
  dueBy.setUTCDate(dueBy.getUTCDate() + toNumber(rule.remittanceDueDays));

  const paid = paidOn ? new Date(paidOn) : null;
  const measuredTo =
    paid && !Number.isNaN(paid.getTime()) ? paid : new Date(asAt || Date.now());

  const overdueMs = measuredTo.getTime() - dueBy.getTime();
  const daysLate = overdueMs > 0 ? Math.floor(overdueMs / 86400000) : 0;

  const rate = toNumber(rule.lateInterestRate);
  const principal = Math.max(0, round2(toNumber(amount)));

  const interest =
    daysLate > 0 && rate > 0 ? round2((principal * rate * daysLate) / 365) : 0;

  return {
    dueBy,
    paidOn: paid && !Number.isNaN(paid.getTime()) ? paid : null,
    paid: Boolean(paid && !Number.isNaN(paid.getTime())),
    daysLate,
    interestRate: rate,
    interest,
    total: round2(principal + interest),
  };
}

/**
 * The whole contribution for one state, for one collection month.
 *
 * @param {object} input
 * @param {object} input.rule
 * @param {Array<object>} input.employees employees in this state
 * @param {number} input.month 1-12
 * @param {number} input.year
 * @param {Date|string} [input.paidOn]
 * @param {Date|string} [input.asAt]
 * @returns {object}
 */
function assessState({ rule, employees, month, year, paidOn, asAt }) {
  const state = rule ? rule.state : '';

  const period = resolveContributionPeriod(rule, month, year);

  if (!period) {
    return {
      state,
      month: Number(month),
      year: Number(year),
      collects: false,
      reason: EXCLUSION_REASON[EXCLUSION.NOT_A_CONTRIBUTION_MONTH],
      period: null,
      lines: [],
      exclusions: [],
      employeeTotal: 0,
      employerTotal: 0,
      total: 0,
      remittance: null,
    };
  }

  // The headcount that decides applicability is measured at the period end,
  // like liability itself — not at the start and not as an average, because the
  // state Acts phrase the threshold as "employing N persons".
  const headcountAtPeriodEnd = (employees || []).filter((employee) => {
    const joined = employee.joinedOn ? new Date(employee.joinedOn) : null;
    const left = employee.leftOn ? new Date(employee.leftOn) : null;

    return (
      (!joined || joined <= period.periodEnd) &&
      (!left || left >= period.periodEnd)
    );
  }).length;

  const lines = [];
  const exclusions = [];

  for (const employee of employees || []) {
    const result = assessEmployee({
      employee,
      rule,
      period,
      stateHeadcount: headcountAtPeriodEnd,
    });

    if (result.liable) lines.push(result);
    else exclusions.push(result);
  }

  const employeeTotal = round2(
    lines.reduce((sum, line) => sum + line.employeeShare, 0),
  );
  const employerTotal = round2(
    lines.reduce((sum, line) => sum + line.employerShare, 0),
  );
  const total = round2(employeeTotal + employerTotal);

  return {
    state,
    month: Number(month),
    year: Number(year),
    collects: true,
    period,
    headcountAtPeriodEnd,
    lines,
    exclusions,
    liableCount: lines.length,
    excludedCount: exclusions.length,
    employeeTotal,
    employerTotal,
    total,
    remittance: remittanceSchedule(rule, period, paidOn, asAt, total),
  };
}

/**
 * Every state that collects in a month, for a whole workforce.
 *
 * @param {object} input
 * @param {Array<object>} input.rules
 * @param {Array<object>} input.employees
 * @param {number} input.month
 * @param {number} input.year
 * @param {object} [input.paidOnByState]
 * @param {Date|string} [input.asAt]
 * @returns {object}
 */
function assessPeriod({
  rules,
  employees,
  month,
  year,
  paidOnByState = {},
  asAt,
}) {
  const byState = new Map();

  for (const employee of employees || []) {
    const state = (employee.state || '').toUpperCase();
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push(employee);
  }

  const ruleByState = new Map(
    (rules || []).map((rule) => [String(rule.state).toUpperCase(), rule]),
  );

  const states = [];
  const unruled = [];

  for (const [state, staff] of byState.entries()) {
    const rule = ruleByState.get(state);

    // A state with staff and no rule on record is surfaced rather than skipped.
    // Silence here reads as "nothing is due", which is the single most likely
    // way a multi-state workforce ends up under-remitting.
    if (!rule) {
      unruled.push({
        state,
        headcount: staff.length,
        reason: EXCLUSION_REASON[EXCLUSION.NO_STATE_RULE],
      });
      continue;
    }

    states.push(
      assessState({
        rule,
        employees: staff,
        month,
        year,
        paidOn: paidOnByState[state],
        asAt,
      }),
    );
  }

  const collecting = states.filter((s) => s.collects);

  return {
    month: Number(month),
    year: Number(year),
    states: states.sort((a, b) => a.state.localeCompare(b.state)),
    unruled,
    collectingStates: collecting.length,
    employeeTotal: round2(
      collecting.reduce((sum, s) => sum + s.employeeTotal, 0),
    ),
    employerTotal: round2(
      collecting.reduce((sum, s) => sum + s.employerTotal, 0),
    ),
    total: round2(collecting.reduce((sum, s) => sum + s.total, 0)),
    interest: round2(
      collecting.reduce(
        (sum, s) => sum + (s.remittance ? s.remittance.interest : 0),
        0,
      ),
    ),
  };
}

/**
 * The collection months a state has in a calendar year.
 *
 * Used by the register to show what is coming rather than only what is due,
 * because a half-yearly deduction that nobody scheduled is a deduction that
 * gets reconciled after the payroll run instead of made in it.
 *
 * @param {object} rule
 * @param {number} year
 * @returns {Array<object>}
 */
function collectionCalendar(rule, year) {
  const months = Array.isArray(rule && rule.contributionMonths)
    ? [...rule.contributionMonths].map(Number).sort((a, b) => a - b)
    : [];

  return months
    .map((month) => {
      const period = resolveContributionPeriod(rule, month, year);
      if (!period) return null;

      const dueBy = new Date(period.periodEnd.getTime());
      dueBy.setUTCDate(dueBy.getUTCDate() + toNumber(rule.remittanceDueDays));

      return { state: rule.state, month, year, period, dueBy };
    })
    .filter(Boolean);
}

module.exports = {
  PERIODICITY,
  EXCLUSION,
  EXCLUSION_REASON,

  resolveContributionPeriod,
  resolveSlab,
  assessEmployee,
  remittanceSchedule,
  assessState,
  assessPeriod,
  collectionCalendar,
};
