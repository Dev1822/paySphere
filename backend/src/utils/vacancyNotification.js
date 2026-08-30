/**
 * Employment Exchanges (Compulsory Notification of Vacancies) Act, 1959
 * (#1879).
 *
 * `recruitmentPipeline.js` opens requisitions and moves candidates.
 * `internalJob.routes.js` posts vacancies internally. Neither knows that for
 * most of the establishments this product serves a vacancy has to be notified
 * to the employment exchange **before it is filled**, and that the establishment
 * owes quarterly and biennial returns whether or not it recruited anybody.
 *
 * Four things shape everything below.
 *
 * **Section 4 is a pre-condition on filling, not a report afterwards.** The
 * notification has to reach the exchange fifteen days before applications close
 * or the vacancy is intended to be filled. A requisition that opens and closes
 * inside a fortnight — which is most of them — is a default by the time anybody
 * runs a quarter-end report. So `notificationWindow` is computed from the
 * intended fill date at the moment the requisition opens, and the finding for a
 * window still open is not a breach: it is a deadline.
 *
 * **Section 5 is the part everybody gets wrong, so it is carried in the
 * output.** Notifying a vacancy creates **no obligation to recruit** through
 * the exchange and none to consider the candidates it sends. Employers who
 * believe otherwise either stop notifying or hold roles open for nothing. Every
 * notifiability result carries `noObligationToRecruit` with the sentence
 * attached, because a compliance flag with no such note reads as a hiring
 * instruction.
 *
 * **The section 3 exclusions are determinations, not a filter.** Promotions,
 * absorption of surplus staff, engagements under three months, unskilled office
 * work, agriculture and domestic service are all out — and they are a large
 * share of real requisitions. Flagging everything would produce a queue nobody
 * could act on, which trains people to clear it without reading. So an
 * exclusion is recorded against a requisition with its ground, and a ground
 * later contradicted by the facts is its own finding.
 *
 * **ER-I is a return about employment, not about vacancies.** It is owed by an
 * establishment that opened no requisitions at all, so it is built from
 * headcount as on the prescribed date and never derived from the requisition
 * table — deriving it would mean the quarters most likely to be missed are the
 * ones with nothing in them.
 *
 * Pure functions, no database access, matching how `contractLabour.js` and
 * `apprenticeshipCompliance.js` are written.
 */

const CNV_RULES = {
  /**
   * The private-sector threshold. Twenty-five or more persons employed.
   *
   * Evaluated as at the date the requisition opened rather than as at today: an
   * establishment crosses it during a year and the obligation starts then, not
   * retrospectively and not from the next audit.
   */
  privateSectorThreshold: 25,

  /** Days the notification must precede the intended fill. */
  preFillNoticeDays: 15,

  /** A vacancy of less duration than this is outside the Act. */
  shortDurationMonths: 3,

  /** Quarters end on the last day of these months. */
  quarterEndMonths: [3, 6, 9, 12],

  /** Days after the quarter end that ER-I is due. */
  erOneDueDays: 30,

  /** ER-II is biennial. */
  erTwoYears: 2,

  /** Days after the biennial reference date that ER-II is due. */
  erTwoDueDays: 30,
};

const SECTOR = {
  /** The Act applies regardless of headcount. */
  PUBLIC: 'PUBLIC',
  /** The threshold applies. */
  PRIVATE: 'PRIVATE',
};

const NOTIFIABILITY = {
  /** Notifiable, and the window applies. */
  NOTIFIABLE: 'NOTIFIABLE',
  /** Outside the Act on a recorded section 3 ground. */
  EXCLUDED: 'EXCLUDED',
  /** The establishment is below the threshold on the relevant date. */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  /** Notifiable and no determination has been recorded either way. */
  UNDETERMINED: 'UNDETERMINED',
};

/**
 * The section 3 and Rule 4 exclusions.
 *
 * These are determinations somebody makes and records, not text a matcher
 * infers. A requisition marked "to be filled by promotion" and then filled by
 * an external hire is the record an inspection is looking for, and the ground
 * has to survive being contradicted.
 */
const EXCLUSION = {
  LESS_THAN_THREE_MONTHS: 'LESS_THAN_THREE_MONTHS',
  UNSKILLED_OFFICE_WORK: 'UNSKILLED_OFFICE_WORK',
  AGRICULTURE_OR_HORTICULTURE: 'AGRICULTURE_OR_HORTICULTURE',
  DOMESTIC_SERVICE: 'DOMESTIC_SERVICE',
  FILLED_BY_PROMOTION: 'FILLED_BY_PROMOTION',
  ABSORPTION_OF_SURPLUS_STAFF: 'ABSORPTION_OF_SURPLUS_STAFF',
  RESULT_OF_EXAMINATION_OR_AGENCY: 'RESULT_OF_EXAMINATION_OR_AGENCY',
  PARLIAMENT_STAFF: 'PARLIAMENT_STAFF',
};

const EXCLUSION_AUTHORITY = {
  [EXCLUSION.LESS_THAN_THREE_MONTHS]: 'Section 3(2)(c)',
  [EXCLUSION.UNSKILLED_OFFICE_WORK]: 'Section 3(2)(d)',
  [EXCLUSION.AGRICULTURE_OR_HORTICULTURE]: 'Section 3(2)(a)',
  [EXCLUSION.DOMESTIC_SERVICE]: 'Section 3(2)(b)',
  [EXCLUSION.FILLED_BY_PROMOTION]: 'Rule 4',
  [EXCLUSION.ABSORPTION_OF_SURPLUS_STAFF]: 'Rule 4',
  [EXCLUSION.RESULT_OF_EXAMINATION_OR_AGENCY]: 'Rule 4',
  [EXCLUSION.PARLIAMENT_STAFF]: 'Section 3(2)(e)',
};

const RETURN_KIND = {
  /** Quarterly employment return. */
  ER_I: 'ER_I',
  /** Biennial occupational return. */
  ER_II: 'ER_II',
};

const FINDING = {
  NOTIFICATION_DUE: 'NOTIFICATION_DUE',
  NOTIFICATION_WINDOW_MISSED: 'NOTIFICATION_WINDOW_MISSED',
  FILLED_WITHOUT_NOTIFICATION: 'FILLED_WITHOUT_NOTIFICATION',
  NOTIFIED_LATE: 'NOTIFIED_LATE',
  DETERMINATION_MISSING: 'DETERMINATION_MISSING',
  EXCLUSION_CONTRADICTED: 'EXCLUSION_CONTRADICTED',
  THRESHOLD_CROSSED: 'THRESHOLD_CROSSED',
  ER_I_DUE: 'ER_I_DUE',
  ER_I_OVERDUE: 'ER_I_OVERDUE',
  ER_II_DUE: 'ER_II_DUE',
  ER_II_OVERDUE: 'ER_II_OVERDUE',
  SECTION_25H_PREFERENCE_ALSO_DUE: 'SECTION_25H_PREFERENCE_ALSO_DUE',
};

const FINDING_SECTION = {
  [FINDING.NOTIFICATION_DUE]: 'Section 4 and Rule 4',
  [FINDING.NOTIFICATION_WINDOW_MISSED]: 'Rule 4',
  [FINDING.FILLED_WITHOUT_NOTIFICATION]: 'Section 4',
  [FINDING.NOTIFIED_LATE]: 'Rule 4',
  [FINDING.DETERMINATION_MISSING]: 'Section 3',
  [FINDING.EXCLUSION_CONTRADICTED]: 'Section 3',
  [FINDING.THRESHOLD_CROSSED]: 'Section 2(f)',
  [FINDING.ER_I_DUE]: 'Section 6 and Rule 6',
  [FINDING.ER_I_OVERDUE]: 'Section 6 and Rule 6',
  [FINDING.ER_II_DUE]: 'Section 6 and Rule 6',
  [FINDING.ER_II_OVERDUE]: 'Section 6 and Rule 6',
  [FINDING.SECTION_25H_PREFERENCE_ALSO_DUE]:
    'Industrial Disputes Act, section 25H',
};

const SEVERITY = {
  BREACH: 'BREACH',
  /** A deadline that has not yet passed. Not a failure. */
  DUE: 'DUE',
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.NOTIFICATION_DUE]: SEVERITY.DUE,
  [FINDING.NOTIFICATION_WINDOW_MISSED]: SEVERITY.BREACH,
  [FINDING.FILLED_WITHOUT_NOTIFICATION]: SEVERITY.BREACH,
  [FINDING.NOTIFIED_LATE]: SEVERITY.BREACH,
  [FINDING.DETERMINATION_MISSING]: SEVERITY.DUE,
  [FINDING.EXCLUSION_CONTRADICTED]: SEVERITY.BREACH,
  [FINDING.THRESHOLD_CROSSED]: SEVERITY.INFORMATIONAL,
  [FINDING.ER_I_DUE]: SEVERITY.DUE,
  [FINDING.ER_I_OVERDUE]: SEVERITY.BREACH,
  [FINDING.ER_II_DUE]: SEVERITY.DUE,
  [FINDING.ER_II_OVERDUE]: SEVERITY.BREACH,
  [FINDING.SECTION_25H_PREFERENCE_ALSO_DUE]: SEVERITY.INFORMATIONAL,
};

/**
 * Section 5, in the module's own words.
 *
 * Carried on every notifiability result rather than left in a comment. An
 * employer that reads a compliance flag as "you must hire through the exchange"
 * either stops notifying or holds a role open for nothing, and both of those
 * are caused by the flag rather than by the Act.
 */
const NO_OBLIGATION_TO_RECRUIT =
  'Notifying a vacancy creates no obligation to recruit through the employment exchange, and none to consider the candidates it sends. Section 5 says so expressly.';

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
 * Signed rather than floored at zero, unlike the equivalent in
 * `epfBelatedRemittance.js`: here the sign is the answer. A window with three
 * days left and one that closed three days ago are different situations, and
 * one of them is not a breach.
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
 * The last day of the quarter a date falls in.
 *
 * @param {Date} date
 * @returns {Date}
 */
function quarterEndFor(date) {
  const month = date.getUTCMonth() + 1;
  const endMonth = Math.ceil(month / 3) * 3;
  // Day 0 of the next month is the last day of this one, which handles
  // February without a leap-year branch.
  return new Date(Date.UTC(date.getUTCFullYear(), endMonth, 0));
}

/**
 * Every quarter end in a range, inclusive.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {Array<Date>}
 */
function quarterEndsBetween(from, to) {
  const start = toUtcDate(from);
  const end = toUtcDate(to);
  if (!start || !end || end < start) return [];

  const ends = [];
  let cursor = quarterEndFor(start);

  while (cursor.getTime() <= end.getTime()) {
    if (cursor.getTime() >= start.getTime()) ends.push(new Date(cursor));
    cursor = quarterEndFor(addDays(cursor, 1));
  }

  return ends;
}

// --- Applicability ----------------------------------------------------------

/**
 * Whether the Act reaches this establishment on a date.
 *
 * The headcount is taken **as at the date** rather than as at today, because an
 * establishment crosses twenty-five during a year and the obligation starts
 * then. Evaluating today's figure against last March's requisition either
 * invents an obligation that did not exist or excuses one that did.
 *
 * @param {object} input
 * @param {string} input.sector
 * @param {number} input.headcountOnDate
 * @param {object} [input.rules]
 * @returns {{applies: boolean, reason: string, threshold: number}}
 */
function applicability({ sector, headcountOnDate, rules = CNV_RULES }) {
  if (sector === SECTOR.PUBLIC) {
    return {
      applies: true,
      reason:
        'A public sector establishment, where the Act applies regardless of headcount.',
      threshold: 0,
    };
  }

  const headcount = Number(headcountOnDate) || 0;
  const applies = headcount >= rules.privateSectorThreshold;

  return {
    applies,
    reason: applies
      ? `${headcount} persons employed on the date, at or above the threshold of ${rules.privateSectorThreshold}.`
      : `${headcount} persons employed on the date, below the threshold of ${rules.privateSectorThreshold}.`,
    threshold: rules.privateSectorThreshold,
  };
}

// --- Notifiability ----------------------------------------------------------

/**
 * Whether a requisition is notifiable, and on what basis.
 *
 * Returns `UNDETERMINED` rather than `NOTIFIABLE` where nobody has recorded a
 * determination. The difference matters: a requisition somebody has looked at
 * and decided is notifiable is a deadline, and one nobody has looked at is a
 * question — and reporting the second as the first is how a queue fills with
 * rows that turn out to be promotions.
 *
 * @param {object} input
 * @param {object} input.requisition
 * @param {{applies: boolean}} input.applicability
 * @param {object} [input.rules]
 * @returns {object}
 */
function notifiability({
  requisition,
  applicability: applies,
  rules = CNV_RULES,
}) {
  const base = { noObligationToRecruit: NO_OBLIGATION_TO_RECRUIT };

  if (!applies?.applies) {
    return {
      ...base,
      status: NOTIFIABILITY.NOT_APPLICABLE,
      ground: null,
      authority: 'Section 2(f)',
    };
  }

  const ground = requisition?.exclusionGround;

  if (ground && EXCLUSION[ground]) {
    return {
      ...base,
      status: NOTIFIABILITY.EXCLUDED,
      ground,
      authority: EXCLUSION_AUTHORITY[ground],
    };
  }

  // The duration exclusion is the one the module can see for itself, and it is
  // still reported as a *suggestion* rather than applied: the exclusion is a
  // determination somebody makes, and an engagement recorded as two months that
  // runs for a year is the record an inspection asks about.
  const duration = Number(requisition?.durationMonths);
  const shortByDuration =
    Number.isFinite(duration) &&
    duration > 0 &&
    duration < rules.shortDurationMonths;

  if (!requisition?.determinedOn) {
    return {
      ...base,
      status: NOTIFIABILITY.UNDETERMINED,
      ground: null,
      authority: 'Section 3',
      suggestedGround: shortByDuration
        ? EXCLUSION.LESS_THAN_THREE_MONTHS
        : null,
    };
  }

  return {
    ...base,
    status: NOTIFIABILITY.NOTIFIABLE,
    ground: null,
    authority: 'Section 4',
  };
}

/**
 * The fifteen-day window before the intended fill.
 *
 * Computed from the intended fill date rather than measured after the fact,
 * because the whole obligation is a pre-condition on filling. A requisition
 * that opens and closes inside a fortnight is already in default when a
 * quarter-end report runs, and only a window computed at the point the
 * requisition opens can say so in time.
 *
 * @param {object} input
 * @param {Date|string} input.intendedFillDate
 * @param {Date|string} [input.notifiedOn]
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {object}
 */
function notificationWindow({
  intendedFillDate,
  notifiedOn,
  asAt,
  rules = CNV_RULES,
}) {
  const fill = toUtcDate(intendedFillDate);
  if (!fill) {
    return {
      notifyBy: null,
      notified: false,
      onTime: false,
      daysRemaining: null,
      missed: false,
    };
  }

  const notifyBy = addDays(fill, -rules.preFillNoticeDays);
  const notified = toUtcDate(notifiedOn);
  const measuredAt = toUtcDate(asAt) || new Date();

  if (notified) {
    const slack = daysBetween(notified, notifyBy);
    return {
      notifyBy,
      notified: true,
      notifiedOn: notified,
      onTime: slack >= 0,
      lateByDays: slack < 0 ? -slack : 0,
      daysRemaining: null,
      missed: false,
    };
  }

  const daysRemaining = daysBetween(measuredAt, notifyBy);

  return {
    notifyBy,
    notified: false,
    onTime: false,
    daysRemaining,
    missed: daysRemaining < 0,
  };
}

// --- Returns ----------------------------------------------------------------

/**
 * The ER-I schedule over a range.
 *
 * Built from quarter ends and nothing else. ER-I is a return about the
 * establishment's **employment**, not about its vacancies, so it is owed by an
 * establishment that opened no requisitions at all — and deriving the schedule
 * from the requisition table would mean the quarters most likely to be missed
 * are the ones with nothing in them.
 *
 * @param {object} input
 * @param {Date|string} input.from
 * @param {Date|string} input.to
 * @param {Array<{kind: string, asOn: Date|string, filedOn: Date|string}>} [input.filings]
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {Array<object>}
 */
function erOneSchedule({ from, to, filings = [], asAt, rules = CNV_RULES }) {
  const measuredAt = toUtcDate(asAt) || new Date();

  const filed = new Map(
    filings
      .filter((filing) => filing.kind === RETURN_KIND.ER_I)
      .map((filing) => [
        toUtcDate(filing.asOn)?.toISOString().slice(0, 10),
        toUtcDate(filing.filedOn),
      ]),
  );

  return quarterEndsBetween(from, to).map((asOn) => {
    const dueOn = addDays(asOn, rules.erOneDueDays);
    const key = asOn.toISOString().slice(0, 10);
    const filedOn = filed.get(key) || null;

    return {
      kind: RETURN_KIND.ER_I,
      asOn,
      dueOn,
      filedOn,
      filed: Boolean(filedOn),
      lateByDays: filedOn ? Math.max(0, daysBetween(dueOn, filedOn)) : 0,
      overdue: !filedOn && measuredAt.getTime() > dueOn.getTime(),
    };
  });
}

/**
 * The ER-II schedule over a range.
 *
 * Biennial, and anchored on a reference date rather than on the range's start,
 * so the schedule does not shift every time somebody widens the view.
 *
 * @param {object} input
 * @param {Date|string} input.anchor
 * @param {Date|string} input.to
 * @param {Array<object>} [input.filings]
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {Array<object>}
 */
function erTwoSchedule({ anchor, to, filings = [], asAt, rules = CNV_RULES }) {
  const start = toUtcDate(anchor);
  const end = toUtcDate(to);
  const measuredAt = toUtcDate(asAt) || new Date();
  if (!start || !end || end < start) return [];

  const filed = new Map(
    filings
      .filter((filing) => filing.kind === RETURN_KIND.ER_II)
      .map((filing) => [
        toUtcDate(filing.asOn)?.toISOString().slice(0, 10),
        toUtcDate(filing.filedOn),
      ]),
  );

  const rows = [];
  let cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const dueOn = addDays(cursor, rules.erTwoDueDays);
    const key = cursor.toISOString().slice(0, 10);
    const filedOn = filed.get(key) || null;

    rows.push({
      kind: RETURN_KIND.ER_II,
      asOn: new Date(cursor),
      dueOn,
      filedOn,
      filed: Boolean(filedOn),
      lateByDays: filedOn ? Math.max(0, daysBetween(dueOn, filedOn)) : 0,
      overdue: !filedOn && measuredAt.getTime() > dueOn.getTime(),
    });

    cursor = new Date(
      Date.UTC(
        cursor.getUTCFullYear() + rules.erTwoYears,
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
      ),
    );
  }

  return rows;
}

// --- Assessment -------------------------------------------------------------

/**
 * @param {Array<object>} findings
 * @param {string} code
 * @param {object} detail
 */
function addFinding(findings, code, detail = {}) {
  findings.push({
    code,
    section: FINDING_SECTION[code],
    severity: FINDING_SEVERITY[code],
    ...detail,
  });
}

/**
 * One requisition.
 *
 * @param {object} input
 * @param {object} input.requisition
 * @param {number} input.headcountOnOpen
 * @param {string} input.sector
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessRequisition({
  requisition,
  headcountOnOpen,
  sector,
  asAt,
  rules = CNV_RULES,
}) {
  const findings = [];
  const measuredAt = toUtcDate(asAt) || new Date();

  const applies = applicability({
    sector,
    headcountOnDate: headcountOnOpen,
    rules,
  });

  const status = notifiability({ requisition, applicability: applies, rules });

  const window = notificationWindow({
    intendedFillDate: requisition?.intendedFillDate,
    notifiedOn: requisition?.notifiedOn,
    asAt: measuredAt,
    rules,
  });

  const filledOn = toUtcDate(requisition?.filledOn);

  if (status.status === NOTIFIABILITY.UNDETERMINED) {
    addFinding(findings, FINDING.DETERMINATION_MISSING, {
      requisitionId: requisition?.requisitionId,
      title: requisition?.title,
      suggestedGround: status.suggestedGround,
      note: 'Nobody has recorded whether this vacancy is notifiable or excluded. The section 3 grounds cover a large share of real requisitions — promotions, absorption of surplus staff, engagements under three months — so this is a question rather than a default.',
    });
  }

  if (
    status.status === NOTIFIABILITY.EXCLUDED &&
    status.ground === EXCLUSION.LESS_THAN_THREE_MONTHS
  ) {
    const actual = Number(requisition?.actualDurationMonths);
    if (Number.isFinite(actual) && actual >= rules.shortDurationMonths) {
      addFinding(findings, FINDING.EXCLUSION_CONTRADICTED, {
        requisitionId: requisition?.requisitionId,
        title: requisition?.title,
        declaredMonths: requisition?.durationMonths,
        actualMonths: actual,
        note: 'The vacancy was excluded as being of less than three months’ duration and the engagement has run longer. This is exactly the record an inspection asks about, which is why the ground is stored rather than computed away.',
      });
    }
  }

  if (status.status === NOTIFIABILITY.NOTIFIABLE) {
    if (filledOn && !window.notified) {
      addFinding(findings, FINDING.FILLED_WITHOUT_NOTIFICATION, {
        requisitionId: requisition?.requisitionId,
        title: requisition?.title,
        filledOn,
        note: 'Section 4 requires the vacancy to be notified before it is filled. The appointment is not invalidated by the omission — the Act creates no such consequence — but the default stands.',
      });
    } else if (window.notified && !window.onTime) {
      addFinding(findings, FINDING.NOTIFIED_LATE, {
        requisitionId: requisition?.requisitionId,
        title: requisition?.title,
        lateByDays: window.lateByDays,
        notifyBy: window.notifyBy,
      });
    } else if (!window.notified && window.missed) {
      addFinding(findings, FINDING.NOTIFICATION_WINDOW_MISSED, {
        requisitionId: requisition?.requisitionId,
        title: requisition?.title,
        notifyBy: window.notifyBy,
        overdueByDays: -window.daysRemaining,
      });
    } else if (!window.notified) {
      // A deadline, not a failure. The distinction is the reason this module
      // computes the window at the point the requisition opens.
      addFinding(findings, FINDING.NOTIFICATION_DUE, {
        requisitionId: requisition?.requisitionId,
        title: requisition?.title,
        notifyBy: window.notifyBy,
        daysRemaining: window.daysRemaining,
      });
    }

    // #1830's section 25H register. Two obligations owed to different parties
    // against the same vacancy, and satisfying one discharges neither the other
    // nor itself — worded so that neither reads as answering the other.
    if (requisition?.retrenchedPreferenceInCategory) {
      addFinding(findings, FINDING.SECTION_25H_PREFERENCE_ALSO_DUE, {
        requisitionId: requisition?.requisitionId,
        category: requisition?.category,
        note: 'A retrenched workman in this category has a section 25H preference in re-employment. That preference and this notification are separate obligations owed to different parties; offering the vacancy under one does not discharge the other.',
      });
    }
  }

  return {
    requisitionId: requisition?.requisitionId,
    title: requisition?.title,
    category: requisition?.category,
    applicability: applies,
    notifiability: status,
    window,
    filledOn,
    findings,
  };
}

/**
 * An establishment: requisitions and returns together.
 *
 * @param {object} input
 * @param {Array<object>} input.requisitions
 * @param {string} input.sector
 * @param {Array<{asOn: Date|string, headcount: number}>} [input.headcounts]
 * @param {Array<object>} [input.filings]
 * @param {{from: Date|string, to: Date|string}} input.period
 * @param {Date|string} [input.erTwoAnchor]
 * @param {Date|string} [input.asAt]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessEstablishment({
  requisitions,
  sector = SECTOR.PRIVATE,
  headcounts = [],
  filings = [],
  period,
  erTwoAnchor,
  asAt,
  rules = CNV_RULES,
} = {}) {
  const measuredAt = toUtcDate(asAt) || new Date();
  const findings = [];

  const snapshots = headcounts
    .map((row) => ({
      asOn: toUtcDate(row.asOn),
      headcount: Number(row.headcount) || 0,
    }))
    .filter((row) => row.asOn)
    .sort((a, b) => a.asOn.getTime() - b.asOn.getTime());

  /**
   * The headcount as at a date, from the latest snapshot on or before it.
   *
   * Nought where there is no snapshot at all rather than today's figure — an
   * unknown headcount that defaults to the current one would invent an
   * obligation for every requisition that predates the establishment crossing
   * the threshold.
   */
  const headcountOn = (date) => {
    const on = toUtcDate(date);
    if (!on) return 0;

    let value = 0;
    for (const snapshot of snapshots) {
      if (snapshot.asOn.getTime() <= on.getTime()) value = snapshot.headcount;
      else break;
    }
    return value;
  };

  // The date the establishment crossed the threshold, where it did so inside
  // the period. Informational, and the reason the obligation starts when it
  // does rather than retrospectively.
  if (sector === SECTOR.PRIVATE) {
    let previous = 0;
    for (const snapshot of snapshots) {
      if (
        previous < rules.privateSectorThreshold &&
        snapshot.headcount >= rules.privateSectorThreshold
      ) {
        addFinding(findings, FINDING.THRESHOLD_CROSSED, {
          asOn: snapshot.asOn,
          headcount: snapshot.headcount,
          threshold: rules.privateSectorThreshold,
          note: 'The establishment reached the threshold on this date. The obligation starts here rather than retrospectively, and rather than from the next audit.',
        });
      }
      previous = snapshot.headcount;
    }
  }

  const assessed = (requisitions || []).map((requisition) =>
    assessRequisition({
      requisition,
      headcountOnOpen: headcountOn(requisition?.openedOn),
      sector,
      asAt: measuredAt,
      rules,
    }),
  );

  for (const row of assessed) findings.push(...row.findings);

  const erOne = erOneSchedule({
    from: period?.from,
    to: period?.to,
    filings,
    asAt: measuredAt,
    rules,
  });

  for (const row of erOne) {
    if (row.overdue) {
      addFinding(findings, FINDING.ER_I_OVERDUE, {
        asOn: row.asOn,
        dueOn: row.dueOn,
        note: 'ER-I is a return about the establishment’s employment and is owed for a quarter in which no vacancy arose at all.',
      });
    } else if (!row.filed) {
      addFinding(findings, FINDING.ER_I_DUE, {
        asOn: row.asOn,
        dueOn: row.dueOn,
      });
    }
  }

  const erTwo = erTwoAnchor
    ? erTwoSchedule({
        anchor: erTwoAnchor,
        to: period?.to,
        filings,
        asAt: measuredAt,
        rules,
      })
    : [];

  for (const row of erTwo) {
    if (row.overdue) {
      addFinding(findings, FINDING.ER_II_OVERDUE, {
        asOn: row.asOn,
        dueOn: row.dueOn,
      });
    } else if (!row.filed) {
      addFinding(findings, FINDING.ER_II_DUE, {
        asOn: row.asOn,
        dueOn: row.dueOn,
      });
    }
  }

  const summary = new Map();
  for (const finding of findings) {
    const bucket = summary.get(finding.code) || {
      code: finding.code,
      section: finding.section,
      severity: finding.severity,
      count: 0,
    };
    bucket.count += 1;
    summary.set(finding.code, bucket);
  }

  return {
    asAt: measuredAt,
    rules,
    sector,

    requisitions: assessed,

    /** Counted rather than filtered away, so an empty queue is explicable. */
    notifiableCount: assessed.filter(
      (row) => row.notifiability.status === NOTIFIABILITY.NOTIFIABLE,
    ).length,
    excludedCount: assessed.filter(
      (row) => row.notifiability.status === NOTIFIABILITY.EXCLUDED,
    ).length,
    undeterminedCount: assessed.filter(
      (row) => row.notifiability.status === NOTIFIABILITY.UNDETERMINED,
    ).length,

    returns: { erOne, erTwo },

    /** Section 5, at the top level where a reader cannot miss it. */
    noObligationToRecruit: NO_OBLIGATION_TO_RECRUIT,

    findings,
    summary: [...summary.values()],
  };
}

module.exports = {
  CNV_RULES,
  SECTOR,
  NOTIFIABILITY,
  EXCLUSION,
  EXCLUSION_AUTHORITY,
  RETURN_KIND,
  FINDING,
  FINDING_SECTION,
  FINDING_SEVERITY,
  SEVERITY,
  NO_OBLIGATION_TO_RECRUIT,
  toUtcDate,
  addDays,
  daysBetween,
  quarterEndFor,
  quarterEndsBetween,
  applicability,
  notifiability,
  notificationWindow,
  erOneSchedule,
  erTwoSchedule,
  assessRequisition,
  assessEstablishment,
};
