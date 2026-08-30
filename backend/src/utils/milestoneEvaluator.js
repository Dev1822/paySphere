/**
 * @fileoverview Milestone Evaluator — pure computation engine
 * @description Determines which employees qualify for service milestone
 * achievements based on their joining dates and the tenant's milestone tier
 * configuration.  No I/O; callers are responsible for reading/writing models.
 *
 * Separated from the controller so the evaluation logic can be unit-tested
 * without mocking Mongoose or Express.
 */

/**
 * Compute the completed years of service for an employee as of a given date.
 *
 * A year of service is completed on the anniversary of joining — not after
 * 365 days.  An employee who joined on 1 March 2023 has completed 1 year on
 * 1 March 2024, regardless of leap years.
 *
 * @param {Date|string} joiningDate
 * @param {Date|string} [asOf] — defaults to today
 * @returns {number} completed years (0 if joined less than 1 year ago)
 */
function completedYearsOfService(joiningDate, asOf) {
  const joined = new Date(joiningDate);
  const now = asOf ? new Date(asOf) : new Date();

  if (Number.isNaN(joined.getTime())) return 0;

  let years = now.getFullYear() - joined.getFullYear();
  const monthDiff = now.getMonth() - joined.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < joined.getDate())) {
    years -= 1;
  }

  return Math.max(0, years);
}

/**
 * Find the milestone tier that matches a given year-of-service value.
 *
 * Returns the first tier whose `yearsOfService` equals `years`, or `null` if
 * no tier matches.  Only active tiers are considered.
 *
 * @param {Array} tiers — array of tier objects from MilestoneConfig
 * @param {number} years
 * @returns {object|null}
 */
function findMatchingTier(tiers, years) {
  if (!Array.isArray(tiers)) return null;
  return tiers.find((t) => t.isActive && t.yearsOfService === years) || null;
}

/**
 * Evaluate a single employee against a tenant's milestone config.
 *
 * @param {object} employee — must have `joiningDate` (Date)
 * @param {object} config — MilestoneConfig document (or plain object with tiers)
 * @param {Date|string} [asOf] — evaluation date, defaults to today
 * @returns {{
 *   qualifies: boolean,
 *   yearsOfService: number,
 *   matchedTier: object|null,
 *   milestoneYear: number|null,
 * }}
 */
function evaluateEmployee(employee, config, asOf) {
  if (!employee?.joiningDate || !config?.tiers?.length) {
    return {
      qualifies: false,
      yearsOfService: 0,
      matchedTier: null,
      milestoneYear: null,
    };
  }

  if (!config.isEnabled) {
    return {
      qualifies: false,
      yearsOfService: 0,
      matchedTier: null,
      milestoneYear: null,
    };
  }

  const years = completedYearsOfService(employee.joiningDate, asOf);
  if (years <= 0 || years > (config.maxEvaluationYears || 30)) {
    return {
      qualifies: false,
      yearsOfService: years,
      matchedTier: null,
      milestoneYear: null,
    };
  }

  const tier = findMatchingTier(config.tiers, years);
  if (!tier) {
    return {
      qualifies: false,
      yearsOfService: years,
      matchedTier: null,
      milestoneYear: null,
    };
  }

  return {
    qualifies: true,
    yearsOfService: years,
    matchedTier: tier,
    milestoneYear: years,
  };
}

/**
 * Run a batch evaluation across a list of employees.
 *
 * @param {Array} employees — array of employee objects with `joiningDate`
 * @param {object} config — MilestoneConfig document
 * @param {Set<string>} existingAchievementKeys — Set of "employeeId:yearsAchieved"
 *   strings for already-recorded milestones (to avoid duplicates)
 * @param {Date|string} [asOf] — evaluation date
 * @returns {{
 *   evaluated: number,
 *   detected: Array<{employeeId: string, yearsOfService: number, tier: object}>,
 *   skipped: number,
 * }}
 */
function batchEvaluate(employees, config, existingAchievementKeys, asOf) {
  const detected = [];
  let skipped = 0;

  for (const emp of employees) {
    const result = evaluateEmployee(emp, config, asOf);

    if (!result.qualifies || !result.matchedTier) {
      continue;
    }

    const key = `${emp._id}:${result.yearsAchieved || result.yearsOfService}`;
    if (existingAchievementKeys.has(key)) {
      skipped += 1;
      continue;
    }

    detected.push({
      employeeId: emp._id,
      employeeName: emp.fullName || 'Unknown',
      joiningDate: emp.joiningDate,
      department: emp.department || '',
      yearsOfService: result.yearsOfService,
      tier: result.matchedTier,
    });
  }

  return {
    evaluated: employees.length,
    detected,
    skipped,
  };
}

/**
 * Determine which milestones are approaching within a given horizon.
 *
 * Useful for the "upcoming milestones" dashboard widget and for sending
 * advance-notice notifications to HR/managers.
 *
 * @param {Array} employees
 * @param {object} config
 * @param {number} horizonDays — how many days ahead to look
 * @param {Date|string} [asOf]
 * @returns {Array<{employeeId, employeeName, department, milestoneDate, yearsOfService, tier}>}
 */
function upcomingMilestones(employees, config, horizonDays, asOf) {
  const now = asOf ? new Date(asOf) : new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + horizonDays);

  const upcoming = [];

  for (const emp of employees) {
    if (!emp.joiningDate || !config?.tiers?.length || !config.isEnabled)
      continue;

    const joined = new Date(emp.joiningDate);

    for (const tier of config.tiers) {
      if (!tier.isActive) continue;

      // Compute the next anniversary date for this tier's year
      const anniversary = new Date(joined);
      anniversary.setFullYear(joined.getFullYear() + tier.yearsOfService);

      // Shift to the current year if it's in the past
      while (anniversary < now) {
        anniversary.setFullYear(anniversary.getFullYear() + 1);
      }

      if (anniversary >= now && anniversary <= horizon) {
        upcoming.push({
          employeeId: emp._id,
          employeeName: emp.fullName || 'Unknown',
          department: emp.department || '',
          joiningDate: emp.joiningDate,
          milestoneDate: new Date(anniversary),
          yearsOfService: tier.yearsOfService,
          tier: tier,
        });
      }
    }
  }

  // Sort by milestone date ascending
  upcoming.sort((a, b) => a.milestoneDate - b.milestoneDate);

  return upcoming;
}

/**
 * Generate a human-readable milestone message for announcements.
 *
 * @param {string} employeeName
 * @param {number} years
 * @param {object} tier
 * @returns {string}
 */
function formatMilestoneMessage(employeeName, years, tier) {
  const yearWord = years === 1 ? 'year' : 'years';
  const rewardNote =
    tier.reward?.type === 'Cash'
      ? ` with a reward of ₹${tier.reward.cashAmount.toLocaleString()}`
      : tier.reward?.type === 'ExtraLeave'
        ? ` with ${tier.reward.extraLeaveDays} extra leave day${tier.reward.extraLeaveDays !== 1 ? 's' : ''}`
        : '';

  return (
    `${employeeName} has completed ${years} ${yearWord} of service! 🎉 ` +
    `Celebrating with the "${tier.label}" milestone${rewardNote}. ` +
    `Thank you for your dedication!`
  );
}

module.exports = {
  completedYearsOfService,
  findMatchingTier,
  evaluateEmployee,
  batchEvaluate,
  upcomingMilestones,
  formatMilestoneMessage,
};
