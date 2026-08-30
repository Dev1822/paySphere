/**
 * @fileoverview Department Budget Utility Functions
 * @description Helpers for variance calculations, forecasting, alert generation,
 *   fiscal period computation, and budget report formatting.
 */

/**
 * Fiscal period metadata.
 */
const PERIOD_META = {
  Annual: { label: 'Annual', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  Q1: { label: 'Q1 (Apr-Jun)', months: [4, 5, 6] },
  Q2: { label: 'Q2 (Jul-Sep)', months: [7, 8, 9] },
  Q3: { label: 'Q3 (Oct-Dec)', months: [10, 11, 12] },
  Q4: { label: 'Q4 (Jan-Mar)', months: [1, 2, 3] },
};

/**
 * Budget status lifecycle transitions.
 */
const VALID_STATUS_TRANSITIONS = {
  Draft: ['Submitted'],
  Submitted: ['UnderReview', 'Rejected'],
  UnderReview: ['Approved', 'Rejected', 'Revised'],
  Approved: ['Revised', 'Closed'],
  Rejected: ['Draft', 'Submitted'],
  Revised: ['Submitted', 'Approved', 'Closed'],
  Closed: [],
};

/**
 * Alert severity configuration.
 */
const ALERT_THRESHOLDS = {
  Warning: { min: 75, max: 89.99, label: '⚠️ Warning', color: 'yellow' },
  Critical: { min: 90, max: 99.99, label: '🔴 Critical', color: 'red' },
  Exceeded: { min: 100, max: Infinity, label: '🚫 Exceeded', color: 'darkred' },
};

/**
 * Calculates variance and utilization for a budget item.
 *
 * @param {number} budgeted - The budgeted amount.
 * @param {number} actual - The actual expenditure.
 * @param {number} [committed=0] - Committed but not spent.
 * @returns {{ variance: number, variancePercent: number, utilizationRate: number, status: string }}
 */
function calculateVariance(budgeted, actual, committed = 0) {
  if (budgeted === 0) {
    return {
      variance: -actual,
      variancePercent: actual > 0 ? -100 : 0,
      utilizationRate: 0,
      status: actual > 0 ? 'OverBudget' : 'OnTrack',
    };
  }

  const variance = budgeted - actual;
  const variancePercent = Math.round((variance / budgeted) * 10000) / 100;
  const utilizationRate =
    Math.round((actual / budgeted) * 10000) / 100;

  let status = 'OnTrack';
  if (utilizationRate >= 100) status = 'Exceeded';
  else if (utilizationRate >= 90) status = 'Critical';
  else if (utilizationRate >= 75) status = 'Warning';

  return { variance, variancePercent, utilizationRate, status };
}

/**
 * Calculates year-over-year change percentage.
 *
 * @param {number} currentYear - Current year amount.
 * @param {number} previousYear - Previous year amount.
 * @returns {number} Percentage change.
 */
function calculateYoYChange(currentYear, previousYear) {
  if (previousYear === 0) {
    return currentYear > 0 ? 100 : 0;
  }
  return Math.round(((currentYear - previousYear) / previousYear) * 10000) / 100;
}

/**
 * Validates a budget status transition.
 *
 * @param {string} currentStatus - Current status.
 * @param {string} targetStatus - Desired target status.
 * @returns {{ allowed: boolean, reason: string }}
 */
function validateStatusTransition(currentStatus, targetStatus) {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!allowed) {
    return {
      allowed: false,
      reason: `Unknown current status: ${currentStatus}`,
    };
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
 * Determines which alerts should fire based on utilization.
 *
 * @param {number} utilizationRate - Current utilization percentage.
 * @param {number} warningThreshold - Warning threshold (default 75).
 * @param {number} criticalThreshold - Critical threshold (default 90).
 * @returns {Array<{ type: string, message: string }>}
 */
function determineAlerts(utilizationRate, warningThreshold = 75, criticalThreshold = 90) {
  const alerts = [];

  if (utilizationRate >= 100) {
    alerts.push({
      type: 'Exceeded',
      message: `Budget exceeded! Utilization at ${utilizationRate.toFixed(1)}%`,
    });
  } else if (utilizationRate >= criticalThreshold) {
    alerts.push({
      type: 'Critical',
      message: `Budget critically high at ${utilizationRate.toFixed(1)}% (threshold: ${criticalThreshold}%)`,
    });
  } else if (utilizationRate >= warningThreshold) {
    alerts.push({
      type: 'Warning',
      message: `Budget utilization at ${utilizationRate.toFixed(1)}% (threshold: ${warningThreshold}%)`,
    });
  }

  return alerts;
}

/**
 * Projects end-of-period expenditure based on current run rate.
 *
 * @param {number} actualSoFar - Actual expenditure to date.
 * @param {Date} periodStart - Start of the budget period.
 * @param {Date} periodEnd - End of the budget period.
 * @param {Date} [currentDate] - Current date (defaults to now).
 * @returns {{ projectedTotal: number, monthsElapsed: number, monthsRemaining: number, monthlyRunRate: number }}
 */
function projectEndOfPeriod(
  actualSoFar,
  periodStart,
  periodEnd,
  currentDate,
) {
  const now = currentDate || new Date();
  const totalDays =
    (new Date(periodEnd) - new Date(periodStart)) / (1000 * 60 * 60 * 24);
  const elapsedDays =
    (now - new Date(periodStart)) / (1000 * 60 * 60 * 24);

  const monthsTotal = Math.max(1, totalDays / 30);
  const monthsElapsed = Math.max(0.1, Math.min(monthsTotal, elapsedDays / 30));
  const monthsRemaining = Math.max(0, monthsTotal - monthsElapsed);

  const monthlyRunRate =
    monthsElapsed > 0 ? actualSoFar / monthsElapsed : 0;
  const projectedTotal = monthlyRunRate * monthsTotal;

  return {
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    monthsElapsed: Math.round(monthsElapsed * 10) / 10,
    monthsRemaining: Math.round(monthsRemaining * 10) / 10,
    monthlyRunRate: Math.round(monthlyRunRate * 100) / 100,
  };
}

/**
 * Gets the fiscal year for a given date (Indian fiscal year: Apr-Mar).
 *
 * @param {Date} [date] - Reference date.
 * @returns {number} Fiscal year (e.g., 2026 for Apr 2026 - Mar 2027).
 */
function getFiscalYear(date) {
  const d = date || new Date();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  // Indian FY: Apr (3) to Mar (2) → FY starts in April
  return month >= 3 ? year : year - 1;
}

/**
 * Gets the current fiscal period.
 *
 * @param {Date} [date] - Reference date.
 * @returns {{ fiscalYear: number, quarter: string, month: number, monthName: string }}
 */
function getCurrentFiscalPeriod(date) {
  const d = date || new Date();
  const month = d.getMonth() + 1; // 1-indexed
  const fiscalYear = getFiscalYear(d);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  let quarter;
  if (month >= 4 && month <= 6) quarter = 'Q1';
  else if (month >= 7 && month <= 9) quarter = 'Q2';
  else if (month >= 10 && month <= 12) quarter = 'Q3';
  else quarter = 'Q4';

  return {
    fiscalYear,
    quarter,
    month,
    monthName: monthNames[month - 1],
  };
}

/**
 * Formats a budget summary for display or notifications.
 *
 * @param {Object} budget - DeptBudget document.
 * @param {string} departmentName - Department name.
 * @returns {Object}
 */
function formatBudgetSummary(budget, departmentName) {
  return {
    id: budget._id,
    department: departmentName,
    fiscalYear: budget.fiscalYear,
    period: budget.period,
    totalBudgeted: budget.totalBudgeted,
    totalActual: budget.totalActual,
    totalCommitted: budget.totalCommitted,
    variance: budget.variance,
    variancePercent: budget.variancePercent,
    utilizationRate: budget.utilizationRate,
    status: budget.status,
    alertLevel:
      budget.utilizationRate >= 100
        ? 'Exceeded'
        : budget.utilizationRate >= (budget.criticalThreshold || 90)
          ? 'Critical'
          : budget.utilizationRate >= (budget.warningThreshold || 75)
            ? 'Warning'
            : 'OnTrack',
  };
}

/**
 * Aggregates line items into a department-level summary.
 *
 * @param {Array} lineItems - Array of DeptBudgetLineItem documents.
 * @returns {{ totalBudgeted: number, totalActual: number, totalCommitted: number, byCategory: Object }}
 */
function aggregateLineItems(lineItems) {
  const summary = {
    totalBudgeted: 0,
    totalActual: 0,
    totalCommitted: 0,
    byCategory: {},
  };

  for (const item of lineItems) {
    summary.totalBudgeted += item.budgetedAmount || 0;
    summary.totalActual += item.actualAmount || 0;
    summary.totalCommitted += item.committedAmount || 0;

    const catId = item.categoryId?.toString() || 'uncategorized';
    if (!summary.byCategory[catId]) {
      summary.byCategory[catId] = {
        budgeted: 0,
        actual: 0,
        committed: 0,
      };
    }
    summary.byCategory[catId].budgeted += item.budgetedAmount || 0;
    summary.byCategory[catId].actual += item.actualAmount || 0;
    summary.byCategory[catId].committed += item.committedAmount || 0;
  }

  return summary;
}

/**
 * Generates a variance report comparing budgeted vs actual across periods.
 *
 * @param {Array} budgets - Array of DeptBudget documents.
 * @returns {Object}
 */
function generateVarianceReport(budgets) {
  const report = {
    totalBudgeted: 0,
    totalActual: 0,
    totalVariance: 0,
    departments: [],
  };

  for (const budget of budgets) {
    const variance = budget.totalBudgeted - budget.totalActual;
    const variancePercent =
      budget.totalBudgeted > 0
        ? Math.round((variance / budget.totalBudgeted) * 10000) / 100
        : 0;

    report.totalBudgeted += budget.totalBudgeted;
    report.totalActual += budget.totalActual;
    report.totalVariance += variance;

    report.departments.push({
      department: budget.department,
      fiscalYear: budget.fiscalYear,
      period: budget.period,
      budgeted: budget.totalBudgeted,
      actual: budget.totalActual,
      variance,
      variancePercent,
      utilizationRate: budget.utilizationRate,
      status: budget.status,
    });
  }

  // Sort by worst utilization first
  report.departments.sort(
    (a, b) => b.utilizationRate - a.utilizationRate,
  );

  return report;
}

module.exports = {
  PERIOD_META,
  VALID_STATUS_TRANSITIONS,
  ALERT_THRESHOLDS,
  calculateVariance,
  calculateYoYChange,
  validateStatusTransition,
  determineAlerts,
  projectEndOfPeriod,
  getFiscalYear,
  getCurrentFiscalPeriod,
  formatBudgetSummary,
  aggregateLineItems,
  generateVarianceReport,
};
