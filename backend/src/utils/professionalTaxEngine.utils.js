/**
 * @fileoverview Multi-State Professional Tax (PT) Slab & Statutory February Surcharge Engine
 * @description Computes state-specific progressive PT deductions, Maharashtra February ₹300 surcharge,
 * female wage earner exemptions (< ₹25k), Karnataka ₹200/month flat rates, and Form III annual ledgers.
 * Issue: #1958
 */

const STATE_PT_SLABS = {
  MAHARASHTRA: {
    stateCode: 'MH',
    hasFebruarySurcharge: true,
    standardHighRate: 200,
    februaryHighRate: 300,
    femaleExemptionThreshold: 25000, // Women earning <= ₹25k exempt
    slabs: [
      { minGross: 0, maxGross: 7500, taxMonthly: 0 },
      { minGross: 7501, maxGross: 10000, taxMonthly: 175 },
      { minGross: 10001, maxGross: Infinity, taxMonthly: 200 },
    ],
  },
  KARNATAKA: {
    stateCode: 'KA',
    hasFebruarySurcharge: false,
    slabs: [
      { minGross: 0, maxGross: 24999, taxMonthly: 0 },
      { minGross: 25000, maxGross: Infinity, taxMonthly: 200 },
    ],
  },
  WEST_BENGAL: {
    stateCode: 'WB',
    hasFebruarySurcharge: false,
    slabs: [
      { minGross: 0, maxGross: 10000, taxMonthly: 0 },
      { minGross: 10001, maxGross: 15000, taxMonthly: 110 },
      { minGross: 15001, maxGross: 20000, taxMonthly: 130 },
      { minGross: 20001, maxGross: 40000, taxMonthly: 150 },
      { minGross: 40001, maxGross: Infinity, taxMonthly: 200 },
    ],
  },
  TELANGANA: {
    stateCode: 'TS',
    hasFebruarySurcharge: false,
    slabs: [
      { minGross: 0, maxGross: 15000, taxMonthly: 0 },
      { minGross: 15001, maxGross: 20000, taxMonthly: 150 },
      { minGross: 20001, maxGross: Infinity, taxMonthly: 200 },
    ],
  },
  GUJARAT: {
    stateCode: 'GJ',
    hasFebruarySurcharge: false,
    slabs: [
      { minGross: 0, maxGross: 12000, taxMonthly: 0 },
      { minGross: 12001, maxGross: Infinity, taxMonthly: 200 },
    ],
  },
};

/**
 * Computes monthly Professional Tax deduction.
 *
 * @param {string} state - Indian State (e.g., 'MAHARASHTRA', 'KARNATAKA')
 * @param {number} monthlyGrossSalary - Monthly gross earnings
 * @param {number} monthIndex - Month index (1 to 12; 2 for February)
 * @param {string} gender - 'M', 'F', or 'OTHER'
 * @returns {{ state: string, monthlyGrossSalary: number, monthIndex: number, ptDeduction: number, isExempt: boolean, ruleApplied: string }}
 */
function computeMonthlyProfessionalTax(
  state = 'MAHARASHTRA',
  monthlyGrossSalary = 0,
  monthIndex = 1,
  gender = 'M',
) {
  const normalizedState = String(state || 'MAHARASHTRA').trim().toUpperCase().replace(/\s+/g, '_');
  const gross = Math.max(0, Number(monthlyGrossSalary) || 0);
  const month = Math.max(1, Math.min(12, Number(monthIndex) || 1));
  const isFemale = String(gender || '').trim().toUpperCase() === 'F';

  const stateConfig = STATE_PT_SLABS[normalizedState];

  if (!stateConfig) {
    return {
      state: normalizedState,
      monthlyGrossSalary: gross,
      monthIndex: month,
      ptDeduction: 0,
      isExempt: true,
      ruleApplied: 'No Professional Tax mandate for this state/union territory',
    };
  }

  // Check Maharashtra female wage earner exemption (< ₹25,000)
  if (normalizedState === 'MAHARASHTRA' && isFemale && gross <= stateConfig.femaleExemptionThreshold) {
    return {
      state: normalizedState,
      monthlyGrossSalary: gross,
      monthIndex: month,
      ptDeduction: 0,
      isExempt: true,
      ruleApplied: 'Statutory female wage earner exemption under ₹25,000/month',
    };
  }

  let basePt = 0;
  for (const slab of stateConfig.slabs) {
    if (gross >= slab.minGross && gross <= slab.maxGross) {
      basePt = slab.taxMonthly;
      break;
    }
  }

  // Apply Maharashtra February surcharge (₹300 instead of ₹200)
  let ptDeduction = basePt;
  let ruleApplied = `Statutory slab deduction: ₹${basePt}`;

  if (normalizedState === 'MAHARASHTRA' && stateConfig.hasFebruarySurcharge && month === 2 && basePt === stateConfig.standardHighRate) {
    ptDeduction = stateConfig.februaryHighRate;
    ruleApplied = `Maharashtra February statutory surcharge: ₹${stateConfig.februaryHighRate}`;
  }

  return {
    state: normalizedState,
    monthlyGrossSalary: gross,
    monthIndex: month,
    ptDeduction,
    isExempt: ptDeduction === 0,
    ruleApplied,
  };
}

/**
 * Calculates full 12-month annual Professional Tax schedule.
 */
function calculateAnnualProfessionalTaxSchedule(state = 'MAHARASHTRA', monthlyGrossSalary = 0, gender = 'M') {
  let annualTotalPt = 0;
  const monthlyBreakdown = [];

  for (let m = 1; m <= 12; m++) {
    const calc = computeMonthlyProfessionalTax(state, monthlyGrossSalary, m, gender);
    annualTotalPt += calc.ptDeduction;
    monthlyBreakdown.push({
      monthNumber: m,
      monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1],
      ptDeducted: calc.ptDeduction,
      ruleApplied: calc.ruleApplied,
    });
  }

  return {
    state: String(state).toUpperCase(),
    monthlyGrossSalary,
    gender: String(gender).toUpperCase(),
    annualTotalPt,
    monthlyBreakdown,
  };
}

/**
 * Aggregates annual Form III return data across employee batch.
 */
function generateFormIIIAggregate(employeeRecords = [], state = 'MAHARASHTRA') {
  let totalEmployees = 0;
  let totalGrossPaid = 0;
  let totalPtDeducted = 0;
  const lineItems = [];

  for (const emp of employeeRecords) {
    const gross = emp.grossSalary || emp.monthlyGross || 35000;
    const gender = emp.gender || 'M';
    const annualSchedule = calculateAnnualProfessionalTaxSchedule(state, gross, gender);

    totalEmployees += 1;
    totalGrossPaid += gross * 12;
    totalPtDeducted += annualSchedule.annualTotalPt;

    lineItems.push({
      employeeId: emp.id || emp.employeeId || `EMP-${totalEmployees}`,
      name: emp.name || emp.fullName || 'Employee',
      gender,
      monthlyGrossSalary: gross,
      annualPtDeducted: annualSchedule.annualTotalPt,
    });
  }

  return {
    state: String(state).toUpperCase(),
    financialYear: '2025-26',
    totalEmployees,
    totalGrossPaid: Math.round(totalGrossPaid * 100) / 100,
    totalPtDeducted: Math.round(totalPtDeducted * 100) / 100,
    lineItems,
  };
}

module.exports = {
  STATE_PT_SLABS,
  computeMonthlyProfessionalTax,
  calculateAnnualProfessionalTaxSchedule,
  generateFormIIIAggregate,
};
