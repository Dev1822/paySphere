/**
 * @fileoverview Multi-State Labour Welfare Fund (LWF) Engine
 * @description Computes statutory state-specific employee & employer LWF contributions,
 * deduction frequencies (Monthly, Half-Yearly in Jun/Dec, Annual in Dec), and Form A remittance returns.
 * Issue: #2063
 */

const LWF_STATE_RULES = {
  MAHARASHTRA: {
    stateCode: 'MH',
    frequency: 'HALF_YEARLY',
    applicableMonths: [6, 12], // June & December
    slabs: [
      { minGross: 0, maxGross: 3000, employeeShare: 6, employerShare: 18 },
      { minGross: 3001, maxGross: Infinity, employeeShare: 12, employerShare: 36 },
    ],
  },
  GUJARAT: {
    stateCode: 'GJ',
    frequency: 'HALF_YEARLY',
    applicableMonths: [6, 12], // June & December
    slabs: [
      { minGross: 0, maxGross: Infinity, employeeShare: 6, employerShare: 12 },
    ],
  },
  KARNATAKA: {
    stateCode: 'KA',
    frequency: 'ANNUAL',
    applicableMonths: [12], // December Annual
    slabs: [
      { minGross: 0, maxGross: Infinity, employeeShare: 20, employerShare: 40 },
    ],
  },
  TAMIL_NADU: {
    stateCode: 'TN',
    frequency: 'ANNUAL',
    applicableMonths: [12], // December Annual
    slabs: [
      { minGross: 0, maxGross: Infinity, employeeShare: 10, employerShare: 20 },
    ],
  },
  TELANGANA: {
    stateCode: 'TS',
    frequency: 'ANNUAL',
    applicableMonths: [12], // December Annual
    slabs: [
      { minGross: 0, maxGross: Infinity, employeeShare: 30, employerShare: 70 },
    ],
  },
};

/**
 * Checks if LWF deduction is triggered in the given payroll month.
 */
function isLwfApplicableMonth(state = 'MAHARASHTRA', monthIndex = 1) {
  const normState = String(state || 'MAHARASHTRA').trim().toUpperCase().replace(/\s+/g, '_');
  const month = Math.max(1, Math.min(12, Number(monthIndex) || 1));
  const config = LWF_STATE_RULES[normState];

  if (!config) return false;
  return config.applicableMonths.includes(month);
}

/**
 * Computes statutory LWF employee deduction and matching employer contribution.
 *
 * @param {string} state - Indian State
 * @param {number} monthlyGrossSalary - Employee monthly gross wage
 * @param {number} monthIndex - Month number (1 to 12)
 * @returns {{ state: string, monthIndex: number, isApplicable: boolean, employeeContribution: number, employerContribution: number, totalLwfRemittance: number, ruleApplied: string }}
 */
function computeLwfDeduction(state = 'MAHARASHTRA', monthlyGrossSalary = 0, monthIndex = 6) {
  const normState = String(state || 'MAHARASHTRA').trim().toUpperCase().replace(/\s+/g, '_');
  const gross = Math.max(0, Number(monthlyGrossSalary) || 0);
  const month = Math.max(1, Math.min(12, Number(monthIndex) || 6));

  const config = LWF_STATE_RULES[normState];

  if (!config) {
    return {
      state: normState,
      monthIndex: month,
      isApplicable: false,
      employeeContribution: 0,
      employerContribution: 0,
      totalLwfRemittance: 0,
      ruleApplied: 'No statutory LWF Act applicable for this state/union territory',
    };
  }

  if (!config.applicableMonths.includes(month)) {
    return {
      state: normState,
      monthIndex: month,
      isApplicable: false,
      employeeContribution: 0,
      employerContribution: 0,
      totalLwfRemittance: 0,
      ruleApplied: `LWF deduction not scheduled for month ${month} (${config.frequency} frequency)`,
    };
  }

  let employeeShare = 0;
  let employerShare = 0;

  for (const slab of config.slabs) {
    if (gross >= slab.minGross && gross <= slab.maxGross) {
      employeeShare = slab.employeeShare;
      employerShare = slab.employerShare;
      break;
    }
  }

  const totalLwfRemittance = Math.round((employeeShare + employerShare) * 100) / 100;

  return {
    state: normState,
    monthIndex: month,
    isApplicable: true,
    employeeContribution: employeeShare,
    employerContribution: employerShare,
    totalLwfRemittance,
    ruleApplied: `Statutory ${config.frequency} LWF: Employee ₹${employeeShare} + Employer ₹${employerShare}`,
  };
}

/**
 * Aggregates Form A statutory LWF remittance report across organization.
 */
function generateFormARemittanceSummary(employeeRecords = [], state = 'MAHARASHTRA', monthIndex = 6) {
  let totalEmployees = 0;
  let totalEmployeeDeductions = 0;
  let totalEmployerContributions = 0;
  let totalRemittanceDue = 0;

  const itemizedList = [];

  for (const emp of employeeRecords) {
    const gross = emp.grossSalary || emp.monthlyGross || 30000;
    const calc = computeLwfDeduction(state, gross, monthIndex);

    totalEmployees += 1;
    totalEmployeeDeductions += calc.employeeContribution;
    totalEmployerContributions += calc.employerContribution;
    totalRemittanceDue += calc.totalLwfRemittance;

    itemizedList.push({
      employeeId: emp.id || emp.employeeId || `EMP-${totalEmployees}`,
      name: emp.name || emp.fullName || 'Employee',
      monthlyGross: gross,
      ...calc,
    });
  }

  return {
    state: String(state).toUpperCase(),
    payrollMonth: monthIndex,
    totalEmployees,
    totalEmployeeDeductions: Math.round(totalEmployeeDeductions * 100) / 100,
    totalEmployerContributions: Math.round(totalEmployerContributions * 100) / 100,
    totalRemittanceDue: Math.round(totalRemittanceDue * 100) / 100,
    itemizedList,
  };
}

module.exports = {
  LWF_STATE_RULES,
  isLwfApplicableMonth,
  computeLwfDeduction,
  generateFormARemittanceSummary,
};
