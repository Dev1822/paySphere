/**
 * EDLI paragraph 22 — the assurance benefit (#1878).
 *
 * `ecrGenerator.utils.js` deducts `EDLI_RATE = 0.005` on every wage month and
 * puts it in the ECR. That is the contribution side of the Employees' Deposit
 * Linked Insurance Scheme, 1976, and it is the only part of the scheme this
 * product knows about. What the scheme pays when a member dies in service — the
 * reason the half per cent is collected — has had no representation anywhere.
 *
 * Four things shape everything below.
 *
 * **The averaging window is a window, not a salary.** Paragraph 22 takes the
 * average monthly wages of the twelve months **preceding the month of death**,
 * each capped at the statutory ceiling. A month of loss of pay is a month with
 * a low figure, not a month to skip — skipping it raises the average and
 * overstates the benefit. `averageMonthlyWages` divides by the window rather
 * than by the number of months it found a figure for, and says which it did.
 *
 * **The minimum is conditional and the condition is not this employer's to
 * answer.** ₹2,50,000 applies where the member was in continuous employment for
 * twelve months preceding the month of death, and that continuity may run
 * **across more than one establishment**. An employee who joined three months
 * ago having worked elsewhere for the preceding year qualifies; one with a gap
 * does not. Neither the date of joining nor the attendance ledger can answer
 * it, so prior service is a stated input with its basis recorded and is never
 * inferred from silence.
 *
 * **An exempted establishment needs a comparison, not a claim.** Where the
 * establishment is exempted under section 17(2A) it runs a group policy
 * instead, and the exemption is conditional on that policy paying **not less
 * than** the scheme would. So `exemptedComparison` computes the paragraph 22
 * figure anyway and reports the shortfall. For an unexempted establishment the
 * EPFO settles the claim on its own arithmetic; for an exempted one nobody else
 * is computing this number at all.
 *
 * **A benefit with no payee is not a benefit.** The assurance is paid to the
 * nominee under the EPF scheme, and where there is none to the family as the
 * scheme defines it and then to the legal heir. `resolvePayees` returns the
 * chain it applied rather than a single name, because which limb applied is the
 * thing a dispute turns on.
 *
 * Pure functions, no database access, matching how `epsPension.js` and
 * `gratuityValuation.js` are written.
 */

/**
 * Paragraph 22 as amended with effect from 28 April 2021.
 *
 * Dated because every figure here has moved: the overall cap was ₹6,00,000
 * before the 2021 amendment and the minimum has been notified more than once.
 * A claim for a death in an earlier year has to reproduce the figures in force
 * then, so `resolveRules` picks by date and the result snapshots what it used.
 */
const EDLI_RULES = {
  effectiveFrom: '2021-04-28',

  /** Wages are taken at this ceiling for every month of the window. */
  wageCeiling: 15000,

  /** Thirty-five times the capped average. */
  multiplier: 35,

  /** Plus half of the average provident fund balance... */
  bonusPercentOfAverageBalance: 50,
  /** ...capped here. */
  bonusCap: 175000,

  /**
   * The whole benefit is capped here.
   *
   * 35 × 15,000 is 5,25,000 and the bonus cap is 1,75,000, which sum to exactly
   * this figure — so the overall cap binds only where a rule set has been
   * overridden inconsistently. It is applied anyway rather than assumed away.
   */
  overallCap: 700000,

  /** The floor, and it is conditional — see `minimumContinuousMonths`. */
  minimumBenefit: 250000,

  /**
   * Twelve months of continuous employment preceding the month of death,
   * which may be across more than one establishment.
   */
  minimumContinuousMonths: 12,

  /** The averaging window, in months preceding the month of death. */
  averagingMonths: 12,

  /** The contribution, for reconciliation only. Not used in the benefit. */
  contributionPercent: 0.5,
};

/**
 * Rule sets in date order. Seeds, and a tenant may add its own.
 *
 * The pre-2021 set is carried rather than dropped because claims for earlier
 * deaths are settled years later, and a claim computed under today's figures
 * for a death in 2019 is a number the EPFO will not recognise.
 */
const SEED_RULE_SETS = [
  {
    ...EDLI_RULES,
    effectiveFrom: '2018-02-15',
    bonusPercentOfAverageBalance: 50,
    bonusCap: 150000,
    overallCap: 600000,
    minimumBenefit: 250000,
  },
  { ...EDLI_RULES },
];

/** How the prior service behind the minimum was established. */
const SERVICE_BASIS = {
  /** From this establishment's own records. */
  THIS_ESTABLISHMENT: 'THIS_ESTABLISHMENT',
  /** A service certificate from the previous employer. */
  SERVICE_CERTIFICATE: 'SERVICE_CERTIFICATE',
  /** The member's EPF passbook across establishments. */
  PASSBOOK: 'PASSBOOK',
  /** Stated by the claimant and not yet supported. */
  DECLARED: 'DECLARED',
};

/** Which limb of the scheme the payee was found under. */
const PAYEE_LIMB = {
  /** A valid Form 2 nomination. */
  NOMINEE: 'NOMINEE',
  /** No nomination: the family, as the scheme defines it. */
  FAMILY: 'FAMILY',
  /** Neither: the legal heir. */
  LEGAL_HEIR: 'LEGAL_HEIR',
  /** Nothing on record. Not a payee — a gap. */
  UNRESOLVED: 'UNRESOLVED',
};

/** Which boundary the computed benefit landed on. */
const BINDING = {
  NONE: 'NONE',
  WAGE_CEILING: 'WAGE_CEILING',
  BONUS_CAP: 'BONUS_CAP',
  OVERALL_CAP: 'OVERALL_CAP',
  MINIMUM: 'MINIMUM',
};

const FINDING = {
  WINDOW_INCOMPLETE: 'WINDOW_INCOMPLETE',
  ZERO_WAGE_MONTHS_IN_WINDOW: 'ZERO_WAGE_MONTHS_IN_WINDOW',
  WAGE_CEILING_BINDING: 'WAGE_CEILING_BINDING',
  BONUS_CAP_APPLIED: 'BONUS_CAP_APPLIED',
  OVERALL_CAP_APPLIED: 'OVERALL_CAP_APPLIED',
  MINIMUM_APPLIED: 'MINIMUM_APPLIED',
  MINIMUM_NOT_AVAILABLE: 'MINIMUM_NOT_AVAILABLE',
  PRIOR_SERVICE_DECLARED_ONLY: 'PRIOR_SERVICE_DECLARED_ONLY',
  NO_NOMINATION: 'NO_NOMINATION',
  PAYEE_UNRESOLVED: 'PAYEE_UNRESOLVED',
  NOMINEE_SHARES_INCOMPLETE: 'NOMINEE_SHARES_INCOMPLETE',
  EXEMPTED_POLICY_SHORTFALL: 'EXEMPTED_POLICY_SHORTFALL',
  EXEMPTED_POLICY_NOT_RECORDED: 'EXEMPTED_POLICY_NOT_RECORDED',
  RULES_PREDATE_DEATH: 'RULES_PREDATE_DEATH',
};

const FINDING_AUTHORITY = {
  [FINDING.WINDOW_INCOMPLETE]: 'Paragraph 22(3)',
  [FINDING.ZERO_WAGE_MONTHS_IN_WINDOW]: 'Paragraph 22(3)',
  [FINDING.WAGE_CEILING_BINDING]: 'Paragraph 22(3)',
  [FINDING.BONUS_CAP_APPLIED]: 'Paragraph 22(3), proviso',
  [FINDING.OVERALL_CAP_APPLIED]: 'Paragraph 22(3), proviso',
  [FINDING.MINIMUM_APPLIED]: 'Paragraph 22(3), second proviso',
  [FINDING.MINIMUM_NOT_AVAILABLE]: 'Paragraph 22(3), second proviso',
  [FINDING.PRIOR_SERVICE_DECLARED_ONLY]: 'Paragraph 22(3), second proviso',
  [FINDING.NO_NOMINATION]: 'Paragraph 26 read with EPF Scheme paragraph 61',
  [FINDING.PAYEE_UNRESOLVED]: 'Paragraph 26',
  [FINDING.NOMINEE_SHARES_INCOMPLETE]: 'EPF Scheme, Form 2',
  [FINDING.EXEMPTED_POLICY_SHORTFALL]: 'Section 17(2A)',
  [FINDING.EXEMPTED_POLICY_NOT_RECORDED]: 'Section 17(2A)',
  [FINDING.RULES_PREDATE_DEATH]: 'Paragraph 22',
};

const SEVERITY = {
  BREACH: 'BREACH',
  EXPOSURE: 'EXPOSURE',
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.WINDOW_INCOMPLETE]: SEVERITY.INFORMATIONAL,
  [FINDING.ZERO_WAGE_MONTHS_IN_WINDOW]: SEVERITY.INFORMATIONAL,
  [FINDING.WAGE_CEILING_BINDING]: SEVERITY.INFORMATIONAL,
  [FINDING.BONUS_CAP_APPLIED]: SEVERITY.INFORMATIONAL,
  [FINDING.OVERALL_CAP_APPLIED]: SEVERITY.INFORMATIONAL,
  [FINDING.MINIMUM_APPLIED]: SEVERITY.INFORMATIONAL,
  [FINDING.MINIMUM_NOT_AVAILABLE]: SEVERITY.EXPOSURE,
  [FINDING.PRIOR_SERVICE_DECLARED_ONLY]: SEVERITY.EXPOSURE,
  [FINDING.NO_NOMINATION]: SEVERITY.EXPOSURE,
  [FINDING.PAYEE_UNRESOLVED]: SEVERITY.BREACH,
  [FINDING.NOMINEE_SHARES_INCOMPLETE]: SEVERITY.EXPOSURE,
  [FINDING.EXEMPTED_POLICY_SHORTFALL]: SEVERITY.BREACH,
  [FINDING.EXEMPTED_POLICY_NOT_RECORDED]: SEVERITY.BREACH,
  [FINDING.RULES_PREDATE_DEATH]: SEVERITY.INFORMATIONAL,
};

// --- Dates and windows ------------------------------------------------------

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

/** A wage month as a sortable integer. */
const ordinalOf = (year, month) => year * 12 + (month - 1);

/**
 * @param {number} ordinal
 * @returns {{year: number, month: number}}
 */
function fromOrdinal(ordinal) {
  return { year: Math.floor(ordinal / 12), month: (ordinal % 12) + 1 };
}

/**
 * The months of the averaging window.
 *
 * **Preceding** the month of death, and not including it. A member who died on
 * the third of a month worked two days of it, and counting that stub as a month
 * of wages would drag the average down for no reason the paragraph gives.
 *
 * @param {Date|string} dateOfDeath
 * @param {number} [months]
 * @returns {Array<{year: number, month: number}>}
 */
function averagingWindow(dateOfDeath, months = EDLI_RULES.averagingMonths) {
  const death = toUtcDate(dateOfDeath);
  if (!death) return [];

  const deathOrdinal = ordinalOf(
    death.getUTCFullYear(),
    death.getUTCMonth() + 1,
  );

  const window = [];
  for (let offset = months; offset >= 1; offset -= 1) {
    window.push(fromOrdinal(deathOrdinal - offset));
  }

  return window;
}

/**
 * The rule set in force on a date.
 *
 * Picks the latest set effective on or before the death, which is not the same
 * as the latest set. A claim for a 2019 death settled today has to reproduce
 * the ₹6,00,000 cap that applied then.
 *
 * @param {Date|string} onDate
 * @param {Array<object>} [ruleSets]
 * @returns {object}
 */
function resolveRules(onDate, ruleSets = SEED_RULE_SETS) {
  const on = toUtcDate(onDate);
  if (!on) return { ...EDLI_RULES };

  const candidates = (ruleSets || [])
    .filter((rules) => {
      const from = toUtcDate(rules.effectiveFrom);
      return from ? from.getTime() <= on.getTime() : true;
    })
    .sort(
      (a, b) =>
        toUtcDate(a.effectiveFrom).getTime() -
        toUtcDate(b.effectiveFrom).getTime(),
    );

  return candidates.length
    ? { ...candidates[candidates.length - 1] }
    : { ...ruleSets[0] };
}

// --- Averages ---------------------------------------------------------------

/**
 * @param {number} value
 * @returns {number}
 */
function round0(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * The capped average monthly wages over the window.
 *
 * Two things this does that the obvious version does not.
 *
 * The cap is applied **per month** and not to the average. Somebody on ₹40,000
 * for six months and nothing for six has a raw average of ₹20,000, which caps
 * to ₹15,000; capping each month first gives ₹7,500. The paragraph caps the
 * wages, so the second is right and the difference is half the benefit.
 *
 * And the divisor is the **window**, not the number of months with a figure.
 * A month of loss of pay is a month with no wages, not a month that did not
 * happen, and dividing by the months found would raise the average for exactly
 * the members whose earnings were interrupted.
 *
 * Where the member served less than the window, `monthsInService` shortens the
 * divisor — that is the paragraph's own shorter-service path, and it is a
 * different thing from a gap inside a full window.
 *
 * @param {object} input
 * @param {Array<{year: number, month: number}>} input.window
 * @param {Array<{year: number, month: number, wages: number}>} input.wageMonths
 * @param {number} input.ceiling
 * @param {number} [input.monthsInService]
 * @returns {{average: number, divisor: number, months: Array<object>, ceilingBinding: boolean, zeroMonths: number}}
 */
function averageMonthlyWages({ window, wageMonths, ceiling, monthsInService }) {
  const byKey = new Map(
    (wageMonths || []).map((row) => [
      `${row.year}-${row.month}`,
      Math.max(0, Number(row.wages) || 0),
    ]),
  );

  let ceilingBinding = false;
  let zeroMonths = 0;

  const months = window.map((month) => {
    const actual = byKey.get(`${month.year}-${month.month}`) ?? 0;
    const capped = Math.min(actual, ceiling);

    if (actual > ceiling) ceilingBinding = true;
    if (actual === 0) zeroMonths += 1;

    return {
      ...month,
      actual,
      capped,
      present: byKey.has(`${month.year}-${month.month}`),
    };
  });

  const divisor =
    Number.isFinite(monthsInService) && monthsInService > 0
      ? Math.min(monthsInService, window.length)
      : window.length;

  const total = months.reduce((sum, month) => sum + month.capped, 0);

  return {
    average: divisor > 0 ? total / divisor : 0,
    divisor,
    months,
    ceilingBinding,
    zeroMonths,
  };
}

/**
 * The average provident fund balance over the window.
 *
 * Uncapped — the ceiling in paragraph 22 is on the wages, not on the balance.
 * The bonus component has its own cap and it is applied later, so capping here
 * would apply the bonus limit twice.
 *
 * @param {object} input
 * @param {Array<{year: number, month: number}>} input.window
 * @param {Array<{year: number, month: number, balance: number}>} input.balances
 * @returns {{average: number, divisor: number, months: Array<object>}}
 */
function averageBalance({ window, balances }) {
  const byKey = new Map(
    (balances || []).map((row) => [
      `${row.year}-${row.month}`,
      Math.max(0, Number(row.balance) || 0),
    ]),
  );

  const months = window.map((month) => ({
    ...month,
    balance: byKey.get(`${month.year}-${month.month}`) ?? 0,
  }));

  const total = months.reduce((sum, month) => sum + month.balance, 0);

  return {
    average: window.length > 0 ? total / window.length : 0,
    divisor: window.length,
    months,
  };
}

// --- Continuous employment --------------------------------------------------

/**
 * Whether the twelve-month condition on the minimum is met.
 *
 * Deliberately takes prior service as an input rather than deriving it. The
 * continuity may run across more than one establishment, so an employee who
 * joined three months ago having worked elsewhere for the preceding year
 * qualifies for the ₹2,50,000 floor and one with a gap does not — and neither
 * this employer's joining date nor its attendance ledger can tell them apart.
 *
 * `basis` travels with the answer because a floor of ₹2,50,000 resting on an
 * unsupported declaration is a different fact from one resting on a passbook.
 *
 * @param {object} input
 * @param {number} input.monthsHere
 * @param {number} [input.monthsElsewhere]
 * @param {string} [input.basis]
 * @param {boolean} [input.gapBetween] A break between the two engagements.
 * @param {number} input.requiredMonths
 * @returns {{months: number, satisfied: boolean, basis: string, gapBetween: boolean}}
 */
function continuousEmployment({
  monthsHere,
  monthsElsewhere = 0,
  basis = SERVICE_BASIS.THIS_ESTABLISHMENT,
  gapBetween = false,
  requiredMonths,
}) {
  const here = Math.max(0, Number(monthsHere) || 0);
  const elsewhere = Math.max(0, Number(monthsElsewhere) || 0);

  // A break breaks it. Continuous employment is continuous, so prior service
  // separated from this engagement by a gap does not aggregate — it is not a
  // matter of adding the two figures.
  const months = gapBetween ? here : here + elsewhere;

  return {
    months,
    satisfied: months >= requiredMonths,
    basis: elsewhere > 0 ? basis : SERVICE_BASIS.THIS_ESTABLISHMENT,
    gapBetween,
  };
}

// --- The benefit ------------------------------------------------------------

/**
 * Paragraph 22(3), with every boundary named.
 *
 * The four boundaries are reported as separate fields rather than folded into
 * one number, because a benefit sitting exactly on ₹7,00,000 looks like a
 * coincidence and is not one — and a family told "seven lakh" should be able to
 * see which limit produced it.
 *
 * @param {object} input
 * @param {number} input.averageWages Already capped per month.
 * @param {number} input.averageBalance
 * @param {{satisfied: boolean}} input.continuous
 * @param {object} input.rules
 * @returns {object}
 */
function assuranceBenefit({
  averageWages,
  averageBalance: balance,
  continuous,
  rules,
}) {
  const assuranceComponent = averageWages * rules.multiplier;

  const bonusBeforeCap = (balance * rules.bonusPercentOfAverageBalance) / 100;
  const bonusComponent = Math.min(bonusBeforeCap, rules.bonusCap);
  const bonusCapped = bonusBeforeCap > rules.bonusCap;

  const beforeOverallCap = assuranceComponent + bonusComponent;
  const afterOverallCap = Math.min(beforeOverallCap, rules.overallCap);
  const overallCapped = beforeOverallCap > rules.overallCap;

  // The floor applies only where the twelve-month condition is met. Applying
  // it unconditionally is the single most common error in this computation and
  // it overstates a short-service claim by up to the whole minimum.
  const minimumAvailable = Boolean(continuous?.satisfied);
  const minimumApplied =
    minimumAvailable && afterOverallCap < rules.minimumBenefit;

  const benefit = minimumApplied ? rules.minimumBenefit : afterOverallCap;

  let binding = BINDING.NONE;
  if (minimumApplied) binding = BINDING.MINIMUM;
  else if (overallCapped) binding = BINDING.OVERALL_CAP;
  else if (bonusCapped) binding = BINDING.BONUS_CAP;

  return {
    /** Thirty-five times the capped average monthly wages. */
    assuranceComponent: round0(assuranceComponent),
    /** Half the average balance, before its own cap. */
    bonusBeforeCap: round0(bonusBeforeCap),
    /** ...and after it. */
    bonusComponent: round0(bonusComponent),

    beforeOverallCap: round0(beforeOverallCap),
    afterOverallCap: round0(afterOverallCap),

    minimumAvailable,
    minimumApplied,

    /** What the scheme pays. */
    benefit: round0(benefit),

    /** Which of the four boundaries produced that figure. */
    binding,

    bonusCapped,
    overallCapped,
  };
}

// --- Section 17(2A) ---------------------------------------------------------

/**
 * The comparison an exempted establishment owes.
 *
 * The exemption under section 17(2A) is conditional on the group policy paying
 * **not less than** the scheme would. So this computes the paragraph 22 figure
 * regardless and reports the shortfall — for an unexempted establishment the
 * EPFO settles the claim on its own arithmetic, and for an exempted one nobody
 * else is computing this number at all.
 *
 * The shortfall is the employer's, not the insurer's. That is why it is
 * returned rather than netted into the benefit: the family is owed the higher
 * of the two, and the difference is a liability of the establishment that
 * accepted the exemption.
 *
 * @param {object} input
 * @param {number} input.schemeBenefit
 * @param {number|null} input.policyBenefit
 * @param {boolean} input.exempted
 * @returns {{applies: boolean, schemeBenefit: number, policyBenefit: number|null, shortfall: number, recorded: boolean}}
 */
function exemptedComparison({ schemeBenefit, policyBenefit, exempted }) {
  if (!exempted) {
    return {
      applies: false,
      schemeBenefit: round0(schemeBenefit),
      policyBenefit: null,
      shortfall: 0,
      recorded: true,
    };
  }

  if (policyBenefit === null || policyBenefit === undefined) {
    return {
      applies: true,
      schemeBenefit: round0(schemeBenefit),
      policyBenefit: null,
      shortfall: 0,
      recorded: false,
    };
  }

  const policy = Math.max(0, Number(policyBenefit) || 0);

  return {
    applies: true,
    schemeBenefit: round0(schemeBenefit),
    policyBenefit: round0(policy),
    shortfall: round0(Math.max(0, schemeBenefit - policy)),
    recorded: true,
  };
}

// --- The payee --------------------------------------------------------------

/**
 * Who the assurance is paid to, and under which limb.
 *
 * Returns the limb rather than a bare list, because which limb applied is the
 * thing a dispute turns on. A nomination that exists but does not add to a
 * hundred per cent is not a valid nomination for the whole benefit, and the
 * remainder falls to the next limb — which is a different outcome from having
 * no nomination at all.
 *
 * @param {object} input
 * @param {Array<{name: string, relationship: string, sharePercent: number}>} [input.nominees]
 * @param {Array<object>} [input.family]
 * @param {Array<object>} [input.legalHeirs]
 * @returns {{limb: string, payees: Array<object>, sharesTotal: number, complete: boolean}}
 */
function resolvePayees({ nominees = [], family = [], legalHeirs = [] }) {
  const valid = nominees.filter(
    (nominee) => nominee?.name && Number(nominee.sharePercent) > 0,
  );

  if (valid.length > 0) {
    const sharesTotal = valid.reduce(
      (total, nominee) => total + Number(nominee.sharePercent),
      0,
    );

    return {
      limb: PAYEE_LIMB.NOMINEE,
      payees: valid.map((nominee) => ({ ...nominee })),
      sharesTotal,
      complete: Math.round(sharesTotal) === 100,
    };
  }

  if (family.length > 0) {
    return {
      limb: PAYEE_LIMB.FAMILY,
      payees: family.map((member) => ({ ...member })),
      sharesTotal: 100,
      complete: true,
    };
  }

  if (legalHeirs.length > 0) {
    return {
      limb: PAYEE_LIMB.LEGAL_HEIR,
      payees: legalHeirs.map((heir) => ({ ...heir })),
      sharesTotal: 100,
      complete: true,
    };
  }

  return {
    limb: PAYEE_LIMB.UNRESOLVED,
    payees: [],
    sharesTotal: 0,
    complete: false,
  };
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
    authority: FINDING_AUTHORITY[code],
    severity: FINDING_SEVERITY[code],
    ...detail,
  });
}

/**
 * A whole claim.
 *
 * @param {object} input
 * @param {object} input.member
 * @param {Array<object>} input.wageMonths
 * @param {Array<object>} [input.balances]
 * @param {object} [input.service]
 * @param {object} [input.nomination]
 * @param {object} [input.exemption]
 * @param {Array<object>} [input.ruleSets]
 * @returns {object}
 */
function assessClaim({
  member,
  wageMonths,
  balances = [],
  service = {},
  nomination = {},
  exemption = {},
  ruleSets = SEED_RULE_SETS,
}) {
  const findings = [];
  const dateOfDeath = toUtcDate(member?.dateOfDeath);

  if (!dateOfDeath) {
    throw new TypeError('member.dateOfDeath is required to compute a claim');
  }

  const rules = resolveRules(dateOfDeath, ruleSets);
  const window = averagingWindow(dateOfDeath, rules.averagingMonths);

  const wages = averageMonthlyWages({
    window,
    wageMonths,
    ceiling: rules.wageCeiling,
    monthsInService: service?.monthsHere,
  });

  const balance = averageBalance({ window, balances });

  const continuous = continuousEmployment({
    monthsHere: service?.monthsHere,
    monthsElsewhere: service?.monthsElsewhere,
    basis: service?.basis,
    gapBetween: service?.gapBetween,
    requiredMonths: rules.minimumContinuousMonths,
  });

  const benefit = assuranceBenefit({
    averageWages: wages.average,
    averageBalance: balance.average,
    continuous,
    rules,
  });

  const payees = resolvePayees(nomination);

  const comparison = exemptedComparison({
    schemeBenefit: benefit.benefit,
    policyBenefit: exemption?.policyBenefit,
    exempted: Boolean(exemption?.exempted),
  });

  // --- Findings ------------------------------------------------------------

  if (wages.divisor < window.length) {
    addFinding(findings, FINDING.WINDOW_INCOMPLETE, {
      divisor: wages.divisor,
      windowMonths: window.length,
      note: 'The member served less than the averaging window, so the average is taken over the actual period. That is the paragraph’s shorter-service path and is not the same as a gap inside a full window.',
    });
  }

  if (wages.zeroMonths > 0 && wages.divisor === window.length) {
    addFinding(findings, FINDING.ZERO_WAGE_MONTHS_IN_WINDOW, {
      months: wages.zeroMonths,
      note: 'Months with no wages are counted as months of the window. Skipping them would raise the average for exactly the members whose earnings were interrupted.',
    });
  }

  if (wages.ceilingBinding) {
    addFinding(findings, FINDING.WAGE_CEILING_BINDING, {
      ceiling: rules.wageCeiling,
      note: 'Wages exceeded the statutory ceiling in at least one month of the window. The cap is applied per month and not to the average.',
    });
  }

  if (benefit.bonusCapped) {
    addFinding(findings, FINDING.BONUS_CAP_APPLIED, {
      from: benefit.bonusBeforeCap,
      to: benefit.bonusComponent,
    });
  }

  if (benefit.overallCapped) {
    addFinding(findings, FINDING.OVERALL_CAP_APPLIED, {
      from: benefit.beforeOverallCap,
      to: benefit.afterOverallCap,
    });
  }

  if (benefit.minimumApplied) {
    addFinding(findings, FINDING.MINIMUM_APPLIED, {
      from: benefit.afterOverallCap,
      to: benefit.benefit,
    });
  }

  if (!continuous.satisfied) {
    addFinding(findings, FINDING.MINIMUM_NOT_AVAILABLE, {
      months: continuous.months,
      requiredMonths: rules.minimumContinuousMonths,
      gapBetween: continuous.gapBetween,
      note: 'The floor is conditional on twelve months of continuous employment preceding the month of death, which may run across more than one establishment. It is not applied here.',
    });
  }

  if (
    service?.monthsElsewhere > 0 &&
    service?.basis === SERVICE_BASIS.DECLARED
  ) {
    addFinding(findings, FINDING.PRIOR_SERVICE_DECLARED_ONLY, {
      months: service.monthsElsewhere,
      note: 'A floor of ₹2,50,000 is resting on prior service that is declared and not yet supported by a service certificate or a passbook.',
    });
  }

  if (payees.limb === PAYEE_LIMB.UNRESOLVED) {
    addFinding(findings, FINDING.PAYEE_UNRESOLVED, {
      note: 'A benefit with no payee is a figure and not a claim. The assurance goes to the nominee, failing which the family as the scheme defines it, failing which the legal heir.',
    });
  } else if (payees.limb !== PAYEE_LIMB.NOMINEE) {
    addFinding(findings, FINDING.NO_NOMINATION, {
      limb: payees.limb,
      note: 'No valid Form 2 nomination is on record, so the benefit falls to the next limb of the scheme.',
    });
  } else if (!payees.complete) {
    addFinding(findings, FINDING.NOMINEE_SHARES_INCOMPLETE, {
      sharesTotal: payees.sharesTotal,
      note: 'The nominated shares do not total a hundred per cent. The remainder falls to the next limb, which is a different outcome from having no nomination at all.',
    });
  }

  if (comparison.applies && !comparison.recorded) {
    addFinding(findings, FINDING.EXEMPTED_POLICY_NOT_RECORDED, {
      note: 'The establishment is exempted under section 17(2A) and no policy benefit is recorded. The exemption is conditional on the policy paying not less than the scheme would, and that cannot be checked without the figure.',
    });
  } else if (comparison.applies && comparison.shortfall > 0) {
    addFinding(findings, FINDING.EXEMPTED_POLICY_SHORTFALL, {
      schemeBenefit: comparison.schemeBenefit,
      policyBenefit: comparison.policyBenefit,
      shortfall: comparison.shortfall,
      note: 'The group policy pays less than paragraph 22 would. The exemption is conditional on it not doing so, and the difference is a liability of the establishment rather than of the insurer.',
    });
  }

  const deathRules = toUtcDate(rules.effectiveFrom);
  if (deathRules && deathRules.getTime() < toUtcDate('2021-04-28').getTime()) {
    addFinding(findings, FINDING.RULES_PREDATE_DEATH, {
      effectiveFrom: rules.effectiveFrom,
      note: 'Computed under the rule set in force at the date of death rather than the current one. The overall cap and the bonus cap have both been amended since.',
    });
  }

  return {
    member: {
      memberId: member?.memberId,
      name: member?.name,
      dateOfDeath,
      uan: member?.uan || '',
    },

    /** Snapshotted, so the figure is reproducible when the claim is reopened. */
    rules,
    window,

    wages,
    balance,
    continuous,

    ...benefit,

    payees,

    /**
     * The section 17(2A) comparison.
     *
     * Kept as its own object rather than folded into the benefit: the family is
     * owed the higher of the two, and the shortfall is a liability of the
     * establishment that accepted the exemption.
     */
    exemption: comparison,

    findings: findings.map((finding) => ({ ...finding })),
  };
}

/**
 * Several claims, for a register view.
 *
 * @param {object} input
 * @param {Array<object>} input.claims
 * @param {Array<object>} [input.ruleSets]
 * @returns {object}
 */
function assessClaims({ claims, ruleSets = SEED_RULE_SETS } = {}) {
  const assessed = (claims || []).map((claim) =>
    assessClaim({ ...claim, ruleSets }),
  );

  const summary = new Map();
  for (const claim of assessed) {
    for (const finding of claim.findings) {
      const bucket = summary.get(finding.code) || {
        code: finding.code,
        authority: finding.authority,
        severity: finding.severity,
        count: 0,
      };
      bucket.count += 1;
      summary.set(finding.code, bucket);
    }
  }

  return {
    claims: assessed,

    /** What the scheme pays across the claims on the register. */
    benefitTotal: round0(
      assessed.reduce((total, claim) => total + claim.benefit, 0),
    ),

    /**
     * The exempted shortfall, kept apart from the benefit total.
     *
     * Adding them would double-count: the shortfall is the part of the same
     * benefit the policy did not cover, not an additional payment.
     */
    exemptedShortfallTotal: round0(
      assessed.reduce(
        (total, claim) => total + (claim.exemption?.shortfall || 0),
        0,
      ),
    ),

    summary: [...summary.values()],
  };
}

module.exports = {
  EDLI_RULES,
  SEED_RULE_SETS,
  SERVICE_BASIS,
  PAYEE_LIMB,
  BINDING,
  FINDING,
  FINDING_AUTHORITY,
  FINDING_SEVERITY,
  SEVERITY,
  toUtcDate,
  averagingWindow,
  resolveRules,
  averageMonthlyWages,
  averageBalance,
  continuousEmployment,
  assuranceBenefit,
  exemptedComparison,
  resolvePayees,
  assessClaim,
  assessClaims,
};
