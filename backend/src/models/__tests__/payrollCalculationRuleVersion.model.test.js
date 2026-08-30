const mongoose = require('mongoose');
const PayrollCalculationRuleVersion = require('../payrollCalculationRuleVersion.model');

describe('PayrollCalculationRuleVersion model', () => {
  test('stores separate calculation-rule versions', () => {
    const tenantId = new mongoose.Types.ObjectId();
    const createdBy = new mongoose.Types.ObjectId();

    const versionOne = new PayrollCalculationRuleVersion({
      tenantId,
      createdBy,
      version: '1.0.0',
      isActive: false,
    });

    const versionTwo = new PayrollCalculationRuleVersion({
      tenantId,
      createdBy,
      version: '2.0.0',
      isActive: true,
      overtime: {
        rateMultiplier: 2,
      },
      leave: {
        dailyRateDivisor: 30,
      },
      deductions: {
        multiplier: 1.1,
      },
      bonus: {
        multiplier: 1.2,
      },
    });

    expect(versionOne.validateSync()).toBeUndefined();
    expect(versionTwo.validateSync()).toBeUndefined();

    expect(versionOne.version).toBe('1.0.0');
    expect(versionTwo.version).toBe('2.0.0');
    expect(versionTwo.overtime.rateMultiplier).toBe(2);
    expect(versionTwo.deductions.multiplier).toBe(1.1);
    expect(versionTwo.bonus.multiplier).toBe(1.2);
  });

  test('requires tenant, creator and version', () => {
    const rule = new PayrollCalculationRuleVersion({});

    const error = rule.validateSync();

    expect(error.errors.tenantId).toBeDefined();
    expect(error.errors.createdBy).toBeDefined();
    expect(error.errors.version).toBeDefined();
  });

  test('defines a unique active-rule index per tenant', () => {
    const indexes = PayrollCalculationRuleVersion.schema.indexes();

    expect(
      indexes.some(
        ([fields, options]) =>
          fields.tenantId === 1 &&
          fields.isActive === 1 &&
          options.unique === true &&
          options.partialFilterExpression?.isActive === true,
      ),
    ).toBe(true);
  });
});