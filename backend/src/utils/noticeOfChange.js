/**
 * Industrial Disputes Act, 1947 — section 9A notice of change (#1973).
 *
 * `salaryRevision.utils.js` changes what an employee is paid.
 * `salaryStructure.js` changes how the pay is composed.
 * `rosteringEngine.utils.js` changes shifts. `leaveAccrual.js` changes leave
 * rules. `benefits.routes.js` changes contributions. Each applies its change on
 * an effective date the employer picks, and for an industrial establishment
 * employing workmen most of those changes cannot lawfully take effect on the
 * date the employer picked.
 *
 * Section 9A: no employer proposing to effect any change in the conditions of
 * service applicable to any workman in respect of any matter specified in the
 * **Fourth Schedule** shall effect that change without giving twenty-one days'
 * notice. The notice is Form E, it goes to the workmen affected, and the
 * twenty-one days run **before the change takes effect** — not before it is
 * approved, and not before it is announced.
 *
 * Five things shape everything below.
 *
 * **A change in the workman's favour still needs notice.** Section 9A is
 * procedural and says nothing about whether the change is beneficial. An
 * employer improving a shift allowance without notice has effected a change in a
 * Fourth Schedule matter without notice, exactly as one who cut it has. This is
 * counter-intuitive enough that an engine flagging only reductions would teach
 * its users a rule that does not exist — so `classifyChange` never looks at the
 * direction of the change, and `FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE` is exported
 * so a caller can put the reason on a screen rather than rediscover it.
 *
 * **An unclassified change is undetermined, not exempt.** A change nobody has
 * mapped to a Fourth Schedule item is a question. Returning `EXEMPT` for it would
 * clear the one case most likely to be a real obligation — item 9, withdrawal of
 * a customary concession or privilege, is the item nobody recognises, because a
 * customary concession has no document to point at.
 *
 * **A pending proceeding is section 33, not a longer section 9A.** Where a
 * conciliation or adjudication proceeding is pending in respect of the
 * establishment, the employer needs the authority's **express permission** — a
 * different obligation, not a stricter version of the same one. Waiting
 * twenty-one days does not cure it, and reporting it as "notice period" is the
 * most expensive error available in this module. `assessChange` short-circuits
 * to `SECTION_33_PERMISSION_REQUIRED` before it computes any notice window at
 * all.
 *
 * **The determination is per person, not per change.** Section 9A protects
 * workmen as defined in section 2(s). It does not reach a person employed in a
 * managerial or administrative capacity, or a supervisor drawing above the
 * prescribed wage. An establishment-wide change touches both populations, and
 * the obligation attaches only to one — so a change produces a notice population
 * with a ground against each name, not a headcount.
 *
 * **Nothing here blocks anything.** Section 9A creates a notice obligation and a
 * section 31 penal consequence. It does not make the change void. An engine that
 * reported a change as impermissible would be asserting a remedy the Act does not
 * give, and a product that refused to save it would be wrong on the law.
 *
 * Pure functions, no database access, matching how `layoffCompensation.js` and
 * `shopsEstablishments.js` are written.
 */

'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The statutory notice period, in days.
 *
 * Central figure. The appropriate government differs by industry and the
 * prescribed manner of the notice is rule-made, so this is a default in
 * `DEFAULT_RULES` rather than a constant callers reach for directly.
 */
const STATUTORY_NOTICE_DAYS = 21;

const FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE =
  'Section 9A is procedural and is not conditioned on the change being adverse. A change in the workman’s favour is still a change in a Fourth Schedule matter and still requires twenty-one days’ notice. Reporting only reductions would teach a rule the Act does not contain.';

const UNCLASSIFIED_IS_A_QUESTION =
  'A change that has not been mapped to a Fourth Schedule item is undetermined, not exempt. Item 9 — withdrawal of a customary concession or privilege — is the item that is missed, because a customary concession has no document to point at.';

const PENDING_PROCEEDING_IS_SECTION_33 =
  'Where a conciliation or adjudication proceeding is pending, the change requires the authority’s express permission under section 33. That is a different obligation, not a longer notice period, and twenty-one days does not cure it.';

const NOTICE_DOES_NOT_INVALIDATE =
  'Section 9A creates a notice obligation with a section 31 penal consequence on the employer. It does not make the change void. A change effected without notice is a default to be recorded, not a change to be reversed.';

// --- The Fourth Schedule ----------------------------------------------------

/**
 * The Fourth Schedule, as eleven items.
 *
 * Held as data rather than as a switch statement because the classification is
 * the finding. A screen showing "requires notice" without the item it falls
 * under gives a reader nothing to check, and the item is what a Form E has to
 * state.
 */
const FOURTH_SCHEDULE = {
  WAGES: {
    item: 1,
    key: 'WAGES',
    text: 'Wages, including the period and mode of payment',
    /** What in this product effects a change of this kind. */
    effectedBy: ['salaryRevision', 'payrollCycle', 'salaryStructure'],
  },
  CONTRIBUTION_TO_FUND: {
    item: 2,
    key: 'CONTRIBUTION_TO_FUND',
    text: 'Contribution paid, or payable, by the employer to any provident fund or pension fund or for the benefit of the workmen under any law',
    effectedBy: ['benefits', 'vpf', 'nps', 'gratuityFund'],
  },
  COMPENSATORY_ALLOWANCE: {
    item: 3,
    key: 'COMPENSATORY_ALLOWANCE',
    text: 'Compensatory and other allowances',
    effectedBy: ['salaryStructure', 'allowanceDistributor', 'perDiem', 'fbp'],
  },
  HOURS_AND_REST: {
    item: 4,
    key: 'HOURS_AND_REST',
    text: 'Hours of work and rest intervals',
    effectedBy: ['rostering', 'workingHours', 'attendanceGrid'],
  },
  LEAVE_AND_HOLIDAYS: {
    item: 5,
    key: 'LEAVE_AND_HOLIDAYS',
    text: 'Leave with wages and holidays',
    effectedBy: ['leaveAccrual', 'leavePolicy', 'holidayCalendar'],
  },
  SHIFT_WORKING: {
    item: 6,
    key: 'SHIFT_WORKING',
    text: 'Starting, alteration or discontinuance of shift working otherwise than in accordance with standing orders',
    effectedBy: ['rostering', 'shiftPreference'],
    /**
     * The qualifier is the whole item. A shift change made *in accordance with
     * certified standing orders* is outside item 6 — the standing orders are
     * themselves a certified instrument and the change was already notified
     * through that route. A change outside them is in.
     */
    qualifiedByStandingOrders: true,
  },
  GRADE_CLASSIFICATION: {
    item: 7,
    key: 'GRADE_CLASSIFICATION',
    text: 'Classification by grades',
    effectedBy: ['salaryStructure', 'jobArchitecture'],
  },
  WITHDRAWAL_OF_CONCESSION: {
    item: 8,
    key: 'WITHDRAWAL_OF_CONCESSION',
    text: 'Withdrawal of any customary concession or privilege or change in usage',
    effectedBy: ['benefits', 'perquisites', 'policy'],
    /**
     * The item nobody recognises. A customary concession has no document to
     * point at — a festival advance given every year, a subsidised canteen, a
     * bus that has always run — so nothing in a product's data model marks its
     * withdrawal as a change at all.
     */
    hasNoUnderlyingDocument: true,
  },
  RATIONALISATION: {
    item: 9,
    key: 'RATIONALISATION',
    text: 'Introduction of new rules of discipline, or alteration of existing rules, except in so far as they are provided in standing orders',
    effectedBy: ['policy', 'disciplinary'],
    qualifiedByStandingOrders: true,
  },
  PLANT_OR_TECHNIQUE: {
    item: 10,
    key: 'PLANT_OR_TECHNIQUE',
    text: 'Rationalisation, standardisation or improvement of plant or technique likely to lead to retrenchment of workmen',
    effectedBy: ['automation', 'processChange'],
  },
  HEADCOUNT_IN_DEPARTMENT: {
    item: 11,
    key: 'HEADCOUNT_IN_DEPARTMENT',
    text: 'Any increase or reduction (other than casual) in the number of persons employed or to be employed in any occupation or process or department or shift, not occasioned by circumstances over which the employer has no control',
    effectedBy: ['headcountPlanning', 'recruitment', 'restructure'],
    /**
     * "Other than casual" is the qualifier that does the work. Ordinary
     * attrition and ordinary hiring are casual fluctuation; a department
     * restructured from forty heads to twenty-eight is not.
     */
    excludesCasualFluctuation: true,
  },
};

/** Verdicts a change can carry. */
const CHANGE_VERDICT = {
  /** Fourth Schedule matter, notice period runs, and there is time left. */
  NOTICE_REQUIRED: 'NOTICE_REQUIRED',
  /** Fourth Schedule matter, notice given, twenty-one clear days served. */
  NOTICE_SERVED: 'NOTICE_SERVED',
  /**
   * The effective date is inside twenty-one days of the notice. Distinct from
   * NOTICE_NOT_GIVEN because the effective date can still be moved, and this is
   * the only point at which the finding is useful.
   */
  NOTICE_PERIOD_SHORT: 'NOTICE_PERIOD_SHORT',
  /** The change took effect and no notice was given. Section 31 default. */
  EFFECTED_WITHOUT_NOTICE: 'EFFECTED_WITHOUT_NOTICE',
  /** Section 33 — express permission, not a notice period. */
  SECTION_33_PERMISSION_REQUIRED: 'SECTION_33_PERMISSION_REQUIRED',
  /** Section 9B, a settlement or award, or government-rule-governed workmen. */
  EXEMPT: 'EXEMPT',
  /** Not a Fourth Schedule matter. */
  NOT_A_SCHEDULED_MATTER: 'NOT_A_SCHEDULED_MATTER',
  /** Nobody has classified it. A question, not a clearance. */
  UNDETERMINED: 'UNDETERMINED',
};

/** Grounds on which section 9A does not apply. */
const EXEMPTION_GROUND = {
  /** Section 9B — the appropriate government has exempted the establishment. */
  SECTION_9B_NOTIFICATION: 'SECTION_9B_NOTIFICATION',
  /** Effected in pursuance of a settlement or award. */
  SETTLEMENT_OR_AWARD: 'SETTLEMENT_OR_AWARD',
  /** Workmen governed by government rules on conditions of service. */
  GOVERNMENT_SERVICE_RULES: 'GOVERNMENT_SERVICE_RULES',
};

/** Why a person is or is not a workman under section 2(s). */
const WORKMAN_GROUND = {
  WORKMAN: 'WORKMAN',
  MANAGERIAL_OR_ADMINISTRATIVE: 'MANAGERIAL_OR_ADMINISTRATIVE',
  SUPERVISORY_ABOVE_THRESHOLD: 'SUPERVISORY_ABOVE_THRESHOLD',
  /** Supervisory but under the wage threshold — still a workman. */
  SUPERVISORY_BELOW_THRESHOLD: 'SUPERVISORY_BELOW_THRESHOLD',
  ARMED_FORCES_OR_POLICE: 'ARMED_FORCES_OR_POLICE',
};

/**
 * The rule set, with the central figures as defaults.
 *
 * The Act is central, but the appropriate government differs by industry and
 * the prescribed manner of the notice is rule-made. A caller with a state or
 * industry variation overrides here rather than editing the engine.
 */
const DEFAULT_RULES = {
  noticeDays: STATUTORY_NOTICE_DAYS,
  /**
   * Section 2(s)(iv): a supervisor drawing wages above this is not a workman.
   * Ten thousand rupees a month since the 2010 amendment.
   */
  supervisoryWageThreshold: 10000,
  noticeForm: 'Form E',
  /**
   * Whether the twenty-one days are clear days — the day of notice and the day
   * of effect both excluded. Kept explicit because an off-by-one here is a
   * twenty-day notice reported as compliant.
   */
  clearDays: true,
};

// --- Helpers ----------------------------------------------------------------

/**
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Midnight UTC, so a notice served at 23:00 and one at 01:00 count the same. */
function startOfDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Whole days between two dates.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

/**
 * @param {object} [overrides]
 * @returns {object}
 */
function resolveRules(overrides) {
  return { ...DEFAULT_RULES, ...(overrides || {}) };
}

// --- Classification ---------------------------------------------------------

/**
 * Which Fourth Schedule item a proposed change falls under.
 *
 * Takes the change's declared `scheduleItem` where a human has recorded one, and
 * otherwise infers from the module that effects it. Inference is deliberately
 * conservative: it produces a *suggestion* with `inferred: true` on it, and a
 * module that maps to more than one item produces all of them rather than
 * picking. `HOURS_AND_REST` and `SHIFT_WORKING` are both reached from the
 * roster, and a shift-pattern change is genuinely both.
 *
 * Never looks at the direction of the change. See
 * `FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE`.
 *
 * @param {object} change
 * @param {string} [change.scheduleItem] A FOURTH_SCHEDULE key, where recorded.
 * @param {string} [change.effectedBy] The module making the change.
 * @param {boolean} [change.inAccordanceWithStandingOrders]
 * @param {boolean} [change.casualFluctuation]
 * @returns {{items: Array<object>, inferred: boolean, verdict: string, reason: string}}
 */
function classifyChange(change) {
  const declared = change && change.scheduleItem;

  if (declared) {
    const item = FOURTH_SCHEDULE[declared];
    if (!item) {
      return {
        items: [],
        inferred: false,
        verdict: CHANGE_VERDICT.UNDETERMINED,
        reason: `‘${declared}’ is not a Fourth Schedule item. ${UNCLASSIFIED_IS_A_QUESTION}`,
      };
    }

    const carved = carveOut(item, change);
    if (carved) return carved;

    return {
      items: [item],
      inferred: false,
      verdict: CHANGE_VERDICT.NOTICE_REQUIRED,
      reason: `Fourth Schedule item ${item.item}: ${item.text}.`,
    };
  }

  const effectedBy = change && change.effectedBy;
  if (!effectedBy) {
    return {
      items: [],
      inferred: false,
      verdict: CHANGE_VERDICT.UNDETERMINED,
      reason: UNCLASSIFIED_IS_A_QUESTION,
    };
  }

  const matches = Object.values(FOURTH_SCHEDULE).filter((item) =>
    item.effectedBy.includes(effectedBy),
  );

  if (matches.length === 0) {
    return {
      items: [],
      inferred: false,
      verdict: CHANGE_VERDICT.UNDETERMINED,
      reason: `No Fourth Schedule item is mapped to ‘${effectedBy}’. ${UNCLASSIFIED_IS_A_QUESTION}`,
    };
  }

  const carvedOut = matches
    .map((item) => carveOut(item, change))
    .filter(Boolean);
  const surviving = matches.filter((item) => !carveOut(item, change));

  if (surviving.length === 0) {
    return carvedOut[0];
  }

  return {
    items: surviving,
    inferred: true,
    verdict: CHANGE_VERDICT.NOTICE_REQUIRED,
    reason:
      surviving.length === 1
        ? `Inferred from ‘${effectedBy}’ — Fourth Schedule item ${surviving[0].item}: ${surviving[0].text}. Confirm before serving.`
        : `Inferred from ‘${effectedBy}’ — items ${surviving
            .map((item) => item.item)
            .join(
              ' and ',
            )} both apply. A shift-pattern change is genuinely both hours and shift working; the Form E states each.`,
  };
}

/**
 * The two qualifiers inside the Schedule itself.
 *
 * Items 6 and 9 are expressed "otherwise than in accordance with standing
 * orders", and item 11 is expressed "other than casual". These are not
 * exemptions under section 9B — they are the boundary of the item, and a change
 * outside the item never required notice in the first place.
 *
 * @returns {object|null}
 */
function carveOut(item, change) {
  if (
    item.qualifiedByStandingOrders &&
    change &&
    change.inAccordanceWithStandingOrders === true
  ) {
    return {
      items: [],
      inferred: false,
      verdict: CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER,
      reason: `Item ${item.item} reaches a change made ‘otherwise than in accordance with standing orders’. This change is in accordance with certified standing orders, which are themselves a certified instrument, so it falls outside the item rather than being exempted from it.`,
    };
  }

  if (
    item.excludesCasualFluctuation &&
    change &&
    change.casualFluctuation === true
  ) {
    return {
      items: [],
      inferred: false,
      verdict: CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER,
      reason: `Item ${item.item} excludes casual fluctuation in the number of persons employed. Ordinary attrition and ordinary hiring are casual; a department restructured is not.`,
    };
  }

  return null;
}

// --- Section 2(s) -----------------------------------------------------------

/**
 * Whether a person is a workman, and why.
 *
 * The ground is returned in every case, including the affirmative one. A notice
 * population that says only "42 workmen" cannot be checked; one that says why
 * each of the forty-two is one can.
 *
 * `SUPERVISORY_BELOW_THRESHOLD` is a separate ground from `WORKMAN` for the same
 * reason: a supervisor is a workman only while their wages stay under the
 * threshold, so a raise can move them out of the population, and a reviewer
 * needs to see which names are near that line.
 *
 * @param {object} person
 * @param {string} [person.capacity] MANAGERIAL | ADMINISTRATIVE | SUPERVISORY | ARMED_FORCES | other
 * @param {number} [person.monthlyWages]
 * @param {object} [rulesOverride]
 * @returns {{isWorkman: boolean, ground: string, reason: string}}
 */
function determineWorkman(person, rulesOverride) {
  const rules = resolveRules(rulesOverride);
  const capacity = String((person && person.capacity) || '').toUpperCase();
  const wages = Number((person && person.monthlyWages) || 0);

  if (capacity === 'ARMED_FORCES' || capacity === 'POLICE') {
    return {
      isWorkman: false,
      ground: WORKMAN_GROUND.ARMED_FORCES_OR_POLICE,
      reason:
        'Section 2(s)(ii) — subject to the Air Force Act, the Army Act or the Navy Act, or employed in the police service or as an officer of a prison.',
    };
  }

  if (capacity === 'MANAGERIAL' || capacity === 'ADMINISTRATIVE') {
    return {
      isWorkman: false,
      ground: WORKMAN_GROUND.MANAGERIAL_OR_ADMINISTRATIVE,
      reason:
        'Section 2(s)(iii) — employed mainly in a managerial or administrative capacity. No section 9A obligation attaches to this person.',
    };
  }

  if (capacity === 'SUPERVISORY') {
    if (wages > rules.supervisoryWageThreshold) {
      return {
        isWorkman: false,
        ground: WORKMAN_GROUND.SUPERVISORY_ABOVE_THRESHOLD,
        reason: `Section 2(s)(iv) — employed in a supervisory capacity drawing wages of ₹${wages} a month, above the ₹${rules.supervisoryWageThreshold} threshold.`,
      };
    }
    return {
      isWorkman: true,
      ground: WORKMAN_GROUND.SUPERVISORY_BELOW_THRESHOLD,
      reason: `Supervisory, but drawing ₹${wages} a month against a ₹${rules.supervisoryWageThreshold} threshold — still a workman under section 2(s). A raise past the threshold moves this person out of the notice population.`,
    };
  }

  return {
    isWorkman: true,
    ground: WORKMAN_GROUND.WORKMAN,
    reason:
      'Section 2(s) — employed to do manual, unskilled, skilled, technical, operational, clerical or supervisory work.',
  };
}

/**
 * The notice population for a change.
 *
 * Returns every person with their determination, not just the workmen, so that a
 * screen can show what a change touched against what it obliged. The two numbers
 * differing is the point.
 *
 * @param {Array<object>} people
 * @param {object} [rulesOverride]
 * @returns {{population: Array<object>, workmen: Array<object>, excluded: Array<object>, affected: number, obliged: number}}
 */
function noticePopulation(people, rulesOverride) {
  const population = (people || []).map((person) => {
    const determination = determineWorkman(person, rulesOverride);
    return {
      employeeId: person.employeeId || person._id || null,
      name: person.name || null,
      capacity: person.capacity || null,
      monthlyWages: person.monthlyWages ?? null,
      ...determination,
    };
  });

  const workmen = population.filter((row) => row.isWorkman);
  const excluded = population.filter((row) => !row.isWorkman);

  return {
    population,
    workmen,
    excluded,
    affected: population.length,
    obliged: workmen.length,
  };
}

// --- The notice window ------------------------------------------------------

/**
 * Twenty-one days, computed backwards from the proposed effective date.
 *
 * Backwards rather than forwards because that is the question the user has: the
 * effective date is chosen first, and what they need to know is the last day on
 * which a notice served would still be in time. A forward computation from the
 * notice date answers a question nobody asked and cannot be reported before a
 * notice exists.
 *
 * Clear days by default: the day of notice and the day of effect are both
 * excluded. A notice served on the 1st for a change effective on the 22nd gives
 * twenty clear days, not twenty-one.
 *
 * @param {Date|string} effectiveOn
 * @param {Date|string|null} noticedOn
 * @param {Date|string} asOf
 * @param {object} [rulesOverride]
 * @returns {object}
 */
function noticeWindow(effectiveOn, noticedOn, asOf, rulesOverride) {
  const rules = resolveRules(rulesOverride);
  const effective = toDate(effectiveOn);
  const notice = toDate(noticedOn);
  const today = toDate(asOf) || new Date();

  if (!effective) {
    return {
      verdict: CHANGE_VERDICT.UNDETERMINED,
      reason:
        'No proposed effective date. The twenty-one days run backwards from it, so without one there is no window to compute.',
      noticeDays: rules.noticeDays,
      latestNoticeDate: null,
      daysGiven: null,
      shortfallDays: null,
      daysRemaining: null,
    };
  }

  /**
   * The last day on which a notice would still be in time. With clear days the
   * notice must precede the effective date by more than the notice period, so
   * the latest date is `effective - (noticeDays + 1)`.
   */
  const offset = rules.clearDays ? rules.noticeDays + 1 : rules.noticeDays;
  const latestNoticeDate = new Date(
    startOfDay(effective) - offset * MS_PER_DAY,
  );

  const hasTakenEffect = daysBetween(today, effective) <= 0;

  if (!notice) {
    if (hasTakenEffect) {
      return {
        verdict: CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE,
        reason: `The change took effect on ${effective.toISOString().slice(0, 10)} and no notice was served. Section 31 makes this an offence by the employer. ${NOTICE_DOES_NOT_INVALIDATE}`,
        noticeDays: rules.noticeDays,
        latestNoticeDate,
        daysGiven: 0,
        shortfallDays: rules.noticeDays,
        daysRemaining: null,
      };
    }

    const daysRemaining = daysBetween(today, latestNoticeDate);
    if (daysRemaining < 0) {
      return {
        verdict: CHANGE_VERDICT.NOTICE_PERIOD_SHORT,
        reason: `No notice served, and the latest date on which one would have been in time was ${latestNoticeDate.toISOString().slice(0, 10)}. Twenty-one clear days can still be given by moving the effective date to ${new Date(startOfDay(today) + offset * MS_PER_DAY).toISOString().slice(0, 10)} or later.`,
        noticeDays: rules.noticeDays,
        latestNoticeDate,
        daysGiven: 0,
        shortfallDays: -daysRemaining,
        daysRemaining,
      };
    }

    return {
      verdict: CHANGE_VERDICT.NOTICE_REQUIRED,
      reason: `Notice not yet served. ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in which to serve it and still give twenty-one clear days.`,
      noticeDays: rules.noticeDays,
      latestNoticeDate,
      daysGiven: 0,
      shortfallDays: null,
      daysRemaining,
    };
  }

  const daysGiven = daysBetween(notice, effective) - (rules.clearDays ? 1 : 0);

  if (daysGiven >= rules.noticeDays) {
    return {
      verdict: CHANGE_VERDICT.NOTICE_SERVED,
      reason: `${daysGiven} clear day${daysGiven === 1 ? '' : 's'} given against a requirement of ${rules.noticeDays}.`,
      noticeDays: rules.noticeDays,
      latestNoticeDate,
      daysGiven,
      shortfallDays: 0,
      daysRemaining: hasTakenEffect ? null : daysBetween(today, effective),
    };
  }

  if (hasTakenEffect) {
    return {
      verdict: CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE,
      reason: `The change took effect on ${effective.toISOString().slice(0, 10)} with ${daysGiven} clear day${daysGiven === 1 ? '' : 's'} of notice against a requirement of ${rules.noticeDays}. Short notice is no notice for section 9A. ${NOTICE_DOES_NOT_INVALIDATE}`,
      noticeDays: rules.noticeDays,
      latestNoticeDate,
      daysGiven,
      shortfallDays: rules.noticeDays - daysGiven,
      daysRemaining: null,
    };
  }

  return {
    verdict: CHANGE_VERDICT.NOTICE_PERIOD_SHORT,
    reason: `Notice served on ${notice.toISOString().slice(0, 10)} gives ${daysGiven} clear day${daysGiven === 1 ? '' : 's'} against a requirement of ${rules.noticeDays}. The effective date has not passed — moving it to ${new Date(startOfDay(notice) + offset * MS_PER_DAY).toISOString().slice(0, 10)} or later cures the shortfall.`,
    noticeDays: rules.noticeDays,
    latestNoticeDate,
    daysGiven,
    shortfallDays: rules.noticeDays - daysGiven,
    daysRemaining: daysBetween(today, effective),
  };
}

// --- Exemptions -------------------------------------------------------------

/**
 * Whether a recorded exemption stands.
 *
 * Every ground carries an authority — a notification number, a settlement
 * reference, the rules relied on. An exemption without one is not recorded as an
 * exemption, because "we thought it was covered by the settlement" is exactly the
 * position section 9A defaults are argued from.
 *
 * @param {object} [exemption]
 * @returns {{exempt: boolean, ground: string|null, reason: string}}
 */
function assessExemption(exemption) {
  if (!exemption || !exemption.ground) {
    return { exempt: false, ground: null, reason: 'No exemption claimed.' };
  }

  const ground = String(exemption.ground).toUpperCase();
  if (!EXEMPTION_GROUND[ground]) {
    return {
      exempt: false,
      ground: null,
      reason: `‘${exemption.ground}’ is not a recognised ground. Section 9A yields to a section 9B notification, to a change effected in pursuance of a settlement or award, and to workmen governed by government service rules — and to nothing else.`,
    };
  }

  const authority = String(exemption.authority || '').trim();
  if (!authority) {
    return {
      exempt: false,
      ground,
      reason:
        'The ground is recognised but no authority is recorded. An exemption is a document — a notification number, a settlement reference, the rules relied on — and one without it is a belief.',
    };
  }

  return {
    exempt: true,
    ground,
    reason: describeExemption(ground, authority),
  };
}

function describeExemption(ground, authority) {
  switch (ground) {
    case EXEMPTION_GROUND.SECTION_9B_NOTIFICATION:
      return `Section 9B — the appropriate government has exempted this establishment by ${authority}. The exemption is for a stated period; check it has not run out.`;
    case EXEMPTION_GROUND.SETTLEMENT_OR_AWARD:
      return `Effected in pursuance of ${authority}. A change made to give effect to a settlement or award is outside section 9A — the terms were already arrived at through the machinery the section exists to protect.`;
    case EXEMPTION_GROUND.GOVERNMENT_SERVICE_RULES:
      return `Workmen governed by ${authority}. Section 9A does not reach workmen to whom government rules on conditions of service apply.`;
    default:
      return authority;
  }
}

// --- Section 33 -------------------------------------------------------------

/**
 * Whether a pending proceeding puts the change under section 33.
 *
 * Checked before anything else in `assessChange`, and returned as its own
 * verdict rather than as a stricter notice period. Section 33(1) forbids the
 * change during pendency **save with the express permission in writing of the
 * authority**; section 33(2) allows it in accordance with standing orders where
 * the workman is not concerned in the dispute. Neither is a waiting period, and
 * a screen that shows "21 days" against a pending adjudication is telling the
 * employer to commit an offence on a date certain.
 *
 * @param {object} [proceeding]
 * @returns {{pending: boolean, verdict: string|null, reason: string, permissionOnRecord: boolean}}
 */
function assessPendingProceeding(proceeding) {
  if (!proceeding || !proceeding.pending) {
    return {
      pending: false,
      verdict: null,
      reason: 'No conciliation or adjudication proceeding pending.',
      permissionOnRecord: false,
    };
  }

  const permission = String(proceeding.expressPermissionReference || '').trim();
  const forum = String(proceeding.forum || 'the authority').trim();

  if (permission) {
    return {
      pending: true,
      verdict: null,
      reason: `A proceeding is pending before ${forum} and express permission under section 33 is on record (${permission}). The section 9A notice period runs alongside it — the permission does not displace the notice.`,
      permissionOnRecord: true,
    };
  }

  return {
    pending: true,
    verdict: CHANGE_VERDICT.SECTION_33_PERMISSION_REQUIRED,
    reason: `A proceeding is pending before ${forum}. ${PENDING_PROCEEDING_IS_SECTION_33}`,
    permissionOnRecord: false,
  };
}

// --- The assessment ---------------------------------------------------------

/**
 * The whole position on one proposed change.
 *
 * Order matters and is the substance of the function:
 *
 *   1. Section 33 first. A pending proceeding is a different obligation, and
 *      computing a notice window for it produces a number that is worse than no
 *      number at all.
 *   2. Classification next. An unclassified change is UNDETERMINED and never
 *      falls through to a clearance.
 *   3. Exemptions after classification, not before — an exemption recorded
 *      against a change that was never a Fourth Schedule matter is noise, and
 *      knowing which of the two applies matters when the exemption expires.
 *   4. The window last, and only for changes that reach it.
 *
 * @param {object} change
 * @param {Array<object>} [people]
 * @param {object} [options]
 * @returns {object}
 */
function assessChange(change, people, options) {
  const opts = options || {};
  const rules = resolveRules(opts.rules);
  const asOf = toDate(opts.asOf) || new Date();

  const population = noticePopulation(people || [], opts.rules);
  const proceeding = assessPendingProceeding(change && change.proceeding);

  const base = {
    changeId: (change && (change.changeId || change._id)) || null,
    description: (change && change.description) || null,
    effectedBy: (change && change.effectedBy) || null,
    effectiveOn: toDate(change && change.effectiveOn),
    noticedOn: toDate(change && change.noticedOn),
    rules,
    proceeding,
    population,
    notes: {
      favourableChangeStillNeedsNotice: FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
      noticeDoesNotInvalidate: NOTICE_DOES_NOT_INVALIDATE,
    },
  };

  if (proceeding.verdict) {
    return {
      ...base,
      verdict: proceeding.verdict,
      reason: proceeding.reason,
      scheduleItems: classifyChange(change).items,
      window: null,
      exemption: null,
    };
  }

  const classification = classifyChange(change);

  if (
    classification.verdict === CHANGE_VERDICT.UNDETERMINED ||
    classification.verdict === CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER
  ) {
    return {
      ...base,
      verdict: classification.verdict,
      reason: classification.reason,
      scheduleItems: classification.items,
      inferred: classification.inferred,
      window: null,
      exemption: null,
    };
  }

  const exemption = assessExemption(change && change.exemption);
  if (exemption.exempt) {
    return {
      ...base,
      verdict: CHANGE_VERDICT.EXEMPT,
      reason: exemption.reason,
      scheduleItems: classification.items,
      inferred: classification.inferred,
      window: null,
      exemption,
    };
  }

  if (population.obliged === 0 && population.affected > 0) {
    return {
      ...base,
      verdict: CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER,
      reason: `The change is a Fourth Schedule matter, but none of the ${population.affected} people it touches is a workman under section 2(s). The obligation attaches to workmen and to nobody else.`,
      scheduleItems: classification.items,
      inferred: classification.inferred,
      window: null,
      exemption,
    };
  }

  const window = noticeWindow(
    change && change.effectiveOn,
    change && change.noticedOn,
    asOf,
    opts.rules,
  );

  return {
    ...base,
    verdict: window.verdict,
    reason: window.reason,
    scheduleItems: classification.items,
    inferred: classification.inferred,
    window,
    exemption,
  };
}

/**
 * The queue, ordered by how soon something has to happen.
 *
 * Defaults first — a change that took effect without notice is a section 31
 * offence that has already been committed and no amount of days remaining will
 * change it. Then section 33, then short notice, then the ones still inside
 * their window ordered by days remaining. Undetermined last but never dropped:
 * an unclassified change is a question and the queue is where it gets asked.
 *
 * @param {Array<object>} assessments
 * @returns {Array<object>}
 */
function orderQueue(assessments) {
  const rank = {
    [CHANGE_VERDICT.EFFECTED_WITHOUT_NOTICE]: 0,
    [CHANGE_VERDICT.SECTION_33_PERMISSION_REQUIRED]: 1,
    [CHANGE_VERDICT.NOTICE_PERIOD_SHORT]: 2,
    [CHANGE_VERDICT.NOTICE_REQUIRED]: 3,
    [CHANGE_VERDICT.UNDETERMINED]: 4,
    [CHANGE_VERDICT.NOTICE_SERVED]: 5,
    [CHANGE_VERDICT.EXEMPT]: 6,
    [CHANGE_VERDICT.NOT_A_SCHEDULED_MATTER]: 7,
  };

  return [...(assessments || [])].sort((a, b) => {
    const byRank = (rank[a.verdict] ?? 99) - (rank[b.verdict] ?? 99);
    if (byRank !== 0) return byRank;

    const aDays = a.window && a.window.daysRemaining;
    const bDays = b.window && b.window.daysRemaining;
    if (aDays === null || aDays === undefined) return 1;
    if (bDays === null || bDays === undefined) return -1;
    return aDays - bDays;
  });
}

/**
 * What a Form E has to state for one change.
 *
 * Not a renderer. It returns the fields, and refuses to produce them for a
 * change that has no schedule item — a Form E stating no item is not a notice,
 * and generating one would let a default be papered over with a document.
 *
 * @param {object} assessment
 * @returns {{ready: boolean, form: object|null, missing: Array<string>}}
 */
function formEFields(assessment) {
  const missing = [];

  if (
    !assessment ||
    !assessment.scheduleItems ||
    assessment.scheduleItems.length === 0
  ) {
    missing.push('Fourth Schedule item');
  }
  if (!assessment || !assessment.effectiveOn)
    missing.push('proposed effective date');
  if (!assessment || !assessment.description)
    missing.push('nature of the change');
  if (
    !assessment ||
    !assessment.population ||
    assessment.population.obliged === 0
  ) {
    missing.push('workmen affected');
  }

  if (missing.length > 0) {
    return { ready: false, form: null, missing };
  }

  return {
    ready: true,
    missing: [],
    form: {
      form: assessment.rules.noticeForm,
      natureOfChange: assessment.description,
      scheduleItems: assessment.scheduleItems.map((item) => ({
        item: item.item,
        text: item.text,
      })),
      proposedEffectiveDate: assessment.effectiveOn,
      workmenAffected: assessment.population.obliged,
      reasonsForChange: assessment.reasonsForChange || null,
      note: FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
    },
  };
}

module.exports = {
  STATUTORY_NOTICE_DAYS,
  FOURTH_SCHEDULE,
  CHANGE_VERDICT,
  EXEMPTION_GROUND,
  WORKMAN_GROUND,
  DEFAULT_RULES,
  FAVOURABLE_CHANGE_STILL_NEEDS_NOTICE,
  UNCLASSIFIED_IS_A_QUESTION,
  PENDING_PROCEEDING_IS_SECTION_33,
  NOTICE_DOES_NOT_INVALIDATE,
  resolveRules,
  classifyChange,
  determineWorkman,
  noticePopulation,
  noticeWindow,
  assessExemption,
  assessPendingProceeding,
  assessChange,
  orderQueue,
  formEFields,
};
