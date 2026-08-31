/**
 * @fileoverview Talent Retention Analytics Controller
 *
 * Provides analytics for employee retention and attrition risk:
 *   - Flight risk scoring per employee (composite risk score)
 *   - Attrition trend analysis (monthly/quarterly separations)
 *   - Compensation benchmarking (percentiles by department/role)
 *   - Retention summary dashboard metrics
 *   - Risk factor breakdown (compensation gap, tenure, department trends)
 */

const Employee = require('../models/employee.model');
const SalaryHistory = require('../models/salaryHistory.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Compute months between two dates.
 */
function monthsBetween(a, b) {
  const ms = Math.abs(new Date(b) - new Date(a));
  return Math.round(ms / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * Compute a percentile from a sorted array.
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return Math.round((sorted[lower] * (upper - idx) + sorted[upper] * (idx - lower)) * 100) / 100;
}

/**
 * Compute standard deviation of an array of numbers.
 */
function stdDev(values) {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * Simple flight risk score based on observable signals.
 * Higher score = higher risk of departure.
 *
 * Factors:
 *   - Tenure relative to department average (shorter = higher risk)
 *   - Salary relative to department median (lower = higher risk)
 *   - Time since last salary change (longer = higher risk)
 *   - Salary growth rate (slower = higher risk)
 *   - Whether marked inactive
 */
function computeFlightRiskScore(employee, deptStats, salaryStats) {
  let score = 50; // baseline

  // Factor 1: Tenure (0-25 points)
  const avgTenure = deptStats.avgTenure || 12;
  const tenureRatio = employee.tenureMonths / avgTenure;
  if (tenureRatio < 0.5) score += 15;
  else if (tenureRatio < 0.8) score += 8;
  else if (tenureRatio > 1.5) score -= 10;
  else if (tenureRatio > 1.2) score -= 5;

  // Factor 2: Salary vs department median (0-25 points)
  const deptMedian = deptStats.medianSalary || 0;
  if (deptMedian > 0) {
    const salaryRatio = employee.monthlySalary / deptMedian;
    if (salaryRatio < 0.7) score += 20;
    else if (salaryRatio < 0.85) score += 12;
    else if (salaryRatio < 0.95) score += 5;
    else if (salaryRatio > 1.2) score -= 10;
    else if (salaryRatio > 1.1) score -= 5;
  }

  // Factor 3: Time since last salary change (0-15 points)
  const monthsSinceRaise = salaryStats.monthsSinceLastRaise || 24;
  if (monthsSinceRaise > 24) score += 15;
  else if (monthsSinceRaise > 18) score += 10;
  else if (monthsSinceRaise > 12) score += 5;
  else if (monthsSinceRaise < 6) score -= 5;

  // Factor 4: Annual salary growth rate (0-15 points)
  const annualGrowth = salaryStats.annualGrowthRate || 0;
  if (annualGrowth < 3) score += 12;
  else if (annualGrowth < 6) score += 5;
  else if (annualGrowth > 15) score -= 8;
  else if (annualGrowth > 10) score -= 5;

  // Factor 5: Department attrition rate (0-10 points)
  const deptAttrition = deptStats.attritionRate || 0;
  if (deptAttrition > 20) score += 10;
  else if (deptAttrition > 15) score += 5;
  else if (deptAttrition < 5) score -= 5;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get risk level label from score.
 */
function riskLevel(score) {
  if (score >= 75) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

// ─── Endpoint: Flight Risk Scores ─────────────────────────────────────────

/**
 * GET /api/retention-analytics/flight-risk
 *
 * Returns flight risk scores for all active employees, with factors.
 * Includes department-level aggregates for context.
 */
exports.getFlightRiskScores = async (req, res, next) => {
  try {
    const filter = tenantFilter(req, { isActive: true, deletedAt: null });
    const employees = await Employee.find(filter).select(
      'fullName department role monthlySalary joiningDate employmentStatus jobLevel',
    );

    if (employees.length === 0) {
      return res.status(200).json({ employees: [], departments: [], summary: { total: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 } });
    }

    const now = new Date();

    // Group by department for stats
    const deptGroups = {};
    for (const emp of employees) {
      const dept = emp.department || 'Unassigned';
      if (!deptGroups[dept]) deptGroups[dept] = [];
      deptGroups[dept].push(emp);
    }

    // Compute department-level statistics
    const deptStats = {};
    for (const [dept, members] of Object.entries(deptGroups)) {
      const salaries = members.map((m) => m.monthlySalary).sort((a, b) => a - b);
      const tenures = members.map((m) => monthsBetween(m.joiningDate || now, now));

      deptStats[dept] = {
        avgSalary: salaries.reduce((s, v) => s + v, 0) / salaries.length,
        medianSalary: percentile(salaries, 50),
        avgTenure: tenures.reduce((s, v) => s + v, 0) / tenures.length,
        count: members.length,
        salaryStdDev: stdDev(salaries),
      };
    }

    // Fetch salary history for time-since-last-raise calculations
    const employeeIds = employees.map((e) => e._id);
    const salaryHistories = await SalaryHistory.find({
      tenantId: req.tenantId,
      employeeId: { $in: employeeIds },
    })
      .select('employeeId createdAt newSalary previousSalary')
      .sort({ createdAt: -1 });

    // Group salary history by employee
    const historyByEmployee = {};
    for (const hist of salaryHistories) {
      const empId = hist.employeeId.toString();
      if (!historyByEmployee[empId]) historyByEmployee[empId] = [];
      historyByEmployee[empId].push(hist);
    }

    // Compute risk scores
    const enriched = employees.map((emp) => {
      const dept = emp.department || 'Unassigned';
      const deptStat = deptStats[dept] || { avgTenure: 12, medianSalary: 0, attritionRate: 0 };

      // Salary history for this employee
      const empHistory = historyByEmployee[emp._id.toString()] || [];
      const monthsSinceLastRaise =
        empHistory.length > 0 ? monthsBetween(empHistory[0].createdAt, now) : monthsBetween(emp.joiningDate || now, now);

      // Annual growth rate
      let annualGrowthRate = 0;
      if (empHistory.length >= 2) {
        const oldest = empHistory[empHistory.length - 1];
        const newest = empHistory[0];
        const years = Math.max(monthsBetween(oldest.createdAt, newest.createdAt) / 12, 0.5);
        if (oldest.previousSalary > 0) {
          annualGrowthRate = Math.round(((newest.newSalary / oldest.previousSalary - 1) / years) * 100 * 100) / 100;
        }
      }

      const salaryStats = {
        monthsSinceLastRaise,
        annualGrowthRate,
        totalRaises: empHistory.length,
      };

      const score = computeFlightRiskScore(emp, deptStat, salaryStats);

      return {
        _id: emp._id,
        fullName: emp.fullName,
        department: dept,
        role: emp.role,
        jobLevel: emp.jobLevel,
        monthlySalary: emp.monthlySalary,
        tenureMonths: monthsBetween(emp.joiningDate || now, now),
        joiningDate: emp.joiningDate,
        flightRiskScore: score,
        riskLevel: riskLevel(score),
        factors: {
          tenureVsDeptAvg: Math.round((monthsBetween(emp.joiningDate || now, now) / deptStat.avgTenure) * 100) / 100,
          salaryVsDeptMedian: deptStat.medianSalary > 0 ? Math.round((emp.monthlySalary / deptStat.medianSalary) * 100) / 100 : null,
          monthsSinceLastRaise,
          annualGrowthRate,
        },
      };
    });

    enriched.sort((a, b) => b.flightRiskScore - a.flightRiskScore);

    // Department summary
    const departments = Object.entries(deptStats).map(([name, stats]) => ({
      department: name,
      headcount: stats.count,
      avgSalary: Math.round(stats.avgSalary),
      medianSalary: Math.round(stats.medianSalary),
      avgTenure: Math.round(stats.avgTenure),
      highRiskCount: enriched.filter((e) => e.department === name && e.flightRiskScore >= 60).length,
    }));

    const summary = {
      total: enriched.length,
      criticalRisk: enriched.filter((e) => e.flightRiskScore >= 75).length,
      highRisk: enriched.filter((e) => e.flightRiskScore >= 60 && e.flightRiskScore < 75).length,
      mediumRisk: enriched.filter((e) => e.flightRiskScore >= 40 && e.flightRiskScore < 60).length,
      lowRisk: enriched.filter((e) => e.flightRiskScore < 40).length,
      avgFlightRisk: enriched.length > 0 ? Math.round(enriched.reduce((s, e) => s + e.flightRiskScore, 0) / enriched.length) : 0,
    };

    res.status(200).json({ employees: enriched, departments, summary });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Attrition Trends ───────────────────────────────────────────

/**
 * GET /api/retention-analytics/attrition-trends
 *
 * Monthly attrition data for the last 12 months.
 * Uses inactive employees as a proxy for separations.
 */
exports.getAttritionTrends = async (req, res, next) => {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // All employees (active + inactive) to compute rates
    const allEmployees = await Employee.find(
      tenantFilter(req, { createdAt: { $gte: twelveMonthsAgo } }),
    ).select('department isActive employmentStatus createdAt');

    // Group by month
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      months.push({
        month: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        separations: 0,
        totalHeadcount: 0,
        newHires: 0,
      });
    }

    // Count new hires per month
    for (const emp of allEmployees) {
      if (emp.createdAt) {
        const monthKey = emp.createdAt.toISOString().slice(0, 7);
        const bucket = months.find((m) => m.month === monthKey);
        if (bucket) bucket.newHires += 1;
      }
    }

    // Fetch currently inactive employees as separation proxy
    const inactiveEmployees = await Employee.find(
      tenantFilter(req, { isActive: false }),
    ).select('department updatedAt');

    // Estimate separations per month based on inactive employee updatedAt
    for (const emp of inactiveEmployees) {
      if (emp.updatedAt) {
        const monthKey = emp.updatedAt.toISOString().slice(0, 7);
        const bucket = months.find((m) => m.month === monthKey);
        if (bucket) bucket.separations += 1;
      }
    }

    // Compute running headcount and attrition rate
    const baseHeadcount = await Employee.countDocuments(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    );

    let runningHeadcount = baseHeadcount;
    for (let i = months.length - 1; i >= 0; i--) {
      runningHeadcount = runningHeadcount - months[i].newHires + months[i].separations;
      months[i].totalHeadcount = Math.max(runningHeadcount, 0);
    }

    // Compute attrition rates
    const trend = months.map((m) => ({
      ...m,
      attritionRate:
        m.totalHeadcount > 0
          ? Math.round((m.separations / m.totalHeadcount) * 10000) / 100
          : 0,
    }));

    // Department-level attrition
    const deptAttrition = {};
    for (const emp of inactiveEmployees) {
      const dept = emp.department || 'Unassigned';
      if (!deptAttrition[dept]) deptAttrition[dept] = 0;
      deptAttrition[dept] += 1;
    }

    const departmentBreakdown = Object.entries(deptAttrition)
      .map(([department, separations]) => ({
        department,
        separations,
        rate: 0, // Will be computed relative to department headcount
      }))
      .sort((a, b) => b.separations - a.separations);

    // Get department headcounts for rate calculation
    const activeEmployees = await Employee.find(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    ).select('department');

    const deptCounts = {};
    for (const emp of activeEmployees) {
      const dept = emp.department || 'Unassigned';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    }

    for (const dept of departmentBreakdown) {
      const currentCount = deptCounts[dept.department] || 1;
      dept.rate = Math.round((dept.separations / (dept.separations + currentCount)) * 10000) / 100;
    }

    res.status(200).json({
      trend,
      departmentBreakdown,
      summary: {
        totalSeparations: inactiveEmployees.length,
        totalActive: activeEmployees.length,
        overallAttritionRate:
          activeEmployees.length + inactiveEmployees.length > 0
            ? Math.round(
                (inactiveEmployees.length / (activeEmployees.length + inactiveEmployees.length)) * 10000,
              ) / 100
            : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Compensation Benchmarking ──────────────────────────────────

/**
 * GET /api/retention-analytics/compensation-benchmark
 *
 * Salary distribution analytics with percentile breakdowns by department,
 * role, and job level. Includes compa-ratio analysis.
 */
exports.getCompensationBenchmark = async (req, res, next) => {
  try {
    const employees = await Employee.find(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    ).select('fullName department role jobLevel monthlySalary joiningDate');

    if (employees.length === 0) {
      return res.status(200).json({ overall: null, departments: [], roles: [], levels: [] });
    }

    // Overall distribution
    const allSalaries = employees.map((e) => e.monthlySalary).sort((a, b) => a - b);
    const overall = {
      total: allSalaries.length,
      min: allSalaries[0],
      max: allSalaries[allSalaries.length - 1],
      mean: Math.round(allSalaries.reduce((s, v) => s + v, 0) / allSalaries.length),
      median: percentile(allSalaries, 50),
      p10: percentile(allSalaries, 10),
      p25: percentile(allSalaries, 25),
      p75: percentile(allSalaries, 75),
      p90: percentile(allSalaries, 90),
      stdDev: stdDev(allSalaries),
    };

    // Group by department
    const deptGroups = {};
    for (const emp of employees) {
      const dept = emp.department || 'Unassigned';
      if (!deptGroups[dept]) deptGroups[dept] = [];
      deptGroups[dept].push(emp);
    }

    const departments = Object.entries(deptGroups)
      .map(([name, members]) => {
        const salaries = members.map((m) => m.monthlySalary).sort((a, b) => a - b);
        return {
          department: name,
          count: members.length,
          min: salaries[0],
          max: salaries[salaries.length - 1],
          mean: Math.round(salaries.reduce((s, v) => s + v, 0) / salaries.length),
          median: percentile(salaries, 50),
          p25: percentile(salaries, 25),
          p75: percentile(salaries, 75),
          // Compa-ratio: individual salary / department median
          avgCompaRatio:
            Math.round(
              (members.reduce((s, m) => s + (m.monthlySalary / (percentile(salaries, 50) || 1)), 0) /
                members.length) *
                100,
            ) / 100,
          salarySpread:
            percentile(salaries, 50) > 0
              ? Math.round(((percentile(salaries, 75) - percentile(salaries, 25)) / percentile(salaries, 50)) * 100)
              : 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Group by role
    const roleGroups = {};
    for (const emp of employees) {
      const role = emp.role || 'Unassigned';
      if (!roleGroups[role]) roleGroups[role] = [];
      roleGroups[role].push(emp);
    }

    const roles = Object.entries(roleGroups)
      .map(([name, members]) => {
        const salaries = members.map((m) => m.monthlySalary).sort((a, b) => a - b);
        return {
          role: name,
          count: members.length,
          mean: Math.round(salaries.reduce((s, v) => s + v, 0) / salaries.length),
          median: percentile(salaries, 50),
          min: salaries[0],
          max: salaries[salaries.length - 1],
        };
      })
      .filter((r) => r.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Group by job level
    const levelGroups = {};
    for (const emp of employees) {
      const level = emp.jobLevel || 'Unassigned';
      if (!levelGroups[level]) levelGroups[level] = [];
      levelGroups[level].push(emp);
    }

    const levels = Object.entries(levelGroups)
      .map(([name, members]) => {
        const salaries = members.map((m) => m.monthlySalary).sort((a, b) => a - b);
        return {
          level: name,
          count: members.length,
          mean: Math.round(salaries.reduce((s, v) => s + v, 0) / salaries.length),
          median: percentile(salaries, 50),
          min: salaries[0],
          max: salaries[salaries.length - 1],
        };
      })
      .filter((l) => l.count >= 2)
      .sort((a, b) => a.median - b.median);

    // Salary distribution histogram (for chart)
    const histogramBins = 10;
    const binSize = Math.ceil((allSalaries[allSalaries.length - 1] - allSalaries[0]) / histogramBins) || 1;
    const histogram = [];
    for (let i = 0; i < histogramBins; i++) {
      const binMin = allSalaries[0] + i * binSize;
      const binMax = binMin + binSize;
      const count = allSalaries.filter((s) => s >= binMin && (i === histogramBins - 1 ? s <= binMax : s < binMax)).length;
      histogram.push({
        range: `${Math.round(binMin / 1000)}k-${Math.round(binMax / 1000)}k`,
        min: binMin,
        max: binMax,
        count,
        percentage: Math.round((count / allSalaries.length) * 100),
      });
    }

    res.status(200).json({ overall, departments, roles, levels, histogram });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Retention Dashboard Summary ────────────────────────────────

/**
 * GET /api/retention-analytics/dashboard
 *
 * High-level retention dashboard with key metrics and alerts.
 */
exports.getRetentionDashboard = async (req, res, next) => {
  try {
    const activeEmployees = await Employee.find(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    ).select('fullName department monthlySalary joiningDate');

    const inactiveEmployees = await Employee.find(
      tenantFilter(req, { isActive: false }),
    ).select('department updatedAt');

    const now = new Date();
    const totalHeadcount = activeEmployees.length + inactiveEmployees.length;

    // Average tenure
    const avgTenure =
      activeEmployees.length > 0
        ? Math.round(
            activeEmployees.reduce((s, e) => s + monthsBetween(e.joiningDate || now, now), 0) /
              activeEmployees.length,
          )
        : 0;

    // Tenure distribution
    const tenureBuckets = { '0-6': 0, '6-12': 0, '1-2yr': 0, '2-5yr': 0, '5+yr': 0 };
    for (const emp of activeEmployees) {
      const months = monthsBetween(emp.joiningDate || now, now);
      if (months <= 6) tenureBuckets['0-6'] += 1;
      else if (months <= 12) tenureBuckets['6-12'] += 1;
      else if (months <= 24) tenureBuckets['1-2yr'] += 1;
      else if (months <= 60) tenureBuckets['2-5yr'] += 1;
      else tenureBuckets['5+yr'] += 1;
    }

    // Compensation health
    const salaries = activeEmployees.map((e) => e.monthlySalary).sort((a, b) => a - b);
    const avgSalary = salaries.length > 0 ? Math.round(salaries.reduce((s, v) => s + v, 0) / salaries.length) : 0;
    const medianSalary = percentile(salaries, 50);
    const salaryGap = salaries.length > 0 ? Math.round(salaries[salaries.length - 1] - salaries[0]) : 0;

    // Recent hires (last 90 days)
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentHires = activeEmployees.filter((e) => e.joiningDate && e.joiningDate >= ninetyDaysAgo).length;

    // Recent separations (last 90 days)
    const recentSeparations = inactiveEmployees.filter(
      (e) => e.updatedAt && e.updatedAt >= ninetyDaysAgo,
    ).length;

    // Critical risk alerts
    const employeesWithHistory = activeEmployees.length; // placeholder
    const highRiskDepartments = [];
    const deptGroups = {};
    for (const emp of activeEmployees) {
      const dept = emp.department || 'Unassigned';
      if (!deptGroups[dept]) deptGroups[dept] = [];
      deptGroups[dept].push(emp);
    }

    for (const [dept, members] of Object.entries(deptGroups)) {
      const deptInactive = inactiveEmployees.filter((e) => e.department === dept).length;
      const deptTotal = members.length + deptInactive;
      const deptAttritionRate = deptTotal > 0 ? Math.round((deptInactive / deptTotal) * 10000) / 100 : 0;
      if (deptAttritionRate > 15 || members.length <= 2) {
        highRiskDepartments.push({
          department: dept,
          headcount: members.length,
          attritionRate: deptAttritionRate,
          avgSalary: Math.round(members.reduce((s, m) => s + m.monthlySalary, 0) / members.length),
        });
      }
    }

    // Insights
    const insights = [];
    if (recentHires > 0 && recentSeparations > recentHires) {
      insights.push({
        type: 'warning',
        title: 'Net Headcount Loss',
        description: `More separations (${recentSeparations}) than new hires (${recentHires}) in the last 90 days.`,
      });
    }
    if (avgTenure < 12) {
      insights.push({
        type: 'warning',
        title: 'Low Average Tenure',
        description: `Average tenure is ${avgTenure} months — below the 12-month benchmark.`,
      });
    }
    if (highRiskDepartments.length > 0) {
      insights.push({
        type: 'critical',
        title: 'High-Risk Departments',
        description: `${highRiskDepartments.length} department(s) have elevated attrition risk.`,
      });
    }
    if (recentHires > 0) {
      insights.push({
        type: 'positive',
        title: 'Active Hiring',
        description: `${recentHires} new hire(s) in the last 90 days.`,
      });
    }

    res.status(200).json({
      dashboard: {
        totalHeadcount,
        activeCount: activeEmployees.length,
        separatedCount: inactiveEmployees.length,
        avgTenure,
        avgSalary,
        medianSalary,
        salaryGap,
        recentHires,
        recentSeparations,
        retentionRate:
          totalHeadcount > 0
            ? Math.round((activeEmployees.length / totalHeadcount) * 10000) / 100
            : 0,
      },
      tenureDistribution: Object.entries(tenureBuckets).map(([range, count]) => ({
        range,
        count,
        percentage: activeEmployees.length > 0 ? Math.round((count / activeEmployees.length) * 100) : 0,
      })),
      highRiskDepartments,
      insights,
    });
  } catch (error) {
    next(error);
  }
};
