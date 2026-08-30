/**
 * @fileoverview Salary Revision Simulator Service Unit Tests
 */

const salaryRevisionService = require('../salaryRevision.service');
const {
  RevisionScenario,
  RevisionLineItem,
  RevisionBatch,
  RevisionAuditLog,
} = require('../../models/salaryRevision.model');
const Employee = require('../../models/employee.model');

jest.mock('../../models/salaryRevision.model');
jest.mock('../../models/employee.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Salary Revision Service', () => {
  const tenantId = 'tenant123';
  const userId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Scenario Management ───────────────────────────────────────────

  describe('createScenario', () => {
    it('should create a scenario', async () => {
      RevisionScenario.create.mockResolvedValue({
        _id: 's1',
        name: 'FY2026 Hike',
        status: 'Draft',
        statusHistory: [],
      });
      RevisionAuditLog.create.mockResolvedValue({});

      const scenario = await salaryRevisionService.createScenario(
        tenantId,
        { name: 'FY2026 Hike', fiscalYear: 2026, effectiveDate: new Date() },
        userId,
      );

      expect(RevisionScenario.create).toHaveBeenCalled();
      expect(scenario._id).toBe('s1');
    });
  });

  describe('getScenarios', () => {
    it('should return scenarios with filters', async () => {
      RevisionScenario.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 's1' }]),
      });

      const scenarios = await salaryRevisionService.getScenarios(tenantId, {
        fiscalYear: 2026,
        status: 'Simulated',
      });

      expect(RevisionScenario.find).toHaveBeenCalled();
    });
  });

  describe('getScenario', () => {
    it('should return a scenario', async () => {
      RevisionScenario.findOne.mockResolvedValue({
        _id: 's1',
        name: 'FY2026 Hike',
      });

      const scenario = await salaryRevisionService.getScenario('s1', tenantId);
      expect(scenario._id).toBe('s1');
    });

    it('should throw 404 when not found', async () => {
      RevisionScenario.findOne.mockResolvedValue(null);

      await expect(
        salaryRevisionService.getScenario('s1', tenantId),
      ).rejects.toThrow('not found');
    });
  });

  describe('updateScenario', () => {
    it('should update Draft scenario', async () => {
      const mockScenario = {
        _id: 's1',
        status: 'Draft',
        save: jest.fn(),
      };
      RevisionScenario.findOne.mockResolvedValue(mockScenario);

      const scenario = await salaryRevisionService.updateScenario(
        's1',
        tenantId,
        { globalHikePercent: 12 },
        userId,
      );

      expect(scenario.globalHikePercent).toBe(12);
      expect(mockScenario.save).toHaveBeenCalled();
    });

    it('should throw 400 for non-editable status', async () => {
      RevisionScenario.findOne.mockResolvedValue({
        _id: 's1',
        status: 'Approved',
      });

      await expect(
        salaryRevisionService.updateScenario('s1', tenantId, {}, userId),
      ).rejects.toThrow('Can only edit');
    });
  });

  describe('transitionScenario', () => {
    it('should transition to Submitted', async () => {
      const mockScenario = {
        _id: 's1',
        status: 'Simulated',
        statusHistory: [],
        save: jest.fn(),
      };
      RevisionScenario.findOne.mockResolvedValue(mockScenario);
      RevisionAuditLog.create.mockResolvedValue({});

      const result = await salaryRevisionService.transitionScenario(
        's1',
        tenantId,
        'Submitted',
        userId,
        'Ready for review',
      );

      expect(result.status).toBe('Submitted');
    });

    it('should reject invalid transition', async () => {
      RevisionScenario.findOne.mockResolvedValue({
        _id: 's1',
        status: 'Draft',
        statusHistory: [],
      });

      await expect(
        salaryRevisionService.transitionScenario(
          's1',
          tenantId,
          'Approved',
          userId,
        ),
      ).rejects.toThrow('Cannot transition');
    });
  });

  // ─── Simulation Engine ─────────────────────────────────────────────

  describe('runSimulation', () => {
    it('should run simulation with UniformPercent', async () => {
      const mockScenario = {
        _id: 's1',
        scenarioType: 'UniformPercent',
        globalHikePercent: 10,
        maxHikeCapPercent: 50,
        departmentHikes: [],
        performanceBands: [],
        statusHistory: [],
        save: jest.fn(),
      };
      RevisionScenario.findOne.mockResolvedValue(mockScenario);

      Employee.find.mockResolvedValue([
        { _id: 'e1', monthlySalary: 50000, department: 'Engineering', role: 'Dev', jobLevel: 'Senior', joiningDate: new Date(2023, 0, 1) },
        { _id: 'e2', monthlySalary: 40000, department: 'Sales', role: 'Rep', jobLevel: 'Junior', joiningDate: new Date(2024, 0, 1) },
      ]);

      RevisionLineItem.deleteMany.mockResolvedValue({});
      RevisionLineItem.insertMany.mockResolvedValue([]);

      const result = await salaryRevisionService.runSimulation(
        's1',
        tenantId,
        userId,
      );

      expect(result.scenario.totalEmployees).toBe(2);
      expect(result.stats.mean).toBe(10);
    });

    it('should throw when no employees found', async () => {
      RevisionScenario.findOne.mockResolvedValue({
        _id: 's1',
        scenarioType: 'UniformPercent',
        globalHikePercent: 10,
        maxHikeCapPercent: 50,
        departmentHikes: [],
        performanceBands: [],
        statusHistory: [],
      });
      Employee.find.mockResolvedValue([]);

      await expect(
        salaryRevisionService.runSimulation('s1', tenantId, userId),
      ).rejects.toThrow('No active employees');
    });
  });

  // ─── Line Item Management ──────────────────────────────────────────

  describe('overrideRevision', () => {
    it('should override a revision', async () => {
      const mockItem = {
        _id: 'li1',
        scenarioId: 's1',
        employeeId: 'e1',
        currentMonthlySalary: 50000,
        revisedMonthlySalary: 55000,
        hikePercent: 10,
        save: jest.fn(),
      };
      RevisionLineItem.findOne.mockResolvedValue(mockItem);
      RevisionAuditLog.create.mockResolvedValue({});
      RevisionLineItem.find.mockResolvedValue([mockItem]);
      RevisionScenario.findByIdAndUpdate.mockResolvedValue({});

      const item = await salaryRevisionService.overrideRevision(
        'li1',
        tenantId,
        { hikePercent: 15, reason: 'Market adjustment' },
        userId,
      );

      expect(item.hikePercent).toBe(15);
      expect(item.isManualOverride).toBe(true);
      expect(item.revisedMonthlySalary).toBe(57500);
    });
  });

  describe('approveRevision', () => {
    it('should approve a revision', async () => {
      const mockItem = {
        _id: 'li1',
        status: 'Pending',
        save: jest.fn(),
      };
      RevisionLineItem.findOne.mockResolvedValue(mockItem);
      RevisionAuditLog.create.mockResolvedValue({});

      const item = await salaryRevisionService.approveRevision(
        'li1',
        tenantId,
        userId,
      );

      expect(item.status).toBe('Approved');
      expect(item.approvedBy).toBe(userId);
    });
  });

  describe('rejectRevision', () => {
    it('should reject with reason', async () => {
      const mockItem = {
        _id: 'li1',
        status: 'Pending',
        save: jest.fn(),
      };
      RevisionLineItem.findOne.mockResolvedValue(mockItem);
      RevisionAuditLog.create.mockResolvedValue({});

      const item = await salaryRevisionService.rejectRevision(
        'li1',
        tenantId,
        userId,
        'Below expectations',
      );

      expect(item.status).toBe('Rejected');
      expect(item.rejectionReason).toBe('Below expectations');
    });

    it('should throw without reason', async () => {
      await expect(
        salaryRevisionService.rejectRevision('li1', tenantId, userId, ''),
      ).rejects.toThrow('required');
    });
  });

  // ─── Batch Management ──────────────────────────────────────────────

  describe('createBatch', () => {
    it('should create a batch from approved scenario', async () => {
      RevisionScenario.findOne.mockResolvedValue({
        _id: 's1',
        status: 'Approved',
        fiscalYear: 2026,
        effectiveDate: new Date(),
      });
      RevisionLineItem.find.mockResolvedValue([
        { _id: 'li1', hikeAmount: 5000 },
        { _id: 'li2', hikeAmount: 3000 },
      ]);
      RevisionBatch.countDocuments.mockResolvedValue(5);
      RevisionBatch.create.mockResolvedValue({
        _id: 'b1',
        batchNumber: 'REV-2026-0006',
      });
      RevisionAuditLog.create.mockResolvedValue({});

      const batch = await salaryRevisionService.createBatch(
        's1',
        tenantId,
        { effectiveDate: new Date() },
        userId,
      );

      expect(batch.batchNumber).toBe('REV-2026-0006');
    });

    it('should throw when scenario not approved', async () => {
      RevisionScenario.findOne.mockResolvedValue(null);

      await expect(
        salaryRevisionService.createBatch('s1', tenantId, {}, userId),
      ).rejects.toThrow('not approved');
    });
  });

  describe('applyBatch', () => {
    it('should apply batch and update employees', async () => {
      const mockBatch = {
        _id: 'b1',
        scenarioId: 's1',
        status: 'Pending',
        save: jest.fn(),
      };
      RevisionBatch.findOne.mockResolvedValue(mockBatch);

      RevisionLineItem.find.mockResolvedValue([
        { _id: 'li1', employeeId: 'e1', revisedMonthlySalary: 55000, status: 'Approved', save: jest.fn() },
        { _id: 'li2', employeeId: 'e2', revisedMonthlySalary: 44000, status: 'Approved', save: jest.fn() },
      ]);

      Employee.findByIdAndUpdate.mockResolvedValue({});
      RevisionScenario.findByIdAndUpdate.mockResolvedValue({});
      RevisionAuditLog.create.mockResolvedValue({});

      const batch = await salaryRevisionService.applyBatch(
        'b1',
        tenantId,
        userId,
      );

      expect(batch.processedCount).toBe(2);
      expect(batch.failedCount).toBe(0);
      expect(Employee.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Reports ──────────────────────────────────────────────────────

  describe('getSimulationDashboard', () => {
    it('should generate dashboard', async () => {
      RevisionScenario.find.mockResolvedValue([
        {
          totalCurrentPayroll: 500000,
          totalIncrementCost: 50000,
          averageHikePercent: 10,
          status: 'Simulated',
          name: 'Scenario 1',
          _id: 's1',
          scenarioType: 'UniformPercent',
          totalEmployees: 100,
        },
      ]);

      const dashboard = await salaryRevisionService.getSimulationDashboard(
        tenantId,
        2026,
      );

      expect(dashboard.totalScenarios).toBe(1);
      expect(dashboard.simulatedCount).toBe(1);
      expect(dashboard.totalCurrentPayroll).toBe(500000);
      expect(dashboard.totalIncrementCost).toBe(50000);
    });
  });

  describe('compareScenarioResults', () => {
    it('should compare scenarios', async () => {
      RevisionScenario.find.mockResolvedValue([
        { _id: 's1', name: 'Conservative', scenarioType: 'UniformPercent', status: 'Simulated', totalEmployees: 100, averageHikePercent: 8, totalIncrementCost: 400000, annualizedImpact: 4800000, budgetImpactPercent: 8 },
        { _id: 's2', name: 'Aggressive', scenarioType: 'PerformanceBased', status: 'Simulated', totalEmployees: 100, averageHikePercent: 15, totalIncrementCost: 750000, annualizedImpact: 9000000, budgetImpactPercent: 15 },
      ]);

      const comparison = await salaryRevisionService.compareScenarioResults(
        tenantId,
        ['s1', 's2'],
      );

      expect(comparison.count).toBe(2);
      expect(comparison.bestByCost).toBe('Conservative');
      expect(comparison.bestByAverageHike).toBe('Aggressive');
    });
  });

  // ─── Audit ────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('should return audit log', async () => {
      RevisionAuditLog.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ action: 'ScenarioCreated' }]),
      });

      const log = await salaryRevisionService.getAuditLog(tenantId, 's1');

      expect(RevisionAuditLog.find).toHaveBeenCalled();
    });
  });
});
