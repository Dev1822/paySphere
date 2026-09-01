/**
 * Industrial Employment (Standing Orders) Act, 1946 (#2029).
 *
 * `subsistenceAllowance.model.js` carries `standingOrdersCertified: { type:
 * Boolean, default: false }`. Somebody types it. Nothing checks it, nothing
 * dates it, and nothing knows what the standing orders say — while #1828 uses
 * that boolean to decide whether the employer may pay above the section 10A
 * subsistence rate, and #1973 uses the same fact to decide whether a shift or
 * discipline change falls inside Fourth Schedule items 6 and 9 at all.
 *
 * Four things shape everything below.
 *
 * **The six-month clock starts on applicability, not on hiring.** Section 3(1)
 * gives the employer six months from the date the Act becomes applicable to
 * submit draft standing orders. The Act becomes applicable when the
 * establishment first employs the threshold number of workmen — so the clock
 * starts on the day headcount crossed 100 (or the state's number), which is an
 * ordinary hire `employee.controller.js` makes without knowing it has started
 * anything. `applicability` therefore takes a headcount history and dates the
 * obligation from the crossing, not from today.
 *
 * **Once it applies, it keeps applying.** The proviso to section 1(3): nothing
 * in the Act shall cease to apply because the number of workmen later fell
 * below the threshold. A headcount-driven implementation that recomputes
 * applicability from today's strength lets an establishment drop out of the Act
 * by attrition. See `ONCE_APPLICABLE_ALWAYS_APPLICABLE`.
 *
 * **Uncertified is not unregulated.** Section 12A deems the prescribed Model
 * Standing Orders adopted until the employer's own are certified. An
 * establishment with no certified orders is governed by a real, binding set of
 * terms it has probably not read — so `governingInstrument` returns MODEL with a
 * reason, never NONE. Reporting "no standing orders" is wrong in the direction
 * that matters.
 *
 * **Certified is not yet operative.** Section 7: certified orders come into
 * operation thirty days from the date authenticated copies are sent under
 * section 5(3), or, where an appeal was filed under section 6, seven days from
 * the date the appellate decision is sent. Both are dates of dispatch **by an
 * authority**, not dates the employer chose, and in the gap the previous
 * instrument still governs. A single `certifiedOn` collapses all of it.
 *
 * Pure functions, no database access, matching how `shopsEstablishments.js` and
 * `noticeOfChange.js` are written.
 */

'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ONCE_APPLICABLE_ALWAYS_APPLICABLE =
  'The proviso to section 1(3): nothing in the Act shall cease to apply to an industrial establishment because the number of workmen later fell below the threshold. Applicability is dated from the first crossing and is not recomputed from present strength.';

const UNCERTIFIED_IS_NOT_UNREGULATED =
  'Section 12A deems the prescribed Model Standing Orders adopted from the date the Act becomes applicable until the employer’s own orders are certified. An establishment without certified orders is governed by the Model orders, not by nothing.';

const MODIFICATION_BAR_IS_UNILATERAL =
  'Section 10(1) bars modification for six months from the date the orders last came into operation, except on agreement between the employer and the workmen or a trade union or other representative body. The bar is on unilateral amendment, not on amendment.';

const OPERATION_LAGS_CERTIFICATION =
  'Section 7: certified standing orders come into operation on the expiry of thirty days from the date authenticated copies are sent under section 5(3), or, where an appeal was preferred under section 6, seven days from the date the appellate decision is sent. Until then the previous instrument governs.';

// --- The Schedule -----------------------------------------------------------

/**
 * The matters standing orders must provide for.
 *
 * Held as data because a certified set that is silent on a Schedule matter does
 * not make the whole set defective — the Model orders fill that matter alone,
 * and the gap is reportable per matter. A boolean cannot express a set that is
 * certified for eight of eleven matters.
 */
const SCHEDULE_MATTERS = {
  CLASSIFICATION: {
    item: 1,
    key: 'CLASSIFICATION',
    text: 'Classification of workmen — permanent, temporary, apprentices, probationers, badlis',
  },
  WORKING_HOURS: {
    item: 2,
    key: 'WORKING_HOURS',
    text: 'Manner of intimating to workmen periods and hours of work, holidays, pay-days and wage rates',
  },
  SHIFT_WORKING: {
    item: 3,
    key: 'SHIFT_WORKING',
    text: 'Shift working',
    /** Fourth Schedule item 6 under #1973 turns on whether this matter is covered. */
    readBy: 'noticeOfChange',
  },
  ATTENDANCE_AND_LATE_COMING: {
    item: 4,
    key: 'ATTENDANCE_AND_LATE_COMING',
    text: 'Attendance and late coming',
  },
  LEAVE_PROCEDURE: {
    item: 5,
    key: 'LEAVE_PROCEDURE',
    text: 'Conditions of, procedure in applying for, and the authority which may grant leave and holidays',
  },
  ENTRY_AND_SEARCH: {
    item: 6,
    key: 'ENTRY_AND_SEARCH',
    text: 'Requirement to enter premises by certain gates, and liability to search',
  },
  CLOSING_AND_REOPENING: {
    item: 7,
    key: 'CLOSING_AND_REOPENING',
    text: 'Closing and reopening of sections of the establishment, and temporary stoppages of work',
  },
  TERMINATION: {
    item: 8,
    key: 'TERMINATION',
    text: 'Termination of employment, and the notice to be given by employer and workmen',
  },
  SUSPENSION_AND_MISCONDUCT: {
    item: 9,
    key: 'SUSPENSION_AND_MISCONDUCT',
    text: 'Suspension or dismissal for misconduct, and acts or omissions which constitute misconduct',
    /** #1828 reads this matter to decide the section 10A subsistence rate. */
    readBy: 'subsistenceAllowance',
  },
  GRIEVANCE: {
    item: 10,
    key: 'GRIEVANCE',
    text: 'Means of redress for workmen against unfair treatment or wrongful exactions',
  },
  OTHER: {
    item: 11,
    key: 'OTHER',
    text: 'Any other matter which may be prescribed',
  },
};

/** Where an establishment sits in the certification procedure. */
const ORDERS_STATE = {
  /** Applicable, six months running, nothing submitted. */
  DRAFT_DUE: 'DRAFT_DUE',
  /** Applicable, six months gone, nothing submitted. Section 13(1) default. */
  DRAFT_OVERDUE: 'DRAFT_OVERDUE',
  /** Five copies with the Certifying Officer under section 3(1). */
  DRAFT_SUBMITTED: 'DRAFT_SUBMITTED',
  /** Section 5 procedure running — objections, hearing, decision. */
  UNDER_CERTIFICATION: 'UNDER_CERTIFICATION',
  /** Section 6 appeal preferred. The operation lag becomes seven days. */
  APPEALED: 'APPEALED',
  /**
   * Certified, but the section 7 period has not run.
   *
   * The state that has to exist. It is real, it lasts thirty days — or seven
   * after an appeal — and throughout it the previous instrument governs.
   */
  CERTIFIED_NOT_YET_OPERATIVE: 'CERTIFIED_NOT_YET_OPERATIVE',
  OPERATIVE: 'OPERATIVE',
};

/** What actually governs the establishment on a given date. */
const INSTRUMENT = {
  /** Section 12A. Never NONE. */
  MODEL: 'MODEL',
  CERTIFIED: 'CERTIFIED',
  /** A superseding set is certified but not yet operative. */
  PREVIOUS_CERTIFIED: 'PREVIOUS_CERTIFIED',
  /** The Act does not apply to this establishment at all. */
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

/** Whether a proposed modification may be made. */
const MODIFICATION_VERDICT = {
  PERMITTED: 'PERMITTED',
  /** Inside six months, no agreement on record. Not simply BARRED. */
  BARRED_UNILATERALLY: 'BARRED_UNILATERALLY',
  /** Inside six months, agreement on record. Section 10(1) proviso. */
  PERMITTED_BY_AGREEMENT: 'PERMITTED_BY_AGREEMENT',
  /** Nothing certified yet — there is nothing to modify. */
  NOTHING_TO_MODIFY: 'NOTHING_TO_MODIFY',
};

// --- Per-state rules --------------------------------------------------------

/**
 * Seeded per state. An absent state returns null.
 *
 * The threshold is the figure that must never be defaulted. It is 100 centrally
 * and 50 in several states, and defaulting to 100 in a state that uses 50 tells
 * an employer with 60 workmen that they have no obligation when six months have
 * been running against them.
 */
const STATE_RULES = {
  CENTRAL: {
    state: 'CENTRAL',
    label: 'Central sphere',
    applicabilityThreshold: 100,
    submissionWindowDays: 182,
    modificationBarMonths: 6,
    operationLagDays: 30,
    operationLagAfterAppealDays: 7,
    hasNotifiedModelOrders: true,
  },
  MH: {
    state: 'MH',
    label: 'Maharashtra',
    /** Reduced to 50 by the state amendment. */
    applicabilityThreshold: 50,
    submissionWindowDays: 182,
    modificationBarMonths: 6,
    operationLagDays: 30,
    operationLagAfterAppealDays: 7,
    hasNotifiedModelOrders: true,
  },
  KA: {
    state: 'KA',
    label: 'Karnataka',
    applicabilityThreshold: 50,
    submissionWindowDays: 182,
    modificationBarMonths: 6,
    operationLagDays: 30,
    operationLagAfterAppealDays: 7,
    hasNotifiedModelOrders: true,
  },
  TN: {
    state: 'TN',
    label: 'Tamil Nadu',
    applicabilityThreshold: 50,
    submissionWindowDays: 182,
    modificationBarMonths: 6,
    operationLagDays: 30,
    operationLagAfterAppealDays: 7,
    hasNotifiedModelOrders: true,
  },
  GJ: {
    state: 'GJ',
    label: 'Gujarat',
    applicabilityThreshold: 50,
    submissionWindowDays: 182,
    modificationBarMonths: 6,
    operationLagDays: 30,
    operationLagAfterAppealDays: 7,
    hasNotifiedModelOrders: true,
  },
  DL: {
    state: 'DL',
    label: 'Delhi',
    applicabilityThreshold: 100,
    submissionWindowDays: 182,
    modificationBarMonths: 6,
    operationLagDays: 30,
    operationLagAfterAppealDays: 7,
    hasNotifiedModelOrders: true,
  },
};

// --- Helpers ----------------------------------------------------------------

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

function addDays(date, days) {
  return new Date(startOfDay(date) + days * MS_PER_DAY);
}

/**
 * Calendar months, not thirty-day blocks.
 *
 * The section 10 bar is expressed in months and a six-month bar from 31 August
 * expires on 28 February, not on 27 February. Clamping to the end of a short
 * month is the behaviour a reader expects and the behaviour a day-count gets
 * wrong twice a year.
 */
function addMonths(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      Math.min(day, lastDay),
    ),
  );
}

/**
 * @param {string} state
 * @returns {object|null}
 */
function resolveRules(state) {
  if (!state) return null;
  return STATE_RULES[String(state).trim().toUpperCase()] || null;
}

// --- Applicability ----------------------------------------------------------

/**
 * When the Act became applicable, from the establishment's headcount history.
 *
 * Takes the history rather than the current strength for two reasons, and both
 * are the whole point of the function:
 *
 *   - The six-month clock runs from the **first** crossing. An establishment
 *     that crossed 100 in March and is at 140 today has had six months running
 *     since March, and a function given only "140" can date the obligation from
 *     today at the earliest.
 *   - Once applicable, always applicable. An establishment that crossed the
 *     threshold two years ago and has since fallen to 80 is still covered by the
 *     proviso to section 1(3), and recomputing from present strength would take
 *     it out of the Act by attrition.
 *
 * @param {Array<{on: Date|string, workmen: number}>} history
 * @param {object} rules
 * @returns {object}
 */
function applicability(history, rules) {
  if (!rules) {
    return {
      applicable: null,
      reason:
        'No rules are on file for this state. The applicability threshold is 100 centrally and 50 in several states, and defaulting it would tell an employer with 60 workmen that they have no obligation.',
      applicableFrom: null,
      threshold: null,
      note: ONCE_APPLICABLE_ALWAYS_APPLICABLE,
    };
  }

  const points = (history || [])
    .map((row) => ({ on: toDate(row.on), workmen: Number(row.workmen) }))
    .filter((row) => row.on && Number.isFinite(row.workmen))
    .sort((a, b) => a.on - b.on);

  const crossing = points.find(
    (row) => row.workmen >= rules.applicabilityThreshold,
  );

  if (!crossing) {
    const highest = points.reduce(
      (max, row) => (row.workmen > max ? row.workmen : max),
      0,
    );
    return {
      applicable: false,
      reason: `The establishment has not reached ${rules.applicabilityThreshold} workmen — the highest strength on record is ${highest}. The Act has never applied, so the Model Standing Orders are not deemed adopted either.`,
      applicableFrom: null,
      threshold: rules.applicabilityThreshold,
      highestStrength: highest,
      note: ONCE_APPLICABLE_ALWAYS_APPLICABLE,
    };
  }

  const latest = points[points.length - 1];
  const fellBelow = latest.workmen < rules.applicabilityThreshold;

  return {
    applicable: true,
    reason: fellBelow
      ? `Applicable from ${crossing.on.toISOString().slice(0, 10)}, when strength first reached ${crossing.workmen} against a threshold of ${rules.applicabilityThreshold}. Strength is now ${latest.workmen}, below the threshold — the Act continues to apply regardless.`
      : `Applicable from ${crossing.on.toISOString().slice(0, 10)}, when strength first reached ${crossing.workmen} against a threshold of ${rules.applicabilityThreshold}.`,
    applicableFrom: crossing.on,
    threshold: rules.applicabilityThreshold,
    strengthAtCrossing: crossing.workmen,
    currentStrength: latest.workmen,
    // Surfaced rather than merely honoured, because a reader looking at an
    // establishment now below the threshold will otherwise assume a bug.
    stillApplicableDespiteFall: fellBelow,
    note: ONCE_APPLICABLE_ALWAYS_APPLICABLE,
  };
}

/**
 * The section 3(1) submission deadline and what remains of it.
 *
 * @param {Date} applicableFrom
 * @param {Date|null} draftSubmittedOn
 * @param {Date} asOf
 * @param {object} rules
 * @returns {object}
 */
function submissionWindow(applicableFrom, draftSubmittedOn, asOf, rules) {
  const from = toDate(applicableFrom);
  if (!from || !rules) {
    return {
      dueBy: null,
      daysRemaining: null,
      state: null,
      reason:
        'The window runs from the date the Act became applicable, so without it there is no deadline to compute.',
    };
  }

  const dueBy = addDays(from, rules.submissionWindowDays);
  const submitted = toDate(draftSubmittedOn);
  const today = toDate(asOf) || new Date();

  if (submitted) {
    const lateBy = daysBetween(dueBy, submitted);
    return {
      dueBy,
      daysRemaining: null,
      submittedOn: submitted,
      lateByDays: lateBy > 0 ? lateBy : 0,
      state: ORDERS_STATE.DRAFT_SUBMITTED,
      reason:
        lateBy > 0
          ? `Draft submitted on ${submitted.toISOString().slice(0, 10)}, ${lateBy} day${lateBy === 1 ? '' : 's'} after the section 3(1) deadline of ${dueBy.toISOString().slice(0, 10)}. Late submission is a section 13(1) default and does not undo the submission.`
          : `Draft submitted on ${submitted.toISOString().slice(0, 10)}, inside the section 3(1) window.`,
    };
  }

  const daysRemaining = daysBetween(today, dueBy);
  if (daysRemaining < 0) {
    return {
      dueBy,
      daysRemaining,
      submittedOn: null,
      lateByDays: -daysRemaining,
      state: ORDERS_STATE.DRAFT_OVERDUE,
      reason: `Nothing submitted, and the section 3(1) deadline of ${dueBy.toISOString().slice(0, 10)} passed ${-daysRemaining} day${daysRemaining === -1 ? '' : 's'} ago. Section 13(1) makes this an offence by the employer; the Model Standing Orders have governed throughout.`,
    };
  }

  return {
    dueBy,
    daysRemaining,
    submittedOn: null,
    lateByDays: 0,
    state: ORDERS_STATE.DRAFT_DUE,
    reason: `Draft standing orders due by ${dueBy.toISOString().slice(0, 10)} — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining.`,
  };
}

// --- Certification and operation --------------------------------------------

/**
 * When a certified set comes into operation, and whether it has.
 *
 * The input dates are dates of **dispatch by an authority**: `authenticatedCopiesSentOn`
 * under section 5(3), and `appellateDecisionSentOn` under section 6. Neither is
 * a date the employer picks, and neither is the date on the certificate.
 *
 * @param {object} orders
 * @param {Date|string} asOf
 * @param {object} rules
 * @returns {object}
 */
function operationDate(orders, asOf, rules) {
  const today = toDate(asOf) || new Date();

  if (!orders || !rules) {
    return {
      state: null,
      operativeFrom: null,
      reason: 'Nothing certified.',
    };
  }

  const appealSent = toDate(orders.appellateDecisionSentOn);
  const copiesSent = toDate(orders.authenticatedCopiesSentOn);

  if (orders.appealPreferred && !appealSent) {
    return {
      state: ORDERS_STATE.APPEALED,
      operativeFrom: null,
      reason:
        'An appeal under section 6 is pending. The orders cannot come into operation until the appellate decision is sent, and the lag is then seven days rather than thirty.',
    };
  }

  const from = appealSent || copiesSent;
  if (!from) {
    return {
      state: ORDERS_STATE.UNDER_CERTIFICATION,
      operativeFrom: null,
      reason:
        'Certified, but no date of dispatch is on record. Section 7 runs from the date authenticated copies were sent, not from the date on the certificate, so the operation date cannot be computed without it.',
    };
  }

  const lag = appealSent
    ? rules.operationLagAfterAppealDays
    : rules.operationLagDays;
  const operativeFrom = addDays(from, lag);
  const operative = daysBetween(today, operativeFrom) <= 0;

  return {
    state: operative
      ? ORDERS_STATE.OPERATIVE
      : ORDERS_STATE.CERTIFIED_NOT_YET_OPERATIVE,
    operativeFrom,
    lagDays: lag,
    ranFromAppeal: Boolean(appealSent),
    daysUntilOperative: operative ? 0 : daysBetween(today, operativeFrom),
    reason: operative
      ? `Operative from ${operativeFrom.toISOString().slice(0, 10)} — ${lag} days from ${from.toISOString().slice(0, 10)}${appealSent ? ', the date the appellate decision was sent' : ', the date authenticated copies were sent'}.`
      : `Certified but not yet operative. Section 7 makes them operative on ${operativeFrom.toISOString().slice(0, 10)}; until then the previous instrument governs. ${OPERATION_LAGS_CERTIFICATION}`,
  };
}

/**
 * What actually governs the establishment on a date.
 *
 * Never returns NONE for an establishment the Act applies to. See
 * `UNCERTIFIED_IS_NOT_UNREGULATED`.
 *
 * @param {object} position
 * @param {Date|string} asOf
 * @param {object} rules
 * @returns {object}
 */
function governingInstrument(position, asOf, rules) {
  if (!position || position.applicable !== true) {
    return {
      instrument: INSTRUMENT.NOT_APPLICABLE,
      reason:
        'The Act has never applied to this establishment, so neither certified nor Model Standing Orders govern it.',
    };
  }

  const current = operationDate(position.current, asOf, rules);
  const previousOperative = position.previous
    ? operationDate(position.previous, asOf, rules)
    : null;

  if (current.state === ORDERS_STATE.OPERATIVE) {
    return {
      instrument: INSTRUMENT.CERTIFIED,
      operativeFrom: current.operativeFrom,
      reason: current.reason,
    };
  }

  if (previousOperative && previousOperative.state === ORDERS_STATE.OPERATIVE) {
    return {
      instrument: INSTRUMENT.PREVIOUS_CERTIFIED,
      operativeFrom: previousOperative.operativeFrom,
      supersededBy: current.operativeFrom || null,
      reason: `The superseding set is not yet operative, so the previously certified orders operative from ${previousOperative.operativeFrom.toISOString().slice(0, 10)} still govern. ${OPERATION_LAGS_CERTIFICATION}`,
    };
  }

  return {
    instrument: INSTRUMENT.MODEL,
    operativeFrom: position.applicableFrom,
    reason: `${UNCERTIFIED_IS_NOT_UNREGULATED} They have governed since ${toDate(position.applicableFrom).toISOString().slice(0, 10)}.`,
  };
}

/**
 * Which Schedule matters the certified set actually covers.
 *
 * A matter the certified orders are silent on falls back to the Model orders for
 * that matter alone — the set does not become defective as a whole. Reported per
 * matter for that reason, and because two consumers ask about one matter each:
 * #1828 about suspension and misconduct, #1973 about shift working.
 *
 * @param {Array<string>} coveredMatters
 * @returns {object}
 */
function scheduleCoverage(coveredMatters) {
  const covered = new Set(
    (coveredMatters || []).map((matter) => String(matter).toUpperCase()),
  );

  const rows = Object.values(SCHEDULE_MATTERS).map((matter) => ({
    item: matter.item,
    key: matter.key,
    text: matter.text,
    covered: covered.has(matter.key),
    governedBy: covered.has(matter.key)
      ? INSTRUMENT.CERTIFIED
      : INSTRUMENT.MODEL,
    readBy: matter.readBy || null,
  }));

  const gaps = rows.filter((row) => !row.covered);

  return {
    matters: rows,
    gaps,
    complete: gaps.length === 0,
    reason: gaps.length
      ? `${gaps.length} Schedule matter${gaps.length === 1 ? '' : 's'} not provided for. Each falls back to the Model Standing Orders for that matter alone — the certified set is not defective as a whole.`
      : 'All Schedule matters are provided for.',
  };
}

// --- Section 10 -------------------------------------------------------------

/**
 * Whether a proposed modification may be made.
 *
 * Returns `BARRED_UNILATERALLY` and never a bare `BARRED`. Section 10(1) bars
 * modification for six months from the date the orders last came into operation
 * **except on agreement** with the workmen or a representative body, so an
 * engine reporting "cannot be modified until <date>" blocks a lawful amendment
 * and an engine reporting nothing lets an unlawful unilateral one through.
 *
 * The agreement must carry a reference. A checkbox saying agreement was reached
 * is the state this check exists to stop being recorded.
 *
 * @param {object} args
 * @returns {object}
 */
function assessModification(args) {
  const { operativeFrom, proposedOn, agreement, rules } = args || {};
  const operative = toDate(operativeFrom);
  const proposed = toDate(proposedOn) || new Date();

  if (!operative || !rules) {
    return {
      verdict: MODIFICATION_VERDICT.NOTHING_TO_MODIFY,
      barLiftsOn: null,
      reason:
        'No certified orders are in operation. Section 10 bars modification of certified standing orders; where there are none, the route is certification under section 3, not modification under section 10.',
      note: MODIFICATION_BAR_IS_UNILATERAL,
    };
  }

  const barLiftsOn = addMonths(operative, rules.modificationBarMonths);
  const inBar = daysBetween(proposed, barLiftsOn) > 0;

  if (!inBar) {
    return {
      verdict: MODIFICATION_VERDICT.PERMITTED,
      barLiftsOn,
      reason: `The orders came into operation on ${operative.toISOString().slice(0, 10)} and the six-month bar lifted on ${barLiftsOn.toISOString().slice(0, 10)}. Either party may apply to the Certifying Officer under section 10(2).`,
      note: MODIFICATION_BAR_IS_UNILATERAL,
    };
  }

  const reference = String((agreement && agreement.reference) || '').trim();
  const party = String((agreement && agreement.party) || '').trim();

  if (reference && party) {
    return {
      verdict: MODIFICATION_VERDICT.PERMITTED_BY_AGREEMENT,
      barLiftsOn,
      agreement: { party, reference },
      reason: `Inside the six-month bar, which lifts on ${barLiftsOn.toISOString().slice(0, 10)} — but section 10(1) excepts a modification agreed with ${party} (${reference}). The bar is on unilateral amendment.`,
      note: MODIFICATION_BAR_IS_UNILATERAL,
    };
  }

  return {
    verdict: MODIFICATION_VERDICT.BARRED_UNILATERALLY,
    barLiftsOn,
    daysUntilBarLifts: daysBetween(proposed, barLiftsOn),
    reason:
      reference || party
        ? `Inside the six-month bar, which lifts on ${barLiftsOn.toISOString().slice(0, 10)}. An agreement is claimed but is incomplete — section 10(1) needs both the representative body agreed with and the reference of the agreement, and one without the other is an assertion.`
        : `Inside the six-month bar, which lifts on ${barLiftsOn.toISOString().slice(0, 10)}. The employer cannot modify unilaterally; a modification agreed with the workmen, a trade union or another representative body is permitted now.`,
    note: MODIFICATION_BAR_IS_UNILATERAL,
  };
}

// --- The whole position -----------------------------------------------------

/**
 * Everything about one establishment on one date.
 *
 * @param {object} establishment
 * @param {object} [options]
 * @returns {object}
 */
function assessEstablishment(establishment, options) {
  const opts = options || {};
  const asOf = toDate(opts.asOf) || new Date();
  const rules = resolveRules(establishment && establishment.state);

  const position = applicability(
    (establishment && establishment.headcountHistory) || [],
    rules,
  );

  if (position.applicable !== true) {
    return {
      establishment: (establishment && establishment.name) || null,
      state: (establishment && establishment.state) || null,
      rules,
      asOf,
      applicability: position,
      submission: null,
      orders: null,
      governing: governingInstrument(position, asOf, rules),
      schedule: null,
      modification: null,
    };
  }

  const enriched = {
    ...position,
    current: establishment.current || null,
    previous: establishment.previous || null,
  };

  const submission = submissionWindow(
    position.applicableFrom,
    establishment.draftSubmittedOn,
    asOf,
    rules,
  );
  const orders = operationDate(establishment.current, asOf, rules);
  const governing = governingInstrument(enriched, asOf, rules);
  const schedule = scheduleCoverage(
    (establishment.current && establishment.current.coveredMatters) || [],
  );

  const modification = assessModification({
    operativeFrom:
      governing.instrument === INSTRUMENT.CERTIFIED ||
      governing.instrument === INSTRUMENT.PREVIOUS_CERTIFIED
        ? governing.operativeFrom
        : null,
    proposedOn: opts.modificationProposedOn || asOf,
    agreement: establishment.modificationAgreement,
    rules,
  });

  return {
    establishment: establishment.name || null,
    state: establishment.state || null,
    rules,
    asOf,
    applicability: position,
    submission,
    orders,
    governing,
    schedule,
    modification,
    notes: {
      onceApplicableAlwaysApplicable: ONCE_APPLICABLE_ALWAYS_APPLICABLE,
      uncertifiedIsNotUnregulated: UNCERTIFIED_IS_NOT_UNREGULATED,
      modificationBarIsUnilateral: MODIFICATION_BAR_IS_UNILATERAL,
      operationLagsCertification: OPERATION_LAGS_CERTIFICATION,
    },
  };
}

/**
 * The answer the two existing consumers actually want.
 *
 * `subsistenceAllowance` (#1828) and `noticeOfChange` (#1973) each read one
 * Schedule matter, and each currently carries its own boolean. This returns the
 * instrument governing **that matter**, which is the question — a certified set
 * silent on shift working leaves shift working on the Model orders even though
 * the establishment plainly has certified standing orders.
 *
 * @param {object} assessment
 * @param {string} matter
 * @returns {object}
 */
function instrumentForMatter(assessment, matter) {
  const key = String(matter || '').toUpperCase();
  if (!SCHEDULE_MATTERS[key]) {
    return {
      instrument: null,
      reason: `‘${matter}’ is not a Schedule matter.`,
      matters: Object.keys(SCHEDULE_MATTERS),
    };
  }

  if (!assessment || !assessment.governing) {
    return { instrument: null, reason: 'No assessment supplied.' };
  }

  if (assessment.governing.instrument === INSTRUMENT.NOT_APPLICABLE) {
    return {
      instrument: INSTRUMENT.NOT_APPLICABLE,
      reason: assessment.governing.reason,
    };
  }

  if (assessment.governing.instrument === INSTRUMENT.MODEL) {
    return {
      instrument: INSTRUMENT.MODEL,
      reason: assessment.governing.reason,
    };
  }

  const row = ((assessment.schedule && assessment.schedule.matters) || []).find(
    (candidate) => candidate.key === key,
  );

  if (!row || !row.covered) {
    return {
      instrument: INSTRUMENT.MODEL,
      reason: `The establishment has certified standing orders, but they are silent on ${SCHEDULE_MATTERS[key].text.toLowerCase()}. That matter falls back to the Model Standing Orders on its own.`,
    };
  }

  return {
    instrument: assessment.governing.instrument,
    reason: `Covered by the ${assessment.governing.instrument === INSTRUMENT.PREVIOUS_CERTIFIED ? 'previously ' : ''}certified standing orders.`,
  };
}

module.exports = {
  SCHEDULE_MATTERS,
  ORDERS_STATE,
  INSTRUMENT,
  MODIFICATION_VERDICT,
  STATE_RULES,
  ONCE_APPLICABLE_ALWAYS_APPLICABLE,
  UNCERTIFIED_IS_NOT_UNREGULATED,
  MODIFICATION_BAR_IS_UNILATERAL,
  OPERATION_LAGS_CERTIFICATION,
  resolveRules,
  applicability,
  submissionWindow,
  operationDate,
  governingInstrument,
  scheduleCoverage,
  assessModification,
  assessEstablishment,
  instrumentForMatter,
};
