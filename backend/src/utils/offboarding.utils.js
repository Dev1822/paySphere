/**
 * @fileoverview Offboarding Utility Functions
 * @description Helpers for status transitions, clearance calculation,
 *   progress tracking, settlement estimation, and exit interview analytics.
 */

/**
 * Valid status transitions for offboarding processes.
 */
const VALID_TRANSITIONS = {
  Initiated: ['InProgress', 'OnHold'],
  InProgress: ['ClearancePending', 'OnHold'],
  ClearancePending: ['SettlementPending', 'OnHold'],
  SettlementPending: ['Completed'],
  Completed: [],
  OnHold: ['Initiated', 'InProgress', 'ClearancePending', 'SettlementPending'],
};

/**
 * Default clearance checklist templates by category.
 */
const DEFAULT_CLEARANCE_ITEMS = [
  { category: 'IT', title: 'Return laptop and peripherals', isMandatory: true, sortOrder: 1 },
  { category: 'IT', title: 'Transfer access credentials and revoke accounts', isMandatory: true, sortOrder: 2 },
  { category: 'IT', title: 'Return software licenses and VPN tokens', isMandatory: true, sortOrder: 3 },
  { category: 'HR', title: 'Submit pending leave balances', isMandatory: true, sortOrder: 1 },
  { category: 'HR', title: 'Return employee ID badge', isMandatory: true, sortOrder: 2 },
  { category: 'HR', title: 'Update personal information for final settlement', isMandatory: false, sortOrder: 3 },
  { category: 'Finance', title: 'Settle outstanding expense claims', isMandatory: true, sortOrder: 1 },
  { category: 'Finance', title: 'Return corporate credit card', isMandatory: true, sortOrder: 2 },
  { category: 'Finance', title: 'Clear salary advances or loans', isMandatory: true, sortOrder: 3 },
  { category: 'Admin', title: 'Return office keys and access cards', isMandatory: true, sortOrder: 1 },
  { category: 'Admin', title: 'Return parking pass', isMandatory: false, sortOrder: 2 },
  { category: 'Manager', title: 'Complete knowledge transfer sessions', isMandatory: true, sortOrder: 1 },
  { category: 'Manager', title: 'Update project documentation', isMandatory: true, sortOrder: 2 },
  { category: 'Manager', title: 'Reassign ongoing tasks and responsibilities', isMandatory: true, sortOrder: 3 },
  { category: 'Facilities', title: 'Clean and vacate desk/cabin', isMandatory: true, sortOrder: 1 },
  { category: 'Legal', title: 'Sign NDA/non-compete acknowledgment', isMandatory: true, sortOrder: 1 },
];

/**
 * Offboarding status metadata.
 */
const STATUS_META = {
  Initiated: { label: 'Initiated', color: 'blue', icon: '🚀' },
  InProgress: { label: 'In Progress', color: 'yellow', icon: '⏳' },
  ClearancePending: { label: 'Clearance Pending', color: 'orange', icon: '📋' },
  SettlementPending: { label: 'Settlement Pending', color: 'purple', icon: '💰' },
  Completed: { label: 'Completed', color: 'green', icon: '✅' },
  OnHold: { label: 'On Hold', color: 'gray', icon: '⏸️' },
};

/**
 * Leaving reason metadata.
 */
const LEAVING_REASON_META = {
  BetterOpportunity: { label: 'Better Opportunity', category: 'External' },
  Compensation: { label: 'Compensation', category: 'Retention' },
  Relocation: { label: 'Relocation', category: 'Personal' },
  CareerGrowth: { label: 'Career Growth', category: 'Retention' },
  WorkLifeBalance: { label: 'Work-Life Balance', category: 'Retention' },
  Management: { label: 'Management Issues', category: 'Retention' },
  CompanyCulture: { label: 'Company Culture', category: 'Retention' },
  Health: { label: 'Health Reasons', category: 'Personal' },
  Personal: { label: 'Personal Reasons', category: 'Personal' },
  Retirement: { label: 'Retirement', category: 'Natural' },
  ContractEnd: { label: 'End of Contract', category: 'Natural' },
  Performance: { label: 'Performance', category: 'Involuntary' },
  Misconduct: { label: 'Misconduct', category: 'Involuntary' },
  Other: { label: 'Other', category: 'Other' },
};

/**
 * Validates a status transition.
 *
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ allowed: boolean, reason: string }}
 */
function validateTransition(currentStatus, targetStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) {
    return { allowed: false, reason: `Unknown status: ${currentStatus}` };
  }
  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
    };
  }
  return { allowed: true, reason: '' };
}

/**
 * Calculates offboarding progress based on checklist completion.
 *
 * @param {Array} checklistItems - Array of clearance items.
 * @param {Object} process - OffboardingProcess document.
 * @returns {number} Progress percentage (0-100).
 */
function calculateProgress(checklistItems, process) {
  if (!checklistItems || checklistItems.length === 0) return 0;

  const totalItems = checklistItems.length;
  const completedItems = checklistItems.filter(
    (item) => item.status === 'Cleared' || item.status === 'Skipped',
  ).length;

  const checklistProgress = (completedItems / totalItems) * 60; // 60% weight for checklist

  // Additional milestones
  let milestoneProgress = 0;
  if (process.handoverStatus === 'Completed') milestoneProgress += 15;
  if (process.exitInterviewConducted) milestoneProgress += 10;
  if (process.settlementStatus === 'Processed' || process.settlementStatus === 'Paid') milestoneProgress += 15;

  return Math.min(100, Math.round(checklistProgress + milestoneProgress));
}

/**
 * Determines if all mandatory clearance items are completed.
 *
 * @param {Array} checklistItems
 * @returns {{ allCleared: boolean, pendingMandatory: Array }}
 */
function checkMandatoryClearance(checklistItems) {
  const pendingMandatory = checklistItems.filter(
    (item) => item.isMandatory && item.status === 'Pending',
  );

  return {
    allCleared: pendingMandatory.length === 0,
    pendingMandatory,
  };
}

/**
 * Estimates final settlement amount based on exit type and leave balances.
 *
 * @param {Object} params
 * @param {string} params.exitType
 * @param {number} params.monthlySalary
 * @param {number} params.lastWorkingDayIndex - Day of month (1-31) of last day.
 * @param {number} params.pendingLeaveDays - Unused leave days.
 * @param {number} params.pendingLoanAmount
 * @param {number} params.assetDeductions
 * @param {number} params.noticePeriodDays
 * @param {boolean} params.isNoticeServed
 * @returns {{ components: Object, total: number }}
 */
function estimateSettlement(params) {
  const {
    monthlySalary = 0,
    lastWorkingDayIndex = 30,
    pendingLeaveDays = 0,
    pendingLoanAmount = 0,
    assetDeductions = 0,
    noticePeriodDays = 30,
    isNoticeServed = true,
  } = params;

  const dailyRate = monthlySalary / 30;

  const components = {
    // Pro-rated salary for current month
    proRatedSalary: Math.round(dailyRate * lastWorkingDayIndex * 100) / 100,
    // Leave encashment (India: 15 days earned leave per year = ~1.25 days/month)
    leaveEncashment: Math.round(pendingLeaveDays * dailyRate * 100) / 100,
    // Notice period buyout (if not served)
    noticePeriodBuyout: isNoticeServed ? 0 : Math.round(dailyRate * noticePeriodDays * 100) / 100,
    // Gratuity (if 5+ years: 15 days per year of service) — simplified
    gratuity: 0, // Would need service years to compute
    // Deductions
    loanRecovery: -Math.abs(pendingLoanAmount),
    assetDeduction: -Math.abs(assetDeductions),
    // Bonus accrual (simplified: 1/12 of annual bonus)
    bonusAccrual: 0,
  };

  const total = Object.values(components).reduce((sum, val) => sum + val, 0);

  return {
    components,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Calculates notice period shortfall or excess.
 *
 * @param {Date} resignationDate
 * @param {Date} lastWorkingDay
 * @param {number} noticePeriodDays
 * @returns {{ servedDays: number, shortfallDays: number, excessDays: number, isBuyoutRequired: boolean }}
 */
function calculateNoticePeriod(resignationDate, lastWorkingDay, noticePeriodDays) {
  const diffMs = new Date(lastWorkingDay) - new Date(resignationDate);
  const servedDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const shortfallDays = Math.max(0, noticePeriodDays - servedDays);
  const excessDays = Math.max(0, servedDays - noticePeriodDays);

  return {
    servedDays,
    shortfallDays,
    excessDays,
    isBuyoutRequired: shortfallDays > 0,
  };
}

/**
 * Generates attrition analytics from offboarding data.
 *
 * @param {Array} processes - Array of OffboardingProcess documents.
 * @param {number} totalHeadcount - Total employee count for rate calculation.
 * @returns {Object}
 */
function generateAttritionAnalytics(processes, totalHeadcount) {
  const stats = {
    totalExits: processes.length,
    attritionRate: totalHeadcount > 0
      ? Math.round((processes.length / totalHeadcount) * 10000) / 100
      : 0,
    byType: {},
    byReason: {},
    byDepartment: {},
    byTenure: {
      '0-6months': 0,
      '6-12months': 0,
      '1-2years': 0,
      '2-5years': 0,
      '5+years': 0,
    },
    averageTenureMonths: 0,
    voluntaryVsInvoluntary: { voluntary: 0, involuntary: 0 },
    averageExitInterviewRating: 0,
  };

  let totalTenureMonths = 0;
  let interviewRatingSum = 0;
  let interviewCount = 0;

  for (const proc of processes) {
    // By exit type
    stats.byType[proc.exitType] = (stats.byType[proc.exitType] || 0) + 1;

    // By reason
    stats.byReason[proc.leavingReason] = (stats.byReason[proc.leavingReason] || 0) + 1;

    // Voluntary vs involuntary
    if (['Resignation', 'Retirement', 'EndOfContract', 'MutualSeparation'].includes(proc.exitType)) {
      stats.voluntaryVsInvoluntary.voluntary++;
    } else {
      stats.voluntaryVsInvoluntary.involuntary++;
    }

    // Exit interview rating
    if (proc.exitInterviewRating) {
      interviewRatingSum += proc.exitInterviewRating;
      interviewCount++;
    }
  }

  stats.averageExitInterviewRating =
    interviewCount > 0
      ? Math.round((interviewRatingSum / interviewCount) * 100) / 100
      : 0;

  return stats;
}

module.exports = {
  VALID_TRANSITIONS,
  DEFAULT_CLEARANCE_ITEMS,
  STATUS_META,
  LEAVING_REASON_META,
  validateTransition,
  calculateProgress,
  checkMandatoryClearance,
  estimateSettlement,
  calculateNoticePeriod,
  generateAttritionAnalytics,
};
