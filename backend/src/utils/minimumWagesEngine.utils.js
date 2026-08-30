/**
 * @fileoverview Statutory Minimum Wages Act Compliance & Arrear Engine
 * @description Audits organization payroll against state-specific skill-tier wage floors
 * (Unskilled, Semi-skilled, Skilled, Highly Skilled), scans discrepancies, and computes retroactive arrears.
 * Issue: #1962
 */

const SKILL_TIERS = {
  UNSKILLED: 'UNSKILLED',
  SEMI_SKILLED: 'SEMI_SKILLED',
  SKILLED: 'SKILLED',
  HIGHLY_SKILLED: 'HIGHLY_SKILLED',
};

const DEFAULT_STATE_MINIMUM_WAGES = {
  DELHI: {
    UNSKILLED: 17494,
    SEMI_SKILLED: 19279,
    SKILLED: 21215,
    HIGHLY_SKILLED: 23082,
  },
  MAHARASHTRA: {
    UNSKILLED: 15400,
    SEMI_SKILLED: 16800,
    SKILLED: 18500,
    HIGHLY_SKILLED: 20500,
  },
  KARNATAKA: {
    UNSKILLED: 14800,
    SEMI_SKILLED: 16100,
    SKILLED: 17900,
    HIGHLY_SKILLED: 19800,
  },
  CENTRAL_SPHERE: {
    UNSKILLED: 16000,
    SEMI_SKILLED: 17500,
    SKILLED: 19500,
    HIGHLY_SKILLED: 21500,
  },
};

/**
 * Resolves benchmark minimum wage for a state and skill tier.
 */
function resolveMinimumWageFloor(state = 'DELHI', skillTier = SKILL_TIERS.SKILLED) {
  const normState = String(state || 'DELHI').trim().toUpperCase().replace(/\s+/g, '_');
  const normTier = String(skillTier || SKILL_TIERS.SKILLED).trim().toUpperCase().replace(/-/g, '_');

  const stateSchedule = DEFAULT_STATE_MINIMUM_WAGES[normState] || DEFAULT_STATE_MINIMUM_WAGES.CENTRAL_SPHERE;
  return stateSchedule[normTier] || stateSchedule.SKILLED;
}

/**
 * Evaluates individual employee compliance against statutory minimum wage.
 *
 * @param {number} basicPay - Monthly basic pay
 * @param {number} dearnessAllowance - Monthly DA
 * @param {string} skillTier - Skill tier classification
 * @param {string} state - Indian State
 * @returns {{ isCompliant: boolean, statutoryWageFloor: number, actualEligibleWages: number, monthlyShortfall: number, skillTier: string, state: string, auditStatus: string }}
 */
function evaluateEmployeeWageCompliance(
  basicPay = 0,
  dearnessAllowance = 0,
  skillTier = SKILL_TIERS.SKILLED,
  state = 'DELHI',
) {
  const basic = Math.max(0, Number(basicPay) || 0);
  const da = Math.max(0, Number(dearnessAllowance) || 0);
  const actualEligibleWages = basic + da;

  const statutoryWageFloor = resolveMinimumWageFloor(state, skillTier);
  const isCompliant = actualEligibleWages >= statutoryWageFloor;
  const monthlyShortfall = isCompliant ? 0 : Math.round((statutoryWageFloor - actualEligibleWages) * 100) / 100;

  return {
    isCompliant,
    statutoryWageFloor,
    actualEligibleWages,
    monthlyShortfall,
    skillTier: String(skillTier).toUpperCase(),
    state: String(state).toUpperCase(),
    auditStatus: isCompliant
      ? 'COMPLIANT_ABOVE_STATUTORY_FLOOR'
      : 'NON_COMPLIANT_WAGE_DISCREPANCY',
  };
}

/**
 * Computes retroactive wage arrears for gazette notification rate revisions.
 */
function calculateRetroactiveWageArrears(
  basicPay = 0,
  dearnessAllowance = 0,
  skillTier = SKILL_TIERS.SKILLED,
  state = 'DELHI',
  retroactiveMonths = 1,
) {
  const months = Math.max(1, Number(retroactiveMonths) || 1);
  const compliance = evaluateEmployeeWageCompliance(basicPay, dearnessAllowance, skillTier, state);

  const totalArrearLiability = Math.round(compliance.monthlyShortfall * months * 100) / 100;

  return {
    ...compliance,
    retroactiveMonths: months,
    totalArrearLiability,
  };
}

/**
 * Scans organization employee dataset and generates compliance score & arrear reports.
 */
function auditOrganizationWageCompliance(employeeRoster = [], state = 'DELHI') {
  let totalAudited = 0;
  let compliantCount = 0;
  let nonCompliantCount = 0;
  let totalMonthlyShortfallLiability = 0;

  const discrepancies = [];
  const auditDetails = [];

  for (const emp of employeeRoster) {
    const basic = emp.basic || emp.salaryDetails?.basic || 20000;
    const da = emp.da || emp.salaryDetails?.da || 0;
    const tier = emp.skillTier || emp.designationTier || SKILL_TIERS.SKILLED;

    const evalResult = evaluateEmployeeWageCompliance(basic, da, tier, state);
    totalAudited += 1;

    if (evalResult.isCompliant) {
      compliantCount += 1;
    } else {
      nonCompliantCount += 1;
      totalMonthlyShortfallLiability += evalResult.monthlyShortfall;
      discrepancies.push({
        employeeId: emp.id || emp.employeeId || `EMP-${totalAudited}`,
        name: emp.name || emp.fullName || 'Staff',
        ...evalResult,
      });
    }

    auditDetails.push({
      employeeId: emp.id || emp.employeeId || `EMP-${totalAudited}`,
      name: emp.name || emp.fullName || 'Staff',
      ...evalResult,
    });
  }

  const compliancePercentage = totalAudited > 0
    ? Math.round((compliantCount / totalAudited) * 10000) / 100
    : 100;

  return {
    state: String(state).toUpperCase(),
    totalAudited,
    compliantCount,
    nonCompliantCount,
    compliancePercentage,
    totalMonthlyShortfallLiability: Math.round(totalMonthlyShortfallLiability * 100) / 100,
    discrepancies,
    auditDetails,
  };
}

module.exports = {
  SKILL_TIERS,
  DEFAULT_STATE_MINIMUM_WAGES,
  resolveMinimumWageFloor,
  evaluateEmployeeWageCompliance,
  calculateRetroactiveWageArrears,
  auditOrganizationWageCompliance,
};
