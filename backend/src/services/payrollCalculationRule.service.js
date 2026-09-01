const {
  PAYROLL_CALCULATION_VERSION,
} = require('../config/payrollCalculationVersion');
const PayrollCalculationRuleVersion = require('../models/payrollCalculationRuleVersion.model');

const DEFAULT_RULES = {
  overtime: {
    rateMultiplier: 1,
    standardMultiplier: 1.5,
    doubleMultiplier: 2,
    holidayMultiplier: 2.5,
    standardDailyHours: 8,
    doubleOtDailyThreshold: 9,
    weeklyHoursCeiling: 48,
  },
  leave: {
    dailyRateDivisor: null,
    maxDays: 31,
  },
  deductions: {
    multiplier: 1,
  },
  bonus: {
    multiplier: 1,
    includeTaxableExpenses: true,
  },
  salary: {
    dailyRateDivisor: null,
  },
};

function normalizeCalculationRule(rule) {
  const source = rule?.toObject ? rule.toObject() : rule;

  return {
    ruleId: source?._id || null,
    version: source?.version || PAYROLL_CALCULATION_VERSION,
    rules: {
      overtime: {
        ...DEFAULT_RULES.overtime,
        ...(source?.overtime || {}),
      },
      leave: {
        ...DEFAULT_RULES.leave,
        ...(source?.leave || {}),
      },
      deductions: {
        ...DEFAULT_RULES.deductions,
        ...(source?.deductions || {}),
      },
      bonus: {
        ...DEFAULT_RULES.bonus,
        ...(source?.bonus || {}),
      },
      salary: {
        ...DEFAULT_RULES.salary,
        ...(source?.salary || {}),
      },
    },
  };
}

async function getActiveCalculationRule(tenantId) {
  const rule = await PayrollCalculationRuleVersion.findOne({
    tenantId,
    isActive: true,
  }).lean();

  return normalizeCalculationRule(rule);
}

module.exports = {
  DEFAULT_RULES,
  normalizeCalculationRule,
  getActiveCalculationRule,
};