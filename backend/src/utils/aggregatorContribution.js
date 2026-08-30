/**
 * Code on Social Security, 2020, section 114 with the Seventh Schedule (#1829).
 *
 * #1000 tracks a gig worker's timesheet and #1367 pays them through an escrow
 * against milestones. Both treat the gig worker as a counterparty to a
 * contract, which is what they are. Neither can express the thing that makes
 * gig work a *statutory* category: an aggregator owes a contribution measured
 * on **its own turnover**, on account of workers who are expressly not its
 * employees.
 *
 * Between one and two per cent of annual turnover, subject to a ceiling of five
 * per cent of what it pays gig and platform workers. That one sentence is
 * unlike every other contribution here, in three ways at once.
 *
 * **The base is turnover, not wages.** Provident fund, ESI, the Labour Welfare
 * Fund and bonus all start from what somebody was paid. This starts from what
 * the platform earned, and `complianceAggregator.js` has no access to such a
 * figure and no reason to.
 *
 * **The cap is on a different base from the levy.** One to two per cent of
 * turnover, capped at five per cent of payouts — two unrelated quantities, and
 * which binds is a fact about the platform's economics rather than about the
 * statute. A marketplace with high turnover and thin payouts is capped; a
 * delivery platform whose payouts are most of its cost is not. So
 * `contributionFor` returns **both limbs** and says which one bound. Applying
 * the cap silently would hide the only interesting thing about the number.
 *
 * **The worker is counted on a different axis from the levy.** #1771 established
 * that a headcount cannot be a single number; this is the second instance and
 * the resolution is not the same. A gig worker registers on their own
 * engagement, and the same person may work for three aggregators at once — each
 * of which owes its own contribution on its own turnover. One beneficiary,
 * three contributions, and neither derived from the other. Any model that
 * computes the levy per worker either triples the person or arbitrarily assigns
 * them to one platform.
 *
 * Pure functions, no database access.
 */

/**
 * The Code's figures, as the default rule set.
 *
 * A different shape from the earlier rule sets: section 114 fixes a *band* and
 * the operative figure comes by notification inside it, so this holds a range
 * with a currently-assumed point rather than a single notified value. Both are
 * kept, and an out-of-band rate is clamped rather than trusted.
 */
const AGGREGATOR_RULES = {
  /** Section 114(1) — the floor of the band. */
  minRatePercent: 1,
  /** And the ceiling. */
  maxRatePercent: 2,
  /** The rate applied where a category carries none of its own. */
  defaultRatePercent: 1,
  /** Section 114(1) proviso — the ceiling, on a different base entirely. */
  payoutCeilingPercent: 5,
  /** Registration — days of engagement in the lookback. */
  registrationQualifyingDays: 90,
  lookbackMonths: 12,
  /** Per-category rates, where a notification differentiates them. */
  categoryRates: null,
  /** Turnover left unattributed above this share is a finding, not rounding. */
  attributionTolerancePercent: 0.5,
};

/**
 * The Seventh Schedule's aggregator categories.
 *
 * Held as a set rather than as free text because the notified rate may differ
 * by category, and because a single platform is frequently more than one of
 * them — a delivery app that also runs a marketplace has turnover in two, and
 * the module has to be able to say so.
 */
const AGGREGATOR_CATEGORY = {
  RIDE_SHARING: 'RIDE_SHARING',
  FOOD_AND_GROCERY_DELIVERY: 'FOOD_AND_GROCERY_DELIVERY',
  LOGISTICS: 'LOGISTICS',
  E_MARKETPLACE: 'E_MARKETPLACE',
  PROFESSIONAL_SERVICES: 'PROFESSIONAL_SERVICES',
  HEALTHCARE: 'HEALTHCARE',
  TRAVEL_AND_HOSPITALITY: 'TRAVEL_AND_HOSPITALITY',
  CONTENT_AND_MEDIA: 'CONTENT_AND_MEDIA',
  OTHER: 'OTHER',
};

const CATEGORY_LABEL = {
  [AGGREGATOR_CATEGORY.RIDE_SHARING]: 'Ride sharing',
  [AGGREGATOR_CATEGORY.FOOD_AND_GROCERY_DELIVERY]: 'Food and grocery delivery',
  [AGGREGATOR_CATEGORY.LOGISTICS]: 'Logistics',
  [AGGREGATOR_CATEGORY.E_MARKETPLACE]: 'E-marketplace, wholesale or retail',
  [AGGREGATOR_CATEGORY.PROFESSIONAL_SERVICES]: 'Professional services',
  [AGGREGATOR_CATEGORY.HEALTHCARE]: 'Healthcare',
  [AGGREGATOR_CATEGORY.TRAVEL_AND_HOSPITALITY]: 'Travel and hospitality',
  [AGGREGATOR_CATEGORY.CONTENT_AND_MEDIA]: 'Content and media',
  [AGGREGATOR_CATEGORY.OTHER]: 'Other aggregator services',
};

/** Which of the two unrelated bases produced the number. */
const LIMB = {
  /** One to two per cent of annual turnover. */
  TURNOVER: 'TURNOVER',
  /** Five per cent of what was paid to gig and platform workers. */
  PAYOUT_CEILING: 'PAYOUT_CEILING',
};

const LIMB_LABEL = {
  [LIMB.TURNOVER]: 'the turnover limb',
  [LIMB.PAYOUT_CEILING]: 'the payout ceiling',
};

/**
 * The statutes a gig worker is outside.
 *
 * Asserted rather than omitted. #1771's `strengthFor` made the convention a
 * required argument for exactly this reason: a population silently excluded
 * from a headcount is indistinguishable from one somebody forgot.
 */
const EXCLUDED_STATUTE = {
  PROVIDENT_FUND: 'PROVIDENT_FUND',
  ESI: 'ESI',
  GRATUITY: 'GRATUITY',
  BONUS: 'BONUS',
  /** Section 2(35) — not an employee, so no establishment threshold counts them. */
  ESTABLISHMENT_THRESHOLD: 'ESTABLISHMENT_THRESHOLD',
};

const FINDING = {
  RATE_OUTSIDE_BAND: 'RATE_OUTSIDE_BAND',
  TURNOVER_UNATTRIBUTED: 'TURNOVER_UNATTRIBUTED',
  ATTRIBUTION_EXCEEDS_TOTAL: 'ATTRIBUTION_EXCEEDS_TOTAL',
  CEILING_BINDS: 'CEILING_BINDS',
  CEILING_HEADROOM_THIN: 'CEILING_HEADROOM_THIN',
  ACCRUAL_SHORT: 'ACCRUAL_SHORT',
  TRUE_UP_DUE: 'TRUE_UP_DUE',
  WORKER_UNREGISTERED: 'WORKER_UNREGISTERED',
  WORKER_MULTI_AGGREGATOR: 'WORKER_MULTI_AGGREGATOR',
  NO_TURNOVER_RECORDED: 'NO_TURNOVER_RECORDED',
};

const FINDING_SECTION = {
  [FINDING.RATE_OUTSIDE_BAND]: 'section 114(1)',
  [FINDING.TURNOVER_UNATTRIBUTED]: 'Seventh Schedule',
  [FINDING.ATTRIBUTION_EXCEEDS_TOTAL]: 'Seventh Schedule',
  [FINDING.CEILING_BINDS]: 'section 114(1) proviso',
  [FINDING.CEILING_HEADROOM_THIN]: 'section 114(1) proviso',
  [FINDING.ACCRUAL_SHORT]: 'section 114(4)',
  [FINDING.TRUE_UP_DUE]: 'section 114(4)',
  [FINDING.WORKER_UNREGISTERED]: 'section 113',
  [FINDING.WORKER_MULTI_AGGREGATOR]: 'section 113',
  [FINDING.NO_TURNOVER_RECORDED]: 'section 114(1)',
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
 * Merge a rule set over the Code's figures.
 *
 * @param {object} [rules]
 * @returns {object}
 */
function resolveRules(rules) {
  const merged = { ...AGGREGATOR_RULES, ...(rules || {}) };

  if (!merged.categoryRates) merged.categoryRates = {};

  if (!(merged.defaultRatePercent > 0)) {
    merged.defaultRatePercent = AGGREGATOR_RULES.defaultRatePercent;
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
 * The rate for a Seventh Schedule category, clamped to the band.
 *
 * Clamped rather than trusted, for the same reason the construction cess rate
 * is: a finding alone would not stop the number being used, and a contribution
 * outside the band is one the Code cannot support.
 *
 * @param {string} category
 * @param {object} [rules]
 * @returns {object}
 */
function rateForCategory(category, rules) {
  const resolved = resolveRules(rules);

  const configured = Object.hasOwn(resolved.categoryRates, category)
    ? toNumber(resolved.categoryRates[category])
    : resolved.defaultRatePercent;

  const clamped = Math.min(
    Math.max(configured, resolved.minRatePercent),
    resolved.maxRatePercent,
  );

  return {
    category,
    label: CATEGORY_LABEL[category] || category,
    configured,
    rate: clamped,
    withinBand: clamped === configured,
  };
}

/**
 * Turnover split across Seventh Schedule categories, checked against the total.
 *
 * The check matters because an unattributed remainder is not a rounding
 * difference: it is turnover the module does not know the rate for, and
 * absorbing it into whichever category happens to be listed first would produce
 * a plausible contribution computed at the wrong rate.
 *
 * @param {object} params
 * @param {number} params.totalTurnover
 * @param {Array<object>} params.byCategory
 * @param {object} [rules]
 * @returns {object}
 */
function attributeTurnover({ totalTurnover, byCategory = [] }, rules) {
  const resolved = resolveRules(rules);

  const total = Math.max(0, toNumber(totalTurnover));
  const findings = [];
  const rows = [];

  let attributed = 0;

  for (const entry of Array.isArray(byCategory) ? byCategory : []) {
    if (!Object.hasOwn(CATEGORY_LABEL, entry?.category)) continue;

    const amount = Math.max(0, toNumber(entry?.turnover));
    attributed += amount;

    const rate = rateForCategory(entry.category, resolved);

    rows.push({
      ...rate,
      turnover: round2(amount),
      contribution: round2((amount * rate.rate) / 100),
    });

    if (!rate.withinBand) {
      findings.push(
        finding(
          FINDING.RATE_OUTSIDE_BAND,
          SEVERITY.BREACH,
          `${rate.label} carries ${rate.configured}%, outside the ${resolved.minRatePercent}–${resolved.maxRatePercent}% band. Applying ${rate.rate}%.`,
          {
            category: entry.category,
            configured: rate.configured,
            applied: rate.rate,
          },
        ),
      );
    }
  }

  const unattributed = round2(total - attributed);
  const tolerance = round2(
    (total * resolved.attributionTolerancePercent) / 100,
  );

  if (total <= 0) {
    findings.push(
      finding(
        FINDING.NO_TURNOVER_RECORDED,
        SEVERITY.BREACH,
        'No turnover has been recorded, so the turnover limb computes to nil and the payout ceiling will bind by default.',
        {},
      ),
    );
  } else if (unattributed > tolerance) {
    findings.push(
      finding(
        FINDING.TURNOVER_UNATTRIBUTED,
        SEVERITY.BREACH,
        `₹${unattributed} of ₹${round2(total)} turnover is not attributed to a Seventh Schedule category, so no rate applies to it.`,
        { unattributed, total: round2(total) },
      ),
    );
  } else if (unattributed < -tolerance) {
    findings.push(
      finding(
        FINDING.ATTRIBUTION_EXCEEDS_TOTAL,
        SEVERITY.BREACH,
        `The categories add to ₹${round2(attributed)} against a stated total turnover of ₹${round2(total)}.`,
        { attributed: round2(attributed), total: round2(total) },
      ),
    );
  }

  return {
    totalTurnover: round2(total),
    attributed: round2(attributed),
    unattributed,
    categories: rows,
    /** The turnover limb, before the ceiling is considered. */
    contribution: round2(rows.reduce((sum, row) => sum + row.contribution, 0)),
    findings,
  };
}

/**
 * Section 114(1) — both limbs, and which one bound.
 *
 * The whole point of the signature. These are two unrelated quantities, and a
 * caller handed only the smaller of them cannot tell a platform whose payouts
 * are most of its cost from one whose payouts are a rounding error — which is
 * the difference between a levy that will grow with the business and one that
 * is already capped.
 *
 * @param {object} params
 * @param {number} params.totalTurnover
 * @param {Array<object>} [params.byCategory]
 * @param {number} params.workerPayouts
 * @param {object} [rules]
 * @returns {object}
 */
function contributionFor({ totalTurnover, byCategory, workerPayouts }, rules) {
  const resolved = resolveRules(rules);

  const attribution = attributeTurnover(
    { totalTurnover, byCategory },
    resolved,
  );

  const payouts = Math.max(0, toNumber(workerPayouts));
  const ceiling = round2((payouts * resolved.payoutCeilingPercent) / 100);

  const findings = [...attribution.findings];

  const capped = attribution.contribution > ceiling;
  const payable = capped ? ceiling : attribution.contribution;
  const bindingLimb = capped ? LIMB.PAYOUT_CEILING : LIMB.TURNOVER;

  if (capped) {
    findings.push(
      finding(
        FINDING.CEILING_BINDS,
        SEVERITY.INFORMATIONAL,
        `The turnover limb comes to ₹${attribution.contribution} and the proviso caps it at ₹${ceiling}, five per cent of ₹${round2(payouts)} paid to workers. The ceiling binds.`,
        { turnoverLimb: attribution.contribution, ceiling },
      ),
    );
  } else if (ceiling > 0) {
    const headroom = round2(ceiling - attribution.contribution);
    const headroomShare = ceiling > 0 ? (headroom / ceiling) * 100 : 0;

    // Worth saying out loud: a platform whose payout ratio is falling will
    // cross into the cap without the turnover limb changing at all, and the
    // contribution would stop tracking turnover with nothing to signal it.
    if (headroomShare < 10) {
      findings.push(
        finding(
          FINDING.CEILING_HEADROOM_THIN,
          SEVERITY.EXPOSURE,
          `The turnover limb is within ₹${headroom} of the payout ceiling. A small fall in the payout ratio would cap the contribution, and it would stop tracking turnover.`,
          { headroom, headroomShare: round2(headroomShare) },
        ),
      );
    }
  }

  return {
    attribution,
    /** Limb one: the rate applied per category, summed. */
    turnoverLimb: attribution.contribution,
    /** Limb two: five per cent of what workers were paid. */
    workerPayouts: round2(payouts),
    payoutCeiling: ceiling,
    capped,
    bindingLimb,
    bindingLimbLabel: LIMB_LABEL[bindingLimb],
    /** How far the non-binding limb is from binding. */
    headroom: round2(Math.abs(ceiling - attribution.contribution)),
    payable: round2(payable),
    findings,
  };
}

/**
 * What section 114 does *not* attract.
 *
 * Computed and stated rather than merely omitted. A gig worker is not an
 * employee under section 2(35), so none of these apply and no establishment
 * threshold counts them — and a caller reading a result with no mention of the
 * provident fund cannot tell that from an oversight.
 *
 * @returns {object}
 */
function statutoryExclusions() {
  return Object.fromEntries(
    Object.values(EXCLUDED_STATUTE).map((statute) => [
      statute,
      {
        applies: false,
        reason:
          'A gig or platform worker is engaged outside a traditional employer–employee relationship under section 2(35), so this does not attach.',
      },
    ]),
  );
}

/**
 * One worker, counted per person rather than per platform.
 *
 * The axis the levy is *not* on. Registration and benefit entitlement are the
 * worker's, assembled from engagements across every aggregator; the
 * contribution is each aggregator's, on its own turnover. Deriving either from
 * the other triples the person or arbitrarily assigns them to one platform.
 *
 * @param {object} worker
 * @param {object} [rules]
 * @returns {object}
 */
function workerRegistration(worker, rules) {
  const resolved = resolveRules(rules);

  const engagements = Array.isArray(worker?.engagements)
    ? worker.engagements
    : [];

  const findings = [];

  const byAggregator = new Map();
  let daysTotal = 0;

  for (const engagement of engagements) {
    const days = Math.max(0, toNumber(engagement?.days));
    daysTotal += days;

    const key = engagement?.aggregator || '(unnamed)';
    byAggregator.set(key, round2((byAggregator.get(key) || 0) + days));
  }

  const qualifies = daysTotal >= resolved.registrationQualifyingDays;
  const registered = Boolean(worker?.registeredOn);

  // The same person on three platforms is one beneficiary. Reported because an
  // aggregator looking only at its own engagement days would think this worker
  // fell short, and because the benefit must not be counted three times.
  if (byAggregator.size > 1) {
    findings.push(
      finding(
        FINDING.WORKER_MULTI_AGGREGATOR,
        SEVERITY.INFORMATIONAL,
        `Engaged by ${byAggregator.size} aggregators for ${daysTotal} days in total. One beneficiary, and each aggregator owes its own contribution on its own turnover.`,
        { aggregatorCount: byAggregator.size, daysTotal },
      ),
    );
  }

  if (qualifies && !registered) {
    findings.push(
      finding(
        FINDING.WORKER_UNREGISTERED,
        SEVERITY.BREACH,
        `${daysTotal} days across ${byAggregator.size} aggregator(s), past the ${resolved.registrationQualifyingDays} the Code requires, and not registered.`,
        { daysTotal, qualifyingDays: resolved.registrationQualifyingDays },
      ),
    );
  }

  return {
    workerId: worker?.workerId || null,
    name: worker?.name || '',
    daysTotal: round2(daysTotal),
    daysByAggregator: Object.fromEntries(byAggregator),
    aggregatorCount: byAggregator.size,
    qualifyingDays: resolved.registrationQualifyingDays,
    qualifies,
    registered,
    registeredOn: toDate(worker?.registeredOn),
    /** Stated, not omitted — see `statutoryExclusions`. */
    exclusions: statutoryExclusions(),
    findings: findings.map((entry) => ({
      ...entry,
      workerId: worker?.workerId || null,
      workerName: worker?.name || '',
    })),
  };
}

/**
 * Section 114(4) — the provisional accrual through the year, and the true-up.
 *
 * The contribution is annual against annual turnover, so something has to
 * accrue in the meantime. This compares what was deposited against what the
 * period's own figures come to and reports the difference in the direction it
 * falls, rather than netting to a single signed number that reads as a payment
 * either way.
 *
 * @param {object} params
 * @param {number} params.payable the year's contribution
 * @param {number} params.deposited what has been paid across the year
 * @param {boolean} [params.turnoverFinalised]
 * @returns {object}
 */
function reconcileAccrual({ payable, deposited, turnoverFinalised = false }) {
  const due = Math.max(0, toNumber(payable));
  const paid = Math.max(0, toNumber(deposited));

  const findings = [];

  const shortfall = round2(Math.max(0, due - paid));
  const excess = round2(Math.max(0, paid - due));

  if (shortfall > 0.005) {
    findings.push(
      finding(
        turnoverFinalised ? FINDING.TRUE_UP_DUE : FINDING.ACCRUAL_SHORT,
        turnoverFinalised ? SEVERITY.BREACH : SEVERITY.EXPOSURE,
        turnoverFinalised
          ? `Turnover is finalised and ₹${shortfall} of the contribution remains to be deposited.`
          : `₹${shortfall} more has accrued than has been deposited. Turnover is not finalised, so this is a provisional figure.`,
        { due, deposited: paid, shortfall },
      ),
    );
  }

  return {
    due,
    deposited: paid,
    shortfall,
    excess,
    turnoverFinalised: turnoverFinalised === true,
    /**
     * Provisional until the turnover is finalised. Named so a reader does not
     * treat a mid-year figure as the assessed contribution.
     */
    provisional: turnoverFinalised !== true,
    findings,
  };
}

/**
 * One aggregator for a period, with its worker register beside it.
 *
 * @param {object} params
 * @returns {object}
 */
function assessAggregator({ aggregator = {}, workers = [], rules } = {}) {
  const resolved = resolveRules(rules);

  const contribution = contributionFor(
    {
      totalTurnover: aggregator?.totalTurnover,
      byCategory: aggregator?.byCategory,
      workerPayouts: aggregator?.workerPayouts,
    },
    resolved,
  );

  const accrual = reconcileAccrual({
    payable: contribution.payable,
    deposited: aggregator?.deposited,
    turnoverFinalised: aggregator?.turnoverFinalised,
  });

  const register = workers.map((worker) =>
    workerRegistration(worker, resolved),
  );

  const findings = [
    ...contribution.findings,
    ...accrual.findings,
    ...register.flatMap((row) => row.findings),
  ];

  const summary = new Map();
  for (const entry of findings) {
    const bucket = summary.get(entry.code) || {
      code: entry.code,
      section: entry.section,
      severity: entry.severity,
      count: 0,
      workers: new Set(),
    };

    bucket.count += 1;
    if (entry.workerId) bucket.workers.add(String(entry.workerId));
    summary.set(entry.code, bucket);
  }

  return {
    name: aggregator?.name || '',
    contribution,
    accrual,

    workerCount: register.length,
    qualifyingCount: register.filter((row) => row.qualifies).length,
    registeredCount: register.filter((row) => row.registered).length,
    /**
     * Workers engaged by more than one aggregator.
     *
     * The count that keeps the two axes apart: each of these is one beneficiary
     * against several contributions, and a register built per platform would
     * either duplicate them or lose the days they worked elsewhere.
     */
    multiAggregatorCount: register.filter((row) => row.aggregatorCount > 1)
      .length,

    /** Stated for the aggregator as a whole, not only per worker. */
    exclusions: statutoryExclusions(),

    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      section: bucket.section,
      severity: bucket.severity,
      count: bucket.count,
      workerCount: bucket.workers.size,
    })),
    workers: register,
  };
}

module.exports = {
  AGGREGATOR_RULES,
  AGGREGATOR_CATEGORY,
  CATEGORY_LABEL,
  LIMB,
  LIMB_LABEL,
  EXCLUDED_STATUTE,
  FINDING,
  FINDING_SECTION,
  SEVERITY,
  resolveRules,
  rateForCategory,
  attributeTurnover,
  contributionFor,
  statutoryExclusions,
  workerRegistration,
  reconcileAccrual,
  assessAggregator,
};
