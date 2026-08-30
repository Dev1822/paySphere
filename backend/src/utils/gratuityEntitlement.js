/**
 * Payment of Gratuity Act, 1972 — the entitlement, not the amount (#2031).
 *
 * `settlement.js` computes the amount: the five-year gate, `(wages × 15 ×
 * years) / 26`, the ≥6-month rounding and the ₹20,00,000 ceiling. That stays
 * where it is and nothing here recomputes it. `gratuityValuation.js` (#1344)
 * measures the defined benefit obligation for the whole workforce under Ind AS
 * 19 — every future exit, weighted and discounted — and its own header sets out
 * why that is a different question. This is the third: one person, one date, and
 * everything about the obligation other than its size.
 *
 * Five things shape everything below.
 *
 * **The thirty days run whether or not anybody applies.** Section 7(2) requires
 * the employer to determine the amount and give notice *as soon as gratuity
 * becomes payable*, whether or not an application has been made; section 7(3)
 * requires payment within thirty days of that date. The clock starts on the last
 * working day, which `settlement.js` already knows, and it does not wait for a
 * Form I. See `CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION`.
 *
 * **Section 7(3A) interest accrues by default.** Ten per cent simple interest
 * from the date gratuity became payable to the date of payment, and there are
 * exactly two ways out which must both be present: the delay is due to the fault
 * of the employee **and** the employer holds the controlling authority's written
 * permission for the delay on that ground. `interestPosition` therefore computes
 * the interest first and clears it only against a recorded permission — never
 * against a flag.
 *
 * **Five years is not a requirement on death or disablement.** The proviso to
 * section 4(1). `settlement.js` today returns `eligible: false, amount: 0` for
 * an employee who died at three years' service, which is a wrong answer to the
 * most sensitive question in the module. `payability` applies the gate only on
 * the grounds the Act applies it to, and on death the payee is the nominee or
 * heir rather than the employee.
 *
 * **Forfeiture is two rules.** Section 4(6)(a) forfeits *to the extent of the
 * damage or loss* — quantified, mandatory, capped at the damage. Section 4(6)(b)
 * permits whole or partial forfeiture, discretionary, and only for riotous or
 * disorderly conduct, an act of violence, or an offence involving moral
 * turpitude committed in the course of employment. A single `forfeited` flag
 * lets a ₹4,000 breakage forfeit ₹6,00,000, and hides that (b) requires the
 * termination to have been **for** that act.
 *
 * **The statutory figure can be a floor.** Section 4(5) preserves better terms
 * under any award, agreement or contract. Reporting the section 4 computation as
 * "the gratuity" is wrong for every employer whose settlement is more generous.
 *
 * Pure functions, no database access, matching how `settlement.js` and
 * `standingOrders.js` are written.
 */

'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

const CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION =
  'Section 7(2): the employer shall determine the amount and give notice to the person to whom it is payable and to the controlling authority as soon as gratuity becomes payable, whether or not an application has been made. The thirty days under section 7(3) run from the date it became payable, not from the date a Form I arrived.';

const INTEREST_IS_NOT_DISCRETIONARY =
  'Section 7(3A): simple interest at the notified rate is payable from the date gratuity became payable until it is paid. It is not a charge the employer decides. The only relief needs both limbs — the delay due to the fault of the employee, and the written permission of the controlling authority for the delay on that ground.';

const FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH =
  'The proviso to section 4(1): completion of five years of continuous service is not necessary where termination is due to death or disablement. On death the amount is payable to the nominee, or to the heirs where there is no nomination.';

const FORFEITURE_IS_TWO_RULES =
  'Section 4(6)(a) forfeits gratuity to the extent of the damage or loss caused, and no further. Section 4(6)(b) permits whole or partial forfeiture, but only where services were terminated for riotous or disorderly conduct, an act of violence, or an offence involving moral turpitude committed in the course of employment.';

const STATUTORY_FIGURE_MAY_BE_A_FLOOR =
  'Section 4(5): nothing in the Act affects the right of an employee to receive better terms of gratuity under any award, agreement or contract with the employer. Where the contractual figure is higher it is the contractual figure that is payable.';

// --- Grounds ----------------------------------------------------------------

/**
 * Why the employment ended.
 *
 * `gateApplies` is the field that carries the proviso to section 4(1), and it is
 * data rather than a condition in `payability` so that the exception cannot be
 * lost in a refactor of the branch.
 */
const CESSATION_GROUND = {
  SUPERANNUATION: {
    key: 'SUPERANNUATION',
    label: 'Superannuation',
    gateApplies: true,
    payableTo: 'EMPLOYEE',
  },
  RETIREMENT: {
    key: 'RETIREMENT',
    label: 'Retirement',
    gateApplies: true,
    payableTo: 'EMPLOYEE',
  },
  RESIGNATION: {
    key: 'RESIGNATION',
    label: 'Resignation',
    gateApplies: true,
    payableTo: 'EMPLOYEE',
  },
  TERMINATION: {
    key: 'TERMINATION',
    label: 'Termination by the employer',
    gateApplies: true,
    payableTo: 'EMPLOYEE',
  },
  DEATH: {
    key: 'DEATH',
    label: 'Death in service',
    /** The proviso to section 4(1). */
    gateApplies: false,
    payableTo: 'NOMINEE_OR_HEIR',
  },
  DISABLEMENT: {
    key: 'DISABLEMENT',
    label: 'Disablement due to accident or disease',
    gateApplies: false,
    payableTo: 'EMPLOYEE',
  },
};

/** What the entitlement position is. */
const PAYABILITY = {
  PAYABLE: 'PAYABLE',
  /** Under five years on a ground the gate applies to. */
  NOT_PAYABLE_SERVICE_SHORT: 'NOT_PAYABLE_SERVICE_SHORT',
  /** Payable, and payable to the nominee or heirs rather than the employee. */
  PAYABLE_TO_NOMINEE: 'PAYABLE_TO_NOMINEE',
  UNDETERMINED: 'UNDETERMINED',
};

/** Where the obligation stands against the section 7 clock. */
const OBLIGATION_STATE = {
  /** Inside thirty days, unpaid. */
  WITHIN_PAYMENT_PERIOD: 'WITHIN_PAYMENT_PERIOD',
  /** Past thirty days, unpaid. Interest running. */
  OVERDUE: 'OVERDUE',
  /** Paid inside thirty days. */
  PAID_IN_TIME: 'PAID_IN_TIME',
  /** Paid late. Interest owed for the days it ran. */
  PAID_LATE: 'PAID_LATE',
};

/** The two sub-sections of section 4(6). */
const FORFEITURE_GROUND = {
  /** 4(6)(a) — damage, loss or destruction of employer property. */
  DAMAGE_OR_LOSS: 'DAMAGE_OR_LOSS',
  /** 4(6)(b) — riotous or disorderly conduct or any other act of violence. */
  RIOTOUS_OR_VIOLENT_CONDUCT: 'RIOTOUS_OR_VIOLENT_CONDUCT',
  /** 4(6)(b) — an offence involving moral turpitude in the course of employment. */
  MORAL_TURPITUDE: 'MORAL_TURPITUDE',
};

const FORFEITURE_VERDICT = {
  APPLIED: 'APPLIED',
  /** Claimed above what the sub-section permits. Capped, and reported. */
  EXCESSIVE: 'EXCESSIVE',
  /** The ground does not support forfeiture at all. */
  NOT_PERMITTED: 'NOT_PERMITTED',
  NONE: 'NONE',
};

/**
 * The rule set.
 *
 * The interest rate is notified by the Central Government and has moved, so it
 * is a default here rather than a constant.
 */
const DEFAULT_RULES = {
  /** Section 4(1) — five years of continuous service. */
  eligibilityYears: 5,
  /** Section 7(3) — thirty days from the date gratuity became payable. */
  paymentPeriodDays: 30,
  /** Section 7(3A) — ten per cent simple interest, notified. */
  interestRatePercent: 10,
  /** Section 4(3) — the ceiling, for the better-terms comparison only. */
  ceiling: 2000000,
  nominationForm: 'Form F',
  applicationForm: 'Form I',
  employerNoticeForm: 'Form L',
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

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function resolveRules(overrides) {
  return { ...DEFAULT_RULES, ...(overrides || {}) };
}

// --- Payability -------------------------------------------------------------

/**
 * Whether gratuity is payable, on what ground, and to whom.
 *
 * The five-year gate is applied only where `CESSATION_GROUND[...].gateApplies`
 * says so. That is the proviso to section 4(1), and it is the answer
 * `settlement.js` gets wrong today for an employee who died at three years'
 * service — `eligible: false, amount: 0`, with an explanation counting the years
 * they did not live to complete.
 *
 * Takes completed years rather than dates because `settlement.js` already owns
 * the service computation, including the distinction between actual completed
 * service and the ≥6-month rounding used in the formula. Duplicating it here
 * would be a second answer to a question that already has one.
 *
 * @param {object} args
 * @param {string} args.ground A CESSATION_GROUND key.
 * @param {number} args.completedYears Actual completed years, before rounding.
 * @param {boolean} [args.hasNomination]
 * @param {object} [rulesOverride]
 * @returns {object}
 */
function payability(args, rulesOverride) {
  const rules = resolveRules(rulesOverride);
  const groundKey = String((args && args.ground) || '').toUpperCase();
  const ground = CESSATION_GROUND[groundKey];

  if (!ground) {
    return {
      verdict: PAYABILITY.UNDETERMINED,
      ground: null,
      reason: `‘${(args && args.ground) || ''}’ is not a recognised ground of cessation. Gratuity turns on why the employment ended — five years is not required on death or disablement — so an unrecorded ground is a question rather than a refusal.`,
      grounds: Object.keys(CESSATION_GROUND),
    };
  }

  const completedYears = Number((args && args.completedYears) ?? NaN);
  if (!Number.isFinite(completedYears) || completedYears < 0) {
    return {
      verdict: PAYABILITY.UNDETERMINED,
      ground: ground.key,
      reason:
        'Completed years of continuous service could not be determined. settlement.js owns that computation; this module does not recompute it.',
    };
  }

  if (ground.gateApplies && completedYears < rules.eligibilityYears) {
    return {
      verdict: PAYABILITY.NOT_PAYABLE_SERVICE_SHORT,
      ground: ground.key,
      payableTo: null,
      reason: `${completedYears} completed year${completedYears === 1 ? '' : 's'} of continuous service against the ${rules.eligibilityYears} required by section 4(1) on ${ground.label.toLowerCase()}.`,
      note: FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
    };
  }

  if (ground.payableTo === 'NOMINEE_OR_HEIR') {
    const hasNomination = Boolean(args && args.hasNomination);
    return {
      verdict: PAYABILITY.PAYABLE_TO_NOMINEE,
      ground: ground.key,
      payableTo: hasNomination ? 'NOMINEE' : 'HEIRS',
      gateWaived:
        !ground.gateApplies && completedYears < rules.eligibilityYears,
      reason: hasNomination
        ? `Payable on ${ground.label.toLowerCase()}. The five-year requirement does not apply, and the amount goes to the nominee under the ${rules.nominationForm} on record — not to the estate and not to whoever the payroll record names as a contact.`
        : `Payable on ${ground.label.toLowerCase()}. The five-year requirement does not apply. There is no ${rules.nominationForm} on record, so the amount goes to the heirs — which is a determination somebody has to make, not a default the system can supply.`,
      note: FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
    };
  }

  return {
    verdict: PAYABILITY.PAYABLE,
    ground: ground.key,
    payableTo: 'EMPLOYEE',
    gateWaived: !ground.gateApplies && completedYears < rules.eligibilityYears,
    reason: ground.gateApplies
      ? `Payable on ${ground.label.toLowerCase()} — ${completedYears} completed years against the ${rules.eligibilityYears} required.`
      : `Payable on ${ground.label.toLowerCase()}. The five-year requirement does not apply to this ground.`,
    note: ground.gateApplies ? null : FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
  };
}

// --- The Form F nomination --------------------------------------------------

/**
 * Whether a nomination stands.
 *
 * Rule 6 under the Act, and deliberately not the EPF Form 2 nomination in
 * `edliAssurance.model.js`. They are separate instruments and an employee may
 * name different people on each — reusing one for the other pays the wrong
 * person the most sensitive amount in the module.
 *
 * Two rules do the work. Shares must total one hundred per cent, because a
 * nomination summing to sixty is a real thing employees file and leaves forty
 * per cent with no payee. And rule 6(3): a nomination made by an employee who
 * has a family must be in favour of family, and one made in favour of a
 * non-family member is void — with the corollary in rule 6(4) that an employee
 * who acquires a family afterwards must make a fresh nomination, which makes the
 * earlier one void from that point rather than merely stale.
 *
 * @param {object} nomination
 * @returns {object}
 */
function assessNomination(nomination) {
  if (
    !nomination ||
    !Array.isArray(nomination.nominees) ||
    nomination.nominees.length === 0
  ) {
    return {
      valid: false,
      reason: `No ${DEFAULT_RULES.nominationForm} is on record. On death the amount is then payable to the heirs, which is a determination somebody has to make.`,
      totalShare: 0,
    };
  }

  const totalShare = nomination.nominees.reduce(
    (sum, nominee) => sum + Number(nominee.sharePercent || 0),
    0,
  );

  if (round2(totalShare) !== 100) {
    return {
      valid: false,
      reason: `The shares total ${round2(totalShare)} per cent. A nomination that does not total one hundred leaves the balance with no payee, and the balance is the part somebody will argue about.`,
      totalShare: round2(totalShare),
    };
  }

  const hadFamilyWhenMade = Boolean(nomination.hadFamilyWhenMade);
  const allFamily = nomination.nominees.every((nominee) =>
    Boolean(nominee.isFamily),
  );

  if (hadFamilyWhenMade && !allFamily) {
    const outsiders = nomination.nominees
      .filter((nominee) => !nominee.isFamily)
      .map((nominee) => nominee.name || 'unnamed');
    return {
      valid: false,
      reason: `Rule 6(3): a nomination made by an employee who has a family shall be made in favour of one or more members of the family, and any nomination in favour of a person who is not a member is void. Named here: ${outsiders.join(', ')}.`,
      totalShare: 100,
      voidUnderRule6: true,
    };
  }

  const acquiredFamilyOn = toDate(nomination.acquiredFamilyOn);
  const madeOn = toDate(nomination.madeOn);
  if (
    !hadFamilyWhenMade &&
    acquiredFamilyOn &&
    madeOn &&
    acquiredFamilyOn > madeOn &&
    !nomination.freshNominationMade
  ) {
    return {
      valid: false,
      reason: `Rule 6(4): the employee had no family when this nomination was made and acquired one on ${acquiredFamilyOn.toISOString().slice(0, 10)}. It became void then, and a fresh nomination in favour of family is required. This is not a stale record — it is a void one.`,
      totalShare: 100,
      voidUnderRule6: true,
    };
  }

  return {
    valid: true,
    reason: `Valid ${DEFAULT_RULES.nominationForm} — ${nomination.nominees.length} nominee${nomination.nominees.length === 1 ? '' : 's'}, shares totalling one hundred per cent.`,
    totalShare: 100,
    nominees: nomination.nominees.map((nominee) => ({
      name: nominee.name || null,
      relationship: nominee.relationship || null,
      sharePercent: Number(nominee.sharePercent),
      isFamily: Boolean(nominee.isFamily),
      isMinor: Boolean(nominee.isMinor),
      guardian: nominee.isMinor ? nominee.guardian || null : null,
    })),
  };
}

// --- Section 4(6) -----------------------------------------------------------

/**
 * How much of the gratuity may lawfully be forfeited.
 *
 * The whole point is that (a) and (b) are different rules:
 *
 *   - **4(6)(a)** is mandatory and quantified. Gratuity is forfeited *to the
 *     extent of the damage or loss*, so the damage figure is required and is the
 *     cap. A claim above it is reported as EXCESSIVE with the permitted amount,
 *     rather than applied — a ₹4,000 breakage does not forfeit ₹6,00,000.
 *   - **4(6)(b)** is discretionary and permits whole or partial forfeiture, but
 *     only on three grounds, and only where **services were terminated for**
 *     that act. The act having occurred is not enough, and `terminatedForTheAct`
 *     is therefore required rather than assumed.
 *
 * @param {object} forfeiture
 * @param {number} grossGratuity
 * @returns {object}
 */
function assessForfeiture(forfeiture, grossGratuity) {
  const gross = Number(grossGratuity || 0);

  if (!forfeiture || !forfeiture.ground) {
    return {
      verdict: FORFEITURE_VERDICT.NONE,
      forfeited: 0,
      permitted: 0,
      payable: round2(gross),
      reason: 'No forfeiture claimed.',
      note: FORFEITURE_IS_TWO_RULES,
    };
  }

  const ground = String(forfeiture.ground).toUpperCase();
  const claimed = Number(forfeiture.amount || 0);

  if (!FORFEITURE_GROUND[ground]) {
    return {
      verdict: FORFEITURE_VERDICT.NOT_PERMITTED,
      forfeited: 0,
      permitted: 0,
      payable: round2(gross),
      reason: `‘${forfeiture.ground}’ is not a ground under section 4(6). Gratuity is forfeitable only for damage or loss to employer property, for riotous or disorderly conduct or an act of violence, or for an offence involving moral turpitude committed in the course of employment.`,
      note: FORFEITURE_IS_TWO_RULES,
    };
  }

  if (ground === FORFEITURE_GROUND.DAMAGE_OR_LOSS) {
    const damage = Number(forfeiture.damageAmount);
    if (!Number.isFinite(damage) || damage <= 0) {
      return {
        verdict: FORFEITURE_VERDICT.NOT_PERMITTED,
        forfeited: 0,
        permitted: 0,
        payable: round2(gross),
        reason:
          'Section 4(6)(a) forfeits gratuity to the extent of the damage or loss. Without a quantified damage figure there is no extent, and forfeiting an unquantified amount under this limb is not something the sub-section permits.',
        note: FORFEITURE_IS_TWO_RULES,
      };
    }

    const permitted = round2(Math.min(damage, gross));
    const forfeited = round2(Math.min(claimed || permitted, permitted));

    return {
      verdict:
        claimed > permitted
          ? FORFEITURE_VERDICT.EXCESSIVE
          : FORFEITURE_VERDICT.APPLIED,
      forfeited,
      permitted,
      claimed: round2(claimed || permitted),
      payable: round2(gross - forfeited),
      reason:
        claimed > permitted
          ? `Section 4(6)(a) permits forfeiture to the extent of the damage, which is ₹${round2(damage)}. ₹${round2(claimed)} was claimed; ₹${permitted} is applied and the excess is not forfeitable under this limb.`
          : `Section 4(6)(a) — forfeited to the extent of the recorded damage of ₹${round2(damage)}.`,
      note: FORFEITURE_IS_TWO_RULES,
    };
  }

  // 4(6)(b).
  if (!forfeiture.terminatedForTheAct) {
    return {
      verdict: FORFEITURE_VERDICT.NOT_PERMITTED,
      forfeited: 0,
      permitted: 0,
      payable: round2(gross),
      reason:
        'Section 4(6)(b) applies where the services of the employee **were terminated for** the act. The act having occurred is not enough — an employee who resigned, or who was terminated on another ground, does not fall within the sub-section however serious the conduct.',
      note: FORFEITURE_IS_TWO_RULES,
    };
  }

  if (
    ground === FORFEITURE_GROUND.MORAL_TURPITUDE &&
    forfeiture.inCourseOfEmployment === false
  ) {
    return {
      verdict: FORFEITURE_VERDICT.NOT_PERMITTED,
      forfeited: 0,
      permitted: 0,
      payable: round2(gross),
      reason:
        'Section 4(6)(b) reaches an offence involving moral turpitude **committed in the course of his employment**. An offence outside the employment is not a ground, however it was dealt with internally.',
      note: FORFEITURE_IS_TWO_RULES,
    };
  }

  const permitted = round2(gross);
  const forfeited = round2(Math.min(claimed, permitted));

  return {
    verdict:
      claimed > permitted
        ? FORFEITURE_VERDICT.EXCESSIVE
        : FORFEITURE_VERDICT.APPLIED,
    forfeited,
    permitted,
    claimed: round2(claimed),
    payable: round2(gross - forfeited),
    reason:
      claimed > permitted
        ? `Section 4(6)(b) permits forfeiture up to the whole of the gratuity, which is ₹${permitted}. ₹${round2(claimed)} was claimed and is capped.`
        : `Section 4(6)(b) — ₹${forfeited} forfeited of ₹${permitted}. The sub-section is discretionary: this is a decision the employer made, not an amount the Act computes.`,
    note: FORFEITURE_IS_TWO_RULES,
  };
}

// --- Section 7 --------------------------------------------------------------

/**
 * The section 7(3) clock, and the section 7(3A) interest.
 *
 * Interest is computed first and cleared afterwards, never the other way round.
 * The relief under 7(3A) needs both limbs — the delay due to the employee's
 * fault **and** the controlling authority's written permission for the delay on
 * that ground — and "the employee did not submit Form I" is not an answer,
 * because the section 7(2) obligation never depended on Form I.
 *
 * Simple interest, not compound: the sub-section says simple.
 *
 * @param {object} args
 * @param {object} [rulesOverride]
 * @returns {object}
 */
function interestPosition(args, rulesOverride) {
  const rules = resolveRules(rulesOverride);
  const payableFrom = toDate(args && args.payableFrom);
  const paidOn = toDate(args && args.paidOn);
  const asOf = toDate(args && args.asOf) || new Date();
  const amount = Number((args && args.amount) || 0);

  if (!payableFrom) {
    return {
      state: null,
      dueBy: null,
      interest: 0,
      reason:
        'Gratuity becomes payable on the date the employment ended. Without it there is no clock, and defaulting it to today would report every unpaid gratuity as being in time.',
      note: CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
    };
  }

  const dueBy = addDays(payableFrom, rules.paymentPeriodDays);
  const upTo = paidOn || asOf;
  const daysLate = Math.max(0, daysBetween(dueBy, upTo));

  const state = paidOn
    ? daysLate > 0
      ? OBLIGATION_STATE.PAID_LATE
      : OBLIGATION_STATE.PAID_IN_TIME
    : daysBetween(asOf, dueBy) >= 0
      ? OBLIGATION_STATE.WITHIN_PAYMENT_PERIOD
      : OBLIGATION_STATE.OVERDUE;

  if (daysLate === 0) {
    return {
      state,
      dueBy,
      daysLate: 0,
      interest: 0,
      // Reported even at zero, so a screen can show the countdown rather than
      // only the consequence. The obligation exists before it is breached.
      daysRemaining: paidOn ? null : daysBetween(asOf, dueBy),
      reason: paidOn
        ? `Paid on ${paidOn.toISOString().slice(0, 10)}, inside the ${rules.paymentPeriodDays} days from ${payableFrom.toISOString().slice(0, 10)}.`
        : `Due by ${dueBy.toISOString().slice(0, 10)} — ${daysBetween(asOf, dueBy)} day${daysBetween(asOf, dueBy) === 1 ? '' : 's'} remaining. ${CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION}`,
      note: INTEREST_IS_NOT_DISCRETIONARY,
    };
  }

  /**
   * Interest runs from the date gratuity became payable, not from day
   * thirty-one.
   *
   * Section 7(3A) says "from the date on which the gratuity becomes payable to
   * the date on which it is paid". The thirty days decide *whether* interest is
   * owed; they do not shorten the period it is computed over. Running it from
   * day thirty-one understates every late payment by a month's interest, which
   * is the arithmetic mistake this comment exists to stop.
   */
  const daysOfInterest = daysBetween(payableFrom, upTo);
  const interest = round2(
    (amount * rules.interestRatePercent * daysOfInterest) /
      (100 * DAYS_PER_YEAR),
  );

  const relief = args && args.relief;
  const permission = String(
    (relief && relief.controllingAuthorityPermission) || '',
  ).trim();
  const employeeFault = Boolean(relief && relief.delayDueToEmployeeFault);

  if (employeeFault && permission) {
    return {
      state,
      dueBy,
      daysLate,
      daysOfInterest,
      interestBeforeRelief: interest,
      interest: 0,
      reliefApplied: true,
      reason: `${daysLate} day${daysLate === 1 ? '' : 's'} beyond the ${rules.paymentPeriodDays} days, but both limbs of the 7(3A) proviso are on record: the delay is due to the fault of the employee and the controlling authority has permitted it in writing (${permission}). ₹${interest} would otherwise have been due.`,
      note: INTEREST_IS_NOT_DISCRETIONARY,
    };
  }

  return {
    state,
    dueBy,
    daysLate,
    daysOfInterest,
    interest,
    ratePercent: rules.interestRatePercent,
    reliefApplied: false,
    reason:
      employeeFault && !permission
        ? `${daysLate} day${daysLate === 1 ? '' : 's'} beyond the ${rules.paymentPeriodDays} days. Employee fault is asserted but the controlling authority's written permission is not on record, and the proviso needs both. ₹${interest} of simple interest has accrued at ${rules.interestRatePercent} per cent over ${daysOfInterest} days.`
        : `${daysLate} day${daysLate === 1 ? '' : 's'} beyond the ${rules.paymentPeriodDays} days. ₹${interest} of simple interest at ${rules.interestRatePercent} per cent has accrued over ${daysOfInterest} days from ${payableFrom.toISOString().slice(0, 10)}.`,
    note: INTEREST_IS_NOT_DISCRETIONARY,
  };
}

/**
 * The two notices under section 7(2), tracked separately.
 *
 * They are two obligations and the second is the one nobody does — a notice to
 * the payee with nothing sent to the controlling authority is half-discharged,
 * and a single `noticeGiven` boolean cannot say which half.
 *
 * @param {object} args
 * @returns {object}
 */
function noticePosition(args) {
  const toPayee = toDate(args && args.noticeToPayeeOn);
  const toAuthority = toDate(args && args.noticeToControllingAuthorityOn);

  const outstanding = [];
  if (!toPayee) outstanding.push('the person to whom the gratuity is payable');
  if (!toAuthority) outstanding.push('the controlling authority');

  return {
    noticeToPayeeOn: toPayee,
    noticeToControllingAuthorityOn: toAuthority,
    complete: outstanding.length === 0,
    outstanding,
    reason: outstanding.length
      ? `Section 7(2) requires notice to both. Outstanding: ${outstanding.join(' and ')}.`
      : 'Notice given to both the payee and the controlling authority.',
    note: CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
  };
}

// --- Section 4(5) -----------------------------------------------------------

/**
 * The statutory figure against the contractual one.
 *
 * Returns both and which governs, rather than a single number. Section 4(5)
 * preserves better terms under any award, agreement or contract, so an employer
 * whose settlement is more generous owes the settlement figure — and the
 * ₹20,00,000 ceiling in section 4(3) caps the *statutory* entitlement, not a
 * contractual one.
 *
 * @param {number} statutory
 * @param {number|null} contractual
 * @returns {object}
 */
function betterTerms(statutory, contractual) {
  const statutoryAmount = round2(Number(statutory || 0));
  const contractualAmount =
    contractual === null || contractual === undefined
      ? null
      : round2(Number(contractual));

  if (contractualAmount === null) {
    return {
      statutory: statutoryAmount,
      contractual: null,
      governing: 'STATUTORY',
      amount: statutoryAmount,
      reason:
        'No contractual gratuity term is on record, so the section 4 computation governs.',
      note: STATUTORY_FIGURE_MAY_BE_A_FLOOR,
    };
  }

  if (contractualAmount > statutoryAmount) {
    return {
      statutory: statutoryAmount,
      contractual: contractualAmount,
      governing: 'CONTRACTUAL',
      amount: contractualAmount,
      difference: round2(contractualAmount - statutoryAmount),
      reason: `The contractual term gives ₹${contractualAmount} against the statutory ₹${statutoryAmount}. ${STATUTORY_FIGURE_MAY_BE_A_FLOOR}`,
      note: STATUTORY_FIGURE_MAY_BE_A_FLOOR,
    };
  }

  return {
    statutory: statutoryAmount,
    contractual: contractualAmount,
    governing: 'STATUTORY',
    amount: statutoryAmount,
    difference: 0,
    reason: `The contractual term gives ₹${contractualAmount}, which is not better than the statutory ₹${statutoryAmount}. The Act governs.`,
    note: STATUTORY_FIGURE_MAY_BE_A_FLOOR,
  };
}

// --- The whole position -----------------------------------------------------

/**
 * Everything about one person's gratuity on one date.
 *
 * Order matters: payability, then the better-terms comparison against the amount
 * `settlement.js` computed, then forfeiture against the governing figure, then
 * the section 7 clock against what is left. Running the clock against the gross
 * would accrue interest on money that was never payable.
 *
 * @param {object} claim
 * @param {object} [options]
 * @returns {object}
 */
function assessClaim(claim, options) {
  const opts = options || {};
  const rules = resolveRules(opts.rules);
  const asOf = toDate(opts.asOf) || new Date();

  const nomination = assessNomination(claim && claim.nomination);

  const entitlement = payability(
    {
      ground: claim && claim.ground,
      completedYears: claim && claim.completedYears,
      hasNomination: nomination.valid,
    },
    opts.rules,
  );

  const base = {
    employeeId: (claim && claim.employeeId) || null,
    ground: entitlement.ground,
    asOf,
    rules,
    nomination,
    payability: entitlement,
    notes: {
      clockDoesNotWaitForAnApplication: CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
      interestIsNotDiscretionary: INTEREST_IS_NOT_DISCRETIONARY,
      fiveYearsDoesNotApplyOnDeath: FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
      forfeitureIsTwoRules: FORFEITURE_IS_TWO_RULES,
      statutoryFigureMayBeAFloor: STATUTORY_FIGURE_MAY_BE_A_FLOOR,
    },
  };

  if (
    entitlement.verdict === PAYABILITY.NOT_PAYABLE_SERVICE_SHORT ||
    entitlement.verdict === PAYABILITY.UNDETERMINED
  ) {
    return {
      ...base,
      terms: null,
      forfeiture: null,
      notice: null,
      obligation: null,
      amountPayable: 0,
    };
  }

  const terms = betterTerms(
    claim && claim.statutoryAmount,
    claim && claim.contractualAmount,
  );
  const forfeiture = assessForfeiture(claim && claim.forfeiture, terms.amount);
  const notice = noticePosition(claim || {});

  const obligation = interestPosition(
    {
      payableFrom: claim && claim.payableFrom,
      paidOn: claim && claim.paidOn,
      asOf,
      amount: forfeiture.payable,
      relief: claim && claim.relief,
    },
    opts.rules,
  );

  return {
    ...base,
    terms,
    forfeiture,
    notice,
    obligation,
    amountPayable: round2(forfeiture.payable + (obligation.interest || 0)),
  };
}

/**
 * The queue, ordered by how soon something has to happen.
 *
 * Overdue and unpaid first — interest is running on those every day — then the
 * ones inside the payment period by days remaining, then paid-late (the interest
 * is owed and quantified but nothing is accruing), then everything else.
 *
 * @param {Array<object>} assessments
 * @returns {Array<object>}
 */
function orderQueue(assessments) {
  const rank = {
    [OBLIGATION_STATE.OVERDUE]: 0,
    [OBLIGATION_STATE.WITHIN_PAYMENT_PERIOD]: 1,
    [OBLIGATION_STATE.PAID_LATE]: 2,
    [OBLIGATION_STATE.PAID_IN_TIME]: 3,
  };

  return [...(assessments || [])].sort((a, b) => {
    const aState = a.obligation && a.obligation.state;
    const bState = b.obligation && b.obligation.state;
    const byRank = (rank[aState] ?? 99) - (rank[bState] ?? 99);
    if (byRank !== 0) return byRank;

    const aInterest = (a.obligation && a.obligation.interest) || 0;
    const bInterest = (b.obligation && b.obligation.interest) || 0;
    return bInterest - aInterest;
  });
}

module.exports = {
  CESSATION_GROUND,
  PAYABILITY,
  OBLIGATION_STATE,
  FORFEITURE_GROUND,
  FORFEITURE_VERDICT,
  DEFAULT_RULES,
  CLOCK_DOES_NOT_WAIT_FOR_AN_APPLICATION,
  INTEREST_IS_NOT_DISCRETIONARY,
  FIVE_YEARS_DOES_NOT_APPLY_ON_DEATH,
  FORFEITURE_IS_TWO_RULES,
  STATUTORY_FIGURE_MAY_BE_A_FLOOR,
  resolveRules,
  payability,
  assessNomination,
  assessForfeiture,
  interestPosition,
  noticePosition,
  betterTerms,
  assessClaim,
  orderQueue,
};
