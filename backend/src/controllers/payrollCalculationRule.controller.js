const PayrollCalculationRuleVersion = require('../models/payrollCalculationRuleVersion.model');
const {
  DEFAULT_RULES,
} = require('../services/payrollCalculationRule.service');

function validateRuleBody(body = {}) {
  const version =
    typeof body.version === 'string' ? body.version.trim() : '';

  if (!version) {
    return { ok: false, message: 'Rule version is required' };
  }

  if (version.length > 50) {
    return { ok: false, message: 'Rule version cannot exceed 50 characters' };
  }

  const rules = {
    overtime: {
      ...DEFAULT_RULES.overtime,
      ...(body.overtime || {}),
    },
    leave: {
      ...DEFAULT_RULES.leave,
      ...(body.leave || {}),
    },
    deductions: {
      ...DEFAULT_RULES.deductions,
      ...(body.deductions || {}),
    },
    bonus: {
      ...DEFAULT_RULES.bonus,
      ...(body.bonus || {}),
    },
    salary: {
      ...DEFAULT_RULES.salary,
      ...(body.salary || {}),
    },
  };

  const numericFields = [
    ['overtime.rateMultiplier', rules.overtime.rateMultiplier],
    ['overtime.standardMultiplier', rules.overtime.standardMultiplier],
    ['overtime.doubleMultiplier', rules.overtime.doubleMultiplier],
    ['overtime.holidayMultiplier', rules.overtime.holidayMultiplier],
    ['overtime.standardDailyHours', rules.overtime.standardDailyHours],
    ['overtime.doubleOtDailyThreshold', rules.overtime.doubleOtDailyThreshold],
    ['overtime.weeklyHoursCeiling', rules.overtime.weeklyHoursCeiling],
    ['leave.maxDays', rules.leave.maxDays],
    ['deductions.multiplier', rules.deductions.multiplier],
    ['bonus.multiplier', rules.bonus.multiplier],
  ];

  if (rules.leave.dailyRateDivisor !== null) {
    numericFields.push([
      'leave.dailyRateDivisor',
      rules.leave.dailyRateDivisor,
    ]);
  }

  if (rules.salary.dailyRateDivisor !== null) {
    numericFields.push([
      'salary.dailyRateDivisor',
      rules.salary.dailyRateDivisor,
    ]);
  }

  for (const [field, value] of numericFields) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      return {
        ok: false,
        message: `${field} must be a non-negative number`,
      };
    }
  }

  if (typeof rules.bonus.includeTaxableExpenses !== 'boolean') {
    return {
      ok: false,
      message: 'bonus.includeTaxableExpenses must be boolean',
    };
  }

  return {
    ok: true,
    value: {
      version,
      overtime: rules.overtime,
      leave: rules.leave,
      deductions: rules.deductions,
      bonus: rules.bonus,
      salary: rules.salary,
    },
  };
}

exports.listCalculationRules = async (req, res, next) => {
  try {
    const rules = await PayrollCalculationRuleVersion.find({
      tenantId: req.tenantId,
    })
      .sort({ effectiveFrom: -1 })
      .lean();

    res.status(200).json({
      rules,
      activeVersion:
        rules.find((rule) => rule.isActive)?.version || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.createCalculationRule = async (req, res, next) => {
  try {
    const validation = validateRuleBody(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const existing = await PayrollCalculationRuleVersion.findOne({
      tenantId: req.tenantId,
      version: validation.value.version,
    });

    if (existing) {
      return res.status(409).json({
        message: `Calculation-rule version "${validation.value.version}" already exists`,
      });
    }

    const existingActive = await PayrollCalculationRuleVersion.exists({
      tenantId: req.tenantId,
      isActive: true,
    });

    const activate =
      req.body.activate === true || !existingActive;

    if (activate) {
      await PayrollCalculationRuleVersion.updateMany(
        {
          tenantId: req.tenantId,
          isActive: true,
        },
        {
          $set: { isActive: false },
        },
      );
    }

    const rule = await PayrollCalculationRuleVersion.create({
      tenantId: req.tenantId,
      createdBy: req.userId,
      effectiveFrom: req.body.effectiveFrom || new Date(),
      isActive: activate,
      ...validation.value,
    });

    res.status(201).json({
      message: `Calculation-rule version "${rule.version}" created`,
      rule,
    });
  } catch (error) {
    next(error);
  }
};

exports.activateCalculationRule = async (req, res, next) => {
  try {
    const { version } = req.params;

    const rule = await PayrollCalculationRuleVersion.findOne({
      tenantId: req.tenantId,
      version,
    });

    if (!rule) {
      return res.status(404).json({
        message: `Calculation-rule version "${version}" not found`,
      });
    }

    if (!rule.isActive) {
      await PayrollCalculationRuleVersion.updateMany(
        {
          tenantId: req.tenantId,
          isActive: true,
        },
        {
          $set: { isActive: false },
        },
      );

      rule.isActive = true;
      await rule.save();
    }

    res.status(200).json({
      message: `Calculation-rule version "${version}" is now active`,
      rule,
    });
  } catch (error) {
    next(error);
  }
};