/**
 * Employment lifecycle and settlement vocabulary (#462).
 *
 * PaySphere can onboard someone and pay them every month, but it has no concept
 * of them *leaving*. The entire exit path is one boolean:
 *
 *   isActive: { type: Boolean, default: true }
 *
 * `toggleEmployeeStatus` flips it and `submitPayrollForReview` then refuses to
 * include the employee at all. The alternative — `deleteEmployee` — refuses
 * outright when any paid payroll exists (#345) and otherwise cascades a
 * `PayrollUpdate.deleteMany`, destroying the salary history.
 *
 * So the two available exits are "freeze them mid-cycle and lose the final
 * payment" or "delete their history". Neither produces a settlement statement.
 */

/**
 * Explicit employment state.
 *
 * `isActive` currently means both "temporarily suspended" and "has left" — two
 * states with completely different payroll semantics collapsed into one flag.
 * This separates them while keeping `isActive` as a derived mirror so every
 * existing query keeps working untouched.
 */
const EMPLOYMENT_STATUS = {
  ACTIVE: 'active',
  PROBATION: 'probation',
  /** Resigned, still working, still payable up to the last working day. */
  NOTICE_PERIOD: 'notice_period',
  /** Left. Excluded from payroll, but the history is preserved. */
  EXITED: 'exited',
  /** Temporarily not payable, but not gone. */
  SUSPENDED: 'suspended',
};

/**
 * Which states `isActive` should be true for.
 *
 * An employee on notice is still working and still being paid, so they stay
 * active — excluding them the moment they resign is exactly the bug that made
 * the final month unpayable.
 */
const ACTIVE_STATUSES = [
  EMPLOYMENT_STATUS.ACTIVE,
  EMPLOYMENT_STATUS.PROBATION,
  EMPLOYMENT_STATUS.NOTICE_PERIOD,
];

/**
 * @param {string} status
 * @returns {boolean} the derived `isActive` value
 */
function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

const EXIT_TYPE = {
  RESIGNATION: 'resignation',
  TERMINATION: 'termination',
  RETIREMENT: 'retirement',
  END_OF_CONTRACT: 'end_of_contract',
};

// --- Settlement ------------------------------------------------------------

/**
 * Settlement lifecycle.
 *
 * Deliberately mirrors the payroll approval ladder from #438, so an F&F goes
 * through the same maker–checker path as a payroll run rather than inventing a
 * second, inconsistent one.
 */
const SETTLEMENT_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

const ALL_SETTLEMENT_STATUSES = Object.values(SETTLEMENT_STATUS);

/**
 * Legal transitions. `paid` and `cancelled` are terminal — a settled F&F must
 * not be reopened, for the same reason a paid payroll row must not be (#251).
 */
const SETTLEMENT_TRANSITIONS = {
  [SETTLEMENT_STATUS.DRAFT]: [
    SETTLEMENT_STATUS.PENDING_APPROVAL,
    SETTLEMENT_STATUS.CANCELLED,
  ],
  [SETTLEMENT_STATUS.PENDING_APPROVAL]: [
    SETTLEMENT_STATUS.APPROVED,
    SETTLEMENT_STATUS.DRAFT,
    SETTLEMENT_STATUS.CANCELLED,
  ],
  [SETTLEMENT_STATUS.APPROVED]: [
    SETTLEMENT_STATUS.PAID,
    SETTLEMENT_STATUS.CANCELLED,
  ],
  [SETTLEMENT_STATUS.PAID]: [],
  [SETTLEMENT_STATUS.CANCELLED]: [],
};

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function canTransitionSettlement(from, to) {
  if (from === to) return true;
  return (SETTLEMENT_TRANSITIONS[from] || []).includes(to);
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
function describeSettlementTransition(from, to) {
  if (!ALL_SETTLEMENT_STATUSES.includes(from)) {
    return `"${from}" is not a recognised settlement status`;
  }
  if (!ALL_SETTLEMENT_STATUSES.includes(to)) {
    return `"${to}" is not a recognised settlement status`;
  }

  const allowed = SETTLEMENT_TRANSITIONS[from] || [];
  if (allowed.length === 0) {
    return `A settlement that is "${from}" is final and cannot change status`;
  }

  return `A settlement that is "${from}" can only move to: ${allowed.join(', ')}`;
}

// --- Gratuity --------------------------------------------------------------

/**
 * Statutory gratuity parameters (Payment of Gratuity Act).
 *
 * Kept here as data so the next change to the ceiling is a one-line edit, in
 * the same spirit as `config/permissions.js`.
 */
const GRATUITY = {
  /** Minimum continuous service before any gratuity is due. */
  ELIGIBILITY_YEARS: 5,
  /** 15 days' wages for every completed year. */
  DAYS_PER_YEAR: 15,
  /** Divisor: a working month is treated as 26 days. */
  MONTH_DAYS: 26,
  /** Statutory maximum. */
  CEILING: 2000000,
  /**
   * A part-year of 6 months or more counts as a full year; less than 6 months
   * is disregarded.
   */
  ROUND_UP_MONTHS: 6,
};

/** Basis for prorating a partial final month. */
const PRORATION_BASIS = {
  /** Calendar days — the default, matching how leave is already deducted. */
  CALENDAR: 'calendar',
  /** Working days, excluding the configured weekly offs. */
  WORKING: 'working',
};

const DEFAULT_SETTLEMENT_POLICY = {
  prorationBasis: PRORATION_BASIS.CALENDAR,
  /** Days of unused leave that may be encashed. 0 disables encashment. */
  leaveEncashmentCapDays: 15,
  /** Default notice period, used when the employee record does not set one. */
  defaultNoticePeriodDays: 30,
  gratuityEnabled: true,
};

const MAX_SETTLEMENT_NOTE_LENGTH = 1000;

module.exports = {
  EMPLOYMENT_STATUS,
  ACTIVE_STATUSES,
  isActiveStatus,
  EXIT_TYPE,
  SETTLEMENT_STATUS,
  ALL_SETTLEMENT_STATUSES,
  SETTLEMENT_TRANSITIONS,
  canTransitionSettlement,
  describeSettlementTransition,
  GRATUITY,
  PRORATION_BASIS,
  DEFAULT_SETTLEMENT_POLICY,
  MAX_SETTLEMENT_NOTE_LENGTH,
};
