const { calculateNetSalary } = require('../salaryCalculator');

describe('calculateNetSalary with versioned calculation rules', () => {
  const employee = {
    monthlySalary: 30000,
    overtimeRate: 200,
  };

  const user = {
    defaultDailyRate: 0,
    defaultOvertimeRate: 0,
  };

  test('version 1 keeps the existing calculation behavior', () => {
    const result = calculateNetSalary(employee, user, {
      leaveDays: 2,
      overtimeHours: 5,
      bonus: 1000,
      deductions: 500,
      calculationRule: {
        version: '1.0.0',
        rules: {
          leave: {
            dailyRateDivisor: 30,
            maxDays: 31,
          },
          overtime: {
            rateMultiplier: 1,
          },
          deductions: {
            multiplier: 1,
          },
          bonus: {
            multiplier: 1,
          },
          salary: {
            dailyRateDivisor: null,
          },
        },
      },
    });

    expect(result.leaveDeduction).toBe(2000);
    expect(result.overtimePay).toBe(1000);
    expect(result.netSalary).toBe(29500);
  });

  test('version 2 produces a different reproducible calculation', () => {
    const result = calculateNetSalary(employee, user, {
      leaveDays: 2,
      overtimeHours: 5,
      bonus: 1000,
      deductions: 500,
      calculationRule: {
        version: '2.0.0',
        rules: {
          leave: {
            dailyRateDivisor: 20,
            maxDays: 31,
          },
          overtime: {
            rateMultiplier: 2,
          },
          deductions: {
            multiplier: 1.5,
          },
          bonus: {
            multiplier: 1.5,
          },
          salary: {
            dailyRateDivisor: null,
          },
        },
      },
    });

    expect(result.leaveDeduction).toBe(3000);
    expect(result.overtimePay).toBe(2000);
    expect(result.netSalary).toBe(29750);
  });

  test('reusing version 1 reproduces the original result after version 2 exists', () => {
    const originalRule = {
      version: '1.0.0',
      rules: {
        leave: {
          dailyRateDivisor: 30,
          maxDays: 31,
        },
        overtime: {
          rateMultiplier: 1,
        },
        deductions: {
          multiplier: 1,
        },
        bonus: {
          multiplier: 1,
        },
        salary: {
          dailyRateDivisor: null,
        },
      },
    };

    const firstCalculation = calculateNetSalary(employee, user, {
      leaveDays: 2,
      overtimeHours: 5,
      bonus: 1000,
      deductions: 500,
      calculationRule: originalRule,
    });

    const historicalRecalculation = calculateNetSalary(employee, user, {
      leaveDays: 2,
      overtimeHours: 5,
      bonus: 1000,
      deductions: 500,
      calculationRule: originalRule,
    });

    expect(historicalRecalculation).toEqual(firstCalculation);
    expect(historicalRecalculation.netSalary).toBe(29500);
  });
});