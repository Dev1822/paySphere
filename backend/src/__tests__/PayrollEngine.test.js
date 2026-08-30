const mongoose = require('mongoose');

jest.mock('../services/cache.service', () => ({
  invalidateAnalytics: jest.fn(),
  invalidateDashboardSummary: jest.fn(),
}));

jest.mock('../services/event.service', () => ({
  emit: jest.fn(),
}));

const PayrollEngine = require('../services/PayrollEngine.service');

// Mock external dependencies that compute() uses internally
jest.mock('../utils/salaryCalculator', () => ({
  calculateNetSalary: jest.fn((emp, user, inputs) => {
    return {
      baseSalary: 5000,
      leaveDeduction: 0,
      overtimePay: 100,
      netSalary: 5100 + inputs.bonus - inputs.deductions,
    };
  }),
}));

jest.mock('../utils/arrearsCalculator', () => ({
  bundleUnreleasedArrears: jest.fn().mockResolvedValue({
    totalArrears: 200,
    arrearsBreakdown: [],
    ledgerIds: [],
  }),
  markArrearsReleased: jest.fn(),
}));

jest.mock('../utils/loanSchedule', () => ({
  allocateRecovery: jest.fn().mockReturnValue({
    totalRecovered: 50,
    recoveries: [{ loanId: 'loan1', amount: 50 }],
    shortfall: 0,
  }),
  applyRepayment: jest.fn(),
  LOAN_STATUS: { ACTIVE: 'active' },
}));

describe('PayrollEngine Service', () => {
  describe('compute()', () => {
    it('calculates payroll purely without DB connections', async () => {
      const employee = {
        _id: 'emp1',
        fullName: 'Test User',
        targetCurrency: 'USD',
      };
      const user = { _id: 'user1' };
      const activity = { tags: [{ label: '100 bonus' }] };
      const attendanceByEmployee = new Map();
      const expensesByEmployee = new Map();
      const revisionsByEmployee = new Map();
      const loansByEmployee = new Map();

      const result = await PayrollEngine.compute({
        activity,
        employee,
        user,
        attendanceByEmployee,
        expensesByEmployee,
        revisionsByEmployee,
        loansByEmployee,
        tenantId: 'tenant1',
        currentMonth: 10,
        currentYear: 2023,
      });

      expect(result.netSalary).toBe(5350);
      expect(result.loanRecoveryTotal).toBe(50);
      expect(result.arrearsPayout).toBe(200);
      expect(result.employee).toEqual(employee);
    });
  });
});
