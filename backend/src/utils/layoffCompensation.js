/**
 * Industrial Disputes Act, 1947, Chapters VA and VB (#1830).
 *
 * `severanceCalculator.service.js` implements section 25F — fifteen days'
 * average pay per completed year, at basic ÷ 26. That is retrenchment, and it
 * is one of four things these chapters govern. The other three are missing, and
 * the largest of them is not a payment calculation at all.
 *
 * **Lay-off is not retrenchment with a smaller number.** The employment
 * subsists. Section 25C pays fifty per cent of basic and dearness allowance for
 * every day of lay-off other than weekly holidays, to a workman with one year
 * of continuous service, subject to **forty-five days in any period of twelve
 * months** — a rolling window, so it cannot be answered from the current
 * lay-off alone.
 *
 * **The payable figure is not `days × rate`.** Section 25E removes the
 * entitlement for days where the workman refused alternative employment at the
 * same establishment, failed to present themselves, or was laid off because of
 * a strike or slow-down elsewhere in the establishment. So it is
 * `days × rate`, net of disentitled days with a reason recorded against each,
 * capped, in that order.
 *
 * **Chapter VB makes lawfulness the question rather than the amount.** Above
 * the state's threshold — one hundred workmen centrally, three hundred in the
 * states that amended it — sections 25M, 25N and 25-O require prior permission.
 * Without it the act is illegal, the workmen are **deemed not to have been laid
 * off or retrenched**, and they are entitled to all wages and benefits *as if
 * they had continued*. That is an entirely different quantity from
 * compensation, and a single figure that could be either would be the most
 * dangerous number in this product — so it is never returned as one.
 *
 * Everything turns on **section 25B**: 240 days in the preceding twelve months
 * (190 below ground in a mine), counting lay-off days, authorised leave,
 * maternity leave to twelve weeks and days of a legal strike as service. There
 * is an attendance ledger in this product and no 25B counter, so this is one
 * function everything else calls.
 *
 * Pure functions, no database access.
 */

const WEEKS_TO_DAYS = 7;

/**
 * The central Act's figures, as the default rule set.
 *
 * The Chapter VB threshold is the one that is not optional to override. Several
 * states have raised it to three hundred, and the difference decides whether an
 * act is a compensable retrenchment or an illegal one — a wrong constant does
 * not produce a wrong number, it produces the wrong *kind* of answer.
 */
const LAYOFF_RULES = {
  /** Section 25B(2) — days of service in the lookback. */
  continuousServiceDays: 240,
  /** And below ground in a mine. */
  mineContinuousServiceDays: 190,
  lookbackMonths: 12,

  /** Section 25C — of basic and dearness allowance. */
  layoffPercent: 50,
  /** Section 25C proviso — days in any twelve months. */
  layoffCeilingDays: 45,
  ceilingWindowMonths: 12,

  /** Sections 25M, 25N and 25-O — workmen, above which permission is required. */
  chapterVBThreshold: 100,
  /** Section 25N(1)(a) — notice, in months. */
  chapterVBNoticeMonths: 3,

  /** Section 25F(b) — days of average pay per completed year. */
  retrenchmentDaysPerYear: 15,
  /** Section 25FFF proviso — the cap, in months of average pay. */
  closureCapMonths: 3,

  /** Section 25B — maternity leave counts as service, to this many weeks. */
  maternityLeaveWeeksCounted: 12,

  /** The statutory divisor for a day's average pay. */
  daysPerMonth: 26,
};

/**
 * What a day in the lookback was, for section 25B.
 *
 * Named because the counting rule is counter-intuitive in both directions: a
 * day of *lay-off* counts toward the service that qualifies for lay-off
 * compensation, and a day of legal strike counts too. Deriving 25B from an
 * attendance ledger's present/absent would fail on both.
 */
const SERVICE_DAY = {
  WORKED: 'WORKED',
  /** Counts. Section 25B(2)(a)(ii). */
  LAYOFF: 'LAYOFF',
  /** Counts. Leave with wages. */
  AUTHORISED_LEAVE: 'AUTHORISED_LEAVE',
  /** Counts, to the statutory cap. */
  MATERNITY_LEAVE: 'MATERNITY_LEAVE',
  /** Counts, where the strike was legal. */
  LEGAL_STRIKE: 'LEGAL_STRIKE',
  /** Does not count. */
  ABSENT: 'ABSENT',
  /** Does not count. */
  ILLEGAL_STRIKE: 'ILLEGAL_STRIKE',
  /** Does not count, and does not attract compensation either. */
  WEEKLY_HOLIDAY: 'WEEKLY_HOLIDAY',
};

/** Which kinds count toward the 240 (or 190). */
const COUNTS_AS_SERVICE = {
  [SERVICE_DAY.WORKED]: true,
  [SERVICE_DAY.LAYOFF]: true,
  [SERVICE_DAY.AUTHORISED_LEAVE]: true,
  [SERVICE_DAY.MATERNITY_LEAVE]: true,
  [SERVICE_DAY.LEGAL_STRIKE]: true,
  [SERVICE_DAY.ABSENT]: false,
  [SERVICE_DAY.ILLEGAL_STRIKE]: false,
  [SERVICE_DAY.WEEKLY_HOLIDAY]: false,
};

/**
 * Section 25E — why a laid-off day carries no compensation.
 *
 * These are findings about conduct rather than leave-type codes, which is why
 * lay-off cannot be modelled as a leave balance.
 */
const DISENTITLEMENT = {
  /** Section 25E(i) — alternative employment at the same establishment. */
  REFUSED_ALTERNATIVE_EMPLOYMENT: 'REFUSED_ALTERNATIVE_EMPLOYMENT',
  /** Section 25E(ii) — did not present themselves at the appointed time. */
  FAILED_TO_PRESENT: 'FAILED_TO_PRESENT',
  /** Section 25E(iii) — a strike or slow-down in another part. */
  STRIKE_ELSEWHERE_IN_ESTABLISHMENT: 'STRIKE_ELSEWHERE_IN_ESTABLISHMENT',
};

const DISENTITLEMENT_LABEL = {
  [DISENTITLEMENT.REFUSED_ALTERNATIVE_EMPLOYMENT]:
    'Refused alternative employment at the same establishment',
  [DISENTITLEMENT.FAILED_TO_PRESENT]: 'Did not present at the appointed time',
  [DISENTITLEMENT.STRIKE_ELSEWHERE_IN_ESTABLISHMENT]:
    'Lay-off caused by a strike or slow-down elsewhere in the establishment',
};

/** What the employer did. Chapter VB gates all three. */
const ACTION = {
  LAYOFF: 'LAYOFF',
  RETRENCHMENT: 'RETRENCHMENT',
  CLOSURE: 'CLOSURE',
};

const ACTION_SECTION = {
  [ACTION.LAYOFF]: 'section 25M',
  [ACTION.RETRENCHMENT]: 'section 25N',
  [ACTION.CLOSURE]: 'section 25-O',
};

/** Where the prior permission stands. */
const PERMISSION_STATE = {
  /** Below the Chapter VB threshold. */
  NOT_REQUIRED: 'NOT_REQUIRED',
  GRANTED: 'GRANTED',
  /** Applied for and refused. The act is illegal if done anyway. */
  REFUSED: 'REFUSED',
  /** Deemed granted where the government did not answer in time. */
  DEEMED_GRANTED: 'DEEMED_GRANTED',
  /** Nobody applied. */
  NOT_SOUGHT: 'NOT_SOUGHT',
};

/**
 * Section 25FFF proviso — grounds that are *not* "unavoidable circumstances
 * beyond the control of the employer", and so do not attract the three-month
 * cap.
 *
 * Listed because they are the grounds most often claimed, and because the
 * proviso's explanation excludes them by name.
 */
const NOT_UNAVOIDABLE = {
  FINANCIAL_DIFFICULTIES: 'FINANCIAL_DIFFICULTIES',
  ACCUMULATION_OF_STOCKS: 'ACCUMULATION_OF_STOCKS',
  EXPIRY_OF_LEASE_OR_LICENCE: 'EXPIRY_OF_LEASE_OR_LICENCE',
};

const FINDING = {
  SERVICE_NOT_QUALIFIED: 'SERVICE_NOT_QUALIFIED',
  CEILING_REACHED: 'CEILING_REACHED',
  CEILING_EXCEEDED: 'CEILING_EXCEEDED',
  DAYS_DISENTITLED: 'DAYS_DISENTITLED',
  PERMISSION_NOT_SOUGHT: 'PERMISSION_NOT_SOUGHT',
  PERMISSION_REFUSED: 'PERMISSION_REFUSED',
  ACT_ILLEGAL: 'ACT_ILLEGAL',
  NOTICE_SHORT: 'NOTICE_SHORT',
  SENIORITY_DEPARTURE: 'SENIORITY_DEPARTURE',
  SENIORITY_DEPARTURE_UNEXPLAINED: 'SENIORITY_DEPARTURE_UNEXPLAINED',
  REEMPLOYMENT_PREFERENCE_DUE: 'REEMPLOYMENT_PREFERENCE_DUE',
  CLOSURE_CAP_NOT_AVAILABLE: 'CLOSURE_CAP_NOT_AVAILABLE',
};

const FINDING_SECTION = {
  [FINDING.SERVICE_NOT_QUALIFIED]: 'section 25B',
  [FINDING.CEILING_REACHED]: 'section 25C proviso',
  [FINDING.CEILING_EXCEEDED]: 'section 25C proviso',
  [FINDING.DAYS_DISENTITLED]: 'section 25E',
  [FINDING.PERMISSION_NOT_SOUGHT]: 'Chapter VB',
  [FINDING.PERMISSION_REFUSED]: 'Chapter VB',
  [FINDING.ACT_ILLEGAL]: 'section 25M(8) / 25N(8)',
  [FINDING.NOTICE_SHORT]: 'section 25N(1)(a)',
  [FINDING.SENIORITY_DEPARTURE]: 'section 25G',
  [FINDING.SENIORITY_DEPARTURE_UNEXPLAINED]: 'section 25G',
  [FINDING.REEMPLOYMENT_PREFERENCE_DUE]: 'section 25H',
  [FINDING.CLOSURE_CAP_NOT_AVAILABLE]: 'section 25FFF proviso',
};

const SEVERITY = {
  BREACH: 'BREACH',
  EXPOSURE: 'EXPOSURE',
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
 * Merge a rule set over the central Act's figures.
 *
 * @param {object} [rules]
 * @returns {object}
 */
function resolveRules(rules) {
  const merged = { ...LAYOFF_RULES, ...(rules || {}) };

  if (!(merged.daysPerMonth > 0))
    merged.daysPerMonth = LAYOFF_RULES.daysPerMonth;
  if (!(merged.chapterVBThreshold > 0)) {
    merged.chapterVBThreshold = LAYOFF_RULES.chapterVBThreshold;
  }

  return merged;
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
    section: FINDING_SECTION[code] || '',
    severity,
    message,
    ...context,
  };
}

/**
 * A day's average pay.
 *
 * Basic and dearness allowance over the statutory twenty-six, which is the
 * divisor Chapter VA works on — not the calendar month `salaryCalculator.js`
 * prorates against.
 *
 * @param {object} wages
 * @param {object} [rules]
 * @returns {number}
 */
function dailyAveragePay(wages, rules) {
  const resolved = resolveRules(rules);

  const monthly =
    Math.max(0, toNumber(wages?.basic)) +
    Math.max(0, toNumber(wages?.dearnessAllowance));

  return round2(monthly / resolved.daysPerMonth);
}

/**
 * Section 25B — continuous service over the preceding twelve months.
 *
 * The qualification gate for everything in these chapters, so it is one
 * function rather than a rule each caller reimplements.
 *
 * Two things make it un-derivable from an attendance ledger. A day of
 * **lay-off** counts toward the service that qualifies for lay-off
 * compensation, and a day of **legal strike** counts too — both read as absence
 * to any present/absent ledger. And maternity leave counts only to the
 * statutory cap, so a longer maternity leave has to be split rather than
 * counted whole.
 *
 * @param {object} params
 * @param {Array<object>} params.days entries of {kind, days}
 * @param {boolean} [params.belowGroundInMine]
 * @param {object} [rules]
 * @returns {object}
 */
function continuousService({ days = [], belowGroundInMine = false }, rules) {
  const resolved = resolveRules(rules);

  const required = belowGroundInMine
    ? resolved.mineContinuousServiceDays
    : resolved.continuousServiceDays;

  const maternityCap = resolved.maternityLeaveWeeksCounted * WEEKS_TO_DAYS;

  const breakdown = {};
  let counted = 0;

  for (const entry of Array.isArray(days) ? days : []) {
    if (!Object.hasOwn(COUNTS_AS_SERVICE, entry?.kind)) continue;

    const raw = Math.max(0, Math.floor(toNumber(entry?.days)));
    breakdown[entry.kind] = (breakdown[entry.kind] || 0) + raw;

    if (!COUNTS_AS_SERVICE[entry.kind]) continue;

    // Maternity leave counts to the cap and no further; the rest of a longer
    // leave is simply not service, rather than not counted at all.
    counted +=
      entry.kind === SERVICE_DAY.MATERNITY_LEAVE
        ? Math.min(raw, maternityCap)
        : raw;
  }

  const findings = [];
  const qualified = counted >= required;

  if (!qualified) {
    findings.push(
      finding(
        FINDING.SERVICE_NOT_QUALIFIED,
        SEVERITY.INFORMATIONAL,
        `${counted} days of service in the lookback against the ${required} section 25B requires${belowGroundInMine ? ' below ground in a mine' : ''}.`,
        { counted, required },
      ),
    );
  }

  return {
    counted,
    required,
    belowGroundInMine: belowGroundInMine === true,
    qualified,
    breakdown,
    maternityCapDays: maternityCap,
    findings,
  };
}

/**
 * Section 25C with 25E — the compensation for a spell of lay-off.
 *
 * `days × rate`, net of disentitled days with a reason against each, then
 * capped at forty-five days across a **rolling** twelve months. In that order:
 * capping first would let a disentitled day consume ceiling a compensable one
 * needed.
 *
 * Weekly holidays are excluded from the compensable days by section 25C itself,
 * so they are taken out before anything else.
 *
 * @param {object} params
 * @param {number} params.laidOffDays
 * @param {number} [params.weeklyHolidays]
 * @param {Array<object>} [params.disentitledDays] entries of {reason, days}
 * @param {number} [params.compensatedDaysInWindow] already paid in the rolling year
 * @param {object} params.wages
 * @param {object} params.service a `continuousService` result
 * @param {object} [rules]
 * @returns {object}
 */
function layoffCompensation(params, rules) {
  const resolved = resolveRules(rules);

  const dailyRate = dailyAveragePay(params?.wages, resolved);
  const compensableRate = round2((dailyRate * resolved.layoffPercent) / 100);

  const laidOff = Math.max(0, Math.floor(toNumber(params?.laidOffDays)));
  const holidays = Math.max(0, Math.floor(toNumber(params?.weeklyHolidays)));

  const findings = [];

  // Section 25C excludes weekly holidays from the compensable days outright.
  const afterHolidays = Math.max(0, laidOff - holidays);

  const disentitled = [];
  let disentitledDays = 0;

  for (const entry of Array.isArray(params?.disentitledDays)
    ? params.disentitledDays
    : []) {
    if (!Object.hasOwn(DISENTITLEMENT_LABEL, entry?.reason)) continue;

    const count = Math.max(0, Math.floor(toNumber(entry?.days)));
    if (count <= 0) continue;

    disentitledDays += count;
    disentitled.push({
      reason: entry.reason,
      label: DISENTITLEMENT_LABEL[entry.reason],
      days: count,
    });
  }

  // Cannot disentitle more days than there were.
  disentitledDays = Math.min(disentitledDays, afterHolidays);

  if (disentitledDays > 0) {
    findings.push(
      finding(
        FINDING.DAYS_DISENTITLED,
        SEVERITY.INFORMATIONAL,
        `${disentitledDays} of ${afterHolidays} compensable days carry no compensation under section 25E.`,
        { disentitledDays, reasons: disentitled },
      ),
    );
  }

  const entitledDays = Math.max(0, afterHolidays - disentitledDays);

  // The rolling window. Days already compensated in the preceding twelve months
  // consume the ceiling, which is why this cannot be answered from the current
  // spell alone.
  const alreadyCompensated = Math.max(
    0,
    Math.floor(toNumber(params?.compensatedDaysInWindow)),
  );
  const ceilingRemaining = Math.max(
    0,
    resolved.layoffCeilingDays - alreadyCompensated,
  );

  const payableDays = Math.min(entitledDays, ceilingRemaining);
  const beyondCeiling = entitledDays - payableDays;

  if (beyondCeiling > 0) {
    findings.push(
      finding(
        FINDING.CEILING_EXCEEDED,
        SEVERITY.EXPOSURE,
        `${beyondCeiling} days fall beyond the ${resolved.layoffCeilingDays}-day ceiling for the rolling ${resolved.ceilingWindowMonths} months (${alreadyCompensated} already compensated). Past the ceiling section 25C stops compelling payment where there is an agreement to the contrary; without one, the alternative is retrenchment.`,
        {
          beyondCeiling,
          alreadyCompensated,
          ceiling: resolved.layoffCeilingDays,
        },
      ),
    );
  } else if (payableDays > 0 && ceilingRemaining - payableDays === 0) {
    findings.push(
      finding(
        FINDING.CEILING_REACHED,
        SEVERITY.INFORMATIONAL,
        `The ${resolved.layoffCeilingDays}-day ceiling is now exhausted for this rolling ${resolved.ceilingWindowMonths} months.`,
        { ceiling: resolved.layoffCeilingDays },
      ),
    );
  }

  // The qualification gate. A workman without 25B service gets no lay-off
  // compensation at all, whatever the day count says.
  const qualified = params?.service?.qualified === true;

  return {
    dailyRate,
    compensableRate,
    laidOffDays: laidOff,
    weeklyHolidays: holidays,
    compensableDays: afterHolidays,
    disentitled,
    disentitledDays,
    entitledDays,
    alreadyCompensatedInWindow: alreadyCompensated,
    ceiling: resolved.layoffCeilingDays,
    ceilingRemaining,
    payableDays: qualified ? payableDays : 0,
    beyondCeilingDays: beyondCeiling,
    qualified,
    compensation: qualified ? round2(payableDays * compensableRate) : 0,
    findings: qualified
      ? findings
      : [...(params?.service?.findings || []), ...findings],
  };
}

/**
 * Chapter VB — whether prior permission was required, and whether it was had.
 *
 * The output is not a payment. It is whether the employer's act was lawful, and
 * that is why this is a separate function from everything above: folding a
 * lawfulness determination into a payout calculator would put the two most
 * different numbers in the chapter behind one signature.
 *
 * @param {object} params
 * @param {number} params.workmen
 * @param {string} params.action an ACTION
 * @param {string} [params.permission] a PERMISSION_STATE
 * @param {number} [params.noticeMonths] for a retrenchment under 25N
 * @param {object} [rules]
 * @returns {object}
 */
function chapterVBPosition(params, rules) {
  const resolved = resolveRules(rules);

  if (!Object.hasOwn(ACTION_SECTION, params?.action)) {
    throw new TypeError(
      `chapterVBPosition needs an action; "${params?.action}" is not one of ${Object.keys(ACTION_SECTION).join(', ')}`,
    );
  }

  const workmen = Math.max(0, toNumber(params?.workmen));
  const required = workmen >= resolved.chapterVBThreshold;
  const findings = [];

  const permission = required
    ? params?.permission || PERMISSION_STATE.NOT_SOUGHT
    : PERMISSION_STATE.NOT_REQUIRED;

  const lawful =
    !required ||
    permission === PERMISSION_STATE.GRANTED ||
    permission === PERMISSION_STATE.DEEMED_GRANTED;

  if (required && permission === PERMISSION_STATE.NOT_SOUGHT) {
    findings.push(
      finding(
        FINDING.PERMISSION_NOT_SOUGHT,
        SEVERITY.BREACH,
        `${workmen} workmen, so ${ACTION_SECTION[params.action]} requires the prior permission of the appropriate government, and none was sought.`,
        { workmen, threshold: resolved.chapterVBThreshold },
      ),
    );
  }

  if (required && permission === PERMISSION_STATE.REFUSED) {
    findings.push(
      finding(
        FINDING.PERMISSION_REFUSED,
        SEVERITY.BREACH,
        `Permission under ${ACTION_SECTION[params.action]} was applied for and refused.`,
        { workmen },
      ),
    );
  }

  if (!lawful) {
    findings.push(
      finding(
        FINDING.ACT_ILLEGAL,
        SEVERITY.BREACH,
        'The act is illegal. The workmen are deemed not to have been laid off or retrenched and are entitled to all wages and benefits as if they had continued — which is not compensation, and is a different quantity entirely.',
        { action: params.action },
      ),
    );
  }

  // Section 25N(1)(a) — three months' notice, quite apart from the permission.
  if (
    required &&
    params?.action === ACTION.RETRENCHMENT &&
    params?.noticeMonths !== undefined
  ) {
    const notice = toNumber(params.noticeMonths);
    if (notice < resolved.chapterVBNoticeMonths) {
      findings.push(
        finding(
          FINDING.NOTICE_SHORT,
          SEVERITY.BREACH,
          `${notice} months' notice against the ${resolved.chapterVBNoticeMonths} section 25N(1)(a) requires.`,
          { noticeMonths: notice, required: resolved.chapterVBNoticeMonths },
        ),
      );
    }
  }

  return {
    action: params.action,
    section: ACTION_SECTION[params.action],
    workmen,
    threshold: resolved.chapterVBThreshold,
    permissionRequired: required,
    permission,
    lawful,
    findings,
  };
}

/**
 * What an illegal lay-off or retrenchment costs.
 *
 * **Not** compensation. Where permission was required and absent, the workmen
 * are deemed not to have been laid off or retrenched, so the liability is full
 * wages and benefits for the period as though they had continued.
 *
 * Returned under its own key with its own basis, and never summed with the
 * compensation figure — a caller that added the two would be paying an
 * alternative twice, and one that read either as "the amount" would be off by
 * the difference between half pay for forty-five days and full pay for the
 * whole period.
 *
 * @param {object} params
 * @param {number} params.days
 * @param {object} params.wages
 * @param {number} [params.benefitsPerDay]
 * @param {object} [rules]
 * @returns {object}
 */
function illegalityExposure({ days, wages, benefitsPerDay = 0 }, rules) {
  const resolved = resolveRules(rules);

  const dailyRate = dailyAveragePay(wages, resolved);
  const count = Math.max(0, Math.floor(toNumber(days)));
  const benefits = Math.max(0, toNumber(benefitsPerDay));

  return {
    basis: 'FULL_WAGES_AS_IF_CONTINUED',
    days: count,
    dailyRate,
    benefitsPerDay: round2(benefits),
    /** Full wages, not the fifty per cent section 25C would have paid. */
    amount: round2(count * (dailyRate + benefits)),
    note: 'Wages and benefits as if the workman had continued in employment. This is not lay-off or retrenchment compensation and must not be added to it.',
  };
}

/**
 * Section 25FFF — compensation on closure.
 *
 * Retrenchment compensation, with the proviso capping it at three months'
 * average pay **only** where the closure is on account of unavoidable
 * circumstances beyond the employer's control. The proviso's explanation
 * excludes financial difficulties, accumulation of stocks and the expiry of a
 * lease or licence by name — and those are the grounds most often claimed, so
 * the cap is refused with a reason rather than silently not applied.
 *
 * @param {object} params
 * @param {number} params.completedYears
 * @param {object} params.wages
 * @param {boolean} [params.unavoidable]
 * @param {Array<string>} [params.grounds]
 * @param {object} [rules]
 * @returns {object}
 */
function closureCompensation(params, rules) {
  const resolved = resolveRules(rules);

  const dailyRate = dailyAveragePay(params?.wages, resolved);
  const years = Math.max(0, Math.floor(toNumber(params?.completedYears)));

  const uncapped = round2(years * resolved.retrenchmentDaysPerYear * dailyRate);
  const cap = round2(
    resolved.closureCapMonths * resolved.daysPerMonth * dailyRate,
  );

  const findings = [];

  const excludedGrounds = (
    Array.isArray(params?.grounds) ? params.grounds : []
  ).filter((ground) => Object.hasOwn(NOT_UNAVOIDABLE, ground));

  // The cap is only available where the circumstances really were beyond
  // control. A claimed ground that the proviso names removes it.
  const capAvailable = params?.unavoidable === true && !excludedGrounds.length;

  if (params?.unavoidable === true && excludedGrounds.length) {
    findings.push(
      finding(
        FINDING.CLOSURE_CAP_NOT_AVAILABLE,
        SEVERITY.BREACH,
        `The closure is claimed as unavoidable, but the grounds given (${excludedGrounds.join(', ')}) are excluded by the section 25FFF proviso's explanation. The three-month cap does not apply.`,
        { grounds: excludedGrounds },
      ),
    );
  }

  return {
    completedYears: years,
    dailyRate,
    uncapped,
    cap,
    capAvailable,
    excludedGrounds,
    amount: capAvailable ? Math.min(uncapped, cap) : uncapped,
    findings,
  };
}

/**
 * Section 25G — last in, first out, within a category.
 *
 * The point is not the ordering, which is trivial; it is that a **departure**
 * from the ordering has to be recorded with reasons. So this compares a
 * proposed selection against the computed order and flags each departure —
 * separately noting the ones with no reason attached, which are the ones a
 * tribunal treats as unexplained.
 *
 * @param {object} params
 * @param {Array<object>} params.workmen entries of {workmanId, name, category, serviceDays}
 * @param {string} params.category
 * @param {Array<*>} params.proposed workmanIds proposed for retrenchment
 * @param {object} [params.reasons] workmanId → reason for departing from LIFO
 * @returns {object}
 */
function seniorityList({
  workmen = [],
  category,
  proposed = [],
  reasons = {},
}) {
  const inCategory = workmen
    .filter((row) => !category || row?.category === category)
    // Last in, first out: least service goes first.
    .sort(
      (a, b) =>
        toNumber(a?.serviceDays) - toNumber(b?.serviceDays) ||
        String(a?.name || '').localeCompare(String(b?.name || '')),
    )
    .map((row, index) => ({
      workmanId: row?.workmanId || null,
      name: row?.name || '',
      category: row?.category || '',
      serviceDays: toNumber(row?.serviceDays),
      lifoRank: index + 1,
    }));

  const proposedSet = new Set(proposed.map((id) => String(id)));
  const expected = new Set(
    inCategory.slice(0, proposedSet.size).map((row) => String(row.workmanId)),
  );

  const findings = [];
  const rows = inCategory.map((row) => {
    const isProposed = proposedSet.has(String(row.workmanId));
    const isExpected = expected.has(String(row.workmanId));

    // A departure is either direction: somebody junior retained, or somebody
    // senior selected. Both need a reason on the record.
    const departure = isProposed !== isExpected;
    const reason = reasons?.[String(row.workmanId)] || '';

    if (departure) {
      findings.push(
        finding(
          reason
            ? FINDING.SENIORITY_DEPARTURE
            : FINDING.SENIORITY_DEPARTURE_UNEXPLAINED,
          reason ? SEVERITY.INFORMATIONAL : SEVERITY.BREACH,
          isProposed
            ? `${row.name} is proposed for retrenchment ahead of workmen with less service.${reason ? '' : ' No reason has been recorded.'}`
            : `${row.name} has less service than a workman proposed for retrenchment and is being retained.${reason ? '' : ' No reason has been recorded.'}`,
          { workmanId: row.workmanId, workmanName: row.name, reason },
        ),
      );
    }

    return {
      ...row,
      proposed: isProposed,
      expected: isExpected,
      departure,
      reason,
    };
  });

  return {
    category: category || '',
    order: rows,
    proposedCount: proposedSet.size,
    departures: rows.filter((row) => row.departure).length,
    unexplainedDepartures: rows.filter((row) => row.departure && !row.reason)
      .length,
    findings,
  };
}

/**
 * Section 25H — the preference a retrenched workman has on a vacancy.
 *
 * Surfaced at the point the vacancy is opened rather than held as a list
 * somebody remembers to consult. `recruitmentPipeline.js` hires without knowing
 * that a retrenched workman in the same category has a statutory claim, which
 * is the gap this closes.
 *
 * @param {object} params
 * @param {Array<object>} params.retrenched
 * @param {string} params.category
 * @param {Date|string} [params.asAt]
 * @returns {object}
 */
function reemploymentPreference({ retrenched = [], category }) {
  const candidates = retrenched
    .filter((row) => !category || row?.category === category)
    .filter((row) => !row?.reemployedOn)
    // Most service first: the preference runs to the longest-serving.
    .sort((a, b) => toNumber(b?.serviceDays) - toNumber(a?.serviceDays))
    .map((row) => ({
      workmanId: row?.workmanId || null,
      name: row?.name || '',
      category: row?.category || '',
      serviceDays: toNumber(row?.serviceDays),
      retrenchedOn: row?.retrenchedOn || null,
      offeredOn: row?.offeredOn || null,
    }));

  const findings = [];

  if (candidates.length) {
    findings.push(
      finding(
        FINDING.REEMPLOYMENT_PREFERENCE_DUE,
        SEVERITY.BREACH,
        `${candidates.length} retrenched workmen in this category have a section 25H preference on the vacancy, and it has to be offered to them before anybody else is engaged.`,
        { category: category || '', candidateCount: candidates.length },
      ),
    );
  }

  return { category: category || '', candidates, findings };
}

/**
 * The establishment: every spell of lay-off, against the Chapter VB position.
 *
 * The result deliberately carries **two** aggregate figures — `compensation`
 * and `illegalityExposure` — and never one. Where the act was lawful the first
 * is what is owed; where it was not, the second is, and it is several times
 * larger. A single field either caller could read would be the most dangerous
 * number in this product.
 *
 * @param {object} params
 * @returns {object}
 */
function assessEstablishment({ spells = [], chapterVB = {}, rules } = {}) {
  const resolved = resolveRules(rules);

  const position = chapterVBPosition(
    {
      workmen: chapterVB?.workmen,
      action: chapterVB?.action || ACTION.LAYOFF,
      permission: chapterVB?.permission,
      noticeMonths: chapterVB?.noticeMonths,
    },
    resolved,
  );

  const assessed = spells.map((spell) => {
    const service = continuousService(
      {
        days: spell?.serviceDays,
        belowGroundInMine: spell?.belowGroundInMine,
      },
      resolved,
    );

    const compensation = layoffCompensation(
      {
        laidOffDays: spell?.laidOffDays,
        weeklyHolidays: spell?.weeklyHolidays,
        disentitledDays: spell?.disentitledDays,
        compensatedDaysInWindow: spell?.compensatedDaysInWindow,
        wages: spell?.wages,
        service,
      },
      resolved,
    );

    // Computed for every spell, and only *relevant* where the act was
    // unlawful. Computing it unconditionally means the page can show what the
    // establishment is exposed to before anybody has filed for permission.
    const exposure = illegalityExposure(
      {
        days: spell?.laidOffDays,
        wages: spell?.wages,
        benefitsPerDay: spell?.benefitsPerDay,
      },
      resolved,
    );

    return {
      workmanId: spell?.workmanId || null,
      name: spell?.name || '',
      category: spell?.category || '',
      service,
      compensation,
      exposure,
      findings: [...service.findings, ...compensation.findings].map(
        (entry) => ({
          ...entry,
          workmanId: spell?.workmanId || null,
          workmanName: spell?.name || '',
        }),
      ),
    };
  });

  const findings = [
    ...position.findings,
    ...assessed.flatMap((row) => row.findings),
  ];

  const summary = new Map();
  for (const entry of findings) {
    const bucket = summary.get(entry.code) || {
      code: entry.code,
      section: entry.section,
      severity: entry.severity,
      count: 0,
      workmen: new Set(),
    };

    bucket.count += 1;
    if (entry.workmanId) bucket.workmen.add(String(entry.workmanId));
    summary.set(entry.code, bucket);
  }

  const sum = (pick) =>
    round2(assessed.reduce((total, row) => total + pick(row), 0));

  return {
    chapterVB: position,
    lawful: position.lawful,

    spellCount: assessed.length,
    qualifiedCount: assessed.filter((row) => row.service.qualified).length,

    /** What is owed where the act was lawful. */
    compensation: sum((row) => row.compensation.compensation),
    payableDays: assessed.reduce(
      (total, row) => total + row.compensation.payableDays,
      0,
    ),
    beyondCeilingDays: assessed.reduce(
      (total, row) => total + row.compensation.beyondCeilingDays,
      0,
    ),

    /**
     * What is owed where it was not. Deliberately a separate field.
     *
     * Full wages as if the workmen had continued, which is several times the
     * compensation figure — and adding the two would be paying an alternative
     * twice.
     */
    illegalityExposure: sum((row) => row.exposure.amount),
    /** Which of the two above actually applies. */
    applicableLiability: position.lawful
      ? 'COMPENSATION'
      : 'FULL_WAGES_AS_IF_CONTINUED',

    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      workmanCount: bucket.workmen.size,
    })),
    spells: assessed,
  };
}

module.exports = {
  LAYOFF_RULES,
  SERVICE_DAY,
  COUNTS_AS_SERVICE,
  DISENTITLEMENT,
  DISENTITLEMENT_LABEL,
  ACTION,
  ACTION_SECTION,
  PERMISSION_STATE,
  NOT_UNAVOIDABLE,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  resolveRules,
  dailyAveragePay,
  continuousService,
  layoffCompensation,
  chapterVBPosition,
  illegalityExposure,
  closureCompensation,
  seniorityList,
  reemploymentPreference,
  assessEstablishment,
};
