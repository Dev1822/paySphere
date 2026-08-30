const mongoose = require('mongoose');
const HeadcountPlan = require('../../models/headcountPlan.model');
const Employee = require('../../models/employee.model');
const headcountPlanningService = require('../headcountPlanning.service');

describe('HeadcountPlanningService', () => {
  const tenantId = new mongoose.Types.ObjectId();
  const department = 'Engineering';
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequisition', () => {
    it('returns an error if backfill has no replacedEmployeeId', async () => {
      const data = {
        type: 'Backfill',
        department,
        requestedCount: 1,
        ctcBudget: 1000,
      };
      const result = await headcountPlanningService.validateRequisition(
        tenantId,
        data,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(422);
      expect(result.error).toMatch(/require a replacedEmployeeId/);
    });

    it('returns an error if replaced employee is not exited or on notice', async () => {
      const employeeId = new mongoose.Types.ObjectId();
      const data = {
        type: 'Backfill',
        department,
        requestedCount: 1,
        ctcBudget: 1000,
        replacedEmployeeId: employeeId,
      };

      jest
        .spyOn(Employee, 'findOne')
        .mockResolvedValueOnce({ employmentStatus: 'Active' });

      const result = await headcountPlanningService.validateRequisition(
        tenantId,
        data,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(422);
      expect(result.error).toMatch(/must hold a terminated\/resigned status/);
    });

    it('returns an error if no headcount plan exists', async () => {
      const data = {
        type: 'New',
        department,
        requestedCount: 1,
        ctcBudget: 1000,
      };

      jest.spyOn(HeadcountPlan, 'findOne').mockResolvedValueOnce(null);

      const result = await headcountPlanningService.validateRequisition(
        tenantId,
        data,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(422);
      expect(result.error).toMatch(/No headcount plan found/);
    });

    it('returns an error if requested headcount exceeds approved headcount', async () => {
      const data = {
        type: 'New',
        department,
        requestedCount: 2,
        ctcBudget: 1000,
      };
      const plan = {
        approvedHeadcount: 5,
        utilizedHeadcount: 4,
        budgetLimit: 10000,
        utilizedBudget: 8000,
      };

      jest.spyOn(HeadcountPlan, 'findOne').mockResolvedValueOnce(plan);

      const result = await headcountPlanningService.validateRequisition(
        tenantId,
        data,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(422);
      expect(result.error).toMatch(/exceeds department approved headcount/);
    });

    it('returns an error if requested budget exceeds budget limit', async () => {
      const data = {
        type: 'New',
        department,
        requestedCount: 1,
        ctcBudget: 3000,
      };
      const plan = {
        approvedHeadcount: 5,
        utilizedHeadcount: 4,
        budgetLimit: 10000,
        utilizedBudget: 8000,
      };

      jest.spyOn(HeadcountPlan, 'findOne').mockResolvedValueOnce(plan);

      const result = await headcountPlanningService.validateRequisition(
        tenantId,
        data,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(422);
      expect(result.error).toMatch(/exceeds department budget limit/);
    });

    it('returns success for a valid new requisition', async () => {
      const data = {
        type: 'New',
        department,
        requestedCount: 1,
        ctcBudget: 1000,
      };
      const plan = {
        approvedHeadcount: 5,
        utilizedHeadcount: 4,
        budgetLimit: 10000,
        utilizedBudget: 8000,
      };

      jest.spyOn(HeadcountPlan, 'findOne').mockResolvedValueOnce(plan);

      const result = await headcountPlanningService.validateRequisition(
        tenantId,
        data,
      );

      expect(result.ok).toBe(true);
      expect(result.plan).toBe(plan);
    });
  });

  describe('getHeadcountAnalytics', () => {
    it('returns calculated analytics based on plans', async () => {
      const plans = [
        {
          department: 'Engineering',
          approvedHeadcount: 10,
          utilizedHeadcount: 8,
          budgetLimit: 100000,
          utilizedBudget: 80000,
        },
        {
          department: 'Sales',
          approvedHeadcount: 5,
          utilizedHeadcount: 5,
          budgetLimit: 50000,
          utilizedBudget: 50000,
        },
      ];

      jest.spyOn(HeadcountPlan, 'find').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(plans),
      });

      const result = await headcountPlanningService.getHeadcountAnalytics(
        tenantId,
        currentYear,
      );

      expect(result.totalPlannedHeadcount).toBe(15);
      expect(result.totalUtilizedHeadcount).toBe(13);
      expect(result.totalBudgetLimit).toBe(150000);
      expect(result.totalUtilizedBudget).toBe(130000);
      expect(result.totalBudgetUtilizationPercent).toBe('86.67');
      expect(result.departments).toHaveLength(2);
      expect(result.departments[0].budgetUtilizationPercent).toBe('80.00');
      expect(result.departments[1].budgetUtilizationPercent).toBe('100.00');
    });
  });
});
