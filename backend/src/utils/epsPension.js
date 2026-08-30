/**
 * Employees' Pension Scheme, 1995 (#1769).
 *
 * The formula is one line:
 *
 *     monthly pension = pensionable salary × pensionable service ÷ 70
 *
 * Both inputs are traps, and the first is the reason this is a module rather
 * than an expression.
 *
 * **Pensionable salary is the average of the last sixty months, and each of
 * those months is capped before it is averaged.** Not after. Paragraph 11(1)
 * defines it as the average monthly pay drawn during the span, and paragraph
 * 11(3) limits the pay that may be drawn into the scheme to ₹15,000 — the limit
 * attaches to the monthly figure, so the average is taken over already-capped
 * values.
 *
 * A member on ₹40,000 for fifty-five months who dropped to ₹9,000 for the last
 * five has capped months of ₹15,000 × 55 and ₹9,000 × 5, averaging **₹14,500**.
 * Average the actual wages first and cap the result and you get ₹15,000, and the
 * pension has been over-stated for the rest of that person's life. The two
 * orders differ whenever a single month in the window is below the ceiling —
 * which is every window containing a joining month, a maternity month, or a
 * month of loss of pay.
 *
 * And the window is sixty **contributory** months, not the last sixty calendar
 * months: the proviso to paragraph 11(1) excludes non-contributory periods, so a
 * member with four months of unpaid leave reaches back sixty-four months to find
 * sixty. Sliding a fixed window over a calendar quietly averages in four zeros.
 *
 * Pure functions, no database access.
 */

const MONTHS_PER_YEAR = 12;

/**
 * The scheme's parameters, as the default assumption set.
 *
 * An assumption set rather than literals because every one of them has moved,
 * and because a valuation has to be reproducible at the figures that were in
 * force when it was made. The wage ceiling went from ₹6,500 to ₹15,000 on 1
 * September 2014, the minimum pension was introduced at ₹1,000 in the same year,
 * and the higher-wage option was reopened by the Supreme Court in November 2022
 * with a further window in 2023.
 */
const EPS_ASSUMPTIONS = {
  /** Paragraph 11(3) — the monthly pay that may be drawn into the scheme. */
  wageCeiling: 15000,
  /** Paragraph 3(1) — the employer's share diverted to the pension fund. */
  contributionPercent: 8.33,
  /** Paragraph 11(1) — the averaging span, in contributory months. */
  averagingMonths: 60,
  /** The divisor in the paragraph 12(2) formula. */
  formulaDivisor: 70,
  /** Paragraph 12 — eligible service for a pension at all. */
  minimumEligibleServiceYears: 10,
  /** Paragraph 10(2) — the service at which the bonus is added. */
  serviceBonusThresholdYears: 20,
  /** Paragraph 10(2) — and the bonus itself. */
  serviceBonusYears: 2,
  /** Paragraph 10(1) — a fraction of a year at or above this counts as one. */
  serviceRoundingMonths: 6,
  /** Paragraph 12(2) — the floor. */
  minimumMonthlyPension: 1000,
  /** The age a full pension is payable at. */
  superannuationAge: 58,
  /** Paragraph 12(7) — the earliest an early pension may be taken. */
  earlyPensionMinAge: 50,
  /** Paragraph 12(7) — the reduction for each year short of 58. */
  earlyPensionReductionPercent: 4,
  /** Paragraph 12(7A) — the increase for each year deferred beyond 58. */
  deferredPensionIncreasePercent: 4,
  /** Paragraph 12(7A) — and the age it stops at. */
  deferredPensionMaxAge: 60,
  /** Paragraph 6A — the date the scheme's own membership begins from. */
  schemeCommencement: '1995-11-16',
};

/**
 * Table B — the past service benefit for a member who joined before 16 November
 * 1995, by the salary at the date and the years of past service.
 *
 * Two salary bands, because the Table has two: at or below ₹2,500 a month, and
 * above it. The figures are the monthly amounts payable at 58.
 */
const PAST_SERVICE_TABLE_B = {
  atOrBelow2500: [
    { upToYears: 11, amount: 80 },
    { upToYears: 15, amount: 95 },
    { upToYears: 20, amount: 120 },
    { upToYears: Infinity, amount: 150 },
  ],
  above2500: [
    { upToYears: 11, amount: 85 },
    { upToYears: 15, amount: 105 },
    { upToYears: 20, amount: 135 },
    { upToYears: Infinity, amount: 170 },
  ],
};

/**
 * Table B's second half — the factor the past service benefit is multiplied by,
 * for the years between the member's age in November 1995 and 58.
 *
 * Held as a lookup on the years remaining rather than as a formula, because the
 * Table is a table: the values are not a clean compounding of any single rate.
 */
const PAST_SERVICE_FACTORS = {
  0: 1.0,
  1: 1.039,
  2: 1.08,
  3: 1.122,
  4: 1.167,
  5: 1.214,
  6: 1.262,
  7: 1.313,
  8: 1.365,
  9: 1.42,
  10: 1.476,
  11: 1.536,
  12: 1.597,
  13: 1.661,
  14: 1.727,
  15: 1.796,
  16: 1.868,
  17: 1.943,
  18: 2.021,
  19: 2.102,
  20: 2.185,
  21: 2.273,
  22: 2.364,
  23: 2.458,
  24: 2.556,
  25: 2.659,
};

/**
 * Table D — the withdrawal benefit for a member below ten years of eligible
 * service, as a multiple of the monthly wage, by completed years of service.
 */
const WITHDRAWAL_TABLE_D = {
  1: 1.02,
  2: 2.05,
  3: 3.1,
  4: 4.18,
  5: 5.28,
  6: 6.4,
  7: 7.54,
  8: 8.7,
  9: 9.88,
};

const OUTCOME = {
  /** Paragraph 12 — a pension, on the formula. */
  PENSION: 'PENSION',
  /** Paragraph 14 — below ten years, so a withdrawal benefit from Table D. */
  WITHDRAWAL: 'WITHDRAWAL',
  /** No contributory service at all. */
  NOT_A_MEMBER: 'NOT_A_MEMBER',
};

const FINDING = {
  CAPPED_BEFORE_AVERAGING: 'CAPPED_BEFORE_AVERAGING',
  WINDOW_EXTENDED: 'WINDOW_EXTENDED',
  SHORT_AVERAGING_WINDOW: 'SHORT_AVERAGING_WINDOW',
  SERVICE_BONUS_ADDED: 'SERVICE_BONUS_ADDED',
  BELOW_ELIGIBLE_SERVICE: 'BELOW_ELIGIBLE_SERVICE',
  MINIMUM_PENSION_APPLIED: 'MINIMUM_PENSION_APPLIED',
  EARLY_PENSION_REDUCED: 'EARLY_PENSION_REDUCED',
  DEFERRED_PENSION_INCREASED: 'DEFERRED_PENSION_INCREASED',
  PAST_SERVICE_ADDED: 'PAST_SERVICE_ADDED',
  HIGHER_WAGE_OPTION: 'HIGHER_WAGE_OPTION',
};

const FINDING_PARAGRAPH = {
  [FINDING.CAPPED_BEFORE_AVERAGING]: 'paragraph 11(1) with 11(3)',
  [FINDING.WINDOW_EXTENDED]: 'paragraph 11(1), proviso',
  [FINDING.SHORT_AVERAGING_WINDOW]: 'paragraph 11(1)',
  [FINDING.SERVICE_BONUS_ADDED]: 'paragraph 10(2)',
  [FINDING.BELOW_ELIGIBLE_SERVICE]: 'paragraph 14',
  [FINDING.MINIMUM_PENSION_APPLIED]: 'paragraph 12(2)',
  [FINDING.EARLY_PENSION_REDUCED]: 'paragraph 12(7)',
  [FINDING.DEFERRED_PENSION_INCREASED]: 'paragraph 12(7A)',
  [FINDING.PAST_SERVICE_ADDED]: 'paragraph 12(3)',
  [FINDING.HIGHER_WAGE_OPTION]: 'paragraph 11(3), proviso',
};

const SEVERITY = {
  ADJUSTED: 'ADJUSTED',
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
 * Whole months between two dates.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function monthsBetween(from, to) {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * MONTHS_PER_YEAR +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

/**
 * Merge an assumption set over the scheme's parameters.
 *
 * @param {object} [assumptions]
 * @returns {object}
 */
function resolveAssumptions(assumptions) {
  return { ...EPS_ASSUMPTIONS, ...(assumptions || {}) };
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
    paragraph: FINDING_PARAGRAPH[code] || '',
    severity,
    message,
    ...context,
  };
}

/**
 * The 8.33 per cent diverted from the employer's contribution.
 *
 * On pensionable wages, which are capped — so the figure is ₹1,250 for every
 * member above the ceiling, and only members below it produce anything else.
 * The remainder of the employer's twelve per cent stays in the provident fund,
 * and returning both halves is what lets a caller reconcile the split rather
 * than assume it.
 *
 * @param {object} input
 * @param {number} input.monthlyWage
 * @param {boolean} [input.higherWageOption] the paragraph 11(3) proviso
 * @param {number} [input.employerPercent] the employer's total, default 12
 * @param {object} [input.assumptions]
 * @returns {{pensionableWage: number, toPension: number, toProvidentFund: number, findings: Array<object>}}
 */
function splitEmployerContribution(input) {
  const assumptions = resolveAssumptions(input?.assumptions);
  const findings = [];

  const wage = Math.max(0, toNumber(input?.monthlyWage));
  const employerPercent = toNumber(input?.employerPercent) || 12;

  const pensionableWage = input?.higherWageOption
    ? wage
    : Math.min(wage, assumptions.wageCeiling);

  if (input?.higherWageOption && wage > assumptions.wageCeiling) {
    findings.push(
      finding(
        FINDING.HIGHER_WAGE_OPTION,
        SEVERITY.INFORMATIONAL,
        `The member has opted to contribute on the full wage of ₹${round2(wage).toFixed(2)} rather than the ₹${assumptions.wageCeiling} ceiling.`,
        { monthlyWage: round2(wage), ceiling: assumptions.wageCeiling },
      ),
    );
  }

  const toPension = round2(
    (pensionableWage * assumptions.contributionPercent) / 100,
  );
  const toProvidentFund = round2((wage * employerPercent) / 100 - toPension);

  return {
    pensionableWage: round2(pensionableWage),
    toPension,
    toProvidentFund,
    findings,
  };
}

/**
 * Pensionable salary — the average of the last sixty contributory months, each
 * capped before it is averaged.
 *
 * Two things happen here and the order of them is the point.
 *
 * First, non-contributory months are dropped and the window reaches further back
 * to make up the count. A month of unpaid leave is not a month of zero pay for
 * this purpose; it is not a month at all.
 *
 * Second, each surviving month is capped at the ceiling and *then* averaged.
 * Averaging first and capping the result gives a number that is greater than or
 * equal to this one, and strictly greater whenever any month in the window is
 * below the ceiling — which over-states the pension for life.
 *
 * @param {Array<object>} history `{month, year, wage, contributory}`, any order
 * @param {object} [options]
 * @param {boolean} [options.higherWageOption]
 * @param {object} [options.assumptions]
 * @returns {{pensionableSalary: number, monthsUsed: number, windowMonths: number, cappedMonths: number, naiveAverageThenCap: number, findings: Array<object>}}
 */
function pensionableSalary(history, options = {}) {
  const assumptions = resolveAssumptions(options.assumptions);
  const findings = [];

  const ceiling = options.higherWageOption ? Infinity : assumptions.wageCeiling;

  // Newest first, so taking the window is a slice from the front.
  const ordered = [...(history || [])]
    .filter((entry) => entry && Number.isFinite(Number(entry.year)))
    .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));

  const contributory = ordered.filter((entry) => entry.contributory !== false);
  const skipped = ordered.length - contributory.length;

  const window = contributory.slice(0, assumptions.averagingMonths);

  if (window.length === 0) {
    return {
      pensionableSalary: 0,
      monthsUsed: 0,
      windowMonths: 0,
      cappedMonths: 0,
      naiveAverageThenCap: 0,
      findings,
    };
  }

  // How far back the window actually reached, including the months it skipped.
  // Reported because "sixty months" and "sixty-four months ago" are different
  // facts and a member who queries the figure will ask which.
  const oldest = window[window.length - 1];
  const newest = window[0];
  const windowMonths =
    monthsBetween(
      new Date(Date.UTC(oldest.year, oldest.month - 1, 1)),
      new Date(Date.UTC(newest.year, newest.month - 1, 1)),
    ) + 1;

  if (skipped > 0 && windowMonths > window.length) {
    findings.push(
      finding(
        FINDING.WINDOW_EXTENDED,
        SEVERITY.INFORMATIONAL,
        `${window.length} contributory months were found across ${windowMonths} calendar months; ${windowMonths - window.length} non-contributory month(s) were skipped rather than averaged in as zero.`,
        { contributoryMonths: window.length, calendarMonths: windowMonths },
      ),
    );
  }

  if (window.length < assumptions.averagingMonths) {
    findings.push(
      finding(
        FINDING.SHORT_AVERAGING_WINDOW,
        SEVERITY.INFORMATIONAL,
        `Only ${window.length} contributory months are on record, against the ${assumptions.averagingMonths} the average is taken over. The figure is the average of what exists.`,
        { monthsAvailable: window.length },
      ),
    );
  }

  const capped = window.map((entry) =>
    Math.min(Math.max(0, toNumber(entry.wage)), ceiling),
  );

  const cappedCount = window.filter(
    (entry) => toNumber(entry.wage) > ceiling,
  ).length;

  const salary = round2(
    capped.reduce((sum, wage) => sum + wage, 0) / capped.length,
  );

  // The other order, computed so the difference can be reported rather than
  // merely avoided — a member whose pension moves because of it deserves to see
  // which figure was used.
  const actualAverage =
    window.reduce((sum, entry) => sum + Math.max(0, toNumber(entry.wage)), 0) /
    window.length;
  const naive = round2(Math.min(actualAverage, ceiling));

  if (naive > salary + 0.01) {
    findings.push(
      finding(
        FINDING.CAPPED_BEFORE_AVERAGING,
        SEVERITY.ADJUSTED,
        `Capping each month before averaging gives ₹${salary.toFixed(2)}. Averaging the actual wages and capping the result would give ₹${naive.toFixed(2)} — ₹${round2(naive - salary).toFixed(2)} higher, and wrong: paragraph 11(3) limits the monthly pay drawn into the scheme, not the average of it.`,
        { pensionableSalary: salary, averageThenCap: naive },
      ),
    );
  }

  return {
    pensionableSalary: salary,
    monthsUsed: window.length,
    windowMonths,
    cappedMonths: cappedCount,
    naiveAverageThenCap: naive,
    findings,
  };
}

/**
 * Pensionable service, with the paragraph 10(1) rounding and the 10(2) bonus.
 *
 * Two things that are easy to conflate:
 *
 * *Eligible service* is what the ten-year threshold in paragraph 12 is tested
 * on. *Pensionable service* is what goes into the formula. They are the same
 * number until the bonus is added, and then they are not — which matters,
 * because adding the bonus first and then testing the threshold would give a
 * pension to a member with eighteen years of service.
 *
 * The rounding is applied to the total and not to each spell: two spells of
 * seven months each are fourteen months and one year, not two.
 *
 * @param {object} input
 * @param {number} input.serviceMonths total contributory months
 * @param {object} [input.assumptions]
 * @returns {{eligibleYears: number, pensionableYears: number, bonusApplied: boolean, findings: Array<object>}}
 */
function pensionableService(input) {
  const assumptions = resolveAssumptions(input?.assumptions);
  const findings = [];

  const months = Math.max(0, Math.floor(toNumber(input?.serviceMonths)));

  const wholeYears = Math.floor(months / MONTHS_PER_YEAR);
  const remainder = months % MONTHS_PER_YEAR;

  // Paragraph 10(1). Six months or more counts as a year; less is dropped.
  const eligibleYears =
    remainder >= assumptions.serviceRoundingMonths
      ? wholeYears + 1
      : wholeYears;

  // Paragraph 10(2). Tested on eligible service, and added afterwards — so the
  // bonus can never be the thing that satisfies its own threshold.
  const bonusApplied = eligibleYears >= assumptions.serviceBonusThresholdYears;

  const pensionableYears = bonusApplied
    ? eligibleYears + assumptions.serviceBonusYears
    : eligibleYears;

  if (bonusApplied) {
    findings.push(
      finding(
        FINDING.SERVICE_BONUS_ADDED,
        SEVERITY.ADJUSTED,
        `${eligibleYears} years of eligible service, so ${assumptions.serviceBonusYears} years are added under paragraph 10(2), giving ${pensionableYears} years of pensionable service.`,
        { eligibleYears, pensionableYears },
      ),
    );
  }

  return { eligibleYears, pensionableYears, bonusApplied, findings };
}

/**
 * The past service benefit for a member who joined before 16 November 1995.
 *
 * A separate component added to the formula pension rather than folded into it,
 * because it is computed from the wage and service *at* 1995 and has nothing to
 * do with the last sixty months.
 *
 * @param {object} input
 * @param {number} input.pastServiceYears service before 16 November 1995
 * @param {number} input.salaryAtCommencement monthly pay in November 1995
 * @param {number} input.yearsToSuperannuationAtCommencement
 * @returns {{amount: number, tableAmount: number, factor: number, findings: Array<object>}}
 */
function pastServiceBenefit(input) {
  const findings = [];

  const years = Math.max(0, toNumber(input?.pastServiceYears));
  if (years <= 0) {
    return { amount: 0, tableAmount: 0, factor: 1, findings };
  }

  const salary = toNumber(input?.salaryAtCommencement);
  const band =
    salary <= 2500
      ? PAST_SERVICE_TABLE_B.atOrBelow2500
      : PAST_SERVICE_TABLE_B.above2500;

  const row =
    band.find((entry) => years < entry.upToYears) || band[band.length - 1];

  const remaining = Math.max(
    0,
    Math.min(
      25,
      Math.round(toNumber(input?.yearsToSuperannuationAtCommencement)),
    ),
  );
  const factor = PAST_SERVICE_FACTORS[remaining] ?? 1;

  const amount = round2(row.amount * factor);

  findings.push(
    finding(
      FINDING.PAST_SERVICE_ADDED,
      SEVERITY.INFORMATIONAL,
      `${years} year(s) of service before 16 November 1995 give a Table B amount of ₹${row.amount}, multiplied by the ${remaining}-year factor of ${factor} — ₹${amount.toFixed(2)} a month, added to the formula pension.`,
      { pastServiceYears: years, tableAmount: row.amount, factor },
    ),
  );

  return { amount, tableAmount: row.amount, factor, findings };
}

/**
 * The withdrawal benefit under paragraph 14, for a member below ten years.
 *
 * A multiple of the monthly wage from Table D, not the formula. Returning the
 * formula figure for such a member would state a monthly pension that will never
 * be paid.
 *
 * @param {object} input
 * @param {number} input.eligibleYears
 * @param {number} input.monthlyWage
 * @param {object} [input.assumptions]
 * @returns {{amount: number, factor: number}}
 */
function withdrawalBenefit(input) {
  const assumptions = resolveAssumptions(input?.assumptions);

  const years = Math.max(
    0,
    Math.min(
      assumptions.minimumEligibleServiceYears - 1,
      Math.floor(toNumber(input?.eligibleYears)),
    ),
  );

  const factor = WITHDRAWAL_TABLE_D[years] || 0;
  const wage = Math.min(
    Math.max(0, toNumber(input?.monthlyWage)),
    assumptions.wageCeiling,
  );

  return { amount: round2(factor * wage), factor };
}

/**
 * Apply paragraph 12(7) or 12(7A) for an age away from 58.
 *
 * The same four per cent a year, in both directions from the same anchor.
 *
 * @param {number} pension
 * @param {number} ageAtDrawing
 * @param {object} [assumptionSet]
 * @returns {{pension: number, adjustmentPercent: number, findings: Array<object>}}
 */
function adjustForAge(pension, ageAtDrawing, assumptionSet) {
  const assumptions = resolveAssumptions(assumptionSet);
  const findings = [];

  const age = toNumber(ageAtDrawing);
  const base = Math.max(0, toNumber(pension));

  if (!Number.isFinite(age) || age === assumptions.superannuationAge) {
    return { pension: round2(base), adjustmentPercent: 0, findings };
  }

  if (age < assumptions.superannuationAge) {
    if (age < assumptions.earlyPensionMinAge) {
      // Below fifty there is no early pension to reduce. Returning a reduced
      // figure would suggest something is payable that is not.
      return { pension: 0, adjustmentPercent: 0, findings };
    }

    const yearsEarly = assumptions.superannuationAge - age;
    const reduction = yearsEarly * assumptions.earlyPensionReductionPercent;
    const reduced = round2(base * (1 - reduction / 100));

    findings.push(
      finding(
        FINDING.EARLY_PENSION_REDUCED,
        SEVERITY.ADJUSTED,
        `Drawn at ${age}, ${yearsEarly} year(s) before ${assumptions.superannuationAge}, so the pension is reduced by ${reduction}% — from ₹${base.toFixed(2)} to ₹${reduced.toFixed(2)}.`,
        { ageAtDrawing: age, yearsEarly, reductionPercent: reduction },
      ),
    );

    return { pension: reduced, adjustmentPercent: -reduction, findings };
  }

  const yearsDeferred = Math.min(
    age - assumptions.superannuationAge,
    assumptions.deferredPensionMaxAge - assumptions.superannuationAge,
  );
  const increase = yearsDeferred * assumptions.deferredPensionIncreasePercent;
  const increased = round2(base * (1 + increase / 100));

  findings.push(
    finding(
      FINDING.DEFERRED_PENSION_INCREASED,
      SEVERITY.ADJUSTED,
      `Deferred to ${age}, ${yearsDeferred} year(s) beyond ${assumptions.superannuationAge}, so the pension is increased by ${increase}% — from ₹${base.toFixed(2)} to ₹${increased.toFixed(2)}.`,
      { ageAtDrawing: age, yearsDeferred, increasePercent: increase },
    ),
  );

  return { pension: increased, adjustmentPercent: increase, findings };
}

/**
 * One member's pension.
 *
 * @param {object} input
 * @param {object} input.member
 * @param {Array<object>} input.wageHistory
 * @param {number} input.serviceMonths
 * @param {number} [input.ageAtDrawing]
 * @param {object} [input.pastService]
 * @param {object} [input.assumptions]
 * @returns {object}
 */
function computePension(input) {
  const assumptions = resolveAssumptions(input?.assumptions);
  const findings = [];
  const member = input?.member || {};

  const salary = pensionableSalary(input?.wageHistory, {
    higherWageOption: member.higherWageOption,
    assumptions,
  });
  findings.push(...salary.findings);

  const service = pensionableService({
    serviceMonths: input?.serviceMonths,
    assumptions,
  });
  findings.push(...service.findings);

  if (salary.monthsUsed === 0 || service.eligibleYears === 0) {
    return {
      memberId: member.memberId || null,
      memberName: member.name || '',
      outcome: OUTCOME.NOT_A_MEMBER,
      pensionableSalary: salary.pensionableSalary,
      eligibleYears: service.eligibleYears,
      pensionableYears: service.pensionableYears,
      monthlyPension: 0,
      findings,
    };
  }

  // Paragraph 12. The threshold is on *eligible* service, before the bonus.
  if (service.eligibleYears < assumptions.minimumEligibleServiceYears) {
    const withdrawal = withdrawalBenefit({
      eligibleYears: service.eligibleYears,
      monthlyWage: salary.pensionableSalary,
      assumptions,
    });

    findings.push(
      finding(
        FINDING.BELOW_ELIGIBLE_SERVICE,
        SEVERITY.INFORMATIONAL,
        `${service.eligibleYears} years of eligible service, below the ${assumptions.minimumEligibleServiceYears} needed for a pension. A withdrawal benefit of ₹${withdrawal.amount.toFixed(2)} is payable under paragraph 14 — ${withdrawal.factor} times the monthly wage.`,
        { eligibleYears: service.eligibleYears, withdrawal: withdrawal.amount },
      ),
    );

    return {
      memberId: member.memberId || null,
      memberName: member.name || '',
      outcome: OUTCOME.WITHDRAWAL,
      pensionableSalary: salary.pensionableSalary,
      monthsUsed: salary.monthsUsed,
      eligibleYears: service.eligibleYears,
      pensionableYears: service.pensionableYears,
      monthlyPension: 0,
      withdrawalBenefit: withdrawal.amount,
      withdrawalFactor: withdrawal.factor,
      findings,
    };
  }

  const formulaPension = round2(
    (salary.pensionableSalary * service.pensionableYears) /
      assumptions.formulaDivisor,
  );

  // Past service, if any, added to the formula figure rather than blended in.
  const past = input?.pastService
    ? pastServiceBenefit(input.pastService)
    : { amount: 0, findings: [] };
  findings.push(...past.findings);

  const beforeAge = round2(formulaPension + past.amount);

  const adjusted = adjustForAge(beforeAge, input?.ageAtDrawing, assumptions);
  findings.push(...adjusted.findings);

  // Paragraph 12(2). The floor applies after the age adjustment, because it is
  // a floor on what is paid rather than on what was computed.
  let monthlyPension = adjusted.pension;

  if (
    monthlyPension > 0 &&
    monthlyPension < assumptions.minimumMonthlyPension
  ) {
    findings.push(
      finding(
        FINDING.MINIMUM_PENSION_APPLIED,
        SEVERITY.ADJUSTED,
        `The computed pension of ₹${monthlyPension.toFixed(2)} is below the ₹${assumptions.minimumMonthlyPension} floor, so ₹${assumptions.minimumMonthlyPension} is payable.`,
        { computed: monthlyPension, floor: assumptions.minimumMonthlyPension },
      ),
    );

    monthlyPension = assumptions.minimumMonthlyPension;
  }

  return {
    memberId: member.memberId || null,
    memberName: member.name || '',
    outcome: OUTCOME.PENSION,
    pensionableSalary: salary.pensionableSalary,
    monthsUsed: salary.monthsUsed,
    windowMonths: salary.windowMonths,
    averageThenCap: salary.naiveAverageThenCap,
    eligibleYears: service.eligibleYears,
    pensionableYears: service.pensionableYears,
    serviceBonusApplied: service.bonusApplied,
    formulaPension,
    pastServiceBenefit: past.amount,
    ageAdjustmentPercent: adjusted.adjustmentPercent,
    monthlyPension,
    annualPension: round2(monthlyPension * MONTHS_PER_YEAR),
    findings,
  };
}

/**
 * What the pension would be at superannuation for a member still serving.
 *
 * Projects service forward and holds the wage flat. Flat rather than escalated
 * because the pensionable wage is capped at ₹15,000 for almost everybody, so an
 * escalation assumption would move nothing for most members and would quietly
 * inflate the figure for the few it did move.
 *
 * @param {object} input as `computePension`, plus `ageNow`
 * @returns {object}
 */
function projectToSuperannuation(input) {
  const assumptions = resolveAssumptions(input?.assumptions);

  const ageNow = toNumber(input?.ageNow);
  const yearsRemaining = Math.max(0, assumptions.superannuationAge - ageNow);

  const projected = computePension({
    ...input,
    serviceMonths:
      toNumber(input?.serviceMonths) + yearsRemaining * MONTHS_PER_YEAR,
    ageAtDrawing: assumptions.superannuationAge,
    assumptions,
  });

  return {
    ...projected,
    projected: true,
    yearsRemaining,
    ageAtProjection: assumptions.superannuationAge,
  };
}

/**
 * A whole scheme membership.
 *
 * @param {Array<object>} members each in `computePension` shape
 * @param {object} [options]
 * @param {object} [options.assumptions]
 * @returns {object}
 */
function valueScheme(members, options = {}) {
  const assumptions = resolveAssumptions(options.assumptions);

  const results = (members || []).map((member) =>
    computePension({ ...member, assumptions }),
  );

  const findings = [];
  const summary = new Map();

  for (const result of results) {
    for (const entry of result.findings) {
      findings.push({
        ...entry,
        memberId: result.memberId,
        memberName: result.memberName,
      });

      if (!summary.has(entry.code)) {
        summary.set(entry.code, {
          code: entry.code,
          paragraph: entry.paragraph,
          severity: entry.severity,
          count: 0,
          members: new Set(),
        });
      }

      const bucket = summary.get(entry.code);
      bucket.count += 1;
      if (result.memberId) bucket.members.add(String(result.memberId));
    }
  }

  const pensioners = results.filter(
    (result) => result.outcome === OUTCOME.PENSION,
  );

  return {
    memberCount: results.length,
    pensionerCount: pensioners.length,
    withdrawalCount: results.filter(
      (result) => result.outcome === OUTCOME.WITHDRAWAL,
    ).length,
    monthlyPensionTotal: round2(
      pensioners.reduce((sum, result) => sum + result.monthlyPension, 0),
    ),
    annualPensionTotal: round2(
      pensioners.reduce((sum, result) => sum + result.annualPension, 0),
    ),
    /**
     * How many members' pensionable salary would have been over-stated by
     * averaging before capping. Reported because it is the one number that says
     * whether the distinction mattered for this population.
     */
    affectedByCapOrder: results.filter((result) =>
      result.findings.some(
        (entry) => entry.code === FINDING.CAPPED_BEFORE_AVERAGING,
      ),
    ).length,
    findings,
    summary: [...summary.values()].map((bucket) => ({
      code: bucket.code,
      paragraph: bucket.paragraph,
      severity: bucket.severity,
      count: bucket.count,
      memberCount: bucket.members.size,
    })),
    members: results,
  };
}

module.exports = {
  EPS_ASSUMPTIONS,
  PAST_SERVICE_TABLE_B,
  PAST_SERVICE_FACTORS,
  WITHDRAWAL_TABLE_D,
  OUTCOME,
  FINDING,
  FINDING_PARAGRAPH,
  SEVERITY,
  resolveAssumptions,
  splitEmployerContribution,
  pensionableSalary,
  pensionableService,
  pastServiceBenefit,
  withdrawalBenefit,
  adjustForAge,
  computePension,
  projectToSuperannuation,
  valueScheme,
};
