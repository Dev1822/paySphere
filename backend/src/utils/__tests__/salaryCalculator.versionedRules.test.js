const { calculateNetSalary } = require('../salaryCalculator');

describe('versioned payroll calculation rules', () => {
  const employee = {
    monthlySalary: 30000,
    overtimeRate: 200,
  };

  const user = {
    defaultDailyRate: 0,
    defaultOvertimeRate: 0,
  };

  const inputs = {
    leaveDays: 2,
    overtimeHours: 5,
    bonus: 1000,
    deductions: 500,
  };

  test('different rule versions produce reproducible different calculations', () => {
    const versionOne = {
      version: '1.0.0',
      ruleId: 'rule-v1',
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

    const versionTwo = {
      version: '2.0.0',
      ruleId: 'rule-v2',
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
    };

    const firstCalculation = calculateNetSalary(
      employee,
      user,
      {
        ...inputs,
        calculationRule: versionOne,
      },
    );

    const secondCalculation = calculateNetSalary(
      employee,
      user,
      {
        ...inputs,
        calculationRule: versionTwo,
      },
    );

    expect(firstCalculation.netSalary).toBe(29500);
    expect(secondCalculation.netSalary).toBe(29750);

    expect(firstCalculation.netSalary).not.toBe(
      secondCalculation.netSalary,
    );

    const historicalRecalculation = calculateNetSalary(
      employee,
      user,
      {
        ...inputs,
        calculationRule: versionOne,
      },
    );

    expect(historicalRecalculation).toEqual(firstCalculation);
  });
});