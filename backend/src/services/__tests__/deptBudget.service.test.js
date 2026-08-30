/**
 * @fileoverview Department Budget Service Unit Tests
 */

const deptBudgetService = require('../deptBudget.service');
const {
  DeptCostCenter,
  DeptBudgetCategory,
  DeptBudget,
  DeptBudgetLineItem,
  BudgetTransaction,
  BudgetAlert,
} = require('../../models/deptBudget.model');

jest.mock('../../models/deptBudget.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Department Budget Service', () => {
  const tenantId = 'tenant123';
  const userId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Cost Center Management ────────────────────────────────────────

  describe('createCostCenter', () => {
    it('should create a cost center', async () => {
      DeptCostCenter.create.mockResolvedValue({
        _id: 'cc1',
        code: 'ENG',
        name: 'Engineering',
      });

      const cc = await deptBudgetService.createCostCenter(
        tenantId,
        { code: 'ENG', name: 'Engineering', department: 'Engineering' },
        userId,
      );

      expect(DeptCostCenter.create).toHaveBeenCalled();
      expect(cc._id).toBe('cc1');
    });
  });

  describe('getCostCenters', () => {
    it('should return active cost centers', async () => {
      DeptCostCenter.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 'cc1' }]),
      });

      const ccs = await deptBudgetService.getCostCenters(tenantId);

      expect(DeptCostCenter.find).toHaveBeenCalledWith({
        tenantId,
        isActive: true,
      });
    });
  });

  describe('updateCostCenter', () => {
    it('should update a cost center', async () => {
      DeptCostCenter.findOneAndUpdate.mockResolvedValue({
        _id: 'cc1',
        name: 'Updated',
      });

      const cc = await deptBudgetService.updateCostCenter('cc1', tenantId, {
        name: 'Updated',
      });

      expect(cc.name).toBe('Updated');
    });

    it('should throw 404 when not found', async () => {
      DeptCostCenter.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        deptBudgetService.updateCostCenter('cc1', tenantId, { name: 'X' }),
      ).rejects.toThrow('not found');
    });
  });

  // ─── Budget Category Management ────────────────────────────────────

  describe('createCategory', () => {
    it('should create a category', async () => {
      DeptBudgetCategory.create.mockResolvedValue({
        _id: 'cat1',
        code: 'SAL',
        name: 'Salaries',
      });

      const cat = await deptBudgetService.createCategory(tenantId, {
        code: 'SAL',
        name: 'Salaries',
      });

      expect(DeptBudgetCategory.create).toHaveBeenCalled();
      expect(cat._id).toBe('cat1');
    });
  });

  // ─── Budget CRUD ──────────────────────────────────────────────────

  describe('createBudget', () => {
    it('should create a budget', async () => {
      DeptBudget.findOne.mockResolvedValue(null); // No existing
      DeptBudget.create.mockResolvedValue({
        _id: 'b1',
        department: 'Engineering',
        fiscalYear: 2026,
        status: 'Draft',
        statusHistory: [],
        save: jest.fn(),
      });

      const budget = await deptBudgetService.createBudget(
        tenantId,
        {
          costCenterId: 'cc1',
          department: 'Engineering',
          fiscalYear: 2026,
          period: 'Annual',
          totalBudgeted: 500000,
        },
        userId,
      );

      expect(DeptBudget.create).toHaveBeenCalled();
      expect(budget._id).toBe('b1');
    });

    it('should throw 409 for duplicate budget', async () => {
      DeptBudget.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(
        deptBudgetService.createBudget(
          tenantId,
          {
            costCenterId: 'cc1',
            department: 'Engineering',
            fiscalYear: 2026,
            period: 'Annual',
            totalBudgeted: 500000,
          },
          userId,
        ),
      ).rejects.toThrow('Budget already exists');
    });
  });

  describe('getBudgets', () => {
    it('should return budgets with filters', async () => {
      DeptBudget.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ _id: 'b1' }]),
      });

      const budgets = await deptBudgetService.getBudgets(tenantId, {
        fiscalYear: 2026,
        department: 'Engineering',
      });

      expect(DeptBudget.find).toHaveBeenCalled();
    });
  });

  describe('updateBudget', () => {
    it('should update budget', async () => {
      const mockBudget = {
        _id: 'b1',
        status: 'Draft',
        save: jest.fn(),
      };
      DeptBudget.findOne.mockResolvedValue(mockBudget);

      const budget = await deptBudgetService.updateBudget('b1', tenantId, {
        totalBudgeted: 600000,
      });

      expect(budget.totalBudgeted).toBe(600000);
      expect(mockBudget.save).toHaveBeenCalled();
    });

    it('should throw 400 for closed budget', async () => {
      DeptBudget.findOne.mockResolvedValue({ _id: 'b1', status: 'Closed' });

      await expect(
        deptBudgetService.updateBudget('b1', tenantId, { totalBudgeted: 600000 }),
      ).rejects.toThrow('closed');
    });
  });

  // ─── Status Transitions ────────────────────────────────────────────

  describe('transitionBudgetStatus', () => {
    it('should transition to Submitted', async () => {
      const mockBudget = {
        _id: 'b1',
        status: 'Draft',
        statusHistory: [],
        save: jest.fn(),
      };
      DeptBudget.findOne.mockResolvedValue(mockBudget);

      const result = await deptBudgetService.transitionBudgetStatus(
        'b1',
        tenantId,
        'Submitted',
        userId,
        'Ready for review',
      );

      expect(result.status).toBe('Submitted');
      expect(result.submittedBy).toBe(userId);
      expect(result.submittedAt).toBeDefined();
    });

    it('should transition to Approved', async () => {
      const mockBudget = {
        _id: 'b1',
        status: 'UnderReview',
        statusHistory: [],
        save: jest.fn(),
      };
      DeptBudget.findOne.mockResolvedValue(mockBudget);

      const result = await deptBudgetService.transitionBudgetStatus(
        'b1',
        tenantId,
        'Approved',
        userId,
        'Looks good',
      );

      expect(result.status).toBe('Approved');
      expect(result.approvedBy).toBe(userId);
      expect(result.approvalStatus).toBe('FullyApproved');
    });

    it('should reject invalid transition', async () => {
      const mockBudget = {
        _id: 'b1',
        status: 'Draft',
        statusHistory: [],
      };
      DeptBudget.findOne.mockResolvedValue(mockBudget);

      await expect(
        deptBudgetService.transitionBudgetStatus(
          'b1',
          tenantId,
          'Approved',
          userId,
        ),
      ).rejects.toThrow('Cannot transition');
    });
  });

  // ─── Line Item Management ──────────────────────────────────────────

  describe('addLineItem', () => {
    it('should add a line item', async () => {
      DeptBudget.findOne.mockResolvedValue({
        _id: 'b1',
        status: 'Draft',
        save: jest.fn(),
      });
      DeptBudgetLineItem.create.mockResolvedValue({
        _id: 'li1',
        budgetedAmount: 100000,
        actualAmount: 0,
        variance: 100000,
      });
      DeptBudgetLineItem.find.mockResolvedValue([]);

      const item = await deptBudgetService.addLineItem(tenantId, 'b1', {
        categoryId: 'cat1',
        name: 'Base Salaries',
        budgetedAmount: 100000,
      });

      expect(DeptBudgetLineItem.create).toHaveBeenCalled();
      expect(item._id).toBe('li1');
    });

    it('should throw 404 when budget not found', async () => {
      DeptBudget.findOne.mockResolvedValue(null);

      await expect(
        deptBudgetService.addLineItem(tenantId, 'b1', {
          categoryId: 'cat1',
          name: 'Base Salaries',
          budgetedAmount: 100000,
        }),
      ).rejects.toThrow('not found');
    });
  });

  describe('removeLineItem', () => {
    it('should remove a line item', async () => {
      DeptBudgetLineItem.findOne.mockResolvedValue({
        _id: 'li1',
        budgetId: 'b1',
      });
      DeptBudgetLineItem.deleteOne.mockResolvedValue({});
      DeptBudgetLineItem.find.mockResolvedValue([]);

      const result = await deptBudgetService.removeLineItem('li1', tenantId);

      expect(result.deleted).toBe(true);
      expect(DeptBudgetLineItem.deleteOne).toHaveBeenCalled();
    });
  });

  // ─── Transaction Recording ─────────────────────────────────────────

  describe('recordTransaction', () => {
    it('should record an actual transaction', async () => {
      BudgetTransaction.create.mockResolvedValue({ _id: 't1' });

      const mockItem = {
        _id: 'li1',
        budgetedAmount: 100000,
        actualAmount: 10000,
        committedAmount: 0,
        save: jest.fn(),
      };
      DeptBudgetLineItem.findOne.mockResolvedValue(mockItem);
      DeptBudgetLineItem.find.mockResolvedValue([mockItem]);

      const transaction = await deptBudgetService.recordTransaction(tenantId, {
        budgetId: 'b1',
        lineItemId: 'li1',
        transactionType: 'Actual',
        amount: 5000,
        transactionDate: new Date(),
      });

      expect(BudgetTransaction.create).toHaveBeenCalled();
      expect(mockItem.actualAmount).toBe(15000);
    });

    it('should handle reversal transactions', async () => {
      BudgetTransaction.create.mockResolvedValue({ _id: 't2' });

      const mockItem = {
        _id: 'li1',
        budgetedAmount: 100000,
        actualAmount: 20000,
        committedAmount: 0,
        save: jest.fn(),
      };
      DeptBudgetLineItem.findOne.mockResolvedValue(mockItem);
      DeptBudgetLineItem.find.mockResolvedValue([mockItem]);

      await deptBudgetService.recordTransaction(tenantId, {
        budgetId: 'b1',
        lineItemId: 'li1',
        transactionType: 'Reversal',
        amount: 5000,
        transactionDate: new Date(),
      });

      expect(mockItem.actualAmount).toBe(15000);
    });
  });

  // ─── Alert Management ─────────────────────────────────────────────

  describe('getAlerts', () => {
    it('should return alerts', async () => {
      BudgetAlert.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ alertType: 'Warning' }]),
      });

      const alerts = await deptBudgetService.getAlerts(tenantId, {});

      expect(BudgetAlert.find).toHaveBeenCalled();
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      const mockAlert = {
        _id: 'a1',
        isAcknowledged: false,
        save: jest.fn(),
      };
      BudgetAlert.findOne.mockResolvedValue(mockAlert);

      const result = await deptBudgetService.acknowledgeAlert(
        'a1',
        tenantId,
        userId,
      );

      expect(result.isAcknowledged).toBe(true);
      expect(result.acknowledgedBy).toBe(userId);
    });

    it('should throw 404 when not found', async () => {
      BudgetAlert.findOne.mockResolvedValue(null);

      await expect(
        deptBudgetService.acknowledgeAlert('a1', tenantId, userId),
      ).rejects.toThrow('not found');
    });
  });

  // ─── Reports ──────────────────────────────────────────────────────

  describe('getBudgetDashboard', () => {
    it('should generate dashboard stats', async () => {
      DeptBudget.find.mockResolvedValue([
        {
          status: 'Approved',
          totalBudgeted: 500000,
          totalActual: 400000,
          totalCommitted: 20000,
          utilizationRate: 80,
          department: 'Engineering',
          variance: 100000,
        },
        {
          status: 'Draft',
          totalBudgeted: 300000,
          totalActual: 0,
          totalCommitted: 0,
          utilizationRate: 0,
          department: 'Sales',
          variance: 300000,
        },
      ]);
      BudgetAlert.find.mockResolvedValue([
        { alertType: 'Warning' },
        { alertType: 'Critical' },
      ]);

      const dashboard = await deptBudgetService.getBudgetDashboard(tenantId, 2026);

      expect(dashboard.totalBudgets).toBe(2);
      expect(dashboard.approvedBudgets).toBe(1);
      expect(dashboard.draftBudgets).toBe(1);
      expect(dashboard.totalBudgeted).toBe(800000);
      expect(dashboard.totalActual).toBe(400000);
      expect(dashboard.overallUtilization).toBe(50);
      expect(dashboard.alerts.warning).toBe(1);
      expect(dashboard.alerts.critical).toBe(1);
      expect(dashboard.byDepartment).toHaveLength(2);
    });
  });

  describe('getBudgetComparison', () => {
    it('should return YoY comparison', async () => {
      DeptBudget.find.mockResolvedValue([
        { fiscalYear: 2024, totalBudgeted: 400000, totalActual: 380000, variance: 20000, utilizationRate: 95 },
        { fiscalYear: 2025, totalBudgeted: 450000, totalActual: 420000, variance: 30000, utilizationRate: 93.33 },
        { fiscalYear: 2026, totalBudgeted: 500000, totalActual: 400000, variance: 100000, utilizationRate: 80 },
      ]);

      const comparison = await deptBudgetService.getBudgetComparison(
        tenantId,
        'Engineering',
        [2024, 2025, 2026],
      );

      expect(comparison.department).toBe('Engineering');
      expect(comparison.years).toHaveLength(3);
      expect(comparison.years[0].fiscalYear).toBe(2024);
    });
  });
});
