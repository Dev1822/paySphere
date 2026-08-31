/**
 * Salary-advance and loan amortisation.
 *
 * Pure functions — no database access — so the money arithmetic can be tested
 * against its boundaries in isolation, the way `salaryCalculator.js` already is
 * (#460).
 *
 * Before this, the only way to model an advance was for the admin to remember
 * to add a manual `deductions` figure every month and to remember to stop when
 * the balance hit zero. There was no principal, no schedule, no outstanding
 * balance, and nothing that made the recovery idempotent — so re-running a
 * month's payroll collected the instalment twice.
 */

const INTEREST_METHOD = {
  /** A plain advance: repay exactly what was borrowed. */
  NONE: 'none',
  /** Interest charged on the original principal for the whole tenure. */
  FLAT: 'flat',
  /** Standard EMI: interest charged on the balance outstanding each month. */
  REDUCING: 'reducing',
};

const LOAN_TYPE = {
  ADVANCE: 'advance',
  LOAN: 'loan',
};

const LOAN_STATUS = {
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  /**
   * Closed early by settling the balance in a lump sum (#1155).
   *
   * Kept apart from `completed` rather than reusing it. To the recovery step
   * the two are the same — neither is collected against — but to everyone else
   * they are not: a loan that ran its full tenure earned all its interest, and
   * one settled in month three had the rest of it rebated. Reporting cannot
   * tell those apart if they share a status, and the rebate has nowhere to
   * hang.
   */
  FORECLOSED: 'foreclosed',
};

const MAX_TENURE_MONTHS = 120;
const MAX_PRINCIPAL = 100000000;
const MAX_INTEREST_RATE_PERCENT = 100;

const Decimal = require('decimal.js');
Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

/**
 * Round to paise. Money must never carry binary floating-point noise — #347
 * already showed what an unrounded sum does to a payroll total.
 * Uses decimal.js for arbitrary precision with banker's rounding.
 *
 * @param {number|string|Decimal} value
 * @returns {number}
 */
function round2(value) {
  return new Decimal(value).toDecimalPlaces(2).toNumber();
}

/**
 * Normalise and bound the inputs a schedule is built from.
 *
 * Returns errors rather than throwing, so a controller can turn them into a
 * 400 listing every problem instead of the first one.
 *
 * @param {object} input
 * @returns {{ok: boolean, value: object, errors: string[]}}
 */
function validateLoanInput(input = {}) {
  const errors = [];

  const principal = Number(input.principal);
  if (!Number.isFinite(principal) || principal <= 0) {
    errors.push('Principal must be a positive number');
  } else if (principal > MAX_PRINCIPAL) {
    errors.push(`Principal cannot exceed ${MAX_PRINCIPAL}`);
  }

  const tenureMonths = Number(input.tenureMonths);
  if (!Number.isInteger(tenureMonths) || tenureMonths < 1) {
    errors.push('Tenure must be a whole number of months, at least 1');
  } else if (tenureMonths > MAX_TENURE_MONTHS) {
    errors.push(`Tenure cannot exceed ${MAX_TENURE_MONTHS} months`);
  }

  const interestMethod = Object.values(INTEREST_METHOD).includes(
    input.interestMethod,
  )
    ? input.interestMethod
    : INTEREST_METHOD.NONE;

  let interestRatePercent = Number(input.interestRatePercent);
  if (!Number.isFinite(interestRatePercent) || interestRatePercent < 0) {
    interestRatePercent = 0;
  }
  if (interestRatePercent > MAX_INTEREST_RATE_PERCENT) {
    errors.push(`Interest rate cannot exceed ${MAX_INTEREST_RATE_PERCENT}%`);
  }

  // An interest-bearing method with a zero rate is just an interest-free
  // advance; treat it as one rather than dividing by zero downstream.
  const effectiveMethod =
    interestRatePercent === 0 ? INTEREST_METHOD.NONE : interestMethod;

  const startMonth = Number(input.startMonth);
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    errors.push('Start month must be an integer between 1 and 12');
  }

  const startYear = Number(input.startYear);
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    errors.push('Start year must be a valid year');
  }

  return {
    ok: errors.length === 0,
    value: {
      principal: round2(principal),
      tenureMonths,
      interestMethod: effectiveMethod,
      interestRatePercent,
      startMonth,
      startYear,
    },
    errors,
  };
}

/**
 * The monthly instalment for a set of terms.
 *
 * @param {object} params
 * @returns {number}
 */
function computeInstallmentAmount({
  principal,
  tenureMonths,
  interestMethod,
  interestRatePercent,
}) {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isInteger(tenureMonths) || tenureMonths < 1) return 0;

  const p = new Decimal(principal);
  const t = new Decimal(tenureMonths);

  if (interestMethod === INTEREST_METHOD.NONE || !interestRatePercent) {
    return round2(p.dividedBy(t));
  }

  const rPercent = new Decimal(interestRatePercent);

  if (interestMethod === INTEREST_METHOD.FLAT) {
    // Interest on the full principal for the whole tenure, spread evenly.
    const years = t.dividedBy(12);
    const totalInterest = p.times(rPercent).times(years).dividedBy(100);
    return round2(p.plus(totalInterest).dividedBy(t));
  }

  // Reducing balance — the standard EMI formula.
  const monthlyRate = rPercent.dividedBy(100).dividedBy(12);
  const growth = new Decimal(1).plus(monthlyRate).pow(t.toNumber());
  return round2(p.times(monthlyRate).times(growth).dividedBy(growth.minus(1)));
}

/**
 * Advance a {month, year} pair by n months.
 *
 * @param {number} month 1-12
 * @param {number} year
 * @param {number} offset
 * @returns {{month: number, year: number}}
 */
function addMonths(month, year, offset) {
  const zeroBased = month - 1 + offset;
  return {
    month: (((zeroBased % 12) + 12) % 12) + 1,
    year: year + Math.floor(zeroBased / 12),
  };
}

/**
 * Build the full instalment table.
 *
 * The last row absorbs all accumulated rounding, so the principal components
 * sum to exactly the principal and the closing balance is exactly zero. Without
 * that, a 10,000 loan over 3 months leaves 0.01 outstanding forever and the
 * loan never auto-completes.
 *
 * @param {object} terms
 * @returns {{ok: boolean, errors: string[], schedule: object[], installmentAmount: number, totalPayable: number, totalInterest: number}}
 */
function buildAmortizationSchedule(terms) {
  const validation = validateLoanInput(terms);

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      schedule: [],
      installmentAmount: 0,
      totalPayable: 0,
      totalInterest: 0,
    };
  }

  const {
    principal,
    tenureMonths,
    interestMethod,
    interestRatePercent,
    startMonth,
    startYear,
  } = validation.value;

  const p = new Decimal(principal);
  const t = new Decimal(tenureMonths);
  const rPercent = new Decimal(interestRatePercent || 0);

  const installmentAmount = computeInstallmentAmount({
    principal,
    tenureMonths,
    interestMethod,
    interestRatePercent,
  });

  const monthlyRate = rPercent.dividedBy(100).dividedBy(12);
  const flatMonthlyInterest =
    interestMethod === INTEREST_METHOD.FLAT
      ? round2(
          p.times(rPercent).times(t.dividedBy(12)).dividedBy(100).dividedBy(t)
        )
      : 0;

  const schedule = [];
  let balance = p;
  let principalPaid = new Decimal(0);
  let interestPaid = new Decimal(0);
  const instAmtDec = new Decimal(installmentAmount);

  for (let i = 0; i < tenureMonths; i += 1) {
    const period = addMonths(startMonth, startYear, i);
    const isLast = i === tenureMonths - 1;

    let interestComponent;
    if (interestMethod === INTEREST_METHOD.REDUCING) {
      interestComponent = new Decimal(round2(balance.times(monthlyRate)));
    } else if (interestMethod === INTEREST_METHOD.FLAT) {
      interestComponent = new Decimal(flatMonthlyInterest);
    } else {
      interestComponent = new Decimal(0);
    }

    let principalComponent;
    let amount;

    if (isLast) {
      // Absorb the drift: whatever principal remains is due now.
      principalComponent = new Decimal(round2(p.minus(principalPaid)));
      amount = new Decimal(round2(principalComponent.plus(interestComponent)));
    } else {
      principalComponent = new Decimal(round2(instAmtDec.minus(interestComponent)));
      amount = instAmtDec;
    }

    principalPaid = new Decimal(round2(principalPaid.plus(principalComponent)));
    interestPaid = new Decimal(round2(interestPaid.plus(interestComponent)));
    balance = new Decimal(round2(p.minus(principalPaid)));

    schedule.push({
      installmentNumber: i + 1,
      month: period.month,
      year: period.year,
      amount: amount.toNumber(),
      principalComponent: principalComponent.toNumber(),
      interestComponent: interestComponent.toNumber(),
      closingBalance: Math.max(balance.toNumber(), 0),
    });
  }

  return {
    ok: true,
    errors: [],
    schedule,
    installmentAmount,
    totalPayable: round2(p.plus(interestPaid)),
    totalInterest: interestPaid.toNumber(),
  };
}

/**
 * Whether a repayment has already been recorded for a period.
 *
 * This is what makes recovery idempotent. The approval workflow explicitly
 * allows a rejected run to be re-submitted, so the same month can be finalised
 * more than once — without this check the second run takes a second instalment.
 *
 * @param {object} loan
 * @param {number} month
 * @param {number} year
 * @returns {object|null} the existing repayment, or null
 */
function findRepayment(loan, month, year) {
  const repayments = Array.isArray(loan?.repayments) ? loan.repayments : [];
  return (
    repayments.find(
      (r) =>
        Number(r.month) === Number(month) && Number(r.year) === Number(year),
    ) || null
  );
}

/**
 * The outstanding balance implied by the recorded repayments.
 *
 * Derived rather than trusted from a stored field, so the ledger and the
 * summary can never disagree.
 *
 * @param {object} loan
 * @returns {number}
 */
function computeOutstanding(loan) {
  const totalPayable = Number(loan?.totalPayable);
  const base =
    Number.isFinite(totalPayable) && totalPayable > 0
      ? totalPayable
      : Number(loan?.principal) || 0;

  const repaid = (
    Array.isArray(loan?.repayments) ? loan.repayments : []
  ).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return round2(Math.max(base - repaid, 0));
}

/**
 * Whether a period falls on or after the loan's start.
 *
 * @param {object} loan
 * @param {number} month
 * @param {number} year
 * @returns {boolean}
 */
function hasStarted(loan, month, year) {
  const startPoint = Number(loan?.startYear) * 12 + Number(loan?.startMonth);
  const point = Number(year) * 12 + Number(month);
  return Number.isFinite(startPoint) && point >= startPoint;
}

/**
 * What this loan is owed for a given payroll month.
 *
 * Returns 0 — not an error — for a loan that has not started, is on hold, is
 * cancelled or completed, or has already been collected for the period.
 *
 * @param {object} loan
 * @param {number} month
 * @param {number} year
 * @returns {{due: number, reason: string, alreadyRecovered: boolean}}
 */
function resolveDueInstallment(loan, month, year) {
  if (!loan) return { due: 0, reason: 'no_loan', alreadyRecovered: false };

  if (loan.status === LOAN_STATUS.CANCELLED) {
    return { due: 0, reason: 'cancelled', alreadyRecovered: false };
  }

  if (loan.status === LOAN_STATUS.COMPLETED) {
    return { due: 0, reason: 'completed', alreadyRecovered: false };
  }

  // Settled early. Nothing is owed, and the schedule rows beyond the closure
  // period were truncated when it was foreclosed — collecting against them
  // would take an instalment on a balance of zero (#1155).
  if (loan.status === LOAN_STATUS.FORECLOSED) {
    return { due: 0, reason: 'foreclosed', alreadyRecovered: false };
  }

  if (loan.status === LOAN_STATUS.ON_HOLD) {
    return { due: 0, reason: 'on_hold', alreadyRecovered: false };
  }

  if (!hasStarted(loan, month, year)) {
    return { due: 0, reason: 'not_started', alreadyRecovered: false };
  }

  const existing = findRepayment(loan, month, year);
  if (existing) {
    // Idempotency: the period is already collected. Report the amount so a
    // re-finalised run reproduces the same payroll row rather than dropping
    // the recovery line entirely.
    return {
      due: round2(Number(existing.amount) || 0),
      reason: 'already_recovered',
      alreadyRecovered: true,
    };
  }

  const outstanding = computeOutstanding(loan);
  if (outstanding <= 0) {
    return { due: 0, reason: 'settled', alreadyRecovered: false };
  }

  const installment = Number(loan.installmentAmount) || 0;

  // Never collect more than is owed: the final instalment is whatever remains.
  return {
    due: round2(Math.min(installment, outstanding)),
    reason: 'due',
    alreadyRecovered: false,
  };
}

/**
 * Split a collected amount into principal and interest using the schedule.
 *
 * @param {object} loan
 * @param {number} month
 * @param {number} year
 * @param {number} amount
 * @returns {{principalComponent: number, interestComponent: number}}
 */
function splitRepayment(loan, month, year, amount) {
  const collected = round2(amount);
  const schedule = Array.isArray(loan?.schedule) ? loan.schedule : [];

  const row = schedule.find(
    (r) => Number(r.month) === Number(month) && Number(r.year) === Number(year),
  );

  if (!row) {
    return { principalComponent: collected, interestComponent: 0 };
  }

  // A partial collection pays interest first, which is the conventional order
  // and stops a shortfall from silently reducing the interest owed.
  const interestComponent = round2(Math.min(row.interestComponent, collected));
  return {
    principalComponent: round2(collected - interestComponent),
    interestComponent,
  };
}

/**
 * Allocate recovery across an employee's active loans within an affordable cap.
 *
 * Recovery must never drive net salary below zero. A shortfall is carried
 * forward — the loan is not forgiven, the instalment simply is not collected
 * this month and the outstanding balance stays where it was.
 *
 * @param {object} params
 * @param {object[]} params.loans the employee's loans
 * @param {number} params.month
 * @param {number} params.year
 * @param {number} params.availableForRecovery the most that can be deducted
 * @returns {{recoveries: object[], totalRecovered: number, shortfall: number}}
 */
function allocateRecovery({ loans, month, year, availableForRecovery }) {
  const cap = Number.isFinite(availableForRecovery)
    ? Math.max(availableForRecovery, 0)
    : 0;

  let remaining = round2(cap);
  let totalDue = 0;
  const recoveries = [];

  // Oldest loan first, so a long-running advance is not starved by a new one.
  const ordered = (Array.isArray(loans) ? [...loans] : []).sort((a, b) => {
    const aPoint = Number(a.startYear) * 12 + Number(a.startMonth);
    const bPoint = Number(b.startYear) * 12 + Number(b.startMonth);
    return aPoint - bPoint;
  });

  for (const loan of ordered) {
    const { due, alreadyRecovered } = resolveDueInstallment(loan, month, year);

    if (due <= 0) continue;

    totalDue = round2(totalDue + due);

    // An instalment already recorded for this period is reproduced in full: it
    // was collected on a previous run and must not be re-capped or dropped.
    const amount = alreadyRecovered ? due : round2(Math.min(due, remaining));

    if (amount <= 0) continue;

    const { principalComponent, interestComponent } = splitRepayment(
      loan,
      month,
      year,
      amount,
    );

    recoveries.push({
      loanId: loan._id || loan.id || null,
      type: loan.type || LOAN_TYPE.ADVANCE,
      amount,
      principalComponent,
      interestComponent,
      scheduledAmount: due,
      alreadyRecovered,
      // Non-zero when the employee could not afford the full instalment.
      shortfall: round2(due - amount),
    });

    if (!alreadyRecovered) {
      remaining = round2(remaining - amount);
    }
  }

  const totalRecovered = round2(
    recoveries.reduce((sum, r) => sum + r.amount, 0),
  );

  return {
    recoveries,
    totalRecovered,
    shortfall: round2(Math.max(totalDue - totalRecovered, 0)),
  };
}

/**
 * Apply a repayment to a loan, returning a new ledger rather than mutating.
 *
 * Re-applying the same period replaces that entry instead of appending a
 * second one, which is what keeps a re-finalised payroll run from
 * double-collecting.
 *
 * @param {object} loan
 * @param {object} repayment
 * @returns {{repayments: object[], totalRepaid: number, outstanding: number, status: string}}
 */
function applyRepayment(loan, { month, year, amount, payrollId = null }) {
  const collected = round2(amount);
  const existing = Array.isArray(loan?.repayments) ? [...loan.repayments] : [];

  const { principalComponent, interestComponent } = splitRepayment(
    loan,
    month,
    year,
    collected,
  );

  const entry = {
    month: Number(month),
    year: Number(year),
    amount: collected,
    principalComponent,
    interestComponent,
    payrollId,
  };

  const index = existing.findIndex(
    (r) => Number(r.month) === Number(month) && Number(r.year) === Number(year),
  );

  if (index >= 0) existing[index] = entry;
  else existing.push(entry);

  existing.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

  const totalRepaid = round2(
    existing.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
  );
  const outstanding = computeOutstanding({ ...loan, repayments: existing });

  let status = loan?.status || LOAN_STATUS.ACTIVE;
  if (outstanding <= 0 && status === LOAN_STATUS.ACTIVE) {
    // Auto-complete, so a settled loan stops being recovered without anyone
    // having to remember to close it.
    status = LOAN_STATUS.COMPLETED;
  }

  return { repayments: existing, totalRepaid, outstanding, status };
}

/**
 * Legal status transitions.
 *
 * `completed` and `cancelled` are terminal: reopening a settled loan would let
 * an employer resume collecting against a balance of zero.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  [LOAN_STATUS.ACTIVE]: [
    LOAN_STATUS.ON_HOLD,
    LOAN_STATUS.CANCELLED,
    LOAN_STATUS.COMPLETED,
    LOAN_STATUS.FORECLOSED,
  ],
  // A held loan can still be settled early — being on hold is why an employee
  // asks to close it out (#1155).
  [LOAN_STATUS.ON_HOLD]: [
    LOAN_STATUS.ACTIVE,
    LOAN_STATUS.CANCELLED,
    LOAN_STATUS.FORECLOSED,
  ],
  [LOAN_STATUS.COMPLETED]: [],
  [LOAN_STATUS.CANCELLED]: [],
  [LOAN_STATUS.FORECLOSED]: [],
};

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function canTransitionStatus(from, to) {
  if (from === to) return true;
  return (ALLOWED_STATUS_TRANSITIONS[from] || []).includes(to);
}

module.exports = {
  INTEREST_METHOD,
  LOAN_TYPE,
  LOAN_STATUS,
  ALLOWED_STATUS_TRANSITIONS,
  MAX_TENURE_MONTHS,
  MAX_PRINCIPAL,
  MAX_INTEREST_RATE_PERCENT,
  round2,
  validateLoanInput,
  computeInstallmentAmount,
  addMonths,
  buildAmortizationSchedule,
  findRepayment,
  computeOutstanding,
  hasStarted,
  resolveDueInstallment,
  splitRepayment,
  allocateRecovery,
  applyRepayment,
  canTransitionStatus,
};
