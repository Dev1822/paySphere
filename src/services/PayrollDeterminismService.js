'use strict';

const logger = require('../utils/logger');
const Decimal = require('decimal.js');

/**
 * PayrollDeterminismService
 * Provides deterministic payroll calculation verification and reconciliation.
 * Uses Decimal.js for precise rounding to ensure identical calculation results.
 */
class PayrollDeterminismService {
  constructor() {
    // Set Decimal.js precision to 10 decimal places for currency
    Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });
  }

  /**
   * Component definitions for payroll
   * Defines the order and structure of calculation components
   */
  static COMPONENTS = {
    GROSS_SALARY: 'grossSalary',
    OVERTIME: 'overtime',
    BONUSES: 'bonuses',
    DEDUCTIONS: 'deductions',
    TAX_COMPONENTS: 'taxComponents',
    NET_SALARY: 'netSalary',
  };

  /**
   * Recalculate payroll from input data deterministically
   * @param {Object} inputData - Contains employee, attendance, leave, bonuses, deductions
   * @returns {Object} Recalculated payroll with all components
   */
  recalculatePayroll(inputData) {
    const {
      baseSalary,
      dailyRate,
      leaveDays = 0,
      overtimeHours = 0,
      overtimeRate = 0,
      bonuses = 0,
      deductions = 0,
      taxRate = 0,
    } = inputData;

    const components = {};

    try {
      // Calculate Gross Salary
      components[this.constructor.COMPONENTS.GROSS_SALARY] = this._roundCurrency(
        baseSalary
      );

      // Calculate Overtime
      const overtimeAmount = this._roundCurrency(
        new Decimal(overtimeRate).times(overtimeHours)
      );
      components[this.constructor.COMPONENTS.OVERTIME] = overtimeAmount;

      // Calculate Bonuses
      components[this.constructor.COMPONENTS.BONUSES] = this._roundCurrency(bonuses);

      // Calculate Deductions (leave, etc.)
      const leaveDeduction = this._roundCurrency(
        new Decimal(dailyRate).times(leaveDays)
      );
      const totalDeductions = this._roundCurrency(
        new Decimal(deductions).plus(leaveDeduction)
      );
      components[this.constructor.COMPONENTS.DEDUCTIONS] = totalDeductions;

      // Calculate Tax Components
      const taxableAmount = this._roundCurrency(
        new Decimal(components[this.constructor.COMPONENTS.GROSS_SALARY])
          .plus(overtimeAmount)
          .plus(components[this.constructor.COMPONENTS.BONUSES])
          .minus(totalDeductions)
      );

      const taxAmount = this._roundCurrency(
        new Decimal(taxableAmount).times(taxRate).dividedBy(100)
      );
      components[this.constructor.COMPONENTS.TAX_COMPONENTS] = {
        taxAmount,
        taxRate,
        taxableAmount,
      };

      // Calculate Net Salary
      const netSalary = this._roundCurrency(
        new Decimal(components[this.constructor.COMPONENTS.GROSS_SALARY])
          .plus(overtimeAmount)
          .plus(components[this.constructor.COMPONENTS.BONUSES])
          .minus(totalDeductions)
          .minus(taxAmount)
      );
      components[this.constructor.COMPONENTS.NET_SALARY] = netSalary;

      return {
        components,
        calculatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Payroll recalculation error', { error: error.message });
      throw new Error(`Failed to recalculate payroll: ${error.message}`);
    }
  }

  /**
   * Reconcile stored payroll against inputs
   * Reports first mismatch found at component level
   * @param {Object} storedPayroll - Payroll record from database
   * @param {Object} inputData - Original input data for recalculation
   * @returns {Object} { isConsistent, mismatchedComponent, differences }
   */
  reconcilePayroll(storedPayroll, inputData) {
    if (!storedPayroll || !storedPayroll.components) {
      return {
        isConsistent: false,
        mismatchedComponent: null,
        error: 'Invalid stored payroll format',
      };
    }

    const recalculated = this.recalculatePayroll(inputData);
    const storedComponents = storedPayroll.components;
    const calculatedComponents = recalculated.components;

    // Check each component in order
    for (const componentKey of Object.values(this.constructor.COMPONENTS)) {
      if (!(componentKey in storedComponents) || !(componentKey in calculatedComponents)) {
        continue;
      }

      const stored = storedComponents[componentKey];
      const calculated = calculatedComponents[componentKey];

      if (!this._compareValues(stored, calculated)) {
        return {
          isConsistent: false,
          mismatchedComponent: componentKey,
          differences: {
            component: componentKey,
            stored: this._valueToNumber(stored),
            calculated: this._valueToNumber(calculated),
            variance: this._calculateVariance(
              this._valueToNumber(stored),
              this._valueToNumber(calculated)
            ),
          },
        };
      }
    }

    return {
      isConsistent: true,
      mismatchedComponent: null,
      reconciliedAt: new Date(),
    };
  }

  /**
   * Round currency value using Decimal.js for precision
   * @param {number|string|Decimal} value - Value to round
   * @returns {number} Rounded to 2 decimal places
   */
  _roundCurrency(value) {
    const decimal = new Decimal(value);
    return parseFloat(decimal.toFixed(2));
  }

  /**
   * Compare two values with tolerance for floating point precision
   * @param {*} stored - Stored value (may be object for tax components)
   * @param {*} calculated - Recalculated value
   * @returns {boolean} True if values match within tolerance
   */
  _compareValues(stored, calculated) {
    if (typeof stored === 'object' && typeof calculated === 'object') {
      // For tax components or other objects, compare all numeric properties
      return this._deepCompare(stored, calculated);
    }

    const storedNum = this._valueToNumber(stored);
    const calculatedNum = this._valueToNumber(calculated);
    const tolerance = 0.01; // 1 cent tolerance

    return Math.abs(storedNum - calculatedNum) < tolerance;
  }

  /**
   * Deep comparison for objects
   */
  _deepCompare(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      const val1 = this._valueToNumber(obj1[key]);
      const val2 = this._valueToNumber(obj2[key]);
      const tolerance = 0.01;

      if (Math.abs(val1 - val2) >= tolerance) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert any value to number
   */
  _valueToNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (typeof value === 'object') return 0;
    return 0;
  }

  /**
   * Calculate variance between stored and calculated values
   */
  _calculateVariance(stored, calculated) {
    const difference = Math.abs(stored - calculated);
    const percentage =
      stored !== 0 ? ((difference / Math.abs(stored)) * 100).toFixed(4) : 0;
    return { absolute: difference.toFixed(2), percentage: `${percentage}%` };
  }
}

module.exports = new PayrollDeterminismService();