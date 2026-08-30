/**
 * Shops and Commercial Establishments Acts — the state Acts (#1972).
 *
 * Every establishment this product serves that is not a factory is registered
 * under one of these. That registration is the establishment's licence to
 * exist. `entity.routes.js` records legal entities and `compliance.routes.js`
 * aggregates findings other modules produce, but nothing in the codebase holds
 * a certificate, its validity, or the obligations that hang off it.
 *
 * Four things shape everything below.
 *
 * **A lapsed certificate is not a late renewal.** They are different findings
 * with different consequences: a renewal filed a week late is a procedural
 * default, and an establishment trading on an expired certificate is trading
 * **unregistered**. Collapsing the two into one "renewal overdue" row is how a
 * serious finding gets cleared alongside a trivial one. See
 * `LAPSED_IS_OPERATING_UNREGISTERED`.
 *
 * **The amendment clock runs from the date the particular changed, not from the
 * date somebody noticed.** The employee count sits on the certificate, changes
 * every time the establishment hires, and is banded by several states — so an
 * ordinary hire crosses a band and starts a fifteen-day clock that
 * `employee.controller.js` knows nothing about. `amendmentsDue` compares the
 * particulars *as they appear on the certificate* against the establishment's
 * current position and dates each difference from when it arose.
 *
 * **The weekly holiday is two tests, not one.** The establishment's notified
 * closing day and the employee's entitlement to a whole day off are separate
 * obligations. An establishment that trades seven days may still owe each
 * employee a day, and only one of those questions is about the shop. Reporting a
 * single "weekly holiday" verdict answers whichever one the reader was not
 * asking about.
 *
 * **The rules are seeded per state, never defaulted.** The registration window,
 * the renewal cycle, the amendment period and the hours are all state-made and
 * they genuinely differ — Maharashtra's 2017 Act runs a certificate for ten
 * years where Delhi's runs for one. A default renewal cycle here would quietly
 * tell an employer their certificate is valid.
 *
 * Pure functions, no database access, matching how `contractLabour.js` and
 * `labourWelfareFund.js` are written.
 */

/**
 * Per-state rules, seeded from the states the product's tenants are actually
 * in. An absent state returns null — see the header.
 */
const STATE_RULES = {
  KA: {
    state: 'KA',
    label: 'Karnataka',
    act: 'Karnataka Shops and Commercial Establishments Act, 1961',
    /** Days from commencement within which registration must be applied for. */
    registrationWindowDays: 30,
    /** Years a certificate runs for. Null means it does not expire. */
    renewalYears: 5,
    /** Days within which a change in particulars must be notified. */
    amendmentDays: 15,
    /** Days within which closure must be intimated and the certificate surrendered. */
    closureIntimationDays: 15,
    weeklyHolidayRequired: true,
    openingHour: 6,
    closingHour: 22,
    maximumSpreadOverHours: 12,
    nightWorkForWomen: {
      permitted: true,
      consentRequired: true,
      transportRequired: true,
      minimumGroupSize: 3,
    },
    /** Bands the employee count is recorded in on the certificate. */
    headcountBands: [
      { from: 0, upto: 9, label: 'Fewer than 10' },
      { from: 10, upto: 19, label: '10 to 19' },
      { from: 20, upto: null, label: '20 and above' },
    ],
  },
  MH: {
    state: 'MH',
    label: 'Maharashtra',
    act: 'Maharashtra Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2017',
    registrationWindowDays: 60,
    renewalYears: 10,
    amendmentDays: 30,
    closureIntimationDays: 30,
    weeklyHolidayRequired: true,
    openingHour: 0,
    closingHour: 24,
    maximumSpreadOverHours: 11,
    nightWorkForWomen: {
      permitted: true,
      consentRequired: true,
      transportRequired: true,
      minimumGroupSize: 3,
    },
    headcountBands: [
      { from: 0, upto: 9, label: 'Fewer than 10' },
      { from: 10, upto: null, label: '10 and above' },
    ],
  },
  TN: {
    state: 'TN',
    label: 'Tamil Nadu',
    act: 'Tamil Nadu Shops and Establishments Act, 1947',
    registrationWindowDays: 30,
    renewalYears: 1,
    amendmentDays: 15,
    closureIntimationDays: 15,
    weeklyHolidayRequired: true,
    openingHour: 6,
    closingHour: 22,
    maximumSpreadOverHours: 12,
    nightWorkForWomen: {
      permitted: true,
      consentRequired: true,
      transportRequired: true,
      minimumGroupSize: 3,
    },
    headcountBands: [
      { from: 0, upto: 9, label: 'Fewer than 10' },
      { from: 10, upto: null, label: '10 and above' },
    ],
  },
  DL: {
    state: 'DL',
    label: 'Delhi',
    act: 'Delhi Shops and Establishments Act, 1954',
    registrationWindowDays: 90,
    renewalYears: 1,
    amendmentDays: 15,
    closureIntimationDays: 10,
    weeklyHolidayRequired: true,
    openingHour: 6,
    closingHour: 23,
    maximumSpreadOverHours: 12,
    nightWorkForWomen: {
      permitted: true,
      consentRequired: true,
      transportRequired: true,
      minimumGroupSize: 3,
    },
    headcountBands: [
      { from: 0, upto: 9, label: 'Fewer than 10' },
      { from: 10, upto: null, label: '10 and above' },
    ],
  },
};

/**
 * The particulars that sit on a certificate, and that a change to starts a
 * clock.
 *
 * Enumerated rather than free-form, because the fifteen-day obligation attaches
 * to *these* and not to any change in the business. A tenant free-texting a
 * particular would produce a queue with rows in it that owe nothing.
 */
const PARTICULAR = {
  ESTABLISHMENT_NAME: 'ESTABLISHMENT_NAME',
  EMPLOYER_NAME: 'EMPLOYER_NAME',
  ADDRESS: 'ADDRESS',
  NATURE_OF_BUSINESS: 'NATURE_OF_BUSINESS',
  /** The trap. See the header. */
  HEADCOUNT_BAND: 'HEADCOUNT_BAND',
  MANAGER_NAME: 'MANAGER_NAME',
};

const REGISTRATION_STATE = {
  /** Registered, and the certificate is current. */
  CURRENT: 'CURRENT',
  /** Commenced, inside the window, not yet registered. */
  WITHIN_WINDOW: 'WITHIN_WINDOW',
  /** Commenced, past the window, never registered. */
  NEVER_REGISTERED: 'NEVER_REGISTERED',
  /** Registered once and the certificate has expired. */
  LAPSED: 'LAPSED',
  /** Closed and surrendered. */
  CLOSED: 'CLOSED',
};

const FINDING = {
  REGISTRATION_DUE: 'REGISTRATION_DUE',
  REGISTRATION_OVERDUE: 'REGISTRATION_OVERDUE',
  OPERATING_UNREGISTERED: 'OPERATING_UNREGISTERED',
  RENEWAL_DUE: 'RENEWAL_DUE',
  AMENDMENT_DUE: 'AMENDMENT_DUE',
  AMENDMENT_OVERDUE: 'AMENDMENT_OVERDUE',
  WEEKLY_HOLIDAY_NOT_GIVEN: 'WEEKLY_HOLIDAY_NOT_GIVEN',
  TRADED_ON_CLOSED_DAY: 'TRADED_ON_CLOSED_DAY',
  OUTSIDE_NOTIFIED_HOURS: 'OUTSIDE_NOTIFIED_HOURS',
  NIGHT_WORK_CONDITIONS_NOT_MET: 'NIGHT_WORK_CONDITIONS_NOT_MET',
  CLOSURE_NOT_INTIMATED: 'CLOSURE_NOT_INTIMATED',
  STATE_RULES_UNKNOWN: 'STATE_RULES_UNKNOWN',
};

const FINDING_AUTHORITY = {
  [FINDING.REGISTRATION_DUE]: 'Section 4',
  [FINDING.REGISTRATION_OVERDUE]: 'Section 4',
  [FINDING.OPERATING_UNREGISTERED]: 'Section 4 read with section 5',
  [FINDING.RENEWAL_DUE]: 'Section 5',
  [FINDING.AMENDMENT_DUE]: 'Section 6',
  [FINDING.AMENDMENT_OVERDUE]: 'Section 6',
  [FINDING.WEEKLY_HOLIDAY_NOT_GIVEN]: 'The weekly holiday provision',
  [FINDING.TRADED_ON_CLOSED_DAY]: 'The notified closing day',
  [FINDING.OUTSIDE_NOTIFIED_HOURS]: 'The opening and closing hours',
  [FINDING.NIGHT_WORK_CONDITIONS_NOT_MET]: 'The night-work conditions',
  [FINDING.CLOSURE_NOT_INTIMATED]: 'Section 7',
  [FINDING.STATE_RULES_UNKNOWN]: 'The state Act',
};

const SEVERITY = {
  BREACH: 'BREACH',
  /** A deadline that has not yet passed. Not a failure. */
  DUE: 'DUE',
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.REGISTRATION_DUE]: SEVERITY.DUE,
  [FINDING.REGISTRATION_OVERDUE]: SEVERITY.BREACH,
  [FINDING.OPERATING_UNREGISTERED]: SEVERITY.BREACH,
  [FINDING.RENEWAL_DUE]: SEVERITY.DUE,
  [FINDING.AMENDMENT_DUE]: SEVERITY.DUE,
  [FINDING.AMENDMENT_OVERDUE]: SEVERITY.BREACH,
  [FINDING.WEEKLY_HOLIDAY_NOT_GIVEN]: SEVERITY.BREACH,
  [FINDING.TRADED_ON_CLOSED_DAY]: SEVERITY.BREACH,
  [FINDING.OUTSIDE_NOTIFIED_HOURS]: SEVERITY.BREACH,
  [FINDING.NIGHT_WORK_CONDITIONS_NOT_MET]: SEVERITY.BREACH,
  [FINDING.CLOSURE_NOT_INTIMATED]: SEVERITY.BREACH,
  [FINDING.STATE_RULES_UNKNOWN]: SEVERITY.DUE,
};

/**
 * The distinction the module refuses to collapse.
 */
const LAPSED_IS_OPERATING_UNREGISTERED =
  'A certificate that has expired is not a renewal that is late. The establishment is trading unregistered, which is a different finding with a different consequence — and a queue that showed the two as one row would let the serious one be cleared alongside the trivial one.';

/**
 * The weekly holiday, in the module's own words.
 */
const WEEKLY_HOLIDAY_IS_TWO_TESTS =
  'The establishment’s notified closing day and the employee’s entitlement to a whole day off are separate obligations. An establishment that trades seven days may still owe each employee a day, and only one of those questions is about the shop.';

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
 * @param {Date} date
 * @param {number} years
 * @returns {Date}
 */
function addYears(date, years) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear() + years,
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

/**
 * Whole days between two dates. Signed — the sign is the answer.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

// --- Rules ------------------------------------------------------------------

/**
 * The rules for a state, or null.
 *
 * Null rather than a national default. There is no national Act, the windows
 * and cycles genuinely differ, and a module that averaged them would be wrong
 * in every state rather than right in one.
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
 * The band an employee count falls in.
 *
 * @param {number} count
 * @param {object} rules
 * @returns {object|null}
 */
function headcountBand(count, rules) {
  const bands = Array.isArray(rules?.headcountBands)
    ? rules.headcountBands
    : [];
  const headcount = Number(count) || 0;

  return (
    bands.find(
      (band) =>
        headcount >= Number(band.from) &&
        (band.upto === null ||
          band.upto === undefined ||
          headcount <= Number(band.upto)),
    ) || null
  );
}

// --- Registration -----------------------------------------------------------

/**
 * The certificate's position on a date.
 *
 * Distinguishes a lapsed certificate from a late renewal, which is the whole
 * point — see `LAPSED_IS_OPERATING_UNREGISTERED`.
 *
 * @param {object} input
 * @returns {object}
 */
function registrationPosition({
  commencedOn,
  registeredOn,
  validTo,
  closedOn,
  surrenderedOn,
  rules,
  asAt = new Date(),
}) {
  const today = toUtcDate(asAt);
  const commenced = toUtcDate(commencedOn);
  const registered = toUtcDate(registeredOn);
  const closed = toUtcDate(closedOn);

  if (closed && toUtcDate(surrenderedOn)) {
    return {
      state: REGISTRATION_STATE.CLOSED,
      commencedOn: commenced,
      registeredOn: registered,
      closedOn: closed,
    };
  }

  // The window runs from commencement, so an establishment that opened and
  // staffed a second office has started a clock nobody in the payroll system is
  // watching.
  const applyBy = commenced
    ? addDays(commenced, Number(rules?.registrationWindowDays) || 0)
    : null;

  if (!registered) {
    const overdue = Boolean(applyBy) && today > applyBy;
    return {
      state: overdue
        ? REGISTRATION_STATE.NEVER_REGISTERED
        : REGISTRATION_STATE.WITHIN_WINDOW,
      commencedOn: commenced,
      registeredOn: null,
      applyBy,
      daysRemaining: applyBy && !overdue ? daysBetween(today, applyBy) : null,
      overdueByDays: overdue ? daysBetween(applyBy, today) : 0,
    };
  }

  // A cycle of null is a certificate that does not expire, which is a real
  // answer in a few states and is not the same as one whose expiry is unknown.
  const expiry =
    toUtcDate(validTo) ||
    (rules?.renewalYears
      ? addYears(registered, Number(rules.renewalYears))
      : null);

  if (!expiry) {
    return {
      state: REGISTRATION_STATE.CURRENT,
      commencedOn: commenced,
      registeredOn: registered,
      validTo: null,
      perpetual: true,
    };
  }

  const daysRemaining = daysBetween(today, expiry);

  return {
    state:
      daysRemaining < 0
        ? REGISTRATION_STATE.LAPSED
        : REGISTRATION_STATE.CURRENT,
    commencedOn: commenced,
    registeredOn: registered,
    validTo: expiry,
    daysRemaining,
    lapsedByDays: daysRemaining < 0 ? Math.abs(daysRemaining) : 0,
    renewalYears: rules?.renewalYears ?? null,
  };
}

// --- Amendments -------------------------------------------------------------

/**
 * Which particulars on the certificate no longer match the establishment.
 *
 * Each difference is dated from **when it arose**, not from when the comparison
 * was run. A hire that crossed a headcount band in March started the clock in
 * March, and dating it from today would report an obligation that is already in
 * default as one with fifteen days left.
 *
 * @param {object} input
 * @returns {Array<object>}
 */
function amendmentsDue({
  onCertificate = {},
  current = {},
  changedOn = {},
  rules,
  asAt = new Date(),
}) {
  const today = toUtcDate(asAt);
  const window = Number(rules?.amendmentDays) || 0;

  return Object.values(PARTICULAR)
    .filter((particular) => {
      const before = onCertificate[particular];
      const after = current[particular];
      return (
        before !== undefined &&
        after !== undefined &&
        String(before) !== String(after)
      );
    })
    .map((particular) => {
      const arose = toUtcDate(changedOn[particular]);
      const notifyBy = arose ? addDays(arose, window) : null;
      const overdue = Boolean(notifyBy) && today > notifyBy;

      return {
        particular,
        onCertificate: onCertificate[particular],
        current: current[particular],
        changedOn: arose,
        notifyBy,
        overdue,
        daysRemaining:
          notifyBy && !overdue ? daysBetween(today, notifyBy) : null,
        overdueByDays: overdue ? daysBetween(notifyBy, today) : 0,
        // An undated change is a gap rather than a deadline. Dating it from
        // today would invent a fresh fifteen days for a change made in March.
        undated: !arose,
      };
    });
}

// --- Weekly holiday and hours -----------------------------------------------

/**
 * The two weekly-holiday tests, kept apart.
 *
 * See `WEEKLY_HOLIDAY_IS_TWO_TESTS`. A single verdict answers whichever
 * question the reader was not asking.
 *
 * @param {object} input
 * @returns {object}
 */
function weeklyHolidayPosition({ closingDay, shifts = [], rules }) {
  if (!rules?.weeklyHolidayRequired) {
    return { required: false, note: WEEKLY_HOLIDAY_IS_TWO_TESTS };
  }

  const rows = shifts
    .map((shift) => ({ ...shift, date: toUtcDate(shift.date) }))
    .filter((shift) => shift.date);

  // Test one: was the establishment open on the day it told the Inspector it
  // would be closed?
  const tradedOnClosedDay =
    closingDay === null || closingDay === undefined
      ? []
      : rows.filter((shift) => shift.date.getUTCDay() === Number(closingDay));

  // Test two: did each employee get a whole day in each week? Independent of
  // test one — an establishment trading seven days can still satisfy this by
  // rostering people off on different days.
  const byEmployee = new Map();
  for (const shift of rows) {
    const key = String(shift.employeeId);
    if (!byEmployee.has(key)) byEmployee.set(key, new Set());
    // Weeks are keyed on the Sunday that opens them, so a week is the same
    // object for every employee regardless of when their shift starts.
    const weekStart = addDays(shift.date, -shift.date.getUTCDay());
    byEmployee.get(key).add(weekStart.toISOString().slice(0, 10));
  }

  const withoutADay = [];
  for (const [employeeId, weeks] of byEmployee.entries()) {
    for (const week of weeks) {
      const worked = rows.filter(
        (shift) =>
          String(shift.employeeId) === employeeId &&
          addDays(shift.date, -shift.date.getUTCDay())
            .toISOString()
            .slice(0, 10) === week,
      );

      if (worked.length >= 7)
        withoutADay.push({ employeeId, weekStarting: week });
    }
  }

  return {
    required: true,
    closingDay: closingDay ?? null,
    tradedOnClosedDay: tradedOnClosedDay.map((shift) => shift.date),
    employeesWithoutAWholeDay: withoutADay,
    note: WEEKLY_HOLIDAY_IS_TWO_TESTS,
  };
}

/**
 * Shifts falling outside the notified opening and closing hours.
 *
 * @param {object} input
 * @returns {Array<object>}
 */
function hoursBreaches({ shifts = [], rules }) {
  const open = Number(rules?.openingHour);
  const close = Number(rules?.closingHour);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return [];

  return shifts.filter((shift) => {
    const start = Number(shift?.startHour);
    const end = Number(shift?.endHour);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return start < open || end > close;
  });
}

/**
 * Whether the conditions on employing a woman at night were met.
 *
 * Every condition is required together. Consent without transport, or transport
 * without the minimum group, is not a partial compliance — it is a breach with
 * one box ticked, and reporting it as "mostly met" is how it stays that way.
 *
 * @param {object} input
 * @returns {object}
 */
function nightWorkPosition({ engagement, rules }) {
  const conditions = rules?.nightWorkForWomen;
  if (!conditions) return { applicable: false };

  if (!conditions.permitted) {
    return {
      applicable: true,
      met: false,
      reason: 'The state does not permit it at all.',
    };
  }

  const unmet = [];
  if (conditions.consentRequired && !engagement?.consentRecordedOn) {
    unmet.push('The employee’s written consent is not on record.');
  }
  if (conditions.transportRequired && !engagement?.transportProvided) {
    unmet.push('Transport to and from the workplace is not provided.');
  }
  if (
    conditions.minimumGroupSize &&
    Number(engagement?.groupSize || 0) < Number(conditions.minimumGroupSize)
  ) {
    unmet.push(
      `Fewer than ${conditions.minimumGroupSize} women are engaged on the shift.`,
    );
  }

  return {
    applicable: true,
    met: unmet.length === 0,
    unmet,
    // Named because a partial answer here reads as progress, and it is not.
    allConditionsRequiredTogether: true,
  };
}

// --- Closure ----------------------------------------------------------------

/**
 * Closure and its intimation.
 *
 * An employer who simply stops filing stays on the register, stays inspectable
 * and keeps accruing. Closure is an obligation and not the absence of one.
 *
 * @param {object} input
 * @returns {object|null}
 */
function closurePosition({ closedOn, intimatedOn, rules, asAt = new Date() }) {
  const closed = toUtcDate(closedOn);
  if (!closed) return null;

  const today = toUtcDate(asAt);
  const intimated = toUtcDate(intimatedOn);
  const dueBy = addDays(closed, Number(rules?.closureIntimationDays) || 0);

  return {
    closedOn: closed,
    intimatedOn: intimated,
    dueBy,
    satisfied: Boolean(intimated) && intimated <= dueBy,
    late: Boolean(intimated) && intimated > dueBy,
    overdue: !intimated && today > dueBy,
    daysRemaining:
      !intimated && today <= dueBy ? daysBetween(today, dueBy) : null,
  };
}

// --- Assessment -------------------------------------------------------------

/**
 * One establishment's complete position.
 *
 * @param {object} input
 * @returns {object}
 */
function assessEstablishment({
  state,
  registration = {},
  particulars = {},
  shifts = [],
  nightEngagements = [],
  ruleOverrides = {},
  alsoCoveredByFactoriesAct = false,
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
        'No rules are on file for this state. There is no national Act — the registration window, the renewal cycle, the amendment period and the hours are all state-made — and a default here would quietly tell an employer their certificate is valid.',
    });

    return {
      state,
      rules: null,
      registration: null,
      amendments: [],
      weeklyHoliday: null,
      closure: null,
      findings,
      severityCounts: { BREACH: 0, DUE: 1, INFORMATIONAL: 0 },
      notes: {
        lapsedIsOperatingUnregistered: LAPSED_IS_OPERATING_UNREGISTERED,
        weeklyHolidayIsTwoTests: WEEKLY_HOLIDAY_IS_TWO_TESTS,
      },
    };
  }

  const position = registrationPosition({ ...registration, rules, asAt });

  if (position.state === REGISTRATION_STATE.WITHIN_WINDOW) {
    add(FINDING.REGISTRATION_DUE, {
      applyBy: position.applyBy,
      daysRemaining: position.daysRemaining,
      detail: `The establishment commenced on ${position.commencedOn?.toISOString().slice(0, 10)}. Registration is due within ${rules.registrationWindowDays} days of that.`,
    });
  }

  if (position.state === REGISTRATION_STATE.NEVER_REGISTERED) {
    add(FINDING.REGISTRATION_OVERDUE, {
      applyBy: position.applyBy,
      overdueByDays: position.overdueByDays,
      detail: `The registration window closed ${position.overdueByDays} days ago and no certificate has been obtained.`,
    });
    // Two findings, not one. The window being missed is a procedural default;
    // trading without a certificate is a separate and continuing one.
    add(FINDING.OPERATING_UNREGISTERED, {
      since: position.applyBy,
      detail: LAPSED_IS_OPERATING_UNREGISTERED,
    });
  }

  if (position.state === REGISTRATION_STATE.LAPSED) {
    add(FINDING.OPERATING_UNREGISTERED, {
      since: position.validTo,
      lapsedByDays: position.lapsedByDays,
      detail: LAPSED_IS_OPERATING_UNREGISTERED,
    });
  }

  if (
    position.state === REGISTRATION_STATE.CURRENT &&
    !position.perpetual &&
    position.daysRemaining !== undefined &&
    position.daysRemaining !== null &&
    position.daysRemaining <= 90
  ) {
    add(FINDING.RENEWAL_DUE, {
      validTo: position.validTo,
      daysRemaining: position.daysRemaining,
      detail: `The certificate expires in ${position.daysRemaining} days. There is no notice from the department, and an establishment operating on a lapsed certificate is operating unregistered.`,
    });
  }

  const amendments = amendmentsDue({ ...particulars, rules, asAt });

  for (const amendment of amendments) {
    add(amendment.overdue ? FINDING.AMENDMENT_OVERDUE : FINDING.AMENDMENT_DUE, {
      particular: amendment.particular,
      onCertificate: amendment.onCertificate,
      current: amendment.current,
      changedOn: amendment.changedOn,
      notifyBy: amendment.notifyBy,
      daysRemaining: amendment.daysRemaining,
      overdueByDays: amendment.overdueByDays,
      detail:
        amendment.particular === PARTICULAR.HEADCOUNT_BAND
          ? 'The employee count on the certificate is banded, so an ordinary hire crossed a band and started the clock. Nothing in the hiring flow raises this.'
          : 'The certificate no longer matches the establishment, and the clock runs from the date the particular changed rather than from today.',
    });
  }

  const weeklyHoliday = weeklyHolidayPosition({
    closingDay: registration.closingDay,
    shifts,
    rules,
  });

  for (const date of weeklyHoliday.tradedOnClosedDay || []) {
    add(FINDING.TRADED_ON_CLOSED_DAY, {
      date,
      detail:
        'A shift is rostered on the day the establishment is notified as closed. The roster is not moved by this module; the position is reported.',
    });
  }

  for (const row of weeklyHoliday.employeesWithoutAWholeDay || []) {
    add(FINDING.WEEKLY_HOLIDAY_NOT_GIVEN, {
      employeeId: row.employeeId,
      weekStarting: row.weekStarting,
      detail: WEEKLY_HOLIDAY_IS_TWO_TESTS,
    });
  }

  for (const shift of hoursBreaches({ shifts, rules })) {
    add(FINDING.OUTSIDE_NOTIFIED_HOURS, {
      employeeId: shift.employeeId,
      date: toUtcDate(shift.date),
      startHour: shift.startHour,
      endHour: shift.endHour,
      detail: `The notified hours are ${rules.openingHour}:00 to ${rules.closingHour}:00.`,
    });
  }

  for (const engagement of nightEngagements) {
    const night = nightWorkPosition({ engagement, rules });
    if (night.applicable && !night.met) {
      add(FINDING.NIGHT_WORK_CONDITIONS_NOT_MET, {
        employeeId: engagement.employeeId,
        date: toUtcDate(engagement.date),
        unmet: night.unmet,
        detail:
          'Every condition is required together. Consent without transport, or transport without the minimum group, is a breach with one box ticked rather than a partial compliance.',
      });
    }
  }

  const closure = closurePosition({ ...registration, rules, asAt });

  if (closure && !closure.satisfied) {
    add(FINDING.CLOSURE_NOT_INTIMATED, {
      closedOn: closure.closedOn,
      dueBy: closure.dueBy,
      daysRemaining: closure.daysRemaining,
      detail:
        'An employer who simply stops filing stays on the register, stays inspectable and keeps accruing. Closure is an obligation rather than the absence of one.',
    });
  }

  return {
    state,
    rules,
    registration: position,
    amendments,
    weeklyHoliday,
    closure,
    // Reported rather than reconciled. #1702 keeps the Factories Act ceilings,
    // and where an establishment is covered by both these are separate
    // obligations under separate Acts rather than one to be netted off.
    alsoCoveredByFactoriesAct,
    findings,
    severityCounts: {
      BREACH: findings.filter((f) => f.severity === SEVERITY.BREACH).length,
      DUE: findings.filter((f) => f.severity === SEVERITY.DUE).length,
      INFORMATIONAL: findings.filter(
        (f) => f.severity === SEVERITY.INFORMATIONAL,
      ).length,
    },
    notes: {
      lapsedIsOperatingUnregistered: LAPSED_IS_OPERATING_UNREGISTERED,
      weeklyHolidayIsTwoTests: WEEKLY_HOLIDAY_IS_TWO_TESTS,
    },
  };
}

module.exports = {
  STATE_RULES,
  PARTICULAR,
  REGISTRATION_STATE,
  FINDING,
  FINDING_AUTHORITY,
  FINDING_SEVERITY,
  SEVERITY,
  LAPSED_IS_OPERATING_UNREGISTERED,
  WEEKLY_HOLIDAY_IS_TWO_TESTS,
  toUtcDate,
  addDays,
  addYears,
  daysBetween,
  resolveRules,
  headcountBand,
  registrationPosition,
  amendmentsDue,
  weeklyHolidayPosition,
  hoursBreaches,
  nightWorkPosition,
  closurePosition,
  assessEstablishment,
};
