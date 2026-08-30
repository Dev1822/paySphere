/**
 * National and Festival Holidays Acts — the state Acts (#1970).
 *
 * `leaveAccrual.js` accrues leave, `leaveBalance.js` tracks it and
 * `attendanceGrid.js` marks a day present or absent. `workingHoursCompliance.js`
 * (#1702) knows the Factories Act spread-over and the section 59 double rate for
 * overtime. None of them has a concept of a **paid holiday that is neither
 * leave nor a weekly off**, and that is what this module owns.
 *
 * Four things shape everything below.
 *
 * **Two kinds of holiday, and the difference is legal rather than
 * presentational.** 26 January, 15 August and 2 October are compulsory and
 * cannot be substituted for another day by any agreement. Festival holidays come
 * from a state-notified list, move each year with the lunar calendar, and *can*
 * be substituted with the employee's agreement. The natural implementation is
 * one configurable list where every row behaves the same, and that list will
 * eventually let somebody swap Independence Day for a Friday before a long
 * weekend. `substitutionPermitted` refuses against a national holiday rather
 * than recording the substitution.
 *
 * **A holiday worked is not overtime.** `overtimeMultiplierEngine.utils.js`
 * keys off hours beyond a daily or weekly ceiling. Working a national holiday
 * is a whole-day consequence that fires on the first hour: a full day at twice
 * the ordinary rate however few hours were worked, and it does **not** consume
 * the statutory overtime quota #1702 tracks. An employee who works four hours
 * on 26 January is owed two days' wages under the Act and nothing at all under
 * the overtime engine. `HOLIDAY_WORK_IS_NOT_OVERTIME` travels on every wage
 * position for that reason.
 *
 * **The list is owed before the year begins.** The state Rules require it to be
 * sent to the Inspector and displayed before a prescribed date — 31 December for
 * the following year in most states. An employer who fixes the list in March has
 * already defaulted, so `listObligation` is computed against the coming year and
 * not the current one.
 *
 * **The state rules are seeded, not defaulted.** The festival count, the
 * qualifying-days condition and the absent-either-side forfeiture genuinely
 * differ between states, and a wrong default silently changes wages. An
 * unseeded state returns `null` from `resolveRules` and the assessment says so.
 *
 * Pure functions, no database access, matching how `workingHoursCompliance.js`
 * and `labourWelfareFund.js` are written.
 */

/**
 * The three that are compulsory everywhere.
 *
 * Fixed by date rather than notified, which is exactly why they are a constant
 * here and not a row somebody maintains.
 */
const NATIONAL_HOLIDAYS = [
  { month: 1, day: 26, name: 'Republic Day' },
  { month: 8, day: 15, name: 'Independence Day' },
  { month: 10, day: 2, name: 'Gandhi Jayanti' },
];

const KIND = {
  /** Compulsory, and not substitutable by any agreement. */
  NATIONAL: 'NATIONAL',
  /** From the state's notified list. Substitutable with agreement. */
  FESTIVAL: 'FESTIVAL',
};

const TREATMENT = {
  /** Twice the day's ordinary wages, whatever hours were worked. */
  DOUBLE_WAGES: 'DOUBLE_WAGES',
  /** Ordinary wages, and a substituted holiday within the prescribed period. */
  WAGES_PLUS_SUBSTITUTED_HOLIDAY: 'WAGES_PLUS_SUBSTITUTED_HOLIDAY',
};

/**
 * Per-state rules, seeded from the states the product's tenants are actually
 * in. An absent state is an explicit gap — see the header.
 */
const STATE_RULES = {
  TN: {
    state: 'TN',
    label: 'Tamil Nadu',
    act: 'Tamil Nadu Industrial Establishments (National and Festival Holidays) Act, 1958',
    festivalHolidayCount: 4,
    /** The list for the following year is due with the Inspector by this date. */
    listDueOn: { month: 12, day: 31 },
    qualifyingDaysInPrecedingPeriod: 30,
    /**
     * Absent on both the working day before and the working day after forfeits
     * the wages for the holiday.
     *
     * A real deduction, and one that gets applied by a manager from memory.
     * Modelled so that it is defensible only against the attendance on record.
     */
    absentEitherSideForfeits: true,
    holidayWorkedTreatment: TREATMENT.DOUBLE_WAGES,
    substitutedHolidayWithinDays: 90,
  },
  KA: {
    state: 'KA',
    label: 'Karnataka',
    act: 'Karnataka Industrial Establishments (National and Festival Holidays) Act, 1963',
    festivalHolidayCount: 5,
    listDueOn: { month: 12, day: 31 },
    qualifyingDaysInPrecedingPeriod: 30,
    absentEitherSideForfeits: false,
    holidayWorkedTreatment: TREATMENT.DOUBLE_WAGES,
    substitutedHolidayWithinDays: 90,
  },
  KL: {
    state: 'KL',
    label: 'Kerala',
    act: 'Kerala Industrial Establishments (National and Festival Holidays) Act, 1958',
    festivalHolidayCount: 9,
    listDueOn: { month: 12, day: 31 },
    qualifyingDaysInPrecedingPeriod: 0,
    absentEitherSideForfeits: false,
    holidayWorkedTreatment: TREATMENT.WAGES_PLUS_SUBSTITUTED_HOLIDAY,
    substitutedHolidayWithinDays: 30,
  },
  MH: {
    state: 'MH',
    label: 'Maharashtra',
    act: 'Bombay Industrial Establishments (National and Festival Holidays) Act, 1958',
    festivalHolidayCount: 4,
    listDueOn: { month: 12, day: 31 },
    qualifyingDaysInPrecedingPeriod: 0,
    absentEitherSideForfeits: false,
    holidayWorkedTreatment: TREATMENT.DOUBLE_WAGES,
    substitutedHolidayWithinDays: 90,
  },
};

const FINDING = {
  NATIONAL_HOLIDAY_MISSING: 'NATIONAL_HOLIDAY_MISSING',
  NATIONAL_HOLIDAY_SUBSTITUTED: 'NATIONAL_HOLIDAY_SUBSTITUTED',
  FESTIVAL_HOLIDAY_SHORTFALL: 'FESTIVAL_HOLIDAY_SHORTFALL',
  SUBSTITUTION_WITHOUT_AGREEMENT: 'SUBSTITUTION_WITHOUT_AGREEMENT',
  LIST_NOT_SETTLED: 'LIST_NOT_SETTLED',
  LIST_SETTLED_LATE: 'LIST_SETTLED_LATE',
  HOLIDAY_WORKED_UNDERPAID: 'HOLIDAY_WORKED_UNDERPAID',
  SUBSTITUTED_HOLIDAY_NOT_GRANTED: 'SUBSTITUTED_HOLIDAY_NOT_GRANTED',
  WAGES_FORFEITED: 'WAGES_FORFEITED',
  STATE_RULES_UNKNOWN: 'STATE_RULES_UNKNOWN',
};

const FINDING_AUTHORITY = {
  [FINDING.NATIONAL_HOLIDAY_MISSING]: 'Section 3',
  [FINDING.NATIONAL_HOLIDAY_SUBSTITUTED]: 'Section 3, proviso',
  [FINDING.FESTIVAL_HOLIDAY_SHORTFALL]: 'Section 3',
  [FINDING.SUBSTITUTION_WITHOUT_AGREEMENT]: 'Section 4',
  [FINDING.LIST_NOT_SETTLED]: 'Rule 3',
  [FINDING.LIST_SETTLED_LATE]: 'Rule 3',
  [FINDING.HOLIDAY_WORKED_UNDERPAID]: 'Section 5',
  [FINDING.SUBSTITUTED_HOLIDAY_NOT_GRANTED]: 'Section 5(2)',
  [FINDING.WAGES_FORFEITED]: 'Section 3, second proviso',
  [FINDING.STATE_RULES_UNKNOWN]: 'The state Act',
};

const SEVERITY = {
  BREACH: 'BREACH',
  /** A deadline that has not yet passed. Not a failure. */
  DUE: 'DUE',
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.NATIONAL_HOLIDAY_MISSING]: SEVERITY.BREACH,
  [FINDING.NATIONAL_HOLIDAY_SUBSTITUTED]: SEVERITY.BREACH,
  [FINDING.FESTIVAL_HOLIDAY_SHORTFALL]: SEVERITY.BREACH,
  [FINDING.SUBSTITUTION_WITHOUT_AGREEMENT]: SEVERITY.BREACH,
  [FINDING.LIST_NOT_SETTLED]: SEVERITY.DUE,
  [FINDING.LIST_SETTLED_LATE]: SEVERITY.BREACH,
  [FINDING.HOLIDAY_WORKED_UNDERPAID]: SEVERITY.BREACH,
  [FINDING.SUBSTITUTED_HOLIDAY_NOT_GRANTED]: SEVERITY.BREACH,
  [FINDING.WAGES_FORFEITED]: SEVERITY.INFORMATIONAL,
  [FINDING.STATE_RULES_UNKNOWN]: SEVERITY.DUE,
};

/**
 * The sentence that keeps this out of the overtime engine.
 *
 * Carried on every wage position rather than left in a comment. A payroll that
 * routes a holiday worked through the overtime multiplier underpays the short
 * day and wrongly consumes the statutory overtime quota, and both errors look
 * like arithmetic rather than like a category mistake.
 */
const HOLIDAY_WORK_IS_NOT_OVERTIME =
  'Working a holiday is a whole-day consequence and not overtime. It is a full day at the statutory rate however few hours were worked, it does not run through the overtime multiplier, and it does not consume the overtime quota under the Factories Act.';

/**
 * The sentence that keeps the three out of the configurable list.
 */
const NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE =
  'The three national holidays are compulsory and cannot be substituted for another day by agreement or otherwise. That is not a policy the employer may set — it is outside the employer’s power, and a calendar that treats them as three more configurable rows will eventually lose one.';

// --- Dates ------------------------------------------------------------------

/**
 * @param {Date|string|number|null|undefined} value
 * @returns {Date|null}
 */
function toUtcDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

/**
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

/**
 * Whole days between two dates. Signed — a negative means `to` is earlier.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * @param {Date} date
 * @returns {string}
 */
function isoDay(date) {
  return date ? date.toISOString().slice(0, 10) : '';
}

// --- Rules ------------------------------------------------------------------

/**
 * The rules for a state, or null.
 *
 * Null rather than a national default. The festival count, the qualifying-days
 * condition and the forfeiture rule genuinely differ, and a default that got any
 * of them wrong would change wages without anything objecting.
 *
 * @param {string} state
 * @param {object} [overrides]
 * @returns {object|null}
 */
function resolveRules(state, overrides = {}) {
  const seeded = STATE_RULES[state];
  const override = overrides?.[state];

  if (!seeded && !override) return null;
  return { ...(seeded || { state }), ...(override || {}) };
}

/**
 * The three national holidays for a calendar year.
 *
 * Built from the constant rather than read from the employer's list. The whole
 * point is that they are not the employer's to choose, so a list that omits one
 * is a finding rather than a shorter list.
 *
 * @param {number} year
 * @returns {Array<object>}
 */
function nationalHolidaysFor(year) {
  return NATIONAL_HOLIDAYS.map((holiday) => ({
    kind: KIND.NATIONAL,
    name: holiday.name,
    date: new Date(Date.UTC(year, holiday.month - 1, holiday.day)),
    substitutable: false,
  }));
}

/**
 * Whether a holiday may be substituted for another day.
 *
 * A refusal rather than a flag. See `NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE`.
 *
 * @param {object} input
 * @param {object} input.holiday
 * @param {object|null} [input.agreement]
 * @returns {{permitted: boolean, reason: string, authority: string}}
 */
function substitutionPermitted({ holiday, agreement }) {
  if (holiday?.kind === KIND.NATIONAL) {
    return {
      permitted: false,
      reason: NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
      authority: 'Section 3, proviso',
    };
  }

  if (!agreement?.agreedOn) {
    return {
      permitted: false,
      reason:
        'A festival holiday may be substituted, but only with the employee’s agreement. No agreement is recorded against this substitution.',
      authority: 'Section 4',
    };
  }

  return {
    permitted: true,
    reason:
      'A festival holiday substituted with the employee’s recorded agreement.',
    authority: 'Section 4',
  };
}

// --- Eligibility ------------------------------------------------------------

/**
 * Whether an employee is entitled to wages for a holiday.
 *
 * Both tests are evaluated against attendance already on record, and the days
 * the answer was computed from are returned with it — a forfeited holiday has
 * to be explainable to the person who lost it, and "the manager remembered you
 * were off" is not an explanation.
 *
 * @param {object} input
 * @param {object} input.holiday
 * @param {Array<{date: Date|string, present: boolean, working: boolean}>} input.attendance
 * @param {object} input.rules
 * @returns {object}
 */
function eligibility({ holiday, attendance = [], rules }) {
  const holidayDate = toUtcDate(holiday?.date);
  const days = attendance
    .map((row) => ({ ...row, date: toUtcDate(row.date) }))
    .filter((row) => row.date)
    .sort((a, b) => a.date - b.date);

  const qualifyingRequired =
    Number(rules?.qualifyingDaysInPrecedingPeriod) || 0;
  const worked = days.filter(
    (row) => row.present && row.date < holidayDate,
  ).length;

  const qualified = worked >= qualifyingRequired;

  // The working day *before* and the working day *after* — not the calendar day
  // either side. An employee whose Sunday falls before the holiday has not been
  // absent, and a calendar-day test would forfeit their wages for it.
  const before = [...days]
    .reverse()
    .find((row) => row.working && row.date < holidayDate);
  const after = days.find((row) => row.working && row.date > holidayDate);

  const absentEitherSide =
    Boolean(rules?.absentEitherSideForfeits) &&
    Boolean(before) &&
    Boolean(after) &&
    !before.present &&
    !after.present;

  return {
    entitled: qualified && !absentEitherSide,
    qualifyingDaysRequired: qualifyingRequired,
    qualifyingDaysWorked: worked,
    qualified,
    absentEitherSide,
    // Returned so the deduction can be explained to the employee who bore it.
    dayBefore: before ? { date: before.date, present: before.present } : null,
    dayAfter: after ? { date: after.date, present: after.present } : null,
    reason: !qualified
      ? `Worked ${worked} qualifying days against the ${qualifyingRequired} the state requires.`
      : absentEitherSide
        ? 'Absent on both the working day before and the working day after the holiday.'
        : 'Entitled to wages for the holiday.',
  };
}

// --- Wages ------------------------------------------------------------------

/**
 * What is owed where a holiday was worked.
 *
 * Not routed through the overtime engine, and it says so — see
 * `HOLIDAY_WORK_IS_NOT_OVERTIME`. The hours worked are recorded and are
 * deliberately not used to scale the amount: the entitlement is a whole day.
 *
 * @param {object} input
 * @param {object} input.holiday
 * @param {number} input.dailyWage
 * @param {number} [input.hoursWorked]
 * @param {object} input.rules
 * @param {Date|string} [input.substitutedHolidayGrantedOn]
 * @returns {object}
 */
function holidayWagePosition({
  holiday,
  dailyWage,
  hoursWorked = 0,
  rules,
  substitutedHolidayGrantedOn,
}) {
  const wage = Number(dailyWage) > 0 ? Number(dailyWage) : 0;
  const treatment = rules?.holidayWorkedTreatment || TREATMENT.DOUBLE_WAGES;
  const holidayDate = toUtcDate(holiday?.date);

  const base = {
    treatment,
    dailyWage: wage,
    // Recorded and deliberately unused in the arithmetic. A four-hour day and a
    // ten-hour day owe the same thing.
    hoursWorked: Number(hoursWorked) || 0,
    consumesOvertimeQuota: false,
    note: HOLIDAY_WORK_IS_NOT_OVERTIME,
  };

  if (treatment === TREATMENT.WAGES_PLUS_SUBSTITUTED_HOLIDAY) {
    const granted = toUtcDate(substitutedHolidayGrantedOn);
    const within = Number(rules?.substitutedHolidayWithinDays) || 0;
    const dueBy = holidayDate && within ? addDays(holidayDate, within) : null;

    return {
      ...base,
      wagesPayable: wage,
      substitutedHolidayDue: true,
      substitutedHolidayGrantedOn: granted,
      substitutedHolidayDueBy: dueBy,
      satisfied: Boolean(granted) && (!dueBy || granted <= dueBy),
    };
  }

  return {
    ...base,
    wagesPayable: wage * 2,
    substitutedHolidayDue: false,
    substitutedHolidayGrantedOn: null,
    substitutedHolidayDueBy: null,
    satisfied: true,
  };
}

// --- The list ---------------------------------------------------------------

/**
 * Whether the holiday list for a year was settled in time.
 *
 * Computed against the year *ahead*. An employer who fixes the list in March
 * has already defaulted, and an obligation that only fires during the year it
 * governs can never be met.
 *
 * @param {object} input
 * @param {number} input.year
 * @param {Date|string|null} input.settledOn
 * @param {object} input.rules
 * @param {Date|string} [input.asAt]
 * @returns {object}
 */
function listObligation({ year, settledOn, rules, asAt = new Date() }) {
  const due = new Date(
    Date.UTC(
      year - 1,
      (Number(rules?.listDueOn?.month) || 12) - 1,
      Number(rules?.listDueOn?.day) || 31,
    ),
  );

  const settled = toUtcDate(settledOn);
  const today = toUtcDate(asAt);

  if (settled) {
    return {
      year,
      dueOn: due,
      settledOn: settled,
      late: settled > due,
      lateByDays: settled > due ? daysBetween(due, settled) : 0,
      daysRemaining: null,
    };
  }

  return {
    year,
    dueOn: due,
    settledOn: null,
    late: today > due,
    lateByDays: today > due ? daysBetween(due, today) : 0,
    // A countdown while it can still be met. See the docstring.
    daysRemaining: today <= due ? daysBetween(today, due) : null,
  };
}

// --- Assessment -------------------------------------------------------------

/**
 * One establishment's holiday position for a year.
 *
 * @param {object} input
 * @returns {object}
 */
function assessYear({
  state,
  year,
  holidays = [],
  substitutions = [],
  worked = [],
  listSettledOn = null,
  ruleOverrides = {},
  asAt = new Date(),
}) {
  const rules = resolveRules(state, ruleOverrides);

  const findings = [];
  const add = (code, detail) =>
    findings.push({
      code,
      authority: FINDING_AUTHORITY[code],
      severity: FINDING_SEVERITY[code],
      ...detail,
    });

  if (!rules) {
    add(FINDING.STATE_RULES_UNKNOWN, {
      state,
      detail:
        'No rules are on file for this state. The festival count, the qualifying-days condition and the forfeiture rule differ between states, and defaulting any of them would change wages without anything objecting.',
    });

    return {
      state,
      year,
      rules: null,
      national: [],
      festival: [],
      worked: [],
      list: null,
      findings,
      severityCounts: { BREACH: 0, DUE: 1, INFORMATIONAL: 0 },
      notes: {
        holidayWorkIsNotOvertime: HOLIDAY_WORK_IS_NOT_OVERTIME,
        nationalHolidaysAreNotSubstitutable:
          NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
      },
    };
  }

  // The three are built from the constant and then matched against the
  // employer's list, rather than read out of it. A list missing one is a
  // finding, not a shorter list.
  const required = nationalHolidaysFor(year);
  const declared = holidays
    .map((holiday) => ({ ...holiday, date: toUtcDate(holiday.date) }))
    .filter((holiday) => holiday.date);

  const national = required.map((holiday) => {
    const match = declared.find(
      (row) =>
        row.kind === KIND.NATIONAL && isoDay(row.date) === isoDay(holiday.date),
    );

    if (!match) {
      add(FINDING.NATIONAL_HOLIDAY_MISSING, {
        name: holiday.name,
        date: holiday.date,
        detail: `${holiday.name} is not on the establishment’s list for ${year}. The three national holidays are compulsory and are not the employer’s to omit.`,
      });
    }

    return { ...holiday, declared: Boolean(match) };
  });

  const festival = declared.filter((row) => row.kind === KIND.FESTIVAL);
  const requiredFestival = Number(rules.festivalHolidayCount) || 0;

  if (festival.length < requiredFestival) {
    add(FINDING.FESTIVAL_HOLIDAY_SHORTFALL, {
      declared: festival.length,
      required: requiredFestival,
      detail: `${festival.length} festival holidays declared against the ${requiredFestival} ${rules.label || state} requires.`,
    });
  }

  for (const substitution of substitutions) {
    const holiday = declared.find(
      (row) => isoDay(row.date) === isoDay(toUtcDate(substitution.holidayDate)),
    ) || {
      kind: substitution.kind,
      date: toUtcDate(substitution.holidayDate),
    };

    const permitted = substitutionPermitted({
      holiday,
      agreement: substitution.agreement,
    });

    if (!permitted.permitted) {
      add(
        holiday.kind === KIND.NATIONAL
          ? FINDING.NATIONAL_HOLIDAY_SUBSTITUTED
          : FINDING.SUBSTITUTION_WITHOUT_AGREEMENT,
        {
          date: holiday.date,
          substitutedFor: toUtcDate(substitution.substitutedDate),
          detail: permitted.reason,
        },
      );
    }
  }

  const workedRows = worked.map((row) => {
    const holiday = declared.find(
      (h) => isoDay(h.date) === isoDay(toUtcDate(row.holidayDate)),
    ) || { kind: row.kind || KIND.FESTIVAL, date: toUtcDate(row.holidayDate) };

    const position = holidayWagePosition({
      holiday,
      dailyWage: row.dailyWage,
      hoursWorked: row.hoursWorked,
      rules,
      substitutedHolidayGrantedOn: row.substitutedHolidayGrantedOn,
    });

    const paid = Number(row.paid) || 0;

    if (paid < position.wagesPayable) {
      add(FINDING.HOLIDAY_WORKED_UNDERPAID, {
        employeeId: row.employeeId,
        date: holiday.date,
        payable: position.wagesPayable,
        paid,
        detail: `${row.hoursWorked || 0} hours were worked on a holiday. The entitlement is a whole day at the statutory rate regardless of hours, and does not run through the overtime multiplier.`,
      });
    }

    if (position.substitutedHolidayDue && !position.satisfied) {
      add(FINDING.SUBSTITUTED_HOLIDAY_NOT_GRANTED, {
        employeeId: row.employeeId,
        date: holiday.date,
        dueBy: position.substitutedHolidayDueBy,
        detail:
          'The state compensates a holiday worked with ordinary wages and a substituted holiday. The substituted holiday has not been granted within the prescribed period.',
      });
    }

    return { ...row, holiday, position };
  });

  const list = listObligation({ year, settledOn: listSettledOn, rules, asAt });

  if (!list.settledOn) {
    add(list.late ? FINDING.LIST_SETTLED_LATE : FINDING.LIST_NOT_SETTLED, {
      year,
      dueOn: list.dueOn,
      daysRemaining: list.daysRemaining,
      lateByDays: list.lateByDays,
      detail: list.late
        ? `The list for ${year} was due with the Inspector on ${isoDay(list.dueOn)} and has still not been settled.`
        : `The list for ${year} is due with the Inspector on ${isoDay(list.dueOn)}. A list fixed after the year has begun is already in default.`,
    });
  } else if (list.late) {
    add(FINDING.LIST_SETTLED_LATE, {
      year,
      dueOn: list.dueOn,
      settledOn: list.settledOn,
      lateByDays: list.lateByDays,
      detail: `The list for ${year} was settled ${list.lateByDays} days after it was due.`,
    });
  }

  return {
    state,
    year,
    rules,
    national,
    festival,
    worked: workedRows,
    list,
    findings,
    severityCounts: {
      BREACH: findings.filter((f) => f.severity === SEVERITY.BREACH).length,
      DUE: findings.filter((f) => f.severity === SEVERITY.DUE).length,
      INFORMATIONAL: findings.filter(
        (f) => f.severity === SEVERITY.INFORMATIONAL,
      ).length,
    },
    notes: {
      holidayWorkIsNotOvertime: HOLIDAY_WORK_IS_NOT_OVERTIME,
      nationalHolidaysAreNotSubstitutable:
        NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
    },
  };
}

module.exports = {
  NATIONAL_HOLIDAYS,
  STATE_RULES,
  KIND,
  TREATMENT,
  FINDING,
  FINDING_AUTHORITY,
  FINDING_SEVERITY,
  SEVERITY,
  HOLIDAY_WORK_IS_NOT_OVERTIME,
  NATIONAL_HOLIDAYS_ARE_NOT_SUBSTITUTABLE,
  toUtcDate,
  addDays,
  daysBetween,
  resolveRules,
  nationalHolidaysFor,
  substitutionPermitted,
  eligibility,
  holidayWagePosition,
  listObligation,
  assessYear,
};
