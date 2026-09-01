/**
 * Industrial Employment (Standing Orders) Act, 1946, section 10A (#1828).
 *
 * `salaryCalculator.js` can pay somebody and `settlement.js` can stop paying
 * them. There is a third state neither can represent: **suspended pending
 * enquiry**, where the employment subsists, the workman does no work, and the
 * employer is nonetheless obliged to pay.
 *
 * The scale rises with time:
 *
 *   first 90 days      50%
 *   days 91 to 180     75%   if the delay is not attributable to the workman
 *   beyond 180 days   100%   on the same condition
 *
 * That condition is why this cannot be date arithmetic. The uplift is
 * conditional on a **finding** — whose fault the delay is — and where the delay
 * *is* the workman's the rate stays at fifty per cent for the whole of the
 * second tier. So `ATTRIBUTABILITY` is a required part of the input and its
 * default is `NOT_DETERMINED`, which does **not** uplift.
 *
 * Defaulting the other way would overpay by silence, and overpayment here is
 * the expensive direction: the only way to correct it afterwards is recovery,
 * which is the thing labour law is least forgiving about.
 *
 * Three further conventions this module fixes rather than infers:
 *
 *   - **Which wages.** Section 10A is on the wages the workman was entitled to
 *     immediately preceding the suspension, meaning basic and dearness
 *     allowance. That is a fourth definition of "wages" in this tree, after the
 *     gross `salaryCalculator.js` produces and the section 2(b) one
 *     `paymentOfWages.js` uses — so it is named rather than assumed, and it is
 *     **frozen** at the date of suspension so a revision to the workman's grade
 *     during a two-year suspension does not move it.
 *
 *   - **What the drawn allowance becomes.** On reinstatement with back wages it
 *     is a set-off against them; on dismissal it is not recoverable. The same
 *     ledger rows mean different things depending on an outcome that arrives
 *     months later, so the module converts rather than re-derives.
 *
 *   - **Whether it is wages for anything else.** Held in the rule set as one
 *     declaration, so the provident fund, ESI and bonus answers are one
 *     decision rather than three independent ones falling out of whichever
 *     module happens to read the payslip row.
 *
 * Pure functions, no database access.
 */

const DAY_MS = 86400000;

/**
 * Section 10A's figures, as the default rule set.
 *
 * A rule set because several states prescribe more generous scales in their own
 * standing orders rules, some certified standing orders better the statute, and
 * the section 1(3) applicability threshold is amended state by state — fifty in
 * several rather than the central hundred.
 */
const SUBSISTENCE_RULES = {
  /** Section 10A(1)(a) — the first tier, in days. */
  firstTierDays: 90,
  firstTierPercent: 50,
  /** Section 10A(1)(b) — the second tier ends here. */
  secondTierDays: 180,
  secondTierPercent: 75,
  /** Section 10A(1)(c) — everything beyond. */
  thirdTierPercent: 100,

  /** Section 1(3) — workmen, above which standing orders are certifiable. */
  standingOrdersThreshold: 100,

  /**
   * Whether the allowance counts as wages elsewhere.
   *
   * One declaration rather than six independent ones. It is not remuneration
   * for work done, so the defaults are `false` — but the point of holding them
   * here is that an establishment which takes a different view states it once.
   */
  countsForProvidentFund: false,
  countsForEsi: false,
  countsForBonus: false,
  /** It is salary in the hands of the workman, whatever else it is not. */
  countsForTds: true,

  /** Days in a month, for turning a monthly wage into a daily one. */
  daysPerMonth: 30,
};

/**
 * Whose fault the delay is.
 *
 * The whole reason this module is not date arithmetic. Section 10A(1)(b) and
 * (c) uplift only where the delay in completing the enquiry is *not directly
 * attributable* to the workman's conduct.
 *
 * `NOT_DETERMINED` is the default and does not uplift. A finding nobody has
 * made is not a finding in the workman's favour, and the alternative default
 * overpays silently — recoverable only by a recovery, which is the worst
 * available remedy here.
 */
const ATTRIBUTABILITY = {
  /** Nobody has made the finding. No uplift. */
  NOT_DETERMINED: 'NOT_DETERMINED',
  /** The workman's own conduct caused the delay. No uplift. */
  WORKMAN: 'WORKMAN',
  /** Anything else — the employer's delay, the tribunal's, nobody's. Uplifts. */
  NOT_WORKMAN: 'NOT_WORKMAN',
};

/** Whether the attributability finding permits the tier-two and -three uplift. */
const UPLIFTS = {
  [ATTRIBUTABILITY.NOT_DETERMINED]: false,
  [ATTRIBUTABILITY.WORKMAN]: false,
  [ATTRIBUTABILITY.NOT_WORKMAN]: true,
};

/**
 * How the enquiry ended, and therefore what the drawn allowance becomes.
 */
const OUTCOME = {
  /** Still running. */
  PENDING: 'PENDING',
  /** The allowance drawn is set off against the back wages. */
  REINSTATED_WITH_BACK_WAGES: 'REINSTATED_WITH_BACK_WAGES',
  /** Reinstated, no back wages ordered. The allowance stands and closes. */
  REINSTATED_WITHOUT_BACK_WAGES: 'REINSTATED_WITHOUT_BACK_WAGES',
  /** No back-wage computation, and the allowance is not recoverable. */
  DISMISSED: 'DISMISSED',
  /** The suspension was lifted without a finding either way. */
  SUSPENSION_REVOKED: 'SUSPENSION_REVOKED',
};

/**
 * Which definition of wages a figure is under.
 *
 * Named because there are already three live in this tree and a fourth silently
 * added is how they get confused. A caller passing a gross salary where this
 * module expects basic-plus-DA would overpay by roughly the allowance itself.
 */
const WAGE_BASIS = {
  /** Section 10A — basic and dearness allowance, as immediately preceding. */
  BASIC_PLUS_DA: 'BASIC_PLUS_DA',
};

const FINDING = {
  ATTRIBUTABILITY_NOT_DETERMINED: 'ATTRIBUTABILITY_NOT_DETERMINED',
  TIER_TRANSITION_DUE: 'TIER_TRANSITION_DUE',
  UNDERPAID: 'UNDERPAID',
  UNPAID: 'UNPAID',
  OVERPAID: 'OVERPAID',
  ENQUIRY_PROLONGED: 'ENQUIRY_PROLONGED',
  WAGE_BASIS_UNRECORDED: 'WAGE_BASIS_UNRECORDED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  SET_OFF_APPLIED: 'SET_OFF_APPLIED',
  NOT_RECOVERABLE: 'NOT_RECOVERABLE',
};

const FINDING_SECTION = {
  [FINDING.ATTRIBUTABILITY_NOT_DETERMINED]: 'section 10A(1)(b)',
  [FINDING.TIER_TRANSITION_DUE]: 'section 10A(1)',
  [FINDING.UNDERPAID]: 'section 10A(1)',
  [FINDING.UNPAID]: 'section 10A(4)',
  [FINDING.OVERPAID]: 'section 10A(1)',
  [FINDING.ENQUIRY_PROLONGED]: 'section 10A(1)(c)',
  [FINDING.WAGE_BASIS_UNRECORDED]: 'section 10A(1)',
  [FINDING.NOT_APPLICABLE]: 'section 1(3)',
  [FINDING.SET_OFF_APPLIED]: 'section 10A(1)',
  [FINDING.NOT_RECOVERABLE]: 'section 10A(1)',
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
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Merge a rule set over section 10A's figures.
 *
 * @param {object} [rules]
 * @returns {object}
 */
function resolveRules(rules) {
  const merged = { ...SUBSISTENCE_RULES, ...(rules || {}) };

  if (!(merged.daysPerMonth > 0)) {
    merged.daysPerMonth = SUBSISTENCE_RULES.daysPerMonth;
  }

  // A certified standing order may better the statute and may not undercut it.
  // Clamping rather than trusting, because a stored rule set below section 10A
  // would produce an underpayment that looks authorised.
  merged.firstTierPercent = Math.max(
    merged.firstTierPercent,
    SUBSISTENCE_RULES.firstTierPercent,
  );
  merged.secondTierPercent = Math.max(
    merged.secondTierPercent,
    SUBSISTENCE_RULES.secondTierPercent,
  );
  merged.thirdTierPercent = Math.max(
    merged.thirdTierPercent,
    SUBSISTENCE_RULES.thirdTierPercent,
  );

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
 * The rate for a given day of suspension.
 *
 * Day one is the first day. Day 90 is still in the first tier and day 91 is in
 * the second, which is what "for the first ninety days" means and is the
 * off-by-one this function exists to fix in one place.
 *
 * The second and third tiers uplift **only** where the attributability finding
 * permits it. Where it does not, the rate stays at the first-tier percentage
 * however long the enquiry runs — section 10A does not reward the employer for
 * a delay it did not cause, and it does not reward the workman for one they did.
 *
 * @param {number} dayNumber 1-based
 * @param {string} attributability an ATTRIBUTABILITY
 * @param {object} [rules]
 * @returns {object}
 */
function rateForDay(dayNumber, attributability, rules) {
  const resolved = resolveRules(rules);

  if (!Object.hasOwn(UPLIFTS, attributability)) {
    throw new TypeError(
      `rateForDay needs an attributability finding; "${attributability}" is not one of ${Object.keys(UPLIFTS).join(', ')}`,
    );
  }

  const day = Math.max(1, Math.floor(toNumber(dayNumber)));
  const uplifts = UPLIFTS[attributability];

  if (day <= resolved.firstTierDays) {
    return { tier: 1, percent: resolved.firstTierPercent, uplifted: false };
  }

  if (day <= resolved.secondTierDays) {
    return {
      tier: 2,
      // The point of the whole module. An un-made finding leaves the rate here.
      percent: uplifts ? resolved.secondTierPercent : resolved.firstTierPercent,
      uplifted: uplifts,
    };
  }

  return {
    tier: 3,
    percent: uplifts ? resolved.thirdTierPercent : resolved.firstTierPercent,
    uplifted: uplifts,
  };
}

/**
 * The section 10A wage base, frozen at the date of suspension.
 *
 * Frozen because the Act says "the wages which the workman was entitled to
 * immediately preceding the date of suspension". A grade revision granted
 * during a two-year suspension does not move it, in either direction.
 *
 * @param {object} params
 * @param {number} params.basic
 * @param {number} [params.dearnessAllowance]
 * @param {object} [rules]
 * @returns {object}
 */
function wageBase({ basic, dearnessAllowance = 0 }, rules) {
  const resolved = resolveRules(rules);

  const monthly =
    Math.max(0, toNumber(basic)) + Math.max(0, toNumber(dearnessAllowance));

  return {
    basis: WAGE_BASIS.BASIC_PLUS_DA,
    basic: round2(basic),
    dearnessAllowance: round2(dearnessAllowance),
    monthly: round2(monthly),
    daily: round2(monthly / resolved.daysPerMonth),
    /**
     * Stated so a caller cannot quietly hand a gross figure to a function that
     * wants basic and dearness allowance, which would overpay by roughly the
     * allowance itself.
     */
    note: 'Section 10A is on basic and dearness allowance as immediately preceding the suspension — not the gross this product computes elsewhere.',
  };
}

/**
 * A day-by-day entitlement, aggregated into tier bands.
 *
 * Banded rather than returned per day because a two-year suspension is seven
 * hundred rows nobody reads, and the three bands are what an enquiry record
 * actually needs: what rate, from when, on what finding.
 *
 * @param {object} params
 * @param {Date|string} params.suspendedOn
 * @param {Date|string} [params.through] the last day to compute to
 * @param {object} params.wages basic and dearnessAllowance
 * @param {string} params.attributability
 * @param {object} [rules]
 * @returns {object}
 */
function entitlementSchedule(params, rules) {
  const resolved = resolveRules(rules);

  const from = toDate(params?.suspendedOn);
  if (!from) {
    throw new TypeError('entitlementSchedule needs a suspension date');
  }

  const to = toDate(params?.through) || new Date();
  const base = wageBase(params?.wages || {}, resolved);

  // Inclusive of both ends: a suspension beginning and ending on the same day
  // is one day of suspension, not zero.
  const days = Math.max(
    0,
    Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1,
  );

  const bands = [];

  for (let day = 1; day <= days; day += 1) {
    const rate = rateForDay(day, params?.attributability, resolved);
    const last = bands[bands.length - 1];

    if (last && last.tier === rate.tier && last.percent === rate.percent) {
      last.days += 1;
      last.toDay = day;
      last.toDate = new Date(from.getTime() + (day - 1) * DAY_MS);
      continue;
    }

    bands.push({
      tier: rate.tier,
      percent: rate.percent,
      uplifted: rate.uplifted,
      fromDay: day,
      toDay: day,
      fromDate: new Date(from.getTime() + (day - 1) * DAY_MS),
      toDate: new Date(from.getTime() + (day - 1) * DAY_MS),
      days: 1,
    });
  }

  for (const band of bands) {
    band.dailyAmount = round2((base.daily * band.percent) / 100);
    band.amount = round2(band.dailyAmount * band.days);
  }

  return {
    suspendedOn: from,
    through: to,
    days,
    wageBase: base,
    attributability: params?.attributability,
    bands,
    due: round2(bands.reduce((sum, band) => sum + band.amount, 0)),
    /**
     * When the rate next changes, so a suspension can be watched rather than
     * remembered. Null once the third tier has been reached.
     */
    nextTransition:
      days < resolved.firstTierDays
        ? {
            onDay: resolved.firstTierDays + 1,
            onDate: new Date(from.getTime() + resolved.firstTierDays * DAY_MS),
            toPercent: UPLIFTS[params?.attributability]
              ? resolved.secondTierPercent
              : resolved.firstTierPercent,
          }
        : days < resolved.secondTierDays
          ? {
              onDay: resolved.secondTierDays + 1,
              onDate: new Date(
                from.getTime() + resolved.secondTierDays * DAY_MS,
              ),
              toPercent: UPLIFTS[params?.attributability]
                ? resolved.thirdTierPercent
                : resolved.firstTierPercent,
            }
          : null,
  };
}

/**
 * What the drawn allowance becomes once the enquiry ends.
 *
 * The module converts rather than re-derives, because the same ledger rows mean
 * different things depending on an outcome that arrives months later:
 *
 *   reinstated with back wages   a set-off against them
 *   reinstated without          the allowance stands, and closes
 *   dismissed                   not recoverable
 *   revoked                     treated as reinstatement without back wages
 *
 * @param {object} params
 * @param {string} params.outcome an OUTCOME
 * @param {number} params.drawn what was actually paid as subsistence allowance
 * @param {number} [params.backWages] gross back wages ordered
 * @returns {object}
 */
function resolveOutcome({ outcome, drawn, backWages = 0 }) {
  const paid = Math.max(0, toNumber(drawn));
  const wages = Math.max(0, toNumber(backWages));

  const findings = [];

  if (outcome === OUTCOME.REINSTATED_WITH_BACK_WAGES) {
    const net = round2(Math.max(0, wages - paid));

    findings.push(
      finding(
        FINDING.SET_OFF_APPLIED,
        SEVERITY.INFORMATIONAL,
        `₹${round2(paid)} drawn as subsistence allowance is set off against ₹${round2(wages)} of back wages, leaving ₹${net}.`,
        { drawn: round2(paid), backWages: round2(wages), net },
      ),
    );

    return {
      outcome,
      drawn: round2(paid),
      backWages: round2(wages),
      setOff: round2(Math.min(paid, wages)),
      netPayable: net,
      recoverable: 0,
      findings,
    };
  }

  if (outcome === OUTCOME.DISMISSED) {
    findings.push(
      finding(
        FINDING.NOT_RECOVERABLE,
        SEVERITY.INFORMATIONAL,
        `₹${round2(paid)} was drawn during the suspension. A dismissal produces no back-wage computation and the allowance is not recoverable.`,
        { drawn: round2(paid) },
      ),
    );
  }

  return {
    outcome,
    drawn: round2(paid),
    backWages: 0,
    setOff: 0,
    netPayable: 0,
    recoverable: 0,
    findings,
  };
}

/**
 * One suspension, end to end.
 *
 * @param {object} suspension
 * @param {object} [rules]
 * @returns {object}
 */
function assessSuspension(suspension, rules) {
  const resolved = resolveRules(rules);

  const attributability =
    suspension?.attributability || ATTRIBUTABILITY.NOT_DETERMINED;

  const schedule = entitlementSchedule(
    {
      suspendedOn: suspension?.suspendedOn,
      through: suspension?.concludedOn || suspension?.asAt,
      wages: suspension?.wages,
      attributability,
    },
    resolved,
  );

  const findings = [];

  if (!(schedule.wageBase.monthly > 0)) {
    findings.push(
      finding(
        FINDING.WAGE_BASIS_UNRECORDED,
        SEVERITY.BREACH,
        'No basic or dearness allowance has been recorded as at the date of suspension, so the entitlement computes to nil.',
        {},
      ),
    );
  }

  // Reported wherever the suspension has run past the first tier, because that
  // is the point where the finding starts to matter — and where its absence
  // starts costing the workman money.
  if (
    schedule.days > resolved.firstTierDays &&
    attributability === ATTRIBUTABILITY.NOT_DETERMINED
  ) {
    const upliftedIfFound = entitlementSchedule(
      {
        suspendedOn: suspension?.suspendedOn,
        through: suspension?.concludedOn || suspension?.asAt,
        wages: suspension?.wages,
        attributability: ATTRIBUTABILITY.NOT_WORKMAN,
      },
      resolved,
    );

    findings.push(
      finding(
        FINDING.ATTRIBUTABILITY_NOT_DETERMINED,
        SEVERITY.EXPOSURE,
        `${schedule.days} days and no finding on whose conduct delayed the enquiry, so the rate is still ${resolved.firstTierPercent}%. A finding that the delay is not the workman's would raise the entitlement by ₹${round2(upliftedIfFound.due - schedule.due)}.`,
        {
          days: schedule.days,
          differenceIfFound: round2(upliftedIfFound.due - schedule.due),
        },
      ),
    );
  }

  if (schedule.days > resolved.secondTierDays) {
    findings.push(
      finding(
        FINDING.ENQUIRY_PROLONGED,
        SEVERITY.INFORMATIONAL,
        `The suspension has run ${schedule.days} days, past the ${resolved.secondTierDays} at which section 10A(1)(c) reaches full wages.`,
        { days: schedule.days },
      ),
    );
  }

  if (schedule.nextTransition) {
    findings.push(
      finding(
        FINDING.TIER_TRANSITION_DUE,
        SEVERITY.INFORMATIONAL,
        `The rate changes on day ${schedule.nextTransition.onDay}, ${schedule.nextTransition.onDate.toISOString().slice(0, 10)}.`,
        schedule.nextTransition,
      ),
    );
  }

  const paid = Math.max(0, toNumber(suspension?.paid));
  const shortfall = round2(Math.max(0, schedule.due - paid));
  const excess = round2(Math.max(0, paid - schedule.due));

  if (schedule.due > 0 && paid <= 0) {
    findings.push(
      finding(
        FINDING.UNPAID,
        SEVERITY.BREACH,
        `₹${schedule.due} is due and nothing has been paid. Non-payment is an offence under section 10A(4) independently of what the enquiry finds.`,
        { due: schedule.due },
      ),
    );
  } else if (shortfall > 0.005) {
    findings.push(
      finding(
        FINDING.UNDERPAID,
        SEVERITY.BREACH,
        `₹${schedule.due} is due and ₹${round2(paid)} has been paid.`,
        { due: schedule.due, paid: round2(paid), shortfall },
      ),
    );
  } else if (excess > 0.005) {
    findings.push(
      finding(
        FINDING.OVERPAID,
        SEVERITY.INFORMATIONAL,
        `₹${round2(paid)} has been paid against ₹${schedule.due} due. Recovering it is the remedy labour law is least forgiving about, so this is reported rather than netted.`,
        { due: schedule.due, paid: round2(paid), excess },
      ),
    );
  }

  const outcome = resolveOutcome({
    outcome: suspension?.outcome || OUTCOME.PENDING,
    drawn: paid,
    backWages: suspension?.backWages,
  });

  const allFindings = [...findings, ...outcome.findings].map((entry) => ({
    ...entry,
    suspensionId: suspension?.suspensionId || null,
    employeeId: suspension?.employeeId || null,
    employeeName: suspension?.name || '',
  }));

  return {
    suspensionId: suspension?.suspensionId || null,
    employeeId: suspension?.employeeId || null,
    name: suspension?.name || '',
    attributability,
    schedule,
    due: schedule.due,
    paid: round2(paid),
    shortfall,
    excess,
    outcome,
    /** The statutory-treatment declaration, carried so callers do not guess. */
    treatment: {
      basis: schedule.wageBase.basis,
      countsForProvidentFund: resolved.countsForProvidentFund,
      countsForEsi: resolved.countsForEsi,
      countsForBonus: resolved.countsForBonus,
      countsForTds: resolved.countsForTds,
    },
    findings: allFindings,
  };
}

/**
 * Section 1(3) — whether standing orders are certifiable for the establishment.
 *
 * The threshold is amended state by state — fifty in several rather than the
 * central hundred — so it lives in the rule set. Reported rather than used as a
 * gate on the computation: an establishment below the threshold that has
 * *adopted* standing orders is bound by them, and returning nil would be wrong.
 *
 * @param {object} params
 * @param {object} [rules]
 * @returns {object}
 */
function assessApplicability(
  { workmen, standingOrdersCertified = false },
  rules,
) {
  const resolved = resolveRules(rules);

  const count = Math.max(0, toNumber(workmen));
  const findings = [];

  const certifiable = count >= resolved.standingOrdersThreshold;

  if (!certifiable && !standingOrdersCertified) {
    findings.push(
      finding(
        FINDING.NOT_APPLICABLE,
        SEVERITY.INFORMATIONAL,
        `${count} workmen, below the ${resolved.standingOrdersThreshold} at which standing orders are certifiable in this state. An establishment that has adopted them anyway is still bound by them.`,
        { workmen: count, threshold: resolved.standingOrdersThreshold },
      ),
    );
  }

  return {
    certifiable,
    /** Adopted counts, whether or not the threshold was reached. */
    applicable: certifiable || standingOrdersCertified === true,
    workmen: count,
    threshold: resolved.standingOrdersThreshold,
    standingOrdersCertified: standingOrdersCertified === true,
    findings,
  };
}

/**
 * The establishment's open and concluded suspensions.
 *
 * @param {object} params
 * @returns {object}
 */
function assessEstablishment({
  suspensions = [],
  applicability = {},
  rules,
} = {}) {
  const resolved = resolveRules(rules);

  const gate = assessApplicability(
    {
      workmen: applicability?.workmen,
      standingOrdersCertified: applicability?.standingOrdersCertified,
    },
    resolved,
  );

  const assessed = suspensions.map((suspension) =>
    assessSuspension(suspension, resolved),
  );

  const findings = [
    ...gate.findings,
    ...assessed.flatMap((row) => row.findings),
  ];

  const summary = new Map();
  for (const entry of findings) {
    const bucket = summary.get(entry.code) || {
      code: entry.code,
      section: entry.section,
      severity: entry.severity,
      count: 0,
      suspensions: new Set(),
    };

    bucket.count += 1;
    if (entry.suspensionId) bucket.suspensions.add(String(entry.suspensionId));
    summary.set(entry.code, bucket);
  }

  const sum = (pick) =>
    round2(assessed.reduce((total, row) => total + pick(row), 0));

  const open = assessed.filter(
    (row) => (row.outcome.outcome || OUTCOME.PENDING) === OUTCOME.PENDING,
  );

  return {
    applicable: gate.applicable,
    applicability: gate,

    suspensionCount: assessed.length,
    openCount: open.length,

    due: sum((row) => row.due),
    paid: sum((row) => row.paid),
    shortfall: sum((row) => row.shortfall),

    /**
     * Open suspensions past the first tier with no attributability finding.
     *
     * The number that matters operationally: each of these is a workman being
     * paid fifty per cent because nobody has answered a question, and the
     * question gets harder to answer the longer it is left.
     */
    awaitingFindingCount: open.filter(
      (row) =>
        row.attributability === ATTRIBUTABILITY.NOT_DETERMINED &&
        row.schedule.days > resolved.firstTierDays,
    ).length,

    /** What a finding in the workman's favour would add, across those. */
    exposureIfAttributed: round2(
      open.reduce((total, row) => {
        const entry = row.findings.find(
          (item) => item.code === FINDING.ATTRIBUTABILITY_NOT_DETERMINED,
        );
        return total + (entry?.differenceIfFound || 0);
      }, 0),
    ),

    setOffOnReinstatement: sum((row) => row.outcome.setOff),

    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      suspensionCount: bucket.suspensions.size,
    })),
    suspensions: assessed,
  };
}

module.exports = {
  SUBSISTENCE_RULES,
  ATTRIBUTABILITY,
  UPLIFTS,
  OUTCOME,
  WAGE_BASIS,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  resolveRules,
  rateForDay,
  wageBase,
  entitlementSchedule,
  resolveOutcome,
  assessSuspension,
  assessApplicability,
  assessEstablishment,
};
