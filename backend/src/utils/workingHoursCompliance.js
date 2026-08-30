/**
 * Working hours compliance (#1702).
 *
 * `attendance.model.js` records punches and `payroll.model.js` pays for the
 * overtime hours. Between recording the hours and paying for them, nothing asked
 * whether the hours were **lawful**.
 *
 * The Factories Act, 1948 and the state Shops and Establishments Acts do not set
 * one limit, they set six, and an employer can satisfy any five while breaching
 * the sixth. The one nothing catches is the spread-over: a split shift of four
 * hours in the morning and four in the evening is eight hours of work and
 * entirely lawful by sections 51 and 54, and if it starts at 07:00 and ends at
 * 20:00 it is a thirteen-hour spread-over and an offence.
 *
 * Four of the six cannot be checked at the point of entry, which is why this
 * runs over a period rather than validating a punch: the weekly total is not
 * knowable on Tuesday, the quarterly overtime ceiling is not knowable in week
 * three, and the ten-consecutive-day rule depends on days that have not happened
 * yet.
 *
 * Pure functions, no database access.
 */

const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = 3600000;

/**
 * The Factories Act limits, as the default rule set.
 *
 * Held as a rule set rather than as literals in the comparison because the
 * state Shops and Establishments Acts differ — nine hours a day and forty-eight
 * a week in most, ten and a half in a few, and the spread-over varies. An
 * establishment carries its own; these are what it falls back to.
 */
const FACTORIES_ACT_LIMITS = {
  /** Section 54. */
  maxDailyHours: 9,
  /** Section 51. */
  maxWeeklyHours: 48,
  /** Section 56 — first in to last out, intervals included. */
  maxSpreadOverHours: 10.5,
  /** Section 55 — no continuous stretch longer than this without a break. */
  maxContinuousHours: 5,
  /** Section 55 — and the break has to be at least this long. */
  minIntervalMinutes: 30,
  /** Section 64(4)(iv) — the weekly ceiling once overtime is counted. */
  maxWeeklyHoursWithOvertime: 60,
  /** Section 65(3)(iv) — overtime in any quarter. */
  maxQuarterlyOvertimeHours: 50,
  /** Section 52 — and the substituted holiday window, in days either side. */
  substitutionWindowDays: 3,
  /** Section 52 proviso — days that may be worked consecutively. */
  maxConsecutiveDays: 10,
  /** Section 59 — overtime at twice the ordinary rate. */
  overtimeMultiplier: 2,
  /** Section 66 — the window women may not work in, absent an exemption. */
  nightHoursStart: 19,
  nightHoursEnd: 6,
  /** The day the establishment's week starts on. 0 = Sunday. */
  weekStartsOn: 1,
};

/** What a finding is about. */
const FINDING = {
  DAILY_HOURS: 'DAILY_HOURS',
  WEEKLY_HOURS: 'WEEKLY_HOURS',
  SPREAD_OVER: 'SPREAD_OVER',
  REST_INTERVAL: 'REST_INTERVAL',
  WEEKLY_HOURS_WITH_OVERTIME: 'WEEKLY_HOURS_WITH_OVERTIME',
  QUARTERLY_OVERTIME: 'QUARTERLY_OVERTIME',
  WEEKLY_HOLIDAY: 'WEEKLY_HOLIDAY',
  CONSECUTIVE_DAYS: 'CONSECUTIVE_DAYS',
  NIGHT_HOURS: 'NIGHT_HOURS',
  OVERTIME_UNDERPAID: 'OVERTIME_UNDERPAID',
};

const FINDING_SECTION = {
  [FINDING.DAILY_HOURS]: 'section 54',
  [FINDING.WEEKLY_HOURS]: 'section 51',
  [FINDING.SPREAD_OVER]: 'section 56',
  [FINDING.REST_INTERVAL]: 'section 55',
  [FINDING.WEEKLY_HOURS_WITH_OVERTIME]: 'section 64(4)(iv)',
  [FINDING.QUARTERLY_OVERTIME]: 'section 65(3)(iv)',
  [FINDING.WEEKLY_HOLIDAY]: 'section 52',
  [FINDING.CONSECUTIVE_DAYS]: 'section 52, proviso',
  [FINDING.NIGHT_HOURS]: 'section 66(1)(b)',
  [FINDING.OVERTIME_UNDERPAID]: 'section 59',
};

const SEVERITY = {
  BREACH: 'BREACH',
  UNDERPAYMENT: 'UNDERPAYMENT',
  INFORMATIONAL: 'INFORMATIONAL',
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
 * Merge the limits an establishment declares over the statutory defaults.
 *
 * @param {object} [limits]
 * @returns {object}
 */
function resolveLimits(limits) {
  return { ...FACTORIES_ACT_LIMITS, ...(limits || {}) };
}

/**
 * Build a finding.
 *
 * @param {string} code
 * @param {string} detail
 * @param {object} [extra]
 * @returns {object}
 */
function finding(code, detail, extra = {}) {
  return {
    code,
    section: FINDING_SECTION[code],
    severity: extra.severity || SEVERITY.BREACH,
    detail,
    ...extra,
  };
}

/**
 * Sessions sorted by clock-in, with the open ones dropped.
 *
 * An open session — somebody still clocked in, or a punch nobody closed — has no
 * duration and cannot be assessed. Dropped rather than treated as running to
 * midnight, which would manufacture a spread-over breach out of a missing punch.
 *
 * @param {Array<object>} sessions
 * @returns {Array<{from: Date, to: Date, hours: number}>}
 */
function usableSessions(sessions) {
  return (sessions || [])
    .filter((session) => session && session.clockIn && session.clockOut)
    .map((session) => {
      const from = new Date(session.clockIn);
      const to = new Date(session.clockOut);

      return {
        from,
        to,
        hours: (to.getTime() - from.getTime()) / MS_PER_HOUR,
      };
    })
    .filter(
      (session) =>
        !Number.isNaN(session.from.getTime()) &&
        !Number.isNaN(session.to.getTime()) &&
        session.hours > 0,
    )
    .sort((a, b) => a.from - b.from);
}

/**
 * Evaluate one day.
 *
 * Sections 54, 55 and 56 are all daily and all measured differently:
 *
 *   - hours worked is the sum of the sessions;
 *   - spread-over is first in to last out, intervals included;
 *   - the continuous stretch is the longest run of sessions separated by gaps
 *     shorter than the statutory interval.
 *
 * That third one is why a break has both a position and a length: two four-hour
 * sessions separated by ten minutes is an eight-hour continuous stretch, not two
 * lawful ones, because a ten-minute gap is not a section 55 interval.
 *
 * @param {object} input
 * @param {Date|string} input.date
 * @param {Array<object>} input.sessions
 * @param {number} [input.overtimeHours]
 * @param {object} [input.limits]
 * @param {boolean} [input.nightHoursExempt]
 * @param {boolean} [input.nightHoursRestricted] whether section 66 applies
 * @returns {object}
 */
function evaluateDay({
  date,
  sessions,
  overtimeHours = 0,
  limits,
  nightHoursExempt = false,
  nightHoursRestricted = false,
}) {
  const rules = resolveLimits(limits);
  const usable = usableSessions(sessions);

  const day = new Date(date);
  const dayLabel = Number.isNaN(day.getTime())
    ? ''
    : day.toISOString().slice(0, 10);

  if (!usable.length) {
    return {
      date: day,
      worked: false,
      hoursWorked: 0,
      spreadOverHours: 0,
      longestContinuousHours: 0,
      intervals: [],
      overtimeHours: round2(toNumber(overtimeHours)),
      findings: [],
    };
  }

  const hoursWorked = round2(
    usable.reduce((sum, session) => sum + session.hours, 0),
  );

  const spreadOverHours = round2(
    (usable[usable.length - 1].to.getTime() - usable[0].from.getTime()) /
      MS_PER_HOUR,
  );

  const intervals = [];
  let longestContinuous = usable[0].hours;
  let running = usable[0].hours;

  for (let i = 1; i < usable.length; i += 1) {
    const gapMinutes =
      ((usable[i].from.getTime() - usable[i - 1].to.getTime()) / MS_PER_HOUR) *
      MINUTES_PER_HOUR;

    intervals.push({
      after: usable[i - 1].to,
      minutes: round2(gapMinutes),
      qualifies: gapMinutes >= rules.minIntervalMinutes,
    });

    if (gapMinutes >= rules.minIntervalMinutes) {
      running = usable[i].hours;
    } else {
      // Too short to be a section 55 interval, so the two sessions are one
      // continuous stretch.
      running += usable[i].hours;
    }

    longestContinuous = Math.max(longestContinuous, running);
  }

  const findings = [];

  if (hoursWorked > rules.maxDailyHours) {
    findings.push(
      finding(
        FINDING.DAILY_HOURS,
        `${round2(hoursWorked)} hours worked on ${dayLabel}, against a daily limit of ${rules.maxDailyHours}`,
        { date: day, hours: hoursWorked, limit: rules.maxDailyHours },
      ),
    );
  }

  if (spreadOverHours > rules.maxSpreadOverHours) {
    findings.push(
      finding(
        FINDING.SPREAD_OVER,
        `${spreadOverHours} hours from first clock-in to last clock-out on ${dayLabel}, against a spread-over limit of ${rules.maxSpreadOverHours} — the hours worked may well be lawful, the spread is not`,
        { date: day, hours: spreadOverHours, limit: rules.maxSpreadOverHours },
      ),
    );
  }

  if (round2(longestContinuous) > rules.maxContinuousHours) {
    findings.push(
      finding(
        FINDING.REST_INTERVAL,
        `${round2(longestContinuous)} hours worked continuously on ${dayLabel} without an interval of at least ${rules.minIntervalMinutes} minutes`,
        {
          date: day,
          hours: round2(longestContinuous),
          limit: rules.maxContinuousHours,
        },
      ),
    );
  }

  // Section 66 applies to a defined population and only where the state has not
  // granted an exemption. Where one has been granted the shift is reported as
  // informational rather than suppressed — the exemptions carry conditions
  // (transport, a minimum group size, consent) and those are what get
  // inspected, so the fact that such a shift happened is worth surfacing.
  if (nightHoursRestricted) {
    // Fractional hours rather than `getUTCHours()`. A shift ending at 19:30 has
    // an hour component of 19, so a whole-hour comparison against a window
    // starting at 19:00 misses the half hour that is actually inside it.
    const hourOf = (date) =>
      date.getUTCHours() + date.getUTCMinutes() / MINUTES_PER_HOUR;

    // The window is [19:00, 06:00), so a session overlaps it when it *starts*
    // inside it or *ends* past its opening. Both ends are tested because a shift
    // can enter the window from either side, and the two boundaries are not
    // symmetrical: a shift ending at exactly 19:00 never worked inside the
    // window, while one ending at exactly 06:00 worked right up to it.
    const inNightWindow = usable.some((session) => {
      const from = hourOf(session.from);
      const to = hourOf(session.to);

      return (
        from >= rules.nightHoursStart ||
        from < rules.nightHoursEnd ||
        to > rules.nightHoursStart ||
        to <= rules.nightHoursEnd
      );
    });

    if (inNightWindow) {
      findings.push(
        finding(
          FINDING.NIGHT_HOURS,
          nightHoursExempt
            ? `work between ${rules.nightHoursStart}:00 and ${rules.nightHoursEnd}:00 on ${dayLabel} under a state exemption — the exemption's conditions on transport, group size and consent are what an inspection asks about`
            : `work between ${rules.nightHoursStart}:00 and ${rules.nightHoursEnd}:00 on ${dayLabel} with no state exemption on record`,
          {
            date: day,
            severity: nightHoursExempt
              ? SEVERITY.INFORMATIONAL
              : SEVERITY.BREACH,
          },
        ),
      );
    }
  }

  return {
    date: day,
    worked: true,
    hoursWorked,
    spreadOverHours,
    longestContinuousHours: round2(longestContinuous),
    intervals,
    overtimeHours: round2(toNumber(overtimeHours)),
    findings,
  };
}

/**
 * The start of the week a date falls in, for an establishment's week start.
 *
 * Assuming Monday would move every boundary for an establishment whose week
 * starts on Sunday, and a forty-eight-hour week measured over the wrong seven
 * days is a different number.
 *
 * @param {Date} date
 * @param {number} weekStartsOn 0 = Sunday
 * @returns {Date}
 */
function startOfWeek(date, weekStartsOn) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const shift = (start.getUTCDay() - weekStartsOn + 7) % 7;
  start.setUTCDate(start.getUTCDate() - shift);

  return start;
}

/**
 * Group evaluated days into the establishment's weeks.
 *
 * @param {Array<object>} days
 * @param {object} rules
 * @returns {Array<object>}
 */
function groupIntoWeeks(days, rules) {
  const weeks = new Map();

  for (const day of days) {
    if (Number.isNaN(day.date.getTime())) continue;

    const start = startOfWeek(day.date, rules.weekStartsOn);
    const key = start.toISOString().slice(0, 10);

    if (!weeks.has(key)) weeks.set(key, { weekStart: start, days: [] });
    weeks.get(key).days.push(day);
  }

  return [...weeks.values()].sort((a, b) => a.weekStart - b.weekStart);
}

/**
 * Sections 51, 64(4)(iv) and 52, per week.
 *
 * The two hour ceilings are separate limits rather than one with an allowance:
 * forty-eight is the ordinary week, sixty is the ceiling *including* overtime,
 * and a week of fifty-two ordinary hours breaches the first without approaching
 * the second.
 *
 * @param {object} week
 * @param {object} rules
 * @param {Array<object>} [surroundingDays] every evaluated day, for the section
 *   52 substitution window, which reaches outside the week by definition
 * @returns {object}
 */
function evaluateWeek(week, rules, surroundingDays) {
  const ordinaryHours = round2(
    week.days.reduce((sum, day) => sum + day.hoursWorked, 0),
  );
  const overtimeHours = round2(
    week.days.reduce((sum, day) => sum + day.overtimeHours, 0),
  );
  const totalHours = round2(ordinaryHours + overtimeHours);

  const weekLabel = week.weekStart.toISOString().slice(0, 10);
  const findings = [];

  if (ordinaryHours > rules.maxWeeklyHours) {
    findings.push(
      finding(
        FINDING.WEEKLY_HOURS,
        `${ordinaryHours} hours in the week beginning ${weekLabel}, against a weekly limit of ${rules.maxWeeklyHours}`,
        { weekStart: week.weekStart, hours: ordinaryHours },
      ),
    );
  }

  if (totalHours > rules.maxWeeklyHoursWithOvertime) {
    findings.push(
      finding(
        FINDING.WEEKLY_HOURS_WITH_OVERTIME,
        `${totalHours} hours including overtime in the week beginning ${weekLabel}, against a ceiling of ${rules.maxWeeklyHoursWithOvertime}`,
        { weekStart: week.weekStart, hours: totalHours },
      ),
    );
  }

  // Section 52 is measured on the week rather than on a rolling seven days: the
  // Act gives a weekly holiday in each week.
  //
  // A week with every day worked is not automatically a breach, which is the
  // part that needs the surrounding days. Section 52(1) allows the holiday to be
  // substituted by one of the three days immediately before or after, so a
  // seven-day week is compliant when a rest day falls inside that window on
  // either side. Reporting one without looking would be asserting a breach the
  // Act expressly permits.
  //
  // A substitution needs a *recorded* rest day. Seven recorded days all worked
  // is evidence that the week had no holiday; days that were never recorded are
  // not evidence that one was substituted, so the finding stands. That is the
  // opposite direction from the consecutive-days rule below, and deliberately:
  // in both cases the engine asserts only from what the ledger actually says.
  const workedDays = week.days.filter((day) => day.worked).length;

  let substituted = false;

  if (workedDays >= 7) {
    const windowMs = rules.substitutionWindowDays * 86400000;
    const weekEnd = new Date(week.weekStart.getTime() + 6 * 86400000);

    substituted = (surroundingDays || []).some((day) => {
      if (day.worked || Number.isNaN(day.date.getTime())) return false;

      const beforeGap = week.weekStart.getTime() - day.date.getTime();
      const afterGap = day.date.getTime() - weekEnd.getTime();

      return (
        (beforeGap > 0 && beforeGap <= windowMs) ||
        (afterGap > 0 && afterGap <= windowMs)
      );
    });

    if (!substituted) {
      findings.push(
        finding(
          FINDING.WEEKLY_HOLIDAY,
          `every day worked in the week beginning ${weekLabel}, with no weekly holiday and no substituted one inside the ${rules.substitutionWindowDays} days either side`,
          { weekStart: week.weekStart },
        ),
      );
    }
  }

  return {
    weekStart: week.weekStart,
    ordinaryHours,
    overtimeHours,
    totalHours,
    workedDays,
    holidaySubstituted: substituted,
    findings,
  };
}

/**
 * The section 52 proviso: not more than ten days worked consecutively.
 *
 * Separate from and stricter than "one day off a week". An employee off on the
 * Monday of one week and the Sunday of the next has a holiday in each week and
 * has still worked twelve days in a row, which the weekly test cannot see
 * because it never looks across a boundary.
 *
 * @param {Array<object>} days
 * @param {object} rules
 * @returns {Array<object>}
 */
function evaluateConsecutiveDays(days, rules) {
  const sorted = [...days]
    .filter((day) => !Number.isNaN(day.date.getTime()))
    .sort((a, b) => a.date - b.date);

  const findings = [];

  let run = 0;
  let runStart = null;

  const flush = (endDate) => {
    if (run > rules.maxConsecutiveDays) {
      findings.push(
        finding(
          FINDING.CONSECUTIVE_DAYS,
          `${run} days worked consecutively from ${runStart
            .toISOString()
            .slice(
              0,
              10,
            )} to ${endDate.toISOString().slice(0, 10)}, against a limit of ${rules.maxConsecutiveDays}`,
          { from: runStart, to: endDate, days: run },
        ),
      );
    }
  };

  let previous = null;

  for (const day of sorted) {
    if (!day.worked) {
      if (run > 0 && previous) flush(previous);
      run = 0;
      runStart = null;
      previous = day.date;
      continue;
    }

    // A gap in the record breaks the run rather than extending it. Missing days
    // are missing evidence, and asserting a twelve-day run across a fortnight
    // nobody recorded would be a finding built out of absence.
    const contiguous =
      previous && Math.round((day.date - previous) / 86400000) === 1;

    if (run === 0 || !contiguous) {
      if (run > 0 && previous) flush(previous);
      run = 1;
      runStart = day.date;
    } else {
      run += 1;
    }

    previous = day.date;
  }

  if (run > 0 && previous) flush(previous);

  return findings;
}

/**
 * Section 65(3)(iv): overtime in a quarter.
 *
 * A running total across thirteen weeks, which is the point — the ceiling
 * cannot be seen from any single week, and the fact an inspection asks for is
 * the date it was crossed rather than the total at the end.
 *
 * @param {Array<object>} days
 * @param {object} rules
 * @returns {object}
 */
function evaluateQuarterlyOvertime(days, rules) {
  const byQuarter = new Map();

  const sorted = [...days]
    .filter((day) => !Number.isNaN(day.date.getTime()))
    .sort((a, b) => a.date - b.date);

  for (const day of sorted) {
    const quarter = `${day.date.getUTCFullYear()}-Q${Math.floor(day.date.getUTCMonth() / 3) + 1}`;

    const bucket = byQuarter.get(quarter) || {
      quarter,
      overtimeHours: 0,
      crossedOn: null,
    };

    const before = bucket.overtimeHours;
    bucket.overtimeHours = round2(before + day.overtimeHours);

    if (
      !bucket.crossedOn &&
      before <= rules.maxQuarterlyOvertimeHours &&
      bucket.overtimeHours > rules.maxQuarterlyOvertimeHours
    ) {
      bucket.crossedOn = day.date;
    }

    byQuarter.set(quarter, bucket);
  }

  const quarters = [...byQuarter.values()];

  const findings = quarters
    .filter((bucket) => bucket.overtimeHours > rules.maxQuarterlyOvertimeHours)
    .map((bucket) =>
      finding(
        FINDING.QUARTERLY_OVERTIME,
        `${bucket.overtimeHours} overtime hours in ${bucket.quarter}, against a quarterly ceiling of ${rules.maxQuarterlyOvertimeHours} — crossed on ${
          bucket.crossedOn
            ? bucket.crossedOn.toISOString().slice(0, 10)
            : 'a day in the quarter'
        }`,
        {
          quarter: bucket.quarter,
          hours: bucket.overtimeHours,
          crossedOn: bucket.crossedOn,
        },
      ),
    );

  return { quarters, findings };
}

/**
 * Section 59: overtime at twice the ordinary rate.
 *
 * The ordinary rate includes allowances and excludes bonus and overtime itself,
 * which is why it is passed in rather than derived from a salary field — the
 * caller knows which components count and this does not.
 *
 * Unlawful overtime is still payable. Section 59 does not stop applying because
 * section 64 was breached, and an engine that refused to price unlawful hours
 * would under-pay the employee to flatter the employer.
 *
 * @param {object} input
 * @param {number} input.overtimeHours
 * @param {number} input.ordinaryHourlyRate
 * @param {number} input.paid
 * @param {object} [input.limits]
 * @returns {object}
 */
function overtimeEntitlement({
  overtimeHours,
  ordinaryHourlyRate,
  paid,
  limits,
}) {
  const rules = resolveLimits(limits);

  const hours = Math.max(0, toNumber(overtimeHours));
  const rate = Math.max(0, toNumber(ordinaryHourlyRate));

  const entitlement = round2(hours * rate * rules.overtimeMultiplier);
  const actuallyPaid = round2(toNumber(paid));
  const shortfall = round2(Math.max(0, entitlement - actuallyPaid));

  const findings = shortfall
    ? [
        finding(
          FINDING.OVERTIME_UNDERPAID,
          `${round2(hours)} overtime hours entitle ${entitlement} at twice the ordinary rate of ${round2(rate)} an hour; ${actuallyPaid} was paid`,
          { severity: SEVERITY.UNDERPAYMENT, amount: shortfall },
        ),
      ]
    : [];

  return {
    hours: round2(hours),
    ordinaryHourlyRate: round2(rate),
    multiplier: rules.overtimeMultiplier,
    entitlement,
    paid: actuallyPaid,
    shortfall,
    findings,
  };
}

/**
 * Assess one employee over a period.
 *
 * @param {object} input
 * @param {object} input.employee
 * @param {Array<object>} input.days raw days: {date, sessions, overtimeHours}
 * @param {object} [input.limits]
 * @returns {object}
 */
function assessEmployee({ employee, days, limits }) {
  const rules = resolveLimits(limits);

  const evaluated = (days || []).map((day) =>
    evaluateDay({
      date: day.date,
      sessions: day.sessions,
      overtimeHours: day.overtimeHours,
      limits: rules,
      nightHoursExempt: employee.nightHoursExempt,
      nightHoursRestricted: employee.nightHoursRestricted,
    }),
  );

  const weeks = groupIntoWeeks(evaluated, rules).map((week) =>
    evaluateWeek(week, rules, evaluated),
  );

  const consecutiveFindings = evaluateConsecutiveDays(evaluated, rules);
  const quarterly = evaluateQuarterlyOvertime(evaluated, rules);

  const overtimeHours = round2(
    evaluated.reduce((sum, day) => sum + day.overtimeHours, 0),
  );

  const overtime = overtimeEntitlement({
    overtimeHours,
    ordinaryHourlyRate: employee.ordinaryHourlyRate,
    paid: employee.overtimePaid,
    limits: rules,
  });

  const findings = [
    ...evaluated.flatMap((day) => day.findings),
    ...weeks.flatMap((week) => week.findings),
    ...consecutiveFindings,
    ...quarterly.findings,
    ...overtime.findings,
  ].map((entry) => ({
    ...entry,
    employeeId: employee.employeeId,
    employeeName: employee.name || '',
  }));

  return {
    employeeId: employee.employeeId,
    name: employee.name || '',
    designation: employee.designation || '',

    daysWorked: evaluated.filter((day) => day.worked).length,
    hoursWorked: round2(
      evaluated.reduce((sum, day) => sum + day.hoursWorked, 0),
    ),
    overtimeHours,

    days: evaluated,
    weeks,
    quarters: quarterly.quarters,
    overtime,

    findings,
    breachCount: findings.filter((f) => f.severity === SEVERITY.BREACH).length,
  };
}

/**
 * Assess a workforce over a period.
 *
 * @param {object} input
 * @param {Array<object>} input.employees
 * @param {object} [input.limits]
 * @param {Date|string} [input.periodStart]
 * @param {Date|string} [input.periodEnd]
 * @returns {object}
 */
function assessPeriod({ employees, limits, periodStart, periodEnd }) {
  const rules = resolveLimits(limits);

  const assessed = (employees || []).map((entry) =>
    assessEmployee({
      employee: entry.employee || entry,
      days: entry.days || [],
      limits: rules,
    }),
  );

  const allFindings = assessed.flatMap((result) => result.findings);

  // Grouped by section rather than listed flat. A hundred spread-over findings
  // across one shift pattern is one problem, and a flat list makes it look like
  // a hundred.
  const bySection = new Map();
  for (const entry of allFindings) {
    const bucket = bySection.get(entry.code) || {
      code: entry.code,
      section: entry.section,
      severity: entry.severity,
      count: 0,
      employees: new Set(),
    };

    bucket.count += 1;
    bucket.employees.add(String(entry.employeeId));
    bySection.set(entry.code, bucket);
  }

  return {
    periodStart: periodStart ? new Date(periodStart) : null,
    periodEnd: periodEnd ? new Date(periodEnd) : null,
    limits: rules,

    employees: assessed,
    assessedCount: assessed.length,

    findings: allFindings,
    breachCount: allFindings.filter((f) => f.severity === SEVERITY.BREACH)
      .length,
    overtimeShortfall: round2(
      assessed.reduce((sum, result) => sum + result.overtime.shortfall, 0),
    ),

    bySection: [...bySection.values()]
      .map((bucket) => ({
        code: bucket.code,
        section: bucket.section,
        severity: bucket.severity,
        count: bucket.count,
        employeeCount: bucket.employees.size,
      }))
      .sort((a, b) => b.count - a.count),

    compliant: allFindings.length === 0,
  };
}

module.exports = {
  FACTORIES_ACT_LIMITS,
  FINDING,
  FINDING_SECTION,
  SEVERITY,

  resolveLimits,
  usableSessions,
  startOfWeek,
  evaluateDay,
  groupIntoWeeks,
  evaluateWeek,
  evaluateConsecutiveDays,
  evaluateQuarterlyOvertime,
  overtimeEntitlement,
  assessEmployee,
  assessPeriod,
};
