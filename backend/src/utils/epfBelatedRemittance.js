/**
 * EPF belated remittance — section 7Q interest and section 14B damages (#1875).
 *
 * `ecrGenerator.utils.js` decides what is owed for a wage month. This module
 * never recomputes that figure; it takes it, asks when it was paid, and answers
 * what the delay costs. The two questions are separate and the second one has
 * no home in the product today.
 *
 * Three things shape everything below.
 *
 * **7Q and 14B are two liabilities, not one penalty.** Section 7Q is simple
 * interest at twelve per cent per annum on the amount due from the date it fell
 * due to the date it was paid. It is automatic and no authority under the Act
 * can waive it. Section 14B is damages, graded by the length of the default
 * under paragraph 32A of the Scheme, levied by a quasi-judicial order after a
 * hearing, and reducible to nil under paragraph 32B for a sick industrial
 * company. A reader closing the books needs to provide for the first and
 * disclose the second, so `assessEstablishment` returns them under separate
 * keys and **nothing in this file returns their sum**. That is deliberate: the
 * moment a combined figure exists, the first report that touches it will
 * provide for damages that are under waiver.
 *
 * **The slab attaches to the arrear, not to the year.** Paragraph 32A grades
 * damages by the period of default — five per cent per annum under two months,
 * ten to under four, fifteen to under six, twenty-five at six and above — and
 * that period is measured on each arrear separately. A month remitted eleven
 * days late and a month remitted eight months late do not blend into an average
 * rate, and a default that runs from month five into month seven is a
 * twenty-five per cent default for its whole length rather than fifteen for
 * part of it. So the unit of computation here is a *tranche*: an amount, the
 * date it fell due, and the date it was cleared.
 *
 * **The employee's share was never the employer's money.** Where the twelve per
 * cent was deducted from wages and not remitted, the exposure is not a
 * contribution in arrears. It survives a waiver of damages and it is not
 * discharged by paying interest. It is bucketed separately as `heldInTrust`,
 * and — like the two liabilities — it is never netted against anything.
 *
 * Pure functions, no database access, matching how `layoffCompensation.js` and
 * `esiContribution.js` are written. Every statutory boundary in here is a place
 * a number can go wrong quietly, so each one is reachable from a unit test
 * without standing up Mongo.
 */

// --- The rules --------------------------------------------------------------

/**
 * The central figures, as defaults.
 *
 * These have been amended before and will be again — the five-day grace period
 * was withdrawn in 2016 and is still in a great many internal spreadsheets,
 * which is why `graceDays` exists as a rule rather than as an assumption. A
 * tenant that has been told otherwise by its Regional Office can override, and
 * the override is stored with the assessment so an old assessment reproduces
 * the rule it was computed under.
 */
const EPF_REMITTANCE_RULES = {
  /** Remittance is due by the 15th of the month following the wage month. */
  dueDayOfNextMonth: 15,

  /**
   * Zero, and it is a rule so that it can be seen to be zero.
   *
   * The five days that used to follow the 15th were withdrawn with effect from
   * January 2016. Carrying it as a configurable zero means an establishment
   * that is still applying it discovers that in the rule panel rather than in
   * a demand notice.
   */
  graceDays: 0,

  /** Section 7Q. Simple, per annum, and not waivable by anyone. */
  interestRatePercent: 12,

  /**
   * Paragraph 32A of the Employees' Provident Funds Scheme, 1952.
   *
   * `upToMonths` is exclusive: a default of exactly two months is in the second
   * slab, not the first. The Act's language is "less than two months", "two
   * months and above but less than four", and so on.
   */
  damageSlabs: [
    { code: 'UNDER_TWO_MONTHS', upToMonths: 2, ratePercent: 5 },
    { code: 'TWO_TO_UNDER_FOUR_MONTHS', upToMonths: 4, ratePercent: 10 },
    { code: 'FOUR_TO_UNDER_SIX_MONTHS', upToMonths: 6, ratePercent: 15 },
    { code: 'SIX_MONTHS_AND_ABOVE', upToMonths: null, ratePercent: 25 },
  ],

  /** Damages are capped at the arrears themselves. */
  damagesCapPercentOfArrears: 100,

  /** Both liabilities are annual rates applied over days. */
  daysInYear: 365,

  /** For placing a delay in a paragraph 32A slab only. Not for interest. */
  daysPerSlabMonth: 30,
};

/**
 * The accounts a remittance is split across.
 *
 * Kept apart rather than summed because the delay is per account in practice —
 * a challan can clear A/c 1 and leave A/c 10 short — and because only one of
 * them carries the trust exposure below.
 */
const COMPONENT = {
  /** A/c 1, the member's twelve per cent, deducted from wages. */
  EMPLOYEE_SHARE: 'EMPLOYEE_SHARE',
  /** A/c 1, the employer's 3.67 per cent. */
  EMPLOYER_SHARE: 'EMPLOYER_SHARE',
  /** A/c 10, the 8.33 per cent diverted to the Pension Scheme. */
  PENSION: 'PENSION',
  /** A/c 21, the 0.5 per cent assurance contribution. */
  EDLI: 'EDLI',
  /** A/c 2, administrative charges. */
  ADMIN_CHARGES: 'ADMIN_CHARGES',
};

const COMPONENT_ACCOUNT = {
  [COMPONENT.EMPLOYEE_SHARE]: 'A/c 1 (member)',
  [COMPONENT.EMPLOYER_SHARE]: 'A/c 1 (employer)',
  [COMPONENT.PENSION]: 'A/c 10',
  [COMPONENT.EDLI]: 'A/c 21',
  [COMPONENT.ADMIN_CHARGES]: 'A/c 2',
};

const COMPONENT_ORDER = [
  COMPONENT.EMPLOYEE_SHARE,
  COMPONENT.EMPLOYER_SHARE,
  COMPONENT.PENSION,
  COMPONENT.EDLI,
  COMPONENT.ADMIN_CHARGES,
];

/**
 * The one component that was somebody else's money before it was late.
 *
 * A set rather than a boolean on the component so that the question asked at
 * the call site is "is this held in trust", which is the property that matters,
 * rather than "is this the employee share", which is how it happens to be true.
 */
const HELD_IN_TRUST = new Set([COMPONENT.EMPLOYEE_SHARE]);

/**
 * Where a paragraph 32B waiver stands.
 *
 * `APPLIED` is not `GRANTED`. An application pending before the Board leaves
 * the damages payable and contingent at the same time, and the distinction is
 * the difference between a provision and a disclosure.
 */
const WAIVER_STATE = {
  NONE: 'NONE',
  APPLIED: 'APPLIED',
  GRANTED_IN_PART: 'GRANTED_IN_PART',
  GRANTED: 'GRANTED',
  REFUSED: 'REFUSED',
};

/** How the amount due for a wage month was established. */
const DUE_BASIS = {
  /** From the ECR the establishment filed. The ordinary case. */
  ECR: 'ECR',
  /**
   * Determined by the Commissioner under section 7A for a past period.
   *
   * Interest and damages on a determined amount run from the *original* due
   * dates, not from the date of the order — which is why this is a basis on the
   * wage month rather than a liability of its own with the order's date on it.
   */
  SECTION_7A: 'SECTION_7A',
  /** Entered by hand where no ECR exists for the month. */
  MANUAL: 'MANUAL',
};

const FINDING = {
  DEFAULT_OPEN: 'DEFAULT_OPEN',
  DEFAULT_CLEARED_LATE: 'DEFAULT_CLEARED_LATE',
  EMPLOYEE_SHARE_WITHHELD: 'EMPLOYEE_SHARE_WITHHELD',
  DAMAGES_CAPPED: 'DAMAGES_CAPPED',
  WAIVER_PENDING: 'WAIVER_PENDING',
  WAIVER_GRANTED: 'WAIVER_GRANTED',
  GRACE_APPLIED: 'GRACE_APPLIED',
  SECTION_7A_DETERMINATION: 'SECTION_7A_DETERMINATION',
  NO_REMITTANCE_RECORDED: 'NO_REMITTANCE_RECORDED',
  OVER_REMITTED: 'OVER_REMITTED',
};

const FINDING_SECTION = {
  [FINDING.DEFAULT_OPEN]: 'Section 7Q and paragraph 38',
  [FINDING.DEFAULT_CLEARED_LATE]: 'Section 7Q and section 14B',
  [FINDING.EMPLOYEE_SHARE_WITHHELD]: 'Section 405 IPC read with paragraph 38',
  [FINDING.DAMAGES_CAPPED]: 'Paragraph 32A proviso',
  [FINDING.WAIVER_PENDING]: 'Paragraph 32B',
  [FINDING.WAIVER_GRANTED]: 'Paragraph 32B',
  [FINDING.GRACE_APPLIED]: 'Paragraph 38, as amended in 2016',
  [FINDING.SECTION_7A_DETERMINATION]: 'Section 7A',
  [FINDING.NO_REMITTANCE_RECORDED]: 'Paragraph 38',
  [FINDING.OVER_REMITTED]: 'Paragraph 38',
};

const SEVERITY = {
  /** A statutory obligation was not met. */
  BREACH: 'BREACH',
  /** Money is or may be owed, and the amount is stated. */
  EXPOSURE: 'EXPOSURE',
  /** Worth a reader's attention, and not itself a failure. */
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.DEFAULT_OPEN]: SEVERITY.BREACH,
  [FINDING.DEFAULT_CLEARED_LATE]: SEVERITY.EXPOSURE,
  [FINDING.EMPLOYEE_SHARE_WITHHELD]: SEVERITY.BREACH,
  [FINDING.DAMAGES_CAPPED]: SEVERITY.INFORMATIONAL,
  [FINDING.WAIVER_PENDING]: SEVERITY.INFORMATIONAL,
  [FINDING.WAIVER_GRANTED]: SEVERITY.INFORMATIONAL,
  [FINDING.GRACE_APPLIED]: SEVERITY.INFORMATIONAL,
  [FINDING.SECTION_7A_DETERMINATION]: SEVERITY.EXPOSURE,
  [FINDING.NO_REMITTANCE_RECORDED]: SEVERITY.BREACH,
  [FINDING.OVER_REMITTED]: SEVERITY.INFORMATIONAL,
};

// --- Dates ------------------------------------------------------------------

/**
 * A date at UTC midnight, or null.
 *
 * Everything here counts days between dates, and a local-midnight date parsed
 * on a machine east of Greenwich lands on the previous day in UTC — which for
 * a due date of the 15th produces a one-day default out of nothing.
 *
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
 * Whole days from `from` to `to`, floored at zero.
 *
 * Floored because a remittance made before the due date is not a negative
 * default. Paying early earns nothing back under either section.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  if (!from || !to) return 0;
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 86400000);
}

/**
 * The statutory due date for a wage month.
 *
 * `wageMonth` is the month the wages relate to; the remittance is due on the
 * fifteenth of the month *after* it. `graceDays` is added rather than folded
 * into the day so that a rule set carrying a non-zero grace shows up in the
 * date and in the finding, instead of silently moving the boundary.
 *
 * @param {{year: number, month: number}} wageMonth `month` is 1-12.
 * @param {object} [rules]
 * @returns {Date}
 */
function dueDateFor(wageMonth, rules = EPF_REMITTANCE_RULES) {
  const year = Number(wageMonth?.year);
  const month = Number(wageMonth?.month);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new TypeError('wageMonth must carry a numeric year and month');
  }

  // Month is 1-12 and the due date is in the following month, so passing
  // `month` straight into a 0-indexed Date.UTC already advances it by one.
  const base = new Date(Date.UTC(year, month, rules.dueDayOfNextMonth));
  if (!rules.graceDays) return base;

  return new Date(base.getTime() + rules.graceDays * 86400000);
}

/**
 * `YYYY-MM` for a wage month, for keys and for display.
 *
 * @param {{year: number, month: number}} wageMonth
 * @returns {string}
 */
function wageMonthKey(wageMonth) {
  const month = String(Number(wageMonth?.month)).padStart(2, '0');
  return `${Number(wageMonth?.year)}-${month}`;
}

// --- Rules ------------------------------------------------------------------

/**
 * A rule set from the central defaults and a tenant's overrides.
 *
 * Slabs are replaced wholesale rather than merged element-wise. A partial slab
 * table is not a thing paragraph 32A can express — the four bands have to
 * tile the whole range — so an override either provides all of them or none.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function resolveRules(overrides = {}) {
  const rules = { ...EPF_REMITTANCE_RULES, ...(overrides || {}) };

  rules.damageSlabs =
    Array.isArray(overrides?.damageSlabs) && overrides.damageSlabs.length
      ? overrides.damageSlabs.map((slab) => ({ ...slab }))
      : EPF_REMITTANCE_RULES.damageSlabs.map((slab) => ({ ...slab }));

  return rules;
}

/**
 * The paragraph 32A band a delay falls in.
 *
 * The delay is converted to months at thirty days for this purpose only. The
 * interest and damages arithmetic below stays in days — using a thirty-day
 * month there would drift by five days a year against the statutory annual
 * rate, which on a large arrear is real money.
 *
 * @param {number} days
 * @param {object} [rules]
 * @returns {{code: string, ratePercent: number, months: number}}
 */
function damageSlabFor(days, rules = EPF_REMITTANCE_RULES) {
  const months = days / rules.daysPerSlabMonth;

  const slab =
    rules.damageSlabs.find(
      (candidate) =>
        candidate.upToMonths === null ||
        candidate.upToMonths === undefined ||
        months < candidate.upToMonths,
    ) || rules.damageSlabs[rules.damageSlabs.length - 1];

  return { code: slab.code, ratePercent: slab.ratePercent, months };
}

// --- Allocation -------------------------------------------------------------

/**
 * Split what was due for one component into tranches by when each part cleared.
 *
 * This is the shape everything downstream needs, and building it is most of the
 * work. Partial remittance is the ordinary case rather than an edge: an
 * establishment short of cash pays what it can on the fifteenth and the rest
 * when it can, and the result is one arrear with two different delays. Treating
 * that as a single default at the later date overstates both liabilities;
 * treating it as a single default at the earlier one understates them.
 *
 * Remittances are applied oldest-first, which is how a challan against a wage
 * month is appropriated in practice. Anything left over after the amount due is
 * met is returned as `excess` rather than carried to another month — cross-month
 * appropriation is a decision for the Regional Office, not for this function.
 *
 * @param {object} input
 * @param {number} input.amountDue
 * @param {Date} input.dueDate
 * @param {Array<{paidOn: Date, amount: number}>} input.remittances
 * @param {Date} [input.asAt] For measuring a default that is still open.
 * @returns {{tranches: Array<object>, cleared: number, outstanding: number, excess: number}}
 */
function allocateTranches({ amountDue, dueDate, remittances, asAt }) {
  const due = Math.max(0, Number(amountDue) || 0);
  const events = (remittances || [])
    .map((event) => ({
      paidOn: toUtcDate(event?.paidOn),
      amount: Math.max(0, Number(event?.amount) || 0),
      reference: event?.reference || '',
    }))
    .filter((event) => event.paidOn && event.amount > 0)
    .sort((a, b) => a.paidOn.getTime() - b.paidOn.getTime());

  const tranches = [];
  let remaining = due;
  let cleared = 0;
  let excess = 0;

  for (const event of events) {
    if (remaining <= 0) {
      excess += event.amount;
      continue;
    }

    const applied = Math.min(remaining, event.amount);
    excess += event.amount - applied;
    remaining -= applied;
    cleared += applied;

    const delayDays = daysBetween(dueDate, event.paidOn);

    tranches.push({
      amount: applied,
      dueDate,
      clearedOn: event.paidOn,
      reference: event.reference,
      delayDays,
      open: false,
    });
  }

  if (remaining > 0) {
    // Still outstanding. The delay is measured to `asAt` — which is the point
    // of passing it in — and the tranche is marked open so a caller can say
    // "as at" rather than implying the default has stopped running.
    const measuredTo = toUtcDate(asAt) || dueDate;

    tranches.push({
      amount: remaining,
      dueDate,
      clearedOn: null,
      reference: '',
      delayDays: daysBetween(dueDate, measuredTo),
      open: true,
    });
  }

  return { tranches, cleared, outstanding: remaining, excess };
}

// --- Section 7Q -------------------------------------------------------------

/**
 * Simple interest at twelve per cent per annum, per tranche, on exact days.
 *
 * Not compounded, not rounded to months. Section 7Q says simple interest and
 * the Commissioner computes on days; a month-rounded figure disagrees with the
 * demand notice by up to twenty-nine days of interest on the whole arrear.
 *
 * @param {Array<object>} tranches
 * @param {object} [rules]
 * @returns {{amount: number, lines: Array<object>}}
 */
function sevenQInterest(tranches, rules = EPF_REMITTANCE_RULES) {
  const lines = (tranches || [])
    .filter((tranche) => tranche.delayDays > 0 && tranche.amount > 0)
    .map((tranche) => {
      const amount =
        (tranche.amount * rules.interestRatePercent * tranche.delayDays) /
        (100 * rules.daysInYear);

      return {
        principal: tranche.amount,
        days: tranche.delayDays,
        ratePercent: rules.interestRatePercent,
        clearedOn: tranche.clearedOn,
        open: tranche.open,
        amount: round2(amount),
      };
    });

  return {
    amount: round2(lines.reduce((total, line) => total + line.amount, 0)),
    lines,
  };
}

// --- Section 14B ------------------------------------------------------------

/**
 * Damages under paragraph 32A, per tranche, then capped.
 *
 * The cap is on the total against the arrears, not per tranche. Paragraph 32A's
 * proviso limits damages to the amount of arrears, and a per-tranche cap would
 * let a set of tranches each under their own cap exceed the arrears together.
 *
 * The cap is reported rather than applied silently: `cappedFrom` carries what
 * the slabs produced before the proviso bit, because a total sitting exactly on
 * the arrears looks like a coincidence and is not one.
 *
 * @param {Array<object>} tranches
 * @param {object} [rules]
 * @returns {{amount: number, cappedFrom: number|null, lines: Array<object>}}
 */
function fourteenBDamages(tranches, rules = EPF_REMITTANCE_RULES) {
  const lines = (tranches || [])
    .filter((tranche) => tranche.delayDays > 0 && tranche.amount > 0)
    .map((tranche) => {
      const slab = damageSlabFor(tranche.delayDays, rules);
      const amount =
        (tranche.amount * slab.ratePercent * tranche.delayDays) /
        (100 * rules.daysInYear);

      return {
        principal: tranche.amount,
        days: tranche.delayDays,
        slab: slab.code,
        ratePercent: slab.ratePercent,
        clearedOn: tranche.clearedOn,
        open: tranche.open,
        amount: round2(amount),
      };
    });

  const gross = lines.reduce((total, line) => total + line.amount, 0);
  const arrears = (tranches || [])
    .filter((tranche) => tranche.delayDays > 0)
    .reduce((total, tranche) => total + tranche.amount, 0);

  const cap = (arrears * rules.damagesCapPercentOfArrears) / 100;

  if (gross > cap) {
    return { amount: round2(cap), cappedFrom: round2(gross), lines };
  }

  return { amount: round2(gross), cappedFrom: null, lines };
}

/**
 * Damages after a paragraph 32B waiver.
 *
 * The assessed figure is kept alongside the waived one under a different key.
 * A waiver granted in part does not make the rest of the assessment disappear,
 * and a waiver applied for and not yet decided does not reduce anything at all
 * — the most a pending application does is make the damages contingent, which
 * is a disclosure and not a measurement.
 *
 * @param {number} assessed
 * @param {{state: string, waivedPercent?: number}} [waiver]
 * @returns {{assessed: number, waivedPercent: number, payable: number, state: string, contingent: boolean}}
 */
function applyWaiver(assessed, waiver) {
  const state = waiver?.state || WAIVER_STATE.NONE;
  const amount = Math.max(0, Number(assessed) || 0);

  if (state === WAIVER_STATE.GRANTED) {
    return {
      assessed: amount,
      waivedPercent: 100,
      payable: 0,
      state,
      contingent: false,
    };
  }

  if (state === WAIVER_STATE.GRANTED_IN_PART) {
    const percent = Math.min(
      100,
      Math.max(0, Number(waiver?.waivedPercent) || 0),
    );
    return {
      assessed: amount,
      waivedPercent: percent,
      payable: round2((amount * (100 - percent)) / 100),
      state,
      contingent: false,
    };
  }

  return {
    assessed: amount,
    waivedPercent: 0,
    payable: amount,
    state,
    // Pending before the Board: payable in full and disclosable as contingent.
    contingent: state === WAIVER_STATE.APPLIED,
  };
}

// --- Assessment -------------------------------------------------------------

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Assess one wage month across its components.
 *
 * @param {object} input
 * @param {{year: number, month: number}} input.wageMonth
 * @param {Object<string, number>} input.dues Amount due per component.
 * @param {Object<string, Array<{paidOn: Date, amount: number}>>} [input.remittances]
 * @param {string} [input.basis] One of DUE_BASIS.
 * @param {Date} [input.asAt]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessWageMonth({
  wageMonth,
  dues,
  remittances = {},
  basis = DUE_BASIS.ECR,
  asAt,
  rules = EPF_REMITTANCE_RULES,
}) {
  const dueDate = dueDateFor(wageMonth, rules);
  const measuredAt = toUtcDate(asAt) || new Date();

  const components = [];

  for (const component of COMPONENT_ORDER) {
    const amountDue = Math.max(0, Number(dues?.[component]) || 0);
    if (amountDue === 0) continue;

    const allocation = allocateTranches({
      amountDue,
      dueDate,
      remittances: remittances?.[component] || [],
      asAt: measuredAt,
    });

    const interest = sevenQInterest(allocation.tranches, rules);
    const damages = fourteenBDamages(allocation.tranches, rules);

    const lateAmount = allocation.tranches
      .filter((tranche) => tranche.delayDays > 0)
      .reduce((total, tranche) => total + tranche.amount, 0);

    const maxDelayDays = allocation.tranches.reduce(
      (worst, tranche) => Math.max(worst, tranche.delayDays),
      0,
    );

    components.push({
      component,
      account: COMPONENT_ACCOUNT[component],
      heldInTrust: HELD_IN_TRUST.has(component),
      amountDue,
      cleared: round2(allocation.cleared),
      outstanding: round2(allocation.outstanding),
      excess: round2(allocation.excess),
      arrears: round2(lateAmount),
      maxDelayDays,
      slab: maxDelayDays > 0 ? damageSlabFor(maxDelayDays, rules).code : null,
      tranches: allocation.tranches,
      interest,
      damages,
    });
  }

  const arrears = round2(
    components.reduce((total, row) => total + row.arrears, 0),
  );

  return {
    wageMonth: { ...wageMonth },
    key: wageMonthKey(wageMonth),
    basis,
    dueDate,
    asAt: measuredAt,
    components,

    /** Section 7Q. Mandatory, not waivable. */
    interest: round2(
      components.reduce((total, row) => total + row.interest.amount, 0),
    ),

    /** Section 14B, before any paragraph 32B waiver. */
    damagesAssessed: round2(
      components.reduce((total, row) => total + row.damages.amount, 0),
    ),

    arrears,

    /**
     * The employee's share deducted and not remitted, on its own.
     *
     * Not a subset of `arrears` for reporting purposes even though it is one
     * arithmetically — a reader who nets this against anything has misread what
     * it is, so it is surfaced at the top level where it cannot be missed.
     */
    heldInTrust: round2(
      components
        .filter((row) => row.heldInTrust)
        .reduce((total, row) => total + row.outstanding, 0),
    ),
  };
}

/**
 * @param {Array<object>} findings
 * @param {string} code
 * @param {object} detail
 */
function addFinding(findings, code, detail) {
  findings.push({
    code,
    section: FINDING_SECTION[code],
    severity: FINDING_SEVERITY[code],
    ...detail,
  });
}

/**
 * Assess an establishment across wage months.
 *
 * The return has two liability keys and no third one adding them. If a future
 * caller wants a single number it has to write the addition itself, at which
 * point somebody reviewing that line has to decide whether provisioning for
 * damages under a pending waiver is right — which is the decision this shape
 * exists to force.
 *
 * @param {object} input
 * @param {Array<object>} input.months
 * @param {Object<string, {state: string, waivedPercent?: number}>} [input.waivers] Keyed by wage month.
 * @param {Date} [input.asAt]
 * @param {object} [input.rules]
 * @returns {object}
 */
function assessEstablishment({ months, waivers = {}, asAt, rules } = {}) {
  const resolved = resolveRules(rules);
  const measuredAt = toUtcDate(asAt) || new Date();

  const findings = [];
  const assessed = (months || []).map((month) =>
    assessWageMonth({
      wageMonth: month.wageMonth,
      dues: month.dues,
      remittances: month.remittances,
      basis: month.basis,
      asAt: measuredAt,
      rules: resolved,
    }),
  );

  let interest = 0;
  let damagesAssessed = 0;
  let damagesPayable = 0;
  let damagesContingent = 0;
  let arrears = 0;
  let heldInTrust = 0;

  const rows = assessed.map((month) => {
    const waiver = applyWaiver(month.damagesAssessed, waivers?.[month.key]);

    interest += month.interest;
    damagesAssessed += waiver.assessed;
    damagesPayable += waiver.payable;
    if (waiver.contingent) damagesContingent += waiver.payable;
    arrears += month.arrears;
    heldInTrust += month.heldInTrust;

    if (month.basis === DUE_BASIS.SECTION_7A) {
      addFinding(findings, FINDING.SECTION_7A_DETERMINATION, {
        wageMonth: month.key,
        amount: month.arrears,
        note: 'Determined under section 7A. Interest and damages run from the original due date, not from the date of the order.',
      });
    }

    if (resolved.graceDays > 0) {
      addFinding(findings, FINDING.GRACE_APPLIED, {
        wageMonth: month.key,
        days: resolved.graceDays,
        note: 'A grace period is configured. The five days that followed the fifteenth were withdrawn with effect from January 2016.',
      });
    }

    for (const component of month.components) {
      if (component.outstanding > 0) {
        addFinding(findings, FINDING.DEFAULT_OPEN, {
          wageMonth: month.key,
          component: component.component,
          account: component.account,
          amount: component.outstanding,
          days: component.maxDelayDays,
        });
      } else if (component.arrears > 0) {
        addFinding(findings, FINDING.DEFAULT_CLEARED_LATE, {
          wageMonth: month.key,
          component: component.component,
          account: component.account,
          amount: component.arrears,
          days: component.maxDelayDays,
          slab: component.slab,
        });
      }

      if (component.heldInTrust && component.outstanding > 0) {
        addFinding(findings, FINDING.EMPLOYEE_SHARE_WITHHELD, {
          wageMonth: month.key,
          amount: component.outstanding,
          note: 'Deducted from wages and not remitted. This is not a contribution in arrears — it survives a waiver of damages and is not discharged by paying interest.',
        });
      }

      if (component.damages.cappedFrom !== null) {
        addFinding(findings, FINDING.DAMAGES_CAPPED, {
          wageMonth: month.key,
          component: component.component,
          from: component.damages.cappedFrom,
          to: component.damages.amount,
        });
      }

      if (component.excess > 0) {
        addFinding(findings, FINDING.OVER_REMITTED, {
          wageMonth: month.key,
          component: component.component,
          amount: component.excess,
          note: 'Remitted beyond what was due for this month. Appropriation to another month is a matter for the Regional Office and is not assumed here.',
        });
      }

      if (
        component.amountDue > 0 &&
        component.tranches.length === 1 &&
        component.tranches[0].open &&
        component.cleared === 0
      ) {
        addFinding(findings, FINDING.NO_REMITTANCE_RECORDED, {
          wageMonth: month.key,
          component: component.component,
          amount: component.amountDue,
        });
      }
    }

    const waiverState = waiver.state;
    if (waiverState === WAIVER_STATE.APPLIED) {
      addFinding(findings, FINDING.WAIVER_PENDING, {
        wageMonth: month.key,
        amount: waiver.payable,
        note: 'A paragraph 32B application is pending. Damages remain payable and are disclosable as contingent; section 7Q interest is not affected by it.',
      });
    } else if (
      waiverState === WAIVER_STATE.GRANTED ||
      waiverState === WAIVER_STATE.GRANTED_IN_PART
    ) {
      addFinding(findings, FINDING.WAIVER_GRANTED, {
        wageMonth: month.key,
        waivedPercent: waiver.waivedPercent,
        note: 'Damages waived under paragraph 32B. Section 7Q interest is unaffected — no authority under the Act can waive it.',
      });
    }

    return { ...month, waiver };
  });

  const summary = new Map();
  for (const finding of findings) {
    const bucket = summary.get(finding.code) || {
      code: finding.code,
      section: finding.section,
      severity: finding.severity,
      count: 0,
      amount: 0,
    };
    bucket.count += 1;
    bucket.amount += Number(finding.amount) || 0;
    summary.set(finding.code, bucket);
  }

  return {
    asAt: measuredAt,
    rules: resolved,
    months: rows,

    /**
     * Section 7Q. Mandatory and not waivable, so this is always a provision.
     */
    interestUnderSection7Q: round2(interest),

    /**
     * Section 14B as assessed under the paragraph 32A slabs, before waiver.
     */
    damagesAssessedUnderSection14B: round2(damagesAssessed),

    /**
     * Section 14B after any paragraph 32B waiver that has actually been
     * granted. A pending application does not reduce this.
     */
    damagesPayableUnderSection14B: round2(damagesPayable),

    /**
     * The part of the payable damages sitting behind a pending application.
     * Disclosable, and already included in `damagesPayableUnderSection14B`.
     */
    damagesContingentOnWaiver: round2(damagesContingent),

    /** The contributions themselves, paid late or not yet paid. */
    arrears: round2(arrears),

    /**
     * The member's share deducted and not remitted.
     *
     * At the top level and never netted. See the note in `assessWageMonth`.
     */
    heldInTrust: round2(heldInTrust),

    findings,
    summary: [...summary.values()].map((bucket) => ({
      ...bucket,
      amount: round2(bucket.amount),
    })),
  };

  // Deliberately no `totalLiability`. Interest that cannot be waived and
  // damages that can be waived to nil are different liabilities to a reader
  // closing the books, and a combined field would be provided for in full by
  // the first report that read it.
}

module.exports = {
  EPF_REMITTANCE_RULES,
  COMPONENT,
  COMPONENT_ACCOUNT,
  COMPONENT_ORDER,
  HELD_IN_TRUST,
  WAIVER_STATE,
  DUE_BASIS,
  FINDING,
  FINDING_SECTION,
  FINDING_SEVERITY,
  SEVERITY,
  toUtcDate,
  daysBetween,
  dueDateFor,
  wageMonthKey,
  resolveRules,
  damageSlabFor,
  allocateTranches,
  sevenQInterest,
  fourteenBDamages,
  applyWaiver,
  assessWageMonth,
  assessEstablishment,
};
