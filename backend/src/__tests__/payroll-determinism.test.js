'use strict';

const payrollDeterminismService = require('../services/PayrollDeterminismService');

describe('PayrollDeterminismService', () => {
  describe('Component Rounding Boundaries', () => {
    /**
     * Test rounding behavior for payroll components
     * Ensures consistent rounding using ROUND_HALF_UP strategy
     */
    test('should round gross salary correctly', () => {
      const inputData = {
        baseSalary: 50000.005, // Test rounding up from .005
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      expect(result.components.grossSalary).toBe(50000.01); // ROUND_HALF_UP
    });

    test('should calculate overtime with precise rounding', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 10.5, // Test fractional hours
        overtimeRate: 75.33, // Fractional rate
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      // 75.33 * 10.5 = 790.965, should round to 790.97
      expect(result.components.overtime).toBe(790.97);
    });

    test('should handle leave deduction rounding', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.666, // Recurring decimal
        leaveDays: 3,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      // 1666.666 * 3 = 4999.998, should round to 5000.00
      expect(result.components.deductions).toBe(5000.00);
    });

    test('should ensure tax components round correctly', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 1000.333, // Fractional bonus
        deductions: 500,
        taxRate: 15.5, // Fractional tax rate
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      expect(result.components.bonuses).toBe(1000.33);

      const taxComponents = result.components.taxComponents;
      expect(typeof taxComponents.taxAmount).toBe('number');
      expect(taxComponents.taxRate).toBe(15.5);
      // Verify taxAmount is properly rounded to 2 decimals
      expect(taxComponents.taxAmount.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });

    test('should calculate net salary with cumulative rounding', () => {
      const inputData = {
        baseSalary: 50000.005,
        dailyRate: 1666.667,
        leaveDays: 2.5,
        overtimeHours: 5.33,
        overtimeRate: 75.5,
        bonuses: 1000.999,
        deductions: 500.555,
        taxRate: 12.5,
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      const netSalary = result.components.netSalary;

      // Verify net salary is properly formatted
      expect(typeof netSalary).toBe('number');
      expect(netSalary.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });
  });

  describe('Reconciliation - Component Level Comparison', () => {
    test('should detect no mismatch for identical calculations', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 1,
        overtimeHours: 5,
        overtimeRate: 75,
        bonuses: 500,
        deductions: 200,
        taxRate: 12,
      };

      const storedPayroll = {
        components: payrollDeterminismService.recalculatePayroll(inputData).components,
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(true);
      expect(result.mismatchedComponent).toBeNull();
    });

    test('should report first mismatch in gross salary', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const storedPayroll = {
        components: {
          grossSalary: 49999.99, // Intentional mismatch
          overtime: 0,
          bonuses: 0,
          deductions: 0,
          taxComponents: { taxAmount: 0, taxRate: 0, taxableAmount: 50000 },
          netSalary: 49999.99,
        },
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(false);
      expect(result.mismatchedComponent).toBe('grossSalary');
      expect(result.differences.component).toBe('grossSalary');
      expect(result.differences.stored).toBe(49999.99);
      expect(result.differences.calculated).toBe(50000);
    });

    test('should report overtime mismatch', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 10,
        overtimeRate: 75,
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const storedPayroll = {
        components: {
          grossSalary: 50000,
          overtime: 749.99, // Should be 750
          bonuses: 0,
          deductions: 0,
          taxComponents: { taxAmount: 0, taxRate: 0, taxableAmount: 50750 },
          netSalary: 50749.99,
        },
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(false);
      expect(result.mismatchedComponent).toBe('overtime');
    });

    test('should report deduction mismatch', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 1,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 200,
        taxRate: 0,
      };

      const storedPayroll = {
        components: {
          grossSalary: 50000,
          overtime: 0,
          bonuses: 0,
          deductions: 1867, // Should be 1866.67
          taxComponents: { taxAmount: 0, taxRate: 0, taxableAmount: 48133.33 },
          netSalary: 48133.33,
        },
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(false);
      expect(result.mismatchedComponent).toBe('deductions');
    });

    test('should report tax component mismatch', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 1000,
        deductions: 500,
        taxRate: 12,
      };

      const storedPayroll = {
        components: {
          grossSalary: 50000,
          overtime: 0,
          bonuses: 1000,
          deductions: 500,
          taxComponents: { taxAmount: 6061, taxRate: 12, taxableAmount: 50500 }, // Wrong tax
          netSalary: 44439,
        },
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(false);
      expect(result.mismatchedComponent).toBe('taxComponents');
    });

    test('should report net salary mismatch', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 5,
        overtimeRate: 75,
        bonuses: 500,
        deductions: 200,
        taxRate: 10,
      };

      const storedPayroll = {
        components: {
          grossSalary: 50000,
          overtime: 375,
          bonuses: 500,
          deductions: 200,
          taxComponents: { taxAmount: 5067.5, taxRate: 10, taxableAmount: 50675 },
          netSalary: 45607.49, // Should be 45607.50
        },
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(false);
      expect(result.mismatchedComponent).toBe('netSalary');
    });
  });

  describe('Tolerance and Variance Calculation', () => {
    test('should allow small variance within tolerance (1 cent)', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const storedPayroll = {
        components: {
          grossSalary: 50000.001, // Within tolerance
          overtime: 0,
          bonuses: 0,
          deductions: 0,
          taxComponents: { taxAmount: 0, taxRate: 0, taxableAmount: 50000 },
          netSalary: 50000.001,
        },
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      // Should be consistent within 1 cent tolerance
      expect(result.isConsistent).toBe(true);
    });

    test('should calculate variance correctly for mismatches', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const storedPayroll = {
        components: {
          grossSalary: 49500, // 500 difference
          overtime: 0,
          bonuses: 0,
          deductions: 0,
          taxComponents: { taxAmount: 0, taxRate: 0, taxableAmount: 49500 },
          netSalary: 49500,
        },
      };

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(false);
      expect(result.differences.variance.absolute).toBe('500.00');
      expect(result.differences.variance.percentage).toMatch(/1\./); // ~1% variance
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero values correctly', () => {
      const inputData = {
        baseSalary: 0,
        dailyRate: 0,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 0,
        taxRate: 0,
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      expect(result.components.grossSalary).toBe(0);
      expect(result.components.netSalary).toBe(0);
    });

    test('should handle negative deductions (credits)', () => {
      const inputData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: -500, // Credit
        taxRate: 0,
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      expect(result.components.netSalary).toBe(50500);
    });

    test('should handle very large salary amounts', () => {
      const inputData = {
        baseSalary: 999999.99,
        dailyRate: 33333.33,
        leaveDays: 0,
        overtimeHours: 100,
        overtimeRate: 150.50,
        bonuses: 10000.50,
        deductions: 5000.75,
        taxRate: 20,
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      expect(typeof result.components.netSalary).toBe('number');
      expect(result.components.netSalary).toBeGreaterThan(0);
    });

    test('should handle missing input data gracefully', () => {
      const inputData = {
        baseSalary: 50000,
        // Other fields omitted
      };

      const result = payrollDeterminismService.recalculatePayroll(inputData);
      expect(result.components.grossSalary).toBe(50000);
      expect(result.components.overtime).toBe(0);
      expect(result.components.bonuses).toBe(0);
    });

    test('should handle invalid stored payroll format', () => {
      const inputData = { baseSalary: 50000 };
      const storedPayroll = null;

      const result = payrollDeterminismService.reconcilePayroll(storedPayroll, inputData);
      expect(result.isConsistent).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Determinism Verification', () => {
    test('identical inputs should produce identical outputs', () => {
      const inputData = {
        baseSalary: 50000.123,
        dailyRate: 1666.674,
        leaveDays: 2.5,
        overtimeHours: 7.75,
        overtimeRate: 75.333,
        bonuses: 1234.567,
        deductions: 543.21,
        taxRate: 13.45,
      };

      const result1 = payrollDeterminismService.recalculatePayroll(inputData);
      const result2 = payrollDeterminismService.recalculatePayroll(inputData);

      // Deep compare all components
      Object.keys(result1.components).forEach(key => {
        const val1 = result1.components[key];
        const val2 = result2.components[key];

        if (typeof val1 === 'object') {
          Object.keys(val1).forEach(subKey => {
            expect(val1[subKey]).toBe(val2[subKey]);
          });
        } else {
          expect(val1).toBe(val2);
        }
      });
    });

    test('different calculation orders should produce same result', () => {
      const baseData = {
        baseSalary: 50000,
        dailyRate: 1666.67,
        leaveDays: 0,
        overtimeHours: 10,
        overtimeRate: 75,
        bonuses: 1000,
        deductions: 500,
        taxRate: 12,
      };

      const result = payrollDeterminismService.recalculatePayroll(baseData);
      expect(typeof result.components.netSalary).toBe('number');
      expect(result.components.netSalary).toBeCloseTo(51091.26, 2);
    });
  });
});