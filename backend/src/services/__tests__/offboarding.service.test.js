/**
 * @fileoverview Offboarding Service Unit Tests
 */

const offboardingService = require('../offboarding.service');
const {
  OffboardingProcess,
  ClearanceChecklistItem,
  AssetReturn,
  KnowledgeTransfer,
  OffboardingActivityLog,
} = require('../../models/offboarding.model');
const Employee = require('../../models/employee.model');

jest.mock('../../models/offboarding.model');
jest.mock('../../models/employee.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Offboarding Service', () => {
  const tenantId = 'tenant123';
  const userId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Process Lifecycle ─────────────────────────────────────────────

  describe('initiateOffboarding', () => {
    it('should initiate offboarding with default checklist', async () => {
      OffboardingProcess.findOne.mockResolvedValue(null); // No existing
      OffboardingProcess.create.mockResolvedValue({
        _id: 'o1',
        status: 'Initiated',
        statusHistory: [],
      });
      ClearanceChecklistItem.insertMany.mockResolvedValue([]);
      OffboardingActivityLog.create.mockResolvedValue({});

      const process = await offboardingService.initiateOffboarding(
        tenantId,
        'emp1',
        {
          exitType: 'Resignation',
          lastWorkingDay: new Date(2026, 8, 30),
          leavingReason: 'BetterOpportunity',
        },
        userId,
      );

      expect(OffboardingProcess.create).toHaveBeenCalled();
      expect(ClearanceChecklistItem.insertMany).toHaveBeenCalled();
      expect(process._id).toBe('o1');
    });

    it('should throw 409 if already exists', async () => {
      OffboardingProcess.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(
        offboardingService.initiateOffboarding(
          tenantId,
          'emp1',
          {
            exitType: 'Resignation',
            lastWorkingDay: new Date(),
          },
          userId,
        ),
      ).rejects.toThrow('already exists');
    });
  });

  describe('getProcess', () => {
    it('should return process with populated fields', async () => {
      OffboardingProcess.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: 'o1',
            status: 'InProgress',
          }),
        }),
      });

      const process = await offboardingService.getProcess('o1', tenantId);
      expect(OffboardingProcess.findOne).toHaveBeenCalled();
    });

    it('should throw 404 when not found', async () => {
      OffboardingProcess.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        offboardingService.getProcess('o1', tenantId),
      ).rejects.toThrow();
    });
  });

  describe('getProcesses', () => {
    it('should return processes with filters', async () => {
      OffboardingProcess.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ _id: 'o1' }]),
      });

      const processes = await offboardingService.getProcesses(tenantId, {
        status: 'InProgress',
      });

      expect(OffboardingProcess.find).toHaveBeenCalled();
    });
  });

  describe('transitionProcess', () => {
    it('should transition to InProgress', async () => {
      const mockProcess = {
        _id: 'o1',
        status: 'Initiated',
        statusHistory: [],
        save: jest.fn(),
      };
      OffboardingProcess.findOne.mockResolvedValue(mockProcess);
      OffboardingActivityLog.create.mockResolvedValue({});

      const result = await offboardingService.transitionProcess(
        'o1',
        tenantId,
        'InProgress',
        userId,
      );

      expect(result.status).toBe('InProgress');
      expect(result.save).toHaveBeenCalled();
    });

    it('should set completion fields on Completed', async () => {
      const mockProcess = {
        _id: 'o1',
        status: 'SettlementPending',
        statusHistory: [],
        save: jest.fn(),
      };
      OffboardingProcess.findOne.mockResolvedValue(mockProcess);
      OffboardingActivityLog.create.mockResolvedValue({});

      const result = await offboardingService.transitionProcess(
        'o1',
        tenantId,
        'Completed',
        userId,
      );

      expect(result.completedAt).toBeDefined();
      expect(result.completedBy).toBe(userId);
      expect(result.progressPercent).toBe(100);
    });

    it('should reject invalid transition', async () => {
      OffboardingProcess.findOne.mockResolvedValue({
        _id: 'o1',
        status: 'Completed',
        statusHistory: [],
      });

      await expect(
        offboardingService.transitionProcess(
          'o1',
          tenantId,
          'Initiated',
          userId,
        ),
      ).rejects.toThrow('Cannot transition');
    });
  });

  // ─── Clearance Checklist ──────────────────────────────────────────

  describe('updateClearanceItem', () => {
    it('should clear an item', async () => {
      const mockItem = {
        _id: 'ci1',
        offboardingId: 'o1',
        status: 'Pending',
        save: jest.fn(),
      };
      ClearanceChecklistItem.findOne.mockResolvedValue(mockItem);
      ClearanceChecklistItem.find.mockResolvedValue([
        { status: 'Cleared' },
        { status: 'Cleared' },
      ]);
      OffboardingProcess.findOne.mockResolvedValue({
        _id: 'o1',
        progressPercent: 0,
        save: jest.fn(),
      });

      const item = await offboardingService.updateClearanceItem(
        'ci1',
        tenantId,
        { status: 'Cleared' },
        userId,
      );

      expect(item.status).toBe('Cleared');
      expect(item.clearedById).toBe(userId);
    });
  });

  // ─── Asset Returns ────────────────────────────────────────────────

  describe('addAssetReturn', () => {
    it('should add an asset record', async () => {
      AssetReturn.create.mockResolvedValue({
        _id: 'a1',
        assetType: 'Laptop',
        status: 'Pending',
      });

      const asset = await offboardingService.addAssetReturn('o1', tenantId, {
        assetType: 'Laptop',
        assetDescription: 'MacBook Pro 14"',
        estimatedValue: 150000,
      });

      expect(AssetReturn.create).toHaveBeenCalled();
      expect(asset._id).toBe('a1');
    });
  });

  describe('updateAssetReturn', () => {
    it('should mark asset as returned', async () => {
      const mockAsset = {
        _id: 'a1',
        offboardingId: 'o1',
        status: 'Pending',
        save: jest.fn(),
      };
      AssetReturn.findOne.mockResolvedValue(mockAsset);
      OffboardingActivityLog.create.mockResolvedValue({});

      const asset = await offboardingService.updateAssetReturn(
        'a1',
        tenantId,
        { status: 'Returned', returnCondition: 'Good' },
        userId,
      );

      expect(asset.status).toBe('Returned');
      expect(asset.receivedById).toBe(userId);
    });

    it('should set deduction for lost/damaged', async () => {
      const mockAsset = {
        _id: 'a1',
        offboardingId: 'o1',
        estimatedValue: 5000,
        status: 'Pending',
        save: jest.fn(),
      };
      AssetReturn.findOne.mockResolvedValue(mockAsset);
      OffboardingActivityLog.create.mockResolvedValue({});

      const asset = await offboardingService.updateAssetReturn(
        'a1',
        tenantId,
        { status: 'Lost' },
        userId,
      );

      expect(asset.deductionAmount).toBe(5000);
    });
  });

  describe('getTotalAssetDeductions', () => {
    it('should sum deductions', async () => {
      AssetReturn.find.mockResolvedValue([
        { deductionAmount: 5000 },
        { deductionAmount: 2000 },
      ]);

      const total = await offboardingService.getTotalAssetDeductions(
        'o1',
        tenantId,
      );
      expect(total).toBe(7000);
    });
  });

  // ─── Knowledge Transfer ───────────────────────────────────────────

  describe('addKnowledgeTransfer', () => {
    it('should add a KT record', async () => {
      KnowledgeTransfer.create.mockResolvedValue({
        _id: 'kt1',
        topic: 'API Architecture',
      });

      const kt = await offboardingService.addKnowledgeTransfer('o1', tenantId, {
        transferToId: 'emp2',
        topic: 'API Architecture',
      });

      expect(kt._id).toBe('kt1');
    });
  });

  // ─── Exit Interview ───────────────────────────────────────────────

  describe('scheduleExitInterview', () => {
    it('should schedule interview', async () => {
      const mockProcess = {
        _id: 'o1',
        save: jest.fn(),
      };
      OffboardingProcess.findOne.mockResolvedValue(mockProcess);
      OffboardingActivityLog.create.mockResolvedValue({});

      const process = await offboardingService.scheduleExitInterview(
        'o1',
        tenantId,
        { date: new Date(), interviewerId: 'user456' },
        userId,
      );

      expect(mockProcess.save).toHaveBeenCalled();
    });
  });

  describe('completeExitInterview', () => {
    it('should complete interview with rating', async () => {
      const mockProcess = {
        _id: 'o1',
        save: jest.fn(),
      };
      OffboardingProcess.findOne.mockResolvedValue(mockProcess);
      OffboardingActivityLog.create.mockResolvedValue({});

      const process = await offboardingService.completeExitInterview(
        'o1',
        tenantId,
        { rating: 4, feedback: 'Great team' },
        userId,
      );

      expect(mockProcess.exitInterviewConducted).toBe(true);
      expect(mockProcess.exitInterviewRating).toBe(4);
    });
  });

  // ─── Settlement ───────────────────────────────────────────────────

  describe('initiateSettlement', () => {
    it('should initiate settlement', async () => {
      const mockProcess = {
        _id: 'o1',
        employeeId: 'emp1',
        lastWorkingDay: new Date(2026, 8, 30),
        settlementStatus: 'NotInitiated',
        statusHistory: [],
        save: jest.fn(),
      };
      OffboardingProcess.findOne.mockResolvedValue(mockProcess);
      AssetReturn.find.mockResolvedValue([]);
      Employee.findById.mockResolvedValue({ monthlySalary: 60000 });
      OffboardingActivityLog.create.mockResolvedValue({});

      const result = await offboardingService.initiateSettlement(
        'o1',
        tenantId,
        userId,
      );

      expect(result.process.settlementStatus).toBe('InProgress');
      expect(result.estimate).toBeDefined();
      expect(result.estimate.total).toBeGreaterThan(0);
    });
  });

  // ─── Dashboard ────────────────────────────────────────────────────

  describe('getOffboardingDashboard', () => {
    it('should return dashboard stats', async () => {
      const mockProcesses = [
        { _id: 'o1', status: 'InProgress' },
        { _id: 'o2', status: 'ClearancePending' },
      ];
      OffboardingProcess.find
        .mockResolvedValueOnce(mockProcesses)
        .mockResolvedValueOnce([{ _id: 'o3' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const dashboard =
        await offboardingService.getOffboardingDashboard(tenantId);

      expect(dashboard.activeCount).toBe(2);
      expect(dashboard.upcomingCount).toBe(1);
    });
  });
});
