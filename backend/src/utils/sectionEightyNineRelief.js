/**
 * Section 89(1) relief on salary received in arrears or in advance (#1969).
 *
 * `arrearsCalculator.js` produces the arrear and `tdsEngine.utils.js` taxes it
 * in the month it is paid. Both are right on their own terms. What neither
 * produces is the relief the Act gives *because* of that bunching, and the
 * whole of this module is the difference between the two.
 *
 * Four things shape everything below.
 *
 * **The relief is a difference between rate environments, so every rate has to
 * be dated.** Rule 21A(2) asks for the additional tax each relation year would
 * have borne **at that year's rates on that year's income**. `taxCalculator.js`
 * holds one current slab set. Running a 2021-22 relation year against 2026-27
 * slabs collapses the two environments into one, which produces nil relief in
 * the ordinary case and a number nobody can defend in the rest. So the rate
 * table is keyed on assessment year *and* regime, and a year with no table on
 * file is refused rather than approximated — see `resolveRateTable`.
 *
 * **The computation is kept in its terms and never reduced to a single
 * figure.** The employee signs a return carrying this number and defends it
 * personally. A relief that cannot be broken back into the four terms of Rule
 * 21A(2) cannot be checked by the person who bears the consequence of it being
 * wrong.
 *
 * **Relief is floored at nil.** Where the bunching produced no rate
 * disadvantage the difference goes negative. Section 89 gives relief; it does
 * not create a recovery. `computeRelief` reports `NO_RELIEF_ARISES` with the
 * reason rather than a negative liability.
 *
 * **The employer's authority is conditional.** Section 192(2A) lets the
 * employer give the relief in the TDS computation only where the employee
 * furnishes particulars in Form 10E, and since AY 2015-16 the relief is
 * disallowed outright without it. A payroll that reduces TDS on the strength of
 * an emailed spreadsheet has short-deducted, and the section 201(1A) interest
 * lands on the employer rather than on the employee. So the relief is computed
 * unconditionally and *applied* only against a recorded furnishing, and those
 * are two different fields on the result.
 *
 * Pure functions, no database access, matching how `perquisiteValuation.js` and
 * `ltaExemption.js` are written.
 */

const RELIEF_RULES = {
  /**
   * The rule the computation follows. Named because Rule 21A has separate
   * sub-rules for arrears (21A(2)), gratuity, compensation on termination and
   * commuted pension, and only the first is implemented here.
   */
  rule: 'Rule 21A(2)',

  /**
   * Relief is disallowed without Form 10E from AY 2015-16 onwards.
   *
   * Held as a year rather than as a boolean because the condition has a start
   * date, and an arrear received before it is not retrospectively disallowed.
   */
  formTenEMandatoryFromAssessmentYear: 2015,

  /** Relief is never negative. See the header. */
  floorAtNil: true,

  /**
   * Health and education cess. Uniform across regimes since AY 2019-20, so it
   * sits in the rules rather than in each rate table — but a table may override
   * it, because the four per cent replaced a three per cent that a 2017-18
   * relation year is still computed at.
   */
  defaultCessRate: 0.04,
};

const REGIME = {
  /** Slabs with deductions and exemptions. */
  OLD: 'OLD',
  /** Section 115BAC. Concessional slabs, most deductions withdrawn. */
  NEW: 'NEW',
};

/**
 * Why a relation year could not be computed.
 *
 * These are refusals, not zeroes. A relation year the module cannot price is
 * not a year that produced no relief — reporting it as nil understates the
 * relief and the employee never finds out.
 */
const GAP = {
  NO_RATE_TABLE: 'NO_RATE_TABLE',
  NO_ASSESSED_INCOME: 'NO_ASSESSED_INCOME',
  REGIME_NOT_RECORDED: 'REGIME_NOT_RECORDED',
};

const GAP_REASON = {
  [GAP.NO_RATE_TABLE]:
    'No rate table is on file for this assessment year, so the additional tax it would have borne cannot be computed at that year’s rates.',
  [GAP.NO_ASSESSED_INCOME]:
    'No assessed total income is recorded for this year. The relation-year term is a difference against what was actually assessed and cannot be inferred from the arrear alone.',
  [GAP.REGIME_NOT_RECORDED]:
    'No regime is recorded for this year. The relation-year term must be computed on the basis the employee was actually assessed on, not on the basis in force today.',
};

const FINDING = {
  FORM_10E_NOT_FURNISHED: 'FORM_10E_NOT_FURNISHED',
  FORM_10E_FURNISHED_AFTER_RETURN: 'FORM_10E_FURNISHED_AFTER_RETURN',
  RATE_TABLE_MISSING: 'RATE_TABLE_MISSING',
  RELATION_YEAR_INCOMPLETE: 'RELATION_YEAR_INCOMPLETE',
  NO_RELIEF_ARISES: 'NO_RELIEF_ARISES',
  RELIEF_AVAILABLE_NOT_APPLIED: 'RELIEF_AVAILABLE_NOT_APPLIED',
  REGIME_CHANGED_ACROSS_YEARS: 'REGIME_CHANGED_ACROSS_YEARS',
  ALLOCATION_DOES_NOT_RECONCILE: 'ALLOCATION_DOES_NOT_RECONCILE',
};

const FINDING_AUTHORITY = {
  [FINDING.FORM_10E_NOT_FURNISHED]: 'Section 192(2A) and Rule 21AA',
  [FINDING.FORM_10E_FURNISHED_AFTER_RETURN]: 'Section 89, first proviso',
  [FINDING.RATE_TABLE_MISSING]: 'Rule 21A(2)',
  [FINDING.RELATION_YEAR_INCOMPLETE]: 'Rule 21A(2)',
  [FINDING.NO_RELIEF_ARISES]: 'Section 89(1)',
  [FINDING.RELIEF_AVAILABLE_NOT_APPLIED]: 'Section 192(2A)',
  [FINDING.REGIME_CHANGED_ACROSS_YEARS]: 'Section 115BAC',
  [FINDING.ALLOCATION_DOES_NOT_RECONCILE]: 'Rule 21A(2), Annexure I',
};

const SEVERITY = {
  BREACH: 'BREACH',
  /** Something is outstanding that can still be done. Not a failure. */
  DUE: 'DUE',
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.FORM_10E_NOT_FURNISHED]: SEVERITY.DUE,
  [FINDING.FORM_10E_FURNISHED_AFTER_RETURN]: SEVERITY.BREACH,
  [FINDING.RATE_TABLE_MISSING]: SEVERITY.BREACH,
  [FINDING.RELATION_YEAR_INCOMPLETE]: SEVERITY.DUE,
  [FINDING.NO_RELIEF_ARISES]: SEVERITY.INFORMATIONAL,
  [FINDING.RELIEF_AVAILABLE_NOT_APPLIED]: SEVERITY.DUE,
  [FINDING.REGIME_CHANGED_ACROSS_YEARS]: SEVERITY.INFORMATIONAL,
  [FINDING.ALLOCATION_DOES_NOT_RECONCILE]: SEVERITY.BREACH,
};

/**
 * Section 192(2A), in the module's own words.
 *
 * Carried on every relief result rather than left in a comment. A payroll that
 * shows a relief figure without it invites somebody to reduce the TDS on the
 * strength of the figure alone, and the interest for doing so is the
 * employer's.
 */
const RELIEF_IS_CONDITIONAL =
  'The employer may give this relief in the TDS computation only where the employee has furnished particulars in Form 10E. Without it the relief is disallowed outright, and the short deduction — with section 201(1A) interest — is the employer’s, not the employee’s.';

// --- Money ------------------------------------------------------------------

/**
 * Round to the rupee.
 *
 * Half-up rather than banker's rounding, because that is what the department's
 * own utilities do and a relief that differs by a rupee from the one on the
 * portal is a relief the employee will not file.
 *
 * @param {number} value
 * @returns {number}
 */
function rupees(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * @param {*} value
 * @returns {number}
 */
function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// --- Dates and years --------------------------------------------------------

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
 * The financial year a date falls in, as its opening calendar year.
 *
 * 1 April to 31 March. Returned as a number rather than as "2021-22" because
 * every arithmetic use of it downstream is on the number, and the label is
 * built once at the edge.
 *
 * @param {Date|string} value
 * @returns {number|null}
 */
function financialYearOf(value) {
  const date = toUtcDate(value);
  if (!date) return null;
  return date.getUTCMonth() + 1 >= 4
    ? date.getUTCFullYear()
    : date.getUTCFullYear() - 1;
}

/**
 * The assessment year for a financial year. FY 2021-22 is AY 2022-23.
 *
 * @param {number} financialYear
 * @returns {number}
 */
function assessmentYearOf(financialYear) {
  return financialYear + 1;
}

/**
 * "2021-22" for 2021.
 *
 * @param {number} year
 * @returns {string}
 */
function yearLabel(year) {
  if (!Number.isFinite(year)) return '';
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

/**
 * The financial years a period touches, in order.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {Array<number>}
 */
function financialYearsBetween(from, to) {
  const start = financialYearOf(from);
  const end = financialYearOf(to);
  if (start === null || end === null || end < start) return [];

  const years = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}

/**
 * Days of a financial year that fall inside a period.
 *
 * Used to split an arrear across the years it relates to. Days rather than
 * months because a revision effective on the 16th contributes half a month, and
 * a month-granular split puts the whole of it in one year.
 *
 * @param {number} financialYear
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number}
 */
function daysOfYearInPeriod(financialYear, from, to) {
  const yearStart = new Date(Date.UTC(financialYear, 3, 1));
  const yearEnd = new Date(Date.UTC(financialYear + 1, 2, 31));

  const start = toUtcDate(from);
  const end = toUtcDate(to);
  if (!start || !end) return 0;

  const overlapStart = start > yearStart ? start : yearStart;
  const overlapEnd = end < yearEnd ? end : yearEnd;
  if (overlapEnd < overlapStart) return 0;

  return Math.round((overlapEnd - overlapStart) / 86400000) + 1;
}

// --- Rate tables ------------------------------------------------------------

/**
 * Resolve the rate table for an assessment year and regime.
 *
 * Returns `null` rather than the nearest table. The nearest table is the whole
 * bug this module exists to avoid: relief is the difference between two rate
 * environments, and substituting one for the other produces a figure that is
 * confidently wrong rather than visibly absent.
 *
 * @param {Array<object>} tables
 * @param {number} assessmentYear
 * @param {string} regime
 * @returns {object|null}
 */
function resolveRateTable(tables, assessmentYear, regime) {
  if (!Array.isArray(tables)) return null;

  return (
    tables.find(
      (table) =>
        Number(table?.assessmentYear) === Number(assessmentYear) &&
        table?.regime === regime,
    ) || null
  );
}

/**
 * Tax on a total income under one dated table.
 *
 * Slabs, then surcharge with marginal relief, then rebate under section 87A,
 * then cess — in that order, because the order changes the answer. Surcharge is
 * on the tax before rebate; cess is on tax plus surcharge after rebate.
 *
 * @param {object} input
 * @param {number} input.totalIncome
 * @param {object} input.table
 * @returns {{tax: number, surcharge: number, rebate: number, cess: number, total: number}}
 */
function taxOn({ totalIncome, table }) {
  const income = amount(totalIncome);
  const slabs = Array.isArray(table?.slabs) ? table.slabs : [];

  let tax = 0;
  for (const slab of slabs) {
    const from = amount(slab?.from);
    const upto =
      slab?.upto === null || slab?.upto === undefined
        ? Infinity
        : Number(slab.upto);
    const rate = Number(slab?.rate) || 0;

    if (income <= from) continue;
    const taxableInSlab = Math.min(income, upto) - from;
    if (taxableInSlab > 0) tax += taxableInSlab * rate;
  }

  // Section 87A. A rebate against tax before cess, capped, and available only
  // below a threshold — the threshold and the cap both move by year and by
  // regime, which is why they live on the table rather than here.
  let rebate = 0;
  const rebateLimit = Number(table?.rebateIncomeLimit) || 0;
  const rebateCap = Number(table?.rebateCap) || 0;
  if (rebateLimit > 0 && income <= rebateLimit) {
    rebate = Math.min(tax, rebateCap);
  }

  // Surcharge is on the tax before the rebate and stepped by income. Marginal
  // relief is not modelled: it applies at the step boundaries only, and an
  // arrear that lands a relation year exactly on one is rare enough that
  // asserting a figure would be worse than reporting the surcharge plainly.
  let surcharge = 0;
  const bands = Array.isArray(table?.surcharge) ? table.surcharge : [];
  for (const band of bands) {
    if (income > amount(band?.above))
      surcharge = tax * (Number(band?.rate) || 0);
  }

  const afterRebate = Math.max(0, tax - rebate);
  const cessRate = Number.isFinite(Number(table?.cessRate))
    ? Number(table.cessRate)
    : RELIEF_RULES.defaultCessRate;
  const cess = (afterRebate + surcharge) * cessRate;

  return {
    tax: rupees(tax),
    surcharge: rupees(surcharge),
    rebate: rupees(rebate),
    cess: rupees(cess),
    total: rupees(afterRebate + surcharge + cess),
  };
}

// --- Allocation -------------------------------------------------------------

/**
 * Split an arrear across the financial years it relates to.
 *
 * By days, from the revision's own effective dates, rather than evenly. An
 * arrear from a revision effective 1 November spans two financial years in a
 * 5:7 ratio and not 1:1, and an even split moves relief between two years with
 * different rates — which is the only variable the whole computation turns on.
 *
 * An explicit per-year breakdown on the input wins over the derived one: where
 * the arrear is not proportional to time — a one-off backdated bonus referable
 * to a single year — days are the wrong measure and the caller knows it.
 *
 * @param {object} input
 * @param {number} input.total
 * @param {Date|string} input.relatesFrom
 * @param {Date|string} input.relatesTo
 * @param {Array<{financialYear: number, amount: number}>} [input.explicit]
 * @returns {Array<{financialYear: number, label: string, amount: number, days: number, basis: string}>}
 */
function allocateArrear({ total, relatesFrom, relatesTo, explicit }) {
  const arrear = amount(total);

  if (Array.isArray(explicit) && explicit.length) {
    return explicit
      .filter((row) => Number.isFinite(Number(row?.financialYear)))
      .map((row) => ({
        financialYear: Number(row.financialYear),
        label: yearLabel(Number(row.financialYear)),
        amount: rupees(amount(row.amount)),
        days: 0,
        basis: 'RECORDED',
      }))
      .sort((a, b) => a.financialYear - b.financialYear);
  }

  const years = financialYearsBetween(relatesFrom, relatesTo);
  if (!years.length || arrear <= 0) return [];

  const withDays = years.map((year) => ({
    financialYear: year,
    label: yearLabel(year),
    days: daysOfYearInPeriod(year, relatesFrom, relatesTo),
  }));

  const totalDays = withDays.reduce((sum, row) => sum + row.days, 0);
  if (totalDays <= 0) return [];

  // The last year absorbs the rounding difference so the allocation reconciles
  // to the arrear exactly. A split that does not add back to the arrear is a
  // finding in Annexure I, not a presentational detail.
  let allocated = 0;
  return withDays.map((row, index) => {
    const isLast = index === withDays.length - 1;
    const share = isLast
      ? arrear - allocated
      : rupees((arrear * row.days) / totalDays);
    allocated += share;

    return { ...row, amount: rupees(share), basis: 'DAYS' };
  });
}

// --- The relation-year term -------------------------------------------------

/**
 * The additional tax a relation year would have borne on its share of the
 * arrear, at that year's rates on that year's assessed income.
 *
 * Returns a gap rather than a number where the year cannot be priced. A year
 * reported as nil because no rate table exists understates the relief, and the
 * employee never finds out — which is why `GAP` is a first-class outcome here
 * and not an exception.
 *
 * @param {object} input
 * @param {{financialYear: number, amount: number}} input.allocation
 * @param {object} input.assessed
 * @param {Array<object>} input.rateTables
 * @returns {object}
 */
function relationYearTerm({ allocation, assessed, rateTables }) {
  const financialYear = Number(allocation?.financialYear);
  const assessmentYear = assessmentYearOf(financialYear);
  const share = amount(allocation?.amount);

  const base = {
    financialYear,
    assessmentYear,
    label: yearLabel(financialYear),
    arrearShare: rupees(share),
  };

  if (!assessed) {
    return {
      ...base,
      gap: GAP.NO_ASSESSED_INCOME,
      reason: GAP_REASON[GAP.NO_ASSESSED_INCOME],
      additionalTax: null,
    };
  }

  const regime = assessed.regime;
  if (!regime || !REGIME[regime]) {
    return {
      ...base,
      gap: GAP.REGIME_NOT_RECORDED,
      reason: GAP_REASON[GAP.REGIME_NOT_RECORDED],
      additionalTax: null,
    };
  }

  const assessedIncome = Number(assessed.totalIncome);
  if (!Number.isFinite(assessedIncome) || assessedIncome < 0) {
    return {
      ...base,
      gap: GAP.NO_ASSESSED_INCOME,
      reason: GAP_REASON[GAP.NO_ASSESSED_INCOME],
      additionalTax: null,
    };
  }

  const table = resolveRateTable(rateTables, assessmentYear, regime);
  if (!table) {
    return {
      ...base,
      gap: GAP.NO_RATE_TABLE,
      reason: GAP_REASON[GAP.NO_RATE_TABLE],
      additionalTax: null,
      regime,
    };
  }

  const without = taxOn({ totalIncome: assessedIncome, table });
  const with_ = taxOn({ totalIncome: assessedIncome + share, table });

  return {
    ...base,
    regime,
    gap: null,
    reason: null,
    assessedIncome: rupees(assessedIncome),
    revisedIncome: rupees(assessedIncome + share),
    taxWithout: without.total,
    taxWith: with_.total,
    additionalTax: rupees(with_.total - without.total),
  };
}

// --- The relief -------------------------------------------------------------

/**
 * Rule 21A(2), kept in its terms.
 *
 * relief = (tax on the year of receipt including the arrears)
 *        − (tax on the year of receipt excluding the arrears)
 *        − Σ (additional tax each relation year would have borne)
 *
 * Every term is returned. A single relief figure that cannot be broken back
 * into these four cannot be checked by the employee who signs the return
 * carrying it.
 *
 * Floored at nil, and the floor is reported. Where the bunching produced no
 * rate disadvantage the difference goes negative; section 89 gives relief and
 * does not create a recovery.
 *
 * @param {object} input
 * @param {object} input.receipt
 * @param {Array<object>} input.allocations
 * @param {Array<object>} input.assessedYears
 * @param {Array<object>} input.rateTables
 * @returns {object}
 */
function computeRelief({ receipt, allocations, assessedYears, rateTables }) {
  const receiptYear = Number(receipt?.financialYear);
  const receiptAssessmentYear = assessmentYearOf(receiptYear);
  const regime = receipt?.regime;

  const arrearTotal = (allocations || []).reduce(
    (sum, row) => sum + amount(row?.amount),
    0,
  );

  const table = resolveRateTable(rateTables, receiptAssessmentYear, regime);

  if (!table) {
    return {
      relief: null,
      gap: GAP.NO_RATE_TABLE,
      reason: GAP_REASON[GAP.NO_RATE_TABLE],
      receiptYear,
      receiptAssessmentYear,
      relationYears: [],
      conditional: RELIEF_IS_CONDITIONAL,
    };
  }

  const incomeExcluding = amount(receipt?.totalIncomeExcludingArrears);
  const incomeIncluding = incomeExcluding + arrearTotal;

  const taxExcluding = taxOn({ totalIncome: incomeExcluding, table });
  const taxIncluding = taxOn({ totalIncome: incomeIncluding, table });

  const assessedBy = new Map(
    (assessedYears || [])
      .filter((row) => Number.isFinite(Number(row?.financialYear)))
      .map((row) => [Number(row.financialYear), row]),
  );

  const relationYears = (allocations || []).map((allocation) =>
    relationYearTerm({
      allocation,
      assessed: assessedBy.get(Number(allocation?.financialYear)) || null,
      rateTables,
    }),
  );

  const incomplete = relationYears.filter((row) => row.gap);

  const relationTotal = relationYears.reduce(
    (sum, row) => sum + (row.additionalTax || 0),
    0,
  );

  const taxOnBunching = taxIncluding.total - taxExcluding.total;
  const raw = taxOnBunching - relationTotal;
  const relief = RELIEF_RULES.floorAtNil ? Math.max(0, raw) : raw;

  return {
    receiptYear,
    receiptAssessmentYear,
    regime,
    arrearTotal: rupees(arrearTotal),

    // The four terms, kept separate. See the header.
    incomeExcludingArrears: rupees(incomeExcluding),
    incomeIncludingArrears: rupees(incomeIncluding),
    taxExcludingArrears: taxExcluding.total,
    taxIncludingArrears: taxIncluding.total,
    taxOnBunching: rupees(taxOnBunching),
    relationYearAdditionalTax: rupees(relationTotal),

    relationYears,
    // Incomplete relation years understate the relief. Reported rather than
    // absorbed, because a relief computed over a subset of the years it relates
    // to is not a smaller relief — it is a wrong one.
    incompleteRelationYears: incomplete.length,

    reliefBeforeFloor: rupees(raw),
    relief: rupees(relief),
    floored: RELIEF_RULES.floorAtNil && raw < 0,
    gap: null,
    conditional: RELIEF_IS_CONDITIONAL,
  };
}

// --- Form 10E ---------------------------------------------------------------

/**
 * Annexure I and Table A, from the computation.
 *
 * Table A is the year-wise spread and Annexure I is the summary that sits over
 * it. Both are built from the same relief result rather than re-derived, so a
 * figure on the form can never disagree with the figure on the screen.
 *
 * @param {object} relief
 * @returns {object}
 */
function formTenE(relief) {
  const tableA = (relief?.relationYears || []).map((row) => ({
    previousYear: row.label,
    assessmentYear: yearLabel(row.assessmentYear - 1),
    totalIncomeOfThatYear: row.assessedIncome ?? null,
    arrearsRelatingToThatYear: row.arrearShare,
    totalIncomeAsIncreased: row.revisedIncome ?? null,
    taxOnTotalIncome: row.taxWithout ?? null,
    taxOnTotalIncomeAsIncreased: row.taxWith ?? null,
    difference: row.additionalTax ?? null,
    // A row the module could not price is carried onto the form as a gap
    // rather than as a zero. A zero in this column is a claim.
    gap: row.gap || null,
  }));

  return {
    annexureI: {
      totalIncomeOfTheYearOfReceipt: relief?.incomeIncludingArrears ?? null,
      arrearsIncluded: relief?.arrearTotal ?? null,
      totalIncomeExcludingArrears: relief?.incomeExcludingArrears ?? null,
      taxOnTotalIncome: relief?.taxIncludingArrears ?? null,
      taxOnTotalIncomeExcludingArrears: relief?.taxExcludingArrears ?? null,
      taxOnArrears: relief?.taxOnBunching ?? null,
      taxOnArrearsSpreadOverYears: relief?.relationYearAdditionalTax ?? null,
      relief: relief?.relief ?? null,
    },
    tableA,
    complete: (relief?.incompleteRelationYears || 0) === 0,
    rule: 'Rule 21AA',
  };
}

/**
 * Whether the employer may apply the relief in the TDS computation.
 *
 * The relief and the authority to give it are different questions and are
 * returned as different fields. A relief of ₹40,000 that cannot yet be applied
 * is not a relief of nil, and a page that showed it as nil would tell the
 * employee they have nothing to claim.
 *
 * @param {object} input
 * @param {object|null} input.furnishing
 * @param {number} input.assessmentYear
 * @param {Date|string} [input.returnFiledOn]
 * @returns {object}
 */
function applicability({ furnishing, assessmentYear, returnFiledOn }) {
  const mandatory =
    Number(assessmentYear) >= RELIEF_RULES.formTenEMandatoryFromAssessmentYear;

  if (!mandatory) {
    return {
      mayApply: true,
      reason: `Form 10E became a condition of the relief from AY ${yearLabel(RELIEF_RULES.formTenEMandatoryFromAssessmentYear - 1)}. This year precedes it.`,
      furnishedOn: null,
    };
  }

  const furnishedOn = toUtcDate(furnishing?.furnishedOn);
  if (!furnishedOn) {
    return {
      mayApply: false,
      reason:
        'The employee has not furnished particulars in Form 10E. Section 192(2A) gives the employer no authority to reduce the deduction until they do.',
      furnishedOn: null,
    };
  }

  const filedOn = toUtcDate(returnFiledOn);
  if (filedOn && furnishedOn > filedOn) {
    return {
      mayApply: false,
      reason:
        'Form 10E was furnished after the return was filed. The relief is disallowed; furnishing it late does not revive it.',
      furnishedOn,
      lateAgainstReturn: true,
    };
  }

  return {
    mayApply: true,
    reason:
      'Form 10E furnished. The employer may give the relief under section 192(2A).',
    furnishedOn,
  };
}

// --- Assessment -------------------------------------------------------------

/**
 * One arrear's complete position: the allocation, the relief, the form and the
 * findings.
 *
 * @param {object} input
 * @returns {object}
 */
function assessArrear({
  arrear,
  assessedYears = [],
  rateTables = [],
  furnishing = null,
  applied = false,
  returnFiledOn = null,
}) {
  const allocations = allocateArrear({
    total: arrear?.amount,
    relatesFrom: arrear?.relatesFrom,
    relatesTo: arrear?.relatesTo,
    explicit: arrear?.allocation,
  });

  const receiptYear = financialYearOf(arrear?.paidOn);

  const relief = computeRelief({
    receipt: {
      financialYear: receiptYear,
      regime: arrear?.regime,
      totalIncomeExcludingArrears: arrear?.totalIncomeExcludingArrears,
    },
    allocations,
    assessedYears,
    rateTables,
  });

  const authority = applicability({
    furnishing,
    assessmentYear: assessmentYearOf(receiptYear),
    returnFiledOn,
  });

  const findings = [];
  const add = (code, detail) =>
    findings.push({
      code,
      authority: FINDING_AUTHORITY[code],
      severity: FINDING_SEVERITY[code],
      ...detail,
    });

  const allocatedTotal = allocations.reduce((sum, row) => sum + row.amount, 0);
  if (allocations.length && allocatedTotal !== rupees(amount(arrear?.amount))) {
    add(FINDING.ALLOCATION_DOES_NOT_RECONCILE, {
      arrear: rupees(amount(arrear?.amount)),
      allocated: allocatedTotal,
      detail:
        'The year-wise allocation does not add back to the arrear. Table A would not reconcile with Annexure I.',
    });
  }

  if (relief.gap === GAP.NO_RATE_TABLE) {
    add(FINDING.RATE_TABLE_MISSING, {
      assessmentYear: relief.receiptAssessmentYear,
      detail: GAP_REASON[GAP.NO_RATE_TABLE],
    });
  }

  for (const year of relief.relationYears || []) {
    if (year.gap) {
      add(FINDING.RELATION_YEAR_INCOMPLETE, {
        financialYear: year.financialYear,
        label: year.label,
        gap: year.gap,
        detail: year.reason,
      });
    }
  }

  // A regime change across the years is not an error, but it is the single
  // most common source of a relief an assessing officer later withdraws — the
  // relation-year term has to be on the basis the employee was actually
  // assessed on, and that basis is not today's.
  const regimes = new Set(
    (relief.relationYears || [])
      .map((row) => row.regime)
      .filter(Boolean)
      .concat(arrear?.regime ? [arrear.regime] : []),
  );
  if (regimes.size > 1) {
    add(FINDING.REGIME_CHANGED_ACROSS_YEARS, {
      regimes: [...regimes],
      detail:
        'The employee was assessed under more than one regime across the years involved. Each relation year is computed on the basis it was actually assessed on.',
    });
  }

  if (relief.relief === 0 && relief.gap === null) {
    add(FINDING.NO_RELIEF_ARISES, {
      reliefBeforeFloor: relief.reliefBeforeFloor,
      detail: relief.floored
        ? 'Spreading the arrear over the years it relates to produced no rate advantage. Section 89 gives relief; it does not create a recovery, so the difference is not carried back as a liability.'
        : 'The bunching produced no additional tax, so no relief arises.',
    });
  }

  if (relief.relief > 0 && !authority.mayApply) {
    add(
      authority.lateAgainstReturn
        ? FINDING.FORM_10E_FURNISHED_AFTER_RETURN
        : FINDING.FORM_10E_NOT_FURNISHED,
      { relief: relief.relief, detail: authority.reason },
    );
  }

  if (relief.relief > 0 && authority.mayApply && !applied) {
    add(FINDING.RELIEF_AVAILABLE_NOT_APPLIED, {
      relief: relief.relief,
      detail:
        'Form 10E is on file and the relief has not been given in the TDS computation. The employee is bearing the cash-flow cost until the refund.',
    });
  }

  return {
    arrear: {
      // Carried through so a caller can act on the claim this assessment is
      // about. The engine reads it and never writes to it.
      id: arrear?._id || arrear?.id || null,
      amount: rupees(amount(arrear?.amount)),
      paidOn: toUtcDate(arrear?.paidOn),
      relatesFrom: toUtcDate(arrear?.relatesFrom),
      relatesTo: toUtcDate(arrear?.relatesTo),
      receiptYear,
      receiptLabel: yearLabel(receiptYear),
    },
    allocations,
    relief,
    authority,
    // Both, always. See `applicability`.
    reliefComputed: relief.relief,
    reliefApplicable: authority.mayApply ? relief.relief : 0,
    form10E: formTenE(relief),
    findings,
    conditional: RELIEF_IS_CONDITIONAL,
  };
}

/**
 * Roll several arrears up for one employee.
 *
 * The reliefs are not summed across arrears received in the same year. Two
 * arrears paid in one financial year are one bunching, and computing them
 * separately double-counts the year-of-receipt term. Where that is detected the
 * roll-up reports it rather than adding the two figures together.
 *
 * @param {object} input
 * @returns {object}
 */
function assessEmployee({
  arrears = [],
  assessedYears = [],
  rateTables = [],
  asAt = new Date(),
}) {
  const assessments = arrears.map((arrear) =>
    assessArrear({
      arrear,
      assessedYears,
      rateTables,
      furnishing: arrear?.furnishing || null,
      applied: Boolean(arrear?.applied),
      returnFiledOn: arrear?.returnFiledOn || null,
    }),
  );

  const byReceiptYear = new Map();
  for (const assessment of assessments) {
    const year = assessment.arrear.receiptYear;
    byReceiptYear.set(year, (byReceiptYear.get(year) || 0) + 1);
  }

  const bunched = [...byReceiptYear.entries()]
    .filter(([, count]) => count > 1)
    .map(([year]) => year);

  const findings = assessments.flatMap((assessment) => assessment.findings);

  return {
    asAt: toUtcDate(asAt),
    assessments,
    totalReliefComputed: assessments.reduce(
      (sum, row) => sum + (row.reliefComputed || 0),
      0,
    ),
    totalReliefApplicable: assessments.reduce(
      (sum, row) => sum + (row.reliefApplicable || 0),
      0,
    ),
    // Named rather than silently summed. See the docstring.
    receiptYearsWithMoreThanOneArrear: bunched,
    findings,
    severityCounts: {
      BREACH: findings.filter((f) => f.severity === SEVERITY.BREACH).length,
      DUE: findings.filter((f) => f.severity === SEVERITY.DUE).length,
      INFORMATIONAL: findings.filter(
        (f) => f.severity === SEVERITY.INFORMATIONAL,
      ).length,
    },
    conditional: RELIEF_IS_CONDITIONAL,
  };
}

module.exports = {
  RELIEF_RULES,
  REGIME,
  GAP,
  GAP_REASON,
  FINDING,
  FINDING_AUTHORITY,
  FINDING_SEVERITY,
  SEVERITY,
  RELIEF_IS_CONDITIONAL,
  rupees,
  financialYearOf,
  assessmentYearOf,
  yearLabel,
  financialYearsBetween,
  daysOfYearInPeriod,
  resolveRateTable,
  taxOn,
  allocateArrear,
  relationYearTerm,
  computeRelief,
  formTenE,
  applicability,
  assessArrear,
  assessEmployee,
};
