/**
 * @fileoverview Comp-Off Service Unit Tests
 */

const compOffService = require('../compOff.service');
const {
  CompOffPolicy,
  CompOffRequest,
  CompOffBalance,
  CompOffLedger,
} = require('../../models/compOff.model');

// Mock all models
jest.mock('../../models/compOff.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Comp-Off Service', () => {
  const tenantId = 'tenant123';
  const employeeId = 'emp123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Policy Management ─────────────────────────────────────────────

  describe('createPolicy', () => {
    it('should create a new policy', async () => {
      const mockData = {
        name: 'Weekend Policy',
        accrualRules: [{ workType: 'weekend', hoursPerDay: 8 }],
      };
      CompOffPolicy.create.mockResolvedValue({ _id: 'p1', ...mockData });

      const policy = await compOffService.createPolicy(
        tenantId,
        mockData,
        'user123',
      );

      expect(CompOffPolicy.create).toHaveBeenCalled();
      expect(policy._id).toBe('p1');
    });
  });

  describe('getPolicies', () => {
    it('should return active policies by default', async () => {
      CompOffPolicy.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 'p1' }]),
      });

      const policies = await compOffService.getPolicies(tenantId);

      expect(CompOffPolicy.find).toHaveBeenCalledWith({
        tenantId,
        isActive: true,
      });
    });

    it('should return all policies when includeInactive is true', async () => {
      CompOffPolicy.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 'p1' }, { _id: 'p2' }]),
      });

      const policies = await compOffService.getPolicies(tenantId, true);

      expect(CompOffPolicy.find).toHaveBeenCalledWith({ tenantId });
    });
  });

  // ─── Balance Queries ───────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return existing balance', async () => {
      const mockBalance = {
        tenantId,
        employeeId,
        year: 2026,
        availableBalance: 5,
        totalAccrued: 7,
        totalUsed: 2,
      };
      CompOffBalance.findOne.mockResolvedValue(mockBalance);

      const balance = await compOffService.getBalance(tenantId, employeeId, 2026);

      expect(balance.availableBalance).toBe(5);
    });

    it('should return zero balance when no record exists', async () => {
      CompOffBalance.findOne.mockResolvedValue(null);

      const balance = await compOffService.getBalance(tenantId, employeeId, 2026);

      expect(balance.availableBalance).toBe(0);
      expect(balance.totalAccrued).toBe(0);
      expect(balance.totalUsed).toBe(0);
    });
  });

  // ─── Request Queries ───────────────────────────────────────────────

  describe('getEmployeeRequests', () => {
    it('should query with status filter', async () => {
      CompOffRequest.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ _id: 'r1' }]),
      });

      const requests = await compOffService.getEmployeeRequests(
        tenantId,
        employeeId,
        { status: 'approved' },
      );

      expect(CompOffRequest.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      );
    });

    it('should query without filters', async () => {
      CompOffRequest.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });

      await compOffService.getEmployeeRequests(tenantId, employeeId);

      expect(CompOffRequest.find).toHaveBeenCalledWith({
        tenantId,
        employeeId,
      });
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending requests with populated fields', async () => {
      CompOffRequest.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ _id: 'r1', status: 'pending' }]),
      });

      const requests = await compOffService.getPendingApprovals(tenantId);

      expect(CompOffRequest.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });
  });

  // ─── Ledger Queries ────────────────────────────────────────────────

  describe('getLedger', () => {
    it('should return ledger entries with default options', async () => {
      CompOffLedger.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ type: 'accrual' }]),
      });

      const ledger = await compOffService.getLedger(tenantId, employeeId);

      expect(CompOffLedger.find).toHaveBeenCalled();
    });

    it('should apply type filter when provided', async () => {
      CompOffLedger.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await compOffService.getLedger(tenantId, employeeId, { type: 'accrual' });

      expect(CompOffLedger.find).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'accrual' }),
      );
    });
  });

  // ─── Balance Updates ───────────────────────────────────────────────

  describe('updateBalanceOnAccrual', () => {
    it('should create balance record on accrual', async () => {
      const mockBalance = {
        availableBalance: 3,
        totalAccrued: 3,
        save: jest.fn(),
      };
      CompOffBalance.findOneAndUpdate.mockResolvedValue(mockBalance);
      CompOffLedger.create.mockResolvedValue({});

      const balance = await compOffService.updateBalanceOnAccrual(
        tenantId,
        employeeId,
        1,
        'req1',
        'policy1',
      );

      expect(CompOffBalance.findOneAndUpdate).toHaveBeenCalled();
      expect(CompOffLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'accrual',
          days: 1,
        }),
      );
    });
  });

  describe('updateBalanceOnUsage', () => {
    it('should deduct balance on usage', async () => {
      const mockBalance = {
        availableBalance: 5,
        totalUsed: 0,
        save: jest.fn(),
      };
      CompOffBalance.findOne.mockResolvedValue(mockBalance);
      CompOffLedger.create.mockResolvedValue({});

      await compOffService.updateBalanceOnUsage(tenantId, employeeId, 1, 'req1');

      expect(mockBalance.totalUsed).toBe(1);
      expect(mockBalance.availableBalance).toBe(4);
      expect(mockBalance.save).toHaveBeenCalled();
    });

    it('should throw when balance is insufficient', async () => {
      const mockBalance = {
        availableBalance: 0,
        totalUsed: 0,
        save: jest.fn(),
      };
      CompOffBalance.findOne.mockResolvedValue(mockBalance);

      await expect(
        compOffService.updateBalanceOnUsage(tenantId, employeeId, 1, 'req1'),
      ).rejects.toThrow('Insufficient');
    });
  });

  describe('updateBalanceOnCancellation', () => {
    it('should reverse balance on cancellation', async () => {
      const mockBalance = {
        availableBalance: 3,
        totalCancelled: 0,
        save: jest.fn(),
      };
      CompOffBalance.findOne.mockResolvedValue(mockBalance);
      CompOffLedger.create.mockResolvedValue({});

      await compOffService.updateBalanceOnCancellation(
        tenantId,
        employeeId,
        1,
        'req1',
      );

      expect(mockBalance.totalCancelled).toBe(1);
      expect(mockBalance.availableBalance).toBe(2);
      expect(mockBalance.save).toHaveBeenCalled();
    });
  });

  // ─── Cancellation ──────────────────────────────────────────────────

  describe('cancelRequest', () => {
    it('should cancel a pending request', async () => {
      const mockRequest = {
        _id: 'req1',
        status: 'pending',
        daysEarned: 1,
        employeeId: { toString: () => employeeId },
        save: jest.fn(),
        statusHistory: [],
      };
      CompOffRequest.findOne.mockResolvedValue(mockRequest);

      const result = await compOffService.cancelRequest(
        'req1',
        tenantId,
        employeeId,
        'Changed mind',
        false,
      );

      expect(result.status).toBe('cancelled');
      expect(result.save).toHaveBeenCalled();
    });

    it('should throw when request not found', async () => {
      CompOffRequest.findOne.mockResolvedValue(null);

      await expect(
        compOffService.cancelRequest('req1', tenantId, employeeId, '', false),
      ).rejects.toThrow('not found');
    });

    it('should throw when already cancelled', async () => {
      const mockRequest = {
        _id: 'req1',
        status: 'cancelled',
        employeeId: { toString: () => employeeId },
      };
      CompOffRequest.findOne.mockResolvedValue(mockRequest);

      await expect(
        compOffService.cancelRequest('req1', tenantId, employeeId, '', false),
      ).rejects.toThrow('already cancelled');
    });
  });

  // ─── Expiry Processing ─────────────────────────────────────────────

  describe('processExpiries', () => {
    it('should process expired requests', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'approved',
        daysEarned: 1,
        workDate: new Date(2026, 0, 1),
        employeeId: 'emp1',
        policyId: 'p1',
        save: jest.fn(),
        statusHistory: [],
      };
      CompOffRequest.find.mockResolvedValue([mockRequest]);

      const mockBalance = {
        totalExpired: 0,
        totalUsed: 1,
        availableBalance: 2,
        save: jest.fn(),
      };
      CompOffBalance.findOne.mockResolvedValue(mockBalance);
      CompOffLedger.create.mockResolvedValue({});

      const result = await compOffService.processExpiries(tenantId);

      expect(result.processedCount).toBe(1);
      expect(result.balanceAdjusted).toBe(1);
      expect(mockBalance.totalExpired).toBe(1);
      expect(mockBalance.totalUsed).toBe(0);
    });

    it('should handle no expired requests', async () => {
      CompOffRequest.find.mockResolvedValue([]);

      const result = await compOffService.processExpiries(tenantId);

      expect(result.processedCount).toBe(0);
      expect(result.balanceAdjusted).toBe(0);
    });
  });

  // ─── Summary Report ────────────────────────────────────────────────

  describe('generateSummaryReport', () => {
    it('should generate a summary report', async () => {
      CompOffRequest.find.mockResolvedValue([]);
      CompOffBalance.find.mockResolvedValue([]);

      const report = await compOffService.generateSummaryReport(
        tenantId,
        2026,
      );

      expect(report.year).toBe(2026);
      expect(report.totalEmployees).toBe(0);
      expect(report.overallStats).toBeDefined();
      expect(report.byWorkType).toBeDefined();
      expect(report.balanceSummary).toBeDefined();
    });

    it('should aggregate by work type and department', async () => {
      CompOffRequest.find.mockResolvedValue([
        {
          workType: 'weekend',
          daysEarned: 1,
          status: 'approved',
          compOffDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          employeeId: { _id: 'e1', department: 'Engineering' },
        },
        {
          workType: 'weekend',
          daysEarned: 1,
          status: 'approved',
          compOffDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          employeeId: { _id: 'e1', department: 'Engineering' },
        },
        {
          workType: 'publicHoliday',
          daysEarned: 2,
          status: 'pending',
          compOffDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          employeeId: { _id: 'e2', department: 'HR' },
        },
      ]);
      CompOffBalance.find.mockResolvedValue([]);

      const report = await compOffService.generateSummaryReport(
        tenantId,
        2026,
      );

      expect(report.byWorkType.weekend).toEqual({ count: 2, daysEarned: 2 });
      expect(report.byWorkType.publicHoliday).toEqual({
        count: 1,
        daysEarned: 2,
      });
      expect(report.byDepartment.Engineering).toEqual({
        count: 2,
        daysEarned: 2,
      });
    });
  });
});
