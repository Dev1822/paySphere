/**
 * @fileoverview Salary Revision Simulator Utility Functions
 * @description Helpers for hike calculation, statutory impact, statistical
 *   analysis, scenario comparison, and revision validation.
 */

/**
 * Scenario type metadata.
 */
const SCENARIO_TYPES = {
  UniformPercent: {
    label: 'Uniform Percentage',
    description: 'Apply the same hike percentage to all employees',
  },
  DepartmentWise: {
    label: 'Department-Wise',
    description: 'Different hike percentages per department',
  },
  PerformanceBased: {
    label: 'Performance-Based',
    description: 'Hike based on performance rating bands',
  },
  MarketAdjustment: {
    label: 'Market Adjustment',
    description: 'Adjust salaries based on market benchmarks',
  },
  Custom: {
    label: 'Custom',
    description: 'Manually specify each employee\'s revision',
  },
};

/**
 * Indian statutory contribution rates.
 */
const STATUTORY_RATES = {
  employerPF: 0.12, // 12% of basic
  employeePF: 0.12,
  employerESI: 0.0325, // 3.25% of gross (if eligible)
  employeeESI: 0.0075,
  esiWageCeiling: 21000,
  pfWageCeiling: 15000,
  gratuityWageRatio: 15 / 26, // 15 days per 26 working days
};

/**
 * Valid status transitions for revision scenarios.
 */
const VALID_SCENARIO_TRANSITIONS = {
  Draft: ['Simulated', 'Submitted'],
  Simulated: ['Submitted', 'Draft'],
  Submitted: ['Approved', 'Rejected'],
  Approved: ['Applied'],
  Rejected: ['Draft'],
  Applied: [],
};

/**
 * Calculates the revised salary and hike details for an employee.
 *
 * @param {number} currentSalary - Current monthly salary.
 * @param {number} hikePercent - Hike percentage to apply.
 * @param {number} [capPercent] - Maximum hike cap percentage.
 * @returns {{ revisedSalary: number, hikeAmount: number, cappedHikePercent: number }}
 */
function calculateRevision(currentSalary, hikePercent, capPercent) {
  let effectiveHikePercent = hikePercent;

  // Apply cap if specified
  if (capPercent && capPercent > 0 && hikePercent > capPercent) {
    effectiveHikePercent = capPercent;
  }

  const hikeAmount = Math.round((currentSalary * effectiveHikePercent) / 100 * 100) / 100;
  const revisedSalary = Math.round((currentSalary + hikeAmount) * 100) / 100;

  return {
    revisedSalary,
    hikeAmount,
    cappedHikePercent: effectiveHikePercent,
  };
}

/**
 * Calculates the statutory contribution impact of a salary revision.
 *
 * @param {number} currentBasic - Current basic salary.
 * @param {number} revisedBasic - Revised basic salary.
 * @param {number} currentGross - Current gross salary.
 * @param {number} revisedGross - Revised gross salary.
 * @returns {{ pfImpact: number, esiImpact: number, gratuityImpact: number, total: number }}
 */
function calculateStatutoryImpact(
  currentBasic,
  revisedBasic,
  currentGross,
  revisedGross,
) {
  // PF impact (employer share)
  const currentPF = Math.min(currentBasic, STATUTORY_RATES.pfWageCeiling) * STATUTORY_RATES.employerPF;
  const revisedPF = Math.min(revisedBasic, STATUTORY_RATES.pfWageCeiling) * STATUTORY_RATES.employerPF;
  const pfImpact = Math.round((revisedPF - currentPF) * 100) / 100;

  // ESI impact (if applicable)
  let esiImpact = 0;
  if (currentGross <= STATUTORY_RATES.esiWageCeiling || revisedGross <= STATUTORY_RATES.esiWageCeiling) {
    const currentESI = Math.min(currentGross, STATUTORY_RATES.esiWageCeiling) * STATUTORY_RATES.employerESI;
    const revisedESI = Math.min(revisedGross, STATUTORY_RATES.esiWageCeiling) * STATUTORY_RATES.employerESI;
    esiImpact = Math.round((revisedESI - currentESI) * 100) / 100;
  }

  // Gratuity impact (annual provision)
  const currentGratuity = currentBasic * STATUTORY_RATES.gratuityWageRatio * 12;
  const revisedGratuity = revisedBasic * STATUTORY_RATES.gratuityWageRatio * 12;
  const gratuityImpact = Math.round((revisedGratuity - currentGratuity) * 100) / 100;

  const total = Math.round((pfImpact + esiImpact + gratuityImpact) * 100) / 100;

  return { pfImpact, esiImpact, gratuityImpact, total };
}

/**
 * Computes statistical summary for an array of hike percentages.
 *
 * @param {number[]} hikes - Array of hike percentages.
 * @returns {{ mean: number, median: number, min: number, max: number, stddev: number, count: number }}
 */
function computeHikeStatistics(hikes) {
  if (hikes.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stddev: 0, count: 0 };
  }

  const sorted = [...hikes].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mean = Math.round((sum / count) * 100) / 100;

  // Median
  const mid = Math.floor(count / 2);
  const median =
    count % 2 === 0
      ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
      : sorted[mid];

  // Standard deviation
  const variance =
    sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / count;
  const stddev = Math.round(Math.sqrt(variance) * 100) / 100;

  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[count - 1],
    stddev,
    count,
  };
}

/**
 * Groups employees by department and computes per-department statistics.
 *
 * @param {Array} items - Array of revision line items with department and hikePercent.
 * @returns {Object} Department-keyed statistics.
 */
function groupByDepartment(items) {
  const groups = {};

  for (const item of items) {
    const dept = item.department || 'Unknown';
    if (!groups[dept]) {
      groups[dept] = { count: 0, totalHike: 0, totalIncrement: 0, salaries: [] };
    }
    groups[dept].count++;
    groups[dept].totalHike += item.hikePercent || 0;
    groups[dept].totalIncrement += item.hikeAmount || 0;
    groups[dept].salaries.push(item.currentMonthlySalary || 0);
  }

  return Object.entries(groups).map(([department, data]) => ({
    department,
    count: data.count,
    avgHike: Math.round((data.totalHike / data.count) * 100) / 100,
    totalIncrement: Math.round(data.totalIncrement * 100) / 100,
    avgSalary: Math.round(
      (data.salaries.reduce((s, v) => s + v, 0) / data.count) * 100,
    ) / 100,
  }));
}

/**
 * Groups employees by level and computes per-level statistics.
 *
 * @param {Array} items - Array of revision line items with level and hikePercent.
 * @returns {Object} Level-keyed statistics.
 */
function groupByLevel(items) {
  const groups = {};

  for (const item of items) {
    const level = item.level || 'Ungraded';
    if (!groups[level]) {
      groups[level] = { count: 0, totalHike: 0, totalIncrement: 0 };
    }
    groups[level].count++;
    groups[level].totalHike += item.hikePercent || 0;
    groups[level].totalIncrement += item.hikeAmount || 0;
  }

  return Object.entries(groups).map(([level, data]) => ({
    level,
    count: data.count,
    avgHike: Math.round((data.totalHike / data.count) * 100) / 100,
    totalIncrement: Math.round(data.totalIncrement * 100) / 100,
  }));
}

/**
 * Validates a scenario status transition.
 *
 * @param {string} currentStatus - Current status.
 * @param {string} targetStatus - Desired target status.
 * @returns {{ allowed: boolean, reason: string }}
 */
function validateScenarioTransition(currentStatus, targetStatus) {
  const allowed = VALID_SCENARIO_TRANSITIONS[currentStatus];
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
 * Generates a scenario comparison summary.
 *
 * @param {Array} scenarios - Array of RevisionScenario documents.
 * @returns {Object}
 */
function compareScenarios(scenarios) {
  return {
    count: scenarios.length,
    scenarios: scenarios.map((s) => ({
      id: s._id,
      name: s.name,
      type: s.scenarioType,
      status: s.status,
      totalEmployees: s.totalEmployees,
      averageHike: s.averageHikePercent,
      totalIncrementCost: s.totalIncrementCost,
      annualizedImpact: s.annualizedImpact,
      budgetImpactPercent: s.budgetImpactPercent,
      effectiveDate: s.effectiveDate,
    })),
    bestByCost: scenarios.length > 0
      ? scenarios.reduce((min, s) =>
          (s.totalIncrementCost || Infinity) < (min.totalIncrementCost || Infinity) ? s : min,
        ).name
      : null,
    bestByAverageHike: scenarios.length > 0
      ? scenarios.reduce((max, s) =>
          (s.averageHikePercent || 0) > (max.averageHikePercent || 0) ? s : max,
        ).name
      : null,
  };
}

/**
 * Computes a compa-ratio (salary as a percentage of the midpoint of a pay band).
 *
 * @param {number} salary - Employee's current salary.
 * @param {number} bandMin - Pay band minimum.
 * @param {number} bandMax - Pay band maximum.
 * @returns {number} Compa-ratio as percentage.
 */
function computeCompaRatio(salary, bandMin, bandMax) {
  if (bandMin === 0 && bandMax === 0) return 100;
  const midpoint = (bandMin + bandMax) / 2;
  if (midpoint === 0) return 100;
  return Math.round((salary / midpoint) * 10000) / 100;
}

module.exports = {
  SCENARIO_TYPES,
  STATUTORY_RATES,
  VALID_SCENARIO_TRANSITIONS,
  calculateRevision,
  calculateStatutoryImpact,
  computeHikeStatistics,
  groupByDepartment,
  groupByLevel,
  validateScenarioTransition,
  compareScenarios,
  computeCompaRatio,
};
