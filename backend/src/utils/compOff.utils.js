/**
 * @fileoverview Comp-Off Utility Functions
 * @description Helpers for calculating eligibility, validating requests,
 *   computing expiry dates, and determining accrual amounts.
 */

/**
 * Work types that earn comp-off and their metadata.
 */
const WORK_TYPE_META = {
  weekend: {
    label: 'Weekend Work',
    description: 'Working on a Saturday or Sunday',
    defaultHours: 8,
  },
  publicHoliday: {
    label: 'Public Holiday',
    description: 'Working on a gazetted public holiday',
    defaultHours: 8,
  },
  restrictedHoliday: {
    label: 'Restricted Holiday',
    description: 'Working on a restricted holiday',
    defaultHours: 8,
  },
  nightShift: {
    label: 'Night Shift',
    description: 'Working a designated night shift',
    defaultHours: 8,
  },
  overtime: {
    label: 'Overtime',
    description: 'Approved overtime hours beyond regular schedule',
    defaultHours: 4,
  },
};

/**
 * Calculates the number of comp-off days earned based on hours worked
 * and policy rules.
 *
 * @param {string} workType - The type of work performed
 * @param {number} hoursWorked - Hours the employee worked
 * @param {Array} accrualRules - Policy accrual rules array
 * @returns {{ daysEarned: number, hoursEarned: number, matched: boolean }}
 */
function calculateDaysEarned(workType, hoursWorked, accrualRules) {
  const rule = accrualRules.find((r) => r.workType === workType);
  if (!rule) {
    return { daysEarned: 0, hoursEarned: 0, matched: false };
  }

  const hoursPerDay = rule.hoursPerDay;
  const daysEarned = Math.min(Math.floor(hoursWorked / hoursPerDay * 10) / 10, 2);

  return {
    daysEarned: Math.max(0.5, daysEarned),
    hoursEarned: Math.min(hoursWorked, hoursPerDay * daysEarned),
    matched: true,
  };
}

/**
 * Computes the expiry date for a comp-off accrual based on policy.
 *
 * @param {Date} workDate - Date the work was performed
 * @param {number} expiryDays - Number of days until expiry from policy
 * @returns {Date}
 */
function computeExpiryDate(workDate, expiryDays) {
  const expiry = new Date(workDate);
  expiry.setDate(expiry.getDate() + expiryDays);
  return expiry;
}

/**
 * Validates whether an employee is eligible to request comp-off.
 *
 * @param {Object} params
 * @param {Date} params.workDate - Date the work was performed
 * @param {Date} params.compOffDate - Requested comp-off date
 * @param {number} params.minAdvanceNoticeDays - Min days in advance
 * @param {number} params.currentBalance - Employee's current comp-off balance
 * @param {number} params.maxBalance - Max allowed comp-off balance
 * @param {number} params.maxAccrualPerMonth - Max comp-off accruals per month
 * @param {number} params.monthAccrualsSoFar - Accruals in current month
 * @returns {{ eligible: boolean, reason: string }}
 */
function validateEligibility({
  workDate,
  compOffDate,
  minAdvanceNoticeDays,
  currentBalance,
  maxBalance,
  maxAccrualPerMonth,
  monthAccrualsSoFar,
}) {
  const now = new Date();

  // Work date cannot be in the future
  if (workDate > now) {
    return {
      eligible: false,
      reason: 'Work date cannot be in the future',
    };
  }

  // Comp-off date must be in the future
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const compOffDay = new Date(
    compOffDate.getFullYear(),
    compOffDate.getMonth(),
    compOffDate.getDate(),
  );
  if (compOffDay <= today) {
    return {
      eligible: false,
      reason: 'Comp-off date must be in the future',
    };
  }

  // Advance notice check
  const daysUntilCompOff = Math.ceil(
    (compOffDay - today) / (1000 * 60 * 60 * 24),
  );
  if (daysUntilCompOff < minAdvanceNoticeDays) {
    return {
      eligible: false,
      reason: `Comp-off must be requested at least ${minAdvanceNoticeDays} day(s) in advance`,
    };
  }

  // Balance cap check
  if (currentBalance >= maxBalance) {
    return {
      eligible: false,
      reason: `Comp-off balance is at the maximum of ${maxBalance} days`,
    };
  }

  // Monthly accrual cap check
  if (monthAccrualsSoFar >= maxAccrualPerMonth) {
    return {
      eligible: false,
      reason: `Monthly comp-off accrual limit of ${maxAccrualPerMonth} reached`,
    };
  }

  // Work date cannot be too old (more than 7 days ago)
  const daysSinceWork = Math.ceil(
    (now - workDate) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceWork > 7) {
    return {
      eligible: false,
      reason: 'Comp-off request must be submitted within 7 days of the work date',
    };
  }

  return { eligible: true, reason: '' };
}

/**
 * Validates a comp-off cancellation request.
 *
 * @param {Object} request - The CompOffRequest document
 * @param {string} userId - The user requesting cancellation
 * @param {boolean} isAdmin - Whether the user is an admin
 * @returns {{ canCancel: boolean, reason: string }}
 */
function validateCancellation(request, userId, isAdmin) {
  if (request.status === 'cancelled') {
    return { canCancel: false, reason: 'Request is already cancelled' };
  }

  if (request.status === 'expired') {
    return { canCancel: false, reason: 'Cannot cancel an expired request' };
  }

  if (
    request.status === 'approved' &&
    !isAdmin &&
    request.employeeId.toString() !== userId
  ) {
    return {
      canCancel: false,
      reason: 'Only the employee or an admin can cancel an approved request',
    };
  }

  if (request.status === 'approved') {
    const now = new Date();
    const compOffDay = new Date(
      request.compOffDate.getFullYear(),
      request.compOffDate.getMonth(),
      request.compOffDate.getDate(),
    );
    if (compOffDay < now) {
      return {
        canCancel: false,
        reason: 'Cannot cancel a comp-off that has already been taken',
      };
    }
  }

  return { canCancel: true, reason: '' };
}

/**
 * Formats a comp-off request summary for notifications or display.
 *
 * @param {Object} request - The CompOffRequest document
 * @param {string} employeeName - Name of the employee
 * @returns {Object}
 */
function formatRequestSummary(request, employeeName) {
  return {
    id: request._id,
    employee: employeeName,
    workDate: request.workDate,
    compOffDate: request.compOffDate,
    daysEarned: request.daysEarned,
    workType: WORK_TYPE_META[request.workType]?.label || request.workType,
    status: request.status,
    reason: request.reason,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  };
}

/**
 * Generates monthly comp-off expiry schedule.
 * Returns all comp-off requests that will expire in a given month.
 *
 * @param {Array} requests - Array of CompOffRequest documents
 * @param {number} year - Year
 * @param {number} month - Month (0-indexed)
 * @returns {Array} Requests expiring in the given month
 */
function getExpiringInMonth(requests, year, month) {
  return requests.filter((req) => {
    if (req.status !== 'approved' && req.status !== 'pending') return false;
    const exp = new Date(req.expiresAt);
    return exp.getFullYear() === year && exp.getMonth() === month;
  });
}

/**
 * Calculates comp-off statistics for an employee.
 *
 * @param {Array} requests - Array of CompOffRequest documents
 * @returns {Object}
 */
function calculateStats(requests) {
  const stats = {
    total: requests.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    expired: 0,
    totalDaysEarned: 0,
    totalDaysUsed: 0,
  };

  for (const req of requests) {
    stats[req.status] = (stats[req.status] || 0) + 1;
    stats.totalDaysEarned += req.daysEarned || 0;
    if (req.status === 'approved' && req.compOffDate <= new Date()) {
      stats.totalDaysUsed += req.daysEarned || 0;
    }
  }

  return stats;
}

module.exports = {
  WORK_TYPE_META,
  calculateDaysEarned,
  computeExpiryDate,
  validateEligibility,
  validateCancellation,
  formatRequestSummary,
  getExpiringInMonth,
  calculateStats,
};
