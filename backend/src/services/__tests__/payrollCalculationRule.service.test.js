const mongoose = require('mongoose');

jest.mock('../../models/payrollCalculationRuleVersion.model', () => ({
  findOne: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
}));

const PayrollCalculationRuleVersion = require('../../models/payrollCalculationRuleVersion.model');

const {
  DEFAULT_RULES,
  normalizeCalculationRule,
  getActiveCalculationRule,
  createCalculationRuleVersion,
  activateCalculationRuleVersion,
} = require('../payrollCalculationRule.service');

describe('Payroll calculation rule version service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalizes the default calculation rule', () => {
    const result = normalizeCalculationRule(null);

    expect(result.version).toBe('1.0.0');
    expect(result.rules.overtime.rateMultiplier).toBe(1);
    expect(result.rules.leave.maxDays).toBe(31);
    expect(result.rules.deductions.multiplier).toBe(1);
    expect(result.rules.bonus.multiplier).toBe(1);
    expect(result.rules.bonus.includeTaxableExpenses).toBe(true);
  });

  test('returns the tenant active calculation rule', async () => {
    PayrollCalculationRuleVersion.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        version: '2.0.0',
        isActive: true,
        overtime: {
          rateMultiplier: 2,
        },
      }),
    });

    const result = await getActiveCalculationRule(
      new mongoose.Types.ObjectId(),
    );

    expect(result.version).toBe('2.0.0');
    expect(result.ruleId).not.toBeNull();
    expect(result.rules.overtime.rateMultiplier).toBe(2);
  });

  test('creates a new rule version without changing the active version by default', async () => {
    PayrollCalculationRuleVersion.findOne.mockResolvedValue(null);

    const created = {
      _id: new mongoose.Types.ObjectId(),
      version: '2.0.0',
      isActive: false,
    };

    PayrollCalculationRuleVersion.create.mockResolvedValue(created);

    const result = await createCalculationRuleVersion({
      tenantId: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      version: '2.0.0',
      rules: {
        overtime: {
          rateMultiplier: 2,
        },
      },
    });

    expect(result).toBe(created);
    expect(PayrollCalculationRuleVersion.updateMany).not.toHaveBeenCalled();

    expect(PayrollCalculationRuleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '2.0.0',
        isActive: false,
        overtime: expect.objectContaining({
          rateMultiplier: 2,
        }),
      }),
    );
  });

  test('activating a new version deactivates the previous active version', async () => {
    const ruleId = new mongoose.Types.ObjectId();

    const rule = {
      _id: ruleId,
      version: '2.0.0',
      isActive: false,
      save: jest.fn().mockResolvedValue(undefined),
    };

    PayrollCalculationRuleVersion.findOne.mockResolvedValue(rule);
    PayrollCalculationRuleVersion.updateMany.mockResolvedValue({
      modifiedCount: 1,
    });

    await activateCalculationRuleVersion(
      new mongoose.Types.ObjectId(),
      '2.0.0',
    );

    expect(PayrollCalculationRuleVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        _id: { $ne: ruleId },
      }),
      {
        $set: {
          isActive: false,
        },
      },
    );

    expect(rule.isActive).toBe(true);
    expect(rule.save).toHaveBeenCalled();
  });

  test('does not create duplicate rule versions', async () => {
    PayrollCalculationRuleVersion.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      version: '2.0.0',
    });

    await expect(
      createCalculationRuleVersion({
        tenantId: new mongoose.Types.ObjectId(),
        createdBy: new mongoose.Types.ObjectId(),
        version: '2.0.0',
      }),
    ).rejects.toThrow(
      'Calculation-rule version "2.0.0" already exists',
    );

    expect(PayrollCalculationRuleVersion.create).not.toHaveBeenCalled();
  });
});