/**
 * @fileoverview Workforce Cost Forecasting Controller
 *
 * Projects total compensation costs forward with configurable assumptions:
 *   - Headcount projections based on hiring plans and attrition rates
 *   - Salary revision scenarios (uniform %, department-wise, performance-based)
 *   - Statutory contribution projections (PF, ESI, gratuity accrual)
 *   - Monthly/quarterly/annual cost projections
 *   - What-if scenario comparison
 *   - Cost per department, role, and level breakdown
 */

const Employee = require('../models/employee.model');
const SalaryHistory = require('../models/salaryHistory.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────

const PF_RATE = 0.12; // 12% employee + 12% employer
const PF_CEILING = 15000; // ₹15,000 wage ceiling for PF
const ESI_RATE = 0.0075; // 0.75% employee + 3.25% employer (2.25% total)
const ESI_CEILING = 21000; // ₹21,000 wage ceiling for ESI
const GRATUITY_ACCRUAL_RATE = 4.81 / 100; // 15/26/12 monthly accrual
const MONTHS_IN_YEAR = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────

function monthsBetween(a, b) {
  return Math.round(
    Math.abs(new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24 * 30.44),
  );
}

/**
 * Project headcount forward assuming linear attrition and hiring.
 */
function projectHeadcount(currentCount, monthlyHires, annualAttritionRate) {
  const monthlyAttritionRate = annualAttritionRate / 12;
  const months = [];
  let hc = currentCount;
  for (let m = 0; m < 12; m++) {
    const separations = Math.round(hc * monthlyAttritionRate);
    hc = hc - separations + monthlyHires;
    months.push({
      month: m + 1,
      headcount: Math.max(1, hc),
      separations,
      newHires: monthlyHires,
    });
  }
  return months;
}

/**
 * Apply a salary revision to a set of salaries.
 */
function applyRevision(salaries, scenario) {
  if (!scenario || scenario.type === 'none') return salaries;

  return salaries.map((emp) => {
    let hikePercent = 0;

    switch (scenario.type) {
      case 'uniform':
        hikePercent = scenario.uniformPercent || 0;
        break;
      case 'departmentWise':
        hikePercent =
          scenario.departmentHikes?.[emp.department] ||
          scenario.defaultHike ||
          0;
        break;
      case 'performanceBased': {
        // Map performance rating to hike
        const band = scenario.performanceBands?.find(
          (b) => b.rating === emp.performanceRating,
        );
        hikePercent = band ? band.hikePercent : scenario.defaultHike || 0;
        break;
      }
      default:
        hikePercent = scenario.uniformPercent || 0;
    }

    // Apply cap
    if (scenario.maxCapPercent) {
      hikePercent = Math.min(hikePercent, scenario.maxCapPercent);
    }

    const revised = emp.monthlySalary * (1 + hikePercent / 100);
    return { ...emp, revisedMonthlySalary: Math.round(revised), hikePercent };
  });
}

/**
 * Compute statutory contributions for a monthly salary.
 */
function computeStatutory(salary) {
  const pfWage = Math.min(salary, PF_CEILING);
  const pfContribution = Math.round(pfWage * PF_RATE);

  const esiWage = Math.min(salary, ESI_CEILING);
  const esiContribution =
    esiWage <= ESI_CEILING ? Math.round(esiWage * ESI_RATE) : 0;

  const gratuityAccrual = Math.round(salary * GRATUITY_ACCRUAL_RATE);

  return { pfContribution, esiContribution, gratuityAccrual };
}

// ─── Endpoint: Get Forecast ───────────────────────────────────────────────

/**
 * POST /api/workforce-cost-forecast
 *
 * Body:
 *   - months: 1-36 (projection horizon)
 *   - monthlyHires: number of new hires per month
 *   - annualAttritionRate: 0-100 (%)
 *   - salaryRevision: { type, uniformPercent, departmentHikes, maxCapPercent, ... }
 *   - includeStatutory: boolean
 *   - departmentFilter: string[] (optional)
 */
exports.getForecast = async (req, res, next) => {
  try {
    const {
      months = 12,
      monthlyHires = 0,
      annualAttritionRate = 10,
      salaryRevision = null,
      includeStatutory = true,
      departmentFilter = [],
    } = req.body || {};

    const clampedMonths = Math.max(1, Math.min(36, Number(months) || 12));
    const clampedHires = Math.max(0, Math.min(50, Number(monthlyHires) || 0));
    const clampedAttrition = Math.max(
      0,
      Math.min(50, Number(annualAttritionRate) || 10),
    );

    // Fetch current employees
    const empFilter = tenantFilter(req, { isActive: true, deletedAt: null });
    if (departmentFilter.length > 0) {
      empFilter.department = { $in: departmentFilter };
    }

    const employees = await Employee.find(empFilter).select(
      'fullName department role jobLevel monthlySalary joiningDate',
    );

    if (employees.length === 0) {
      return res.status(200).json({
        projection: [],
        summary: { totalCost: 0, totalStatutory: 0, headcount: 0 },
        assumptions: {
          monthlyHires: clampedHires,
          annualAttritionRate: clampedAttrition,
          salaryRevision,
          months: clampedMonths,
        },
      });
    }

    // Apply salary revision to current employees
    const empData = employees.map((e) => ({
      fullName: e.fullName,
      department: e.department || 'Unassigned',
      role: e.role || '',
      jobLevel: e.jobLevel || '',
      monthlySalary: e.monthlySalary,
      joiningDate: e.joiningDate,
    }));

    const revisedEmployees = applyRevision(empData, salaryRevision);

    // Current total monthly payroll
    const currentMonthlyPayroll = revisedEmployees.reduce(
      (s, e) => s + (e.revisedMonthlySalary || e.monthlySalary),
      0,
    );

    // Headcount projection
    const hcProjection = projectHeadcount(
      employees.length,
      clampedHires,
      clampedAttrition,
    );

    // Monthly cost projection
    const projection = [];
    let cumulativeCost = 0;
    let cumulativeStatutory = 0;

    for (let m = 0; m < clampedMonths; m++) {
      const hc = hcProjection[m].headcount;

      // Scale payroll proportionally to headcount changes
      const scale = employees.length > 0 ? hc / employees.length : 1;
      const monthlyPayroll = Math.round(currentMonthlyPayroll * scale);

      // Statutory contributions
      let statutory = {
        pfContribution: 0,
        esiContribution: 0,
        gratuityAccrual: 0,
      };
      if (includeStatutory) {
        const avgSalary = hc > 0 ? monthlyPayroll / hc : 0;
        const perEmployeeStatutory = computeStatutory(avgSalary);
        statutory = {
          pfContribution: Math.round(perEmployeeStatutory.pfContribution * hc),
          esiContribution: Math.round(
            perEmployeeStatutory.esiContribution * hc,
          ),
          gratuityAccrual: Math.round(
            perEmployeeStatutory.gratuityAccrual * hc,
          ),
        };
      }

      const totalStatutory =
        statutory.pfContribution +
        statutory.esiContribution +
        statutory.gratuityAccrual;
      const totalMonthlyCost = monthlyPayroll + totalStatutory;

      cumulativeCost += totalMonthlyCost;
      cumulativeStatutory += totalStatutory;

      projection.push({
        month: m + 1,
        date: new Date(Date.now() + (m + 1) * 30.44 * 86400000)
          .toISOString()
          .slice(0, 7),
        headcount: hc,
        newHires: hcProjection[m].newHires,
        separations: hcProjection[m].separations,
        monthlyPayroll,
        statutory,
        totalStatutory,
        totalMonthlyCost,
        cumulativeCost,
        cumulativeStatutory,
      });
    }

    // Department breakdown
    const deptGroups = {};
    for (const emp of revisedEmployees) {
      if (!deptGroups[emp.department])
        deptGroups[emp.department] = {
          count: 0,
          totalSalary: 0,
          revisedTotalSalary: 0,
        };
      deptGroups[emp.department].count += 1;
      deptGroups[emp.department].totalSalary += emp.monthlySalary;
      deptGroups[emp.department].revisedTotalSalary +=
        emp.revisedMonthlySalary || emp.monthlySalary;
    }

    const departmentBreakdown = Object.entries(deptGroups)
      .map(([department, data]) => ({
        department,
        headcount: data.count,
        currentMonthlyPayroll: data.totalSalary,
        revisedMonthlyPayroll: data.revisedTotalSalary,
        totalHikeCost: data.revisedTotalSalary - data.totalSalary,
      }))
      .sort((a, b) => b.revisedMonthlyPayroll - a.revisedMonthlyPayroll);

    // Role breakdown
    const roleGroups = {};
    for (const emp of revisedEmployees) {
      const role = emp.role || 'Unassigned';
      if (!roleGroups[role]) roleGroups[role] = { count: 0, totalSalary: 0 };
      roleGroups[role].count += 1;
      roleGroups[role].totalSalary +=
        emp.revisedMonthlySalary || emp.monthlySalary;
    }

    const roleBreakdown = Object.entries(roleGroups)
      .map(([role, data]) => ({
        role,
        headcount: data.count,
        monthlyPayroll: data.totalSalary,
      }))
      .sort((a, b) => b.monthlyPayroll - a.monthlyPayroll)
      .slice(0, 20);

    res.status(200).json({
      projection,
      departmentBreakdown,
      roleBreakdown,
      summary: {
        currentMonthlyPayroll,
        projectedAnnualPayroll:
          projection.length > 0
            ? projection[projection.length - 1].cumulativeCost
            : 0,
        projectedAnnualStatutory:
          projection.length > 0
            ? projection[projection.length - 1].cumulativeStatutory
            : 0,
        currentHeadcount: employees.length,
        projectedHeadcount: hcProjection[hcProjection.length - 1].headcount,
        peakHeadcount: Math.max(...hcProjection.map((h) => h.headcount)),
        avgMonthlyCost:
          projection.length > 0
            ? Math.round(
                projection.reduce((s, p) => s + p.totalMonthlyCost, 0) /
                  projection.length,
              )
            : 0,
      },
      assumptions: {
        monthlyHires: clampedHires,
        annualAttritionRate: clampedAttrition,
        salaryRevision: salaryRevision || { type: 'none' },
        includeStatutory,
        months: clampedMonths,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Scenario Comparison ────────────────────────────────────────

/**
 * POST /api/workforce-cost-forecast/compare
 *
 * Compares multiple salary revision scenarios side by side.
 *
 * Body:
 *   - scenarios: Array of { name, type, uniformPercent, ... }
 *   - months: projection horizon
 *   - monthlyHires, annualAttritionRate
 */
exports.compareScenarios = async (req, res, next) => {
  try {
    const {
      scenarios = [],
      months = 12,
      monthlyHires = 0,
      annualAttritionRate = 10,
    } = req.body || {};

    if (scenarios.length === 0) {
      return res
        .status(400)
        .json({ message: 'At least one scenario is required' });
    }

    const clampedMonths = Math.max(1, Math.min(36, Number(months) || 12));
    const clampedHires = Math.max(0, Math.min(50, Number(monthlyHires) || 0));
    const clampedAttrition = Math.max(
      0,
      Math.min(50, Number(annualAttritionRate) || 10),
    );

    const employees = await Employee.find(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    ).select('fullName department role jobLevel monthlySalary joiningDate');

    if (employees.length === 0) {
      return res.status(200).json({ comparisons: [], baseline: null });
    }

    const empData = employees.map((e) => ({
      fullName: e.fullName,
      department: e.department || 'Unassigned',
      role: e.role || '',
      jobLevel: e.jobLevel || '',
      monthlySalary: e.monthlySalary,
      joiningDate: e.joiningDate,
    }));

    // Baseline (no revision)
    const baseRevised = applyRevision(empData, { type: 'none' });
    const basePayroll = baseRevised.reduce((s, e) => s + e.monthlySalary, 0);
    const hcProjection = projectHeadcount(
      employees.length,
      clampedHires,
      clampedAttrition,
    );

    // Build baseline projection
    const baselineProjection = [];
    let baseCumulative = 0;
    for (let m = 0; m < clampedMonths; m++) {
      const hc = hcProjection[m].headcount;
      const scale = employees.length > 0 ? hc / employees.length : 1;
      const monthlyPayroll = Math.round(basePayroll * scale);
      baseCumulative += monthlyPayroll;
      baselineProjection.push({
        month: m + 1,
        monthlyPayroll,
        cumulativeCost: baseCumulative,
        headcount: hc,
      });
    }

    // Compare each scenario
    const comparisons = scenarios.map((scenario) => {
      const revised = applyRevision(empData, scenario);
      const revisedPayroll = revised.reduce(
        (s, e) => s + (e.revisedMonthlySalary || e.monthlySalary),
        0,
      );
      const totalHikeCost = revisedPayroll - basePayroll;

      const projection = [];
      let cumulative = 0;
      for (let m = 0; m < clampedMonths; m++) {
        const hc = hcProjection[m].headcount;
        const scale = employees.length > 0 ? hc / employees.length : 1;
        const monthlyPayroll = Math.round(revisedPayroll * scale);
        cumulative += monthlyPayroll;
        projection.push({
          month: m + 1,
          monthlyPayroll,
          cumulativeCost: cumulative,
          headcount: hc,
        });
      }

      const finalMonth = projection[projection.length - 1] || {
        cumulativeCost: 0,
      };
      const baseFinal = baselineProjection[baselineProjection.length - 1] || {
        cumulativeCost: 0,
      };

      return {
        name: scenario.name || 'Untitled Scenario',
        type: scenario.type,
        currentMonthlyHike: totalHikeCost,
        projectedAnnualIncrement:
          finalMonth.cumulativeCost - baseFinal.cumulativeCost,
        projectedAnnualTotal: finalMonth.cumulativeCost,
        avgHikePercent:
          empData.length > 0
            ? Math.round(
                (revised.reduce((s, e) => s + (e.hikePercent || 0), 0) /
                  empData.length) *
                  100,
              ) / 100
            : 0,
        headcountAtEnd: hcProjection[hcProjection.length - 1].headcount,
        projection,
      };
    });

    res.status(200).json({
      baseline: {
        monthlyPayroll: basePayroll,
        annualProjected:
          baselineProjection[baselineProjection.length - 1]?.cumulativeCost ||
          0,
        headcount: employees.length,
      },
      comparisons,
      assumptions: {
        months: clampedMonths,
        monthlyHires: clampedHires,
        annualAttritionRate: clampedAttrition,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Endpoint: Quick Summary ──────────────────────────────────────────────

/**
 * GET /api/workforce-cost-forecast/summary
 *
 * Quick summary of current workforce cost with no projection.
 */
exports.getCostSummary = async (req, res, next) => {
  try {
    const employees = await Employee.find(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    ).select('department role jobLevel monthlySalary');

    if (employees.length === 0) {
      return res
        .status(200)
        .json({
          summary: { headcount: 0, totalMonthlyPayroll: 0, avgSalary: 0 },
        });
    }

    const totalMonthlyPayroll = employees.reduce(
      (s, e) => s + e.monthlySalary,
      0,
    );
    const salaries = employees
      .map((e) => e.monthlySalary)
      .sort((a, b) => a - b);
    const avgSalary = Math.round(totalMonthlyPayroll / employees.length);
    const medianSalary = salaries[Math.floor(salaries.length / 2)];

    // Statutory estimates
    const avgStatutory = computeStatutory(avgSalary);
    const totalStatutory = {
      pf: Math.round(avgStatutory.pfContribution * employees.length),
      esi: Math.round(avgStatutory.esiContribution * employees.length),
      gratuity: Math.round(avgStatutory.gratuityAccrual * employees.length),
    };

    // Department totals
    const deptTotals = {};
    for (const emp of employees) {
      const dept = emp.department || 'Unassigned';
      if (!deptTotals[dept]) deptTotals[dept] = { count: 0, total: 0 };
      deptTotals[dept].count += 1;
      deptTotals[dept].total += emp.monthlySalary;
    }

    const departmentCosts = Object.entries(deptTotals)
      .map(([department, data]) => ({
        department,
        headcount: data.count,
        monthlyPayroll: data.total,
        percentage: Math.round((data.total / totalMonthlyPayroll) * 100),
      }))
      .sort((a, b) => b.monthlyPayroll - a.monthlyPayroll);

    res.status(200).json({
      summary: {
        headcount: employees.length,
        totalMonthlyPayroll,
        totalAnnualPayroll: totalMonthlyPayroll * 12,
        avgSalary,
        medianSalary,
        minSalary: salaries[0],
        maxSalary: salaries[salaries.length - 1],
        statutory: totalStatutory,
        totalCostWithStatutory:
          totalMonthlyPayroll +
          totalStatutory.pf +
          totalStatutory.esi +
          totalStatutory.gratuity,
      },
      departmentCosts,
    });
  } catch (error) {
    next(error);
  }
};
