/**
 * @fileoverview Comp-Off Utility Functions Unit Tests
 */

const {
  WORK_TYPE_META,
  calculateDaysEarned,
  computeExpiryDate,
  validateEligibility,
  validateCancellation,
  formatRequestSummary,
  getExpiringInMonth,
  calculateStats,
} = require('../compOff.utils');

describe('Comp-Off Utilities', () => {
  // ─── calculateDaysEarned ───────────────────────────────────────────

  describe('calculateDaysEarned', () => {
    const accrualRules = [
      { workType: 'weekend', hoursPerDay: 8 },
      { workType: 'publicHoliday', hoursPerDay: 8 },
      { workType: 'overtime', hoursPerDay: 4 },
    ];

    it('should calculate days for weekend work (8 hours = 1 day)', () => {
      const result = calculateDaysEarned('weekend', 8, accrualRules);
      expect(result.daysEarned).toBe(1);
      expect(result.hoursEarned).toBe(8);
      expect(result.matched).toBe(true);
    });

    it('should calculate days for overtime (4 hours = 1 day)', () => {
      const result = calculateDaysEarned('overtime', 4, accrualRules);
      expect(result.daysEarned).toBe(1);
      expect(result.matched).toBe(true);
    });

    it('should handle fractional days', () => {
      const result = calculateDaysEarned('weekend', 12, accrualRules);
      expect(result.daysEarned).toBeGreaterThanOrEqual(1);
      expect(result.matched).toBe(true);
    });

    it('should return matched=false for unknown work type', () => {
      const result = calculateDaysEarned('unknown', 8, accrualRules);
      expect(result.matched).toBe(false);
      expect(result.daysEarned).toBe(0);
    });

    it('should cap at 2 days maximum', () => {
      const result = calculateDaysEarned('weekend', 32, accrualRules);
      expect(result.daysEarned).toBeLessThanOrEqual(2);
    });

    it('should return minimum 0.5 days', () => {
      const result = calculateDaysEarned('weekend', 1, accrualRules);
      expect(result.daysEarned).toBe(0.5);
    });
  });

  // ─── computeExpiryDate ─────────────────────────────────────────────

  describe('computeExpiryDate', () => {
    it('should compute expiry 90 days from work date', () => {
      const workDate = new Date('2026-01-01');
      const expiry = computeExpiryDate(workDate, 90);
      expect(expiry.getDate()).toBe(1); // March 1 (non-leap, +90 = March 32 → April 1)
      // 90 days from Jan 1 is April 1
      expect(expiry.getMonth()).toBe(3); // April (0-indexed)
    });

    it('should compute expiry 30 days from work date', () => {
      const workDate = new Date('2026-08-01');
      const expiry = computeExpiryDate(workDate, 30);
      expect(expiry.getMonth()).toBe(8); // September (0-indexed)
      expect(expiry.getDate()).toBe(31);
    });

    it('should not mutate the original date', () => {
      const workDate = new Date('2026-06-15');
      const original = workDate.getTime();
      computeExpiryDate(workDate, 30);
      expect(workDate.getTime()).toBe(original);
    });
  });

  // ─── validateEligibility ───────────────────────────────────────────

  describe('validateEligibility', () => {
    const baseParams = {
      workDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      compOffDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      minAdvanceNoticeDays: 1,
      currentBalance: 3,
      maxBalance: 10,
      maxAccrualPerMonth: 4,
      monthAccrualsSoFar: 1,
    };

    it('should pass for valid eligibility', () => {
      const result = validateEligibility(baseParams);
      expect(result.eligible).toBe(true);
    });

    it('should reject future work date', () => {
      const result = validateEligibility({
        ...baseParams,
        workDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('future');
    });

    it('should reject past or same-day comp-off date', () => {
      const result = validateEligibility({
        ...baseParams,
        compOffDate: new Date(),
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('future');
    });

    it('should reject when balance is at max', () => {
      const result = validateEligibility({
        ...baseParams,
        currentBalance: 10,
        maxBalance: 10,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('maximum');
    });

    it('should reject when monthly accrual is at max', () => {
      const result = validateEligibility({
        ...baseParams,
        monthAccrualsSoFar: 4,
        maxAccrualPerMonth: 4,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Monthly');
    });

    it('should reject when advance notice is insufficient', () => {
      const result = validateEligibility({
        ...baseParams,
        compOffDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
        minAdvanceNoticeDays: 2,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('advance');
    });

    it('should reject work date more than 7 days old', () => {
      const result = validateEligibility({
        ...baseParams,
        workDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('7 days');
    });
  });

  // ─── validateCancellation ──────────────────────────────────────────

  describe('validateCancellation', () => {
    it('should allow cancellation of pending request', () => {
      const request = { status: 'pending', employeeId: { toString: () => 'emp1' } };
      const result = validateCancellation(request, 'emp1', false);
      expect(result.canCancel).toBe(true);
    });

    it('should not allow cancellation of already cancelled request', () => {
      const request = { status: 'cancelled', employeeId: { toString: () => 'emp1' } };
      const result = validateCancellation(request, 'emp1', false);
      expect(result.canCancel).toBe(false);
      expect(result.reason).toContain('already cancelled');
    });

    it('should not allow cancellation of expired request', () => {
      const request = { status: 'expired', employeeId: { toString: () => 'emp1' } };
      const result = validateCancellation(request, 'emp1', false);
      expect(result.canCancel).toBe(false);
    });

    it('should allow admin to cancel approved request', () => {
      const request = {
        status: 'approved',
        compOffDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        employeeId: { toString: () => 'emp1' },
      };
      const result = validateCancellation(request, 'admin1', true);
      expect(result.canCancel).toBe(true);
    });
  });

  // ─── formatRequestSummary ──────────────────────────────────────────

  describe('formatRequestSummary', () => {
    it('should format request summary correctly', () => {
      const request = {
        _id: 'req1',
        workDate: new Date('2026-08-20'),
        compOffDate: new Date('2026-09-01'),
        daysEarned: 1,
        workType: 'weekend',
        status: 'pending',
        reason: 'Weekend work',
        createdAt: new Date('2026-08-21'),
        expiresAt: new Date('2026-11-20'),
      };

      const summary = formatRequestSummary(request, 'John Doe');
      expect(summary.employee).toBe('John Doe');
      expect(summary.workType).toBe('Weekend Work');
      expect(summary.daysEarned).toBe(1);
      expect(summary.id).toBe('req1');
    });
  });

  // ─── getExpiringInMonth ────────────────────────────────────────────

  describe('getExpiringInMonth', () => {
    it('should return requests expiring in given month', () => {
      const requests = [
        {
          status: 'approved',
          expiresAt: new Date(2026, 8, 15),
        },
        {
          status: 'approved',
          expiresAt: new Date(2026, 9, 10),
        },
        {
          status: 'cancelled',
          expiresAt: new Date(2026, 8, 20),
        },
      ];

      const result = getExpiringInMonth(requests, 2026, 8); // September
      expect(result).toHaveLength(1);
      expect(result[0].expiresAt.getMonth()).toBe(8);
    });

    it('should exclude non-approved/pending statuses', () => {
      const requests = [
        {
          status: 'cancelled',
          expiresAt: new Date(2026, 8, 15),
        },
        {
          status: 'rejected',
          expiresAt: new Date(2026, 8, 20),
        },
      ];

      const result = getExpiringInMonth(requests, 2026, 8);
      expect(result).toHaveLength(0);
    });
  });

  // ─── calculateStats ────────────────────────────────────────────────

  describe('calculateStats', () => {
    it('should calculate stats correctly', () => {
      const requests = [
        { status: 'pending', daysEarned: 1 },
        { status: 'approved', daysEarned: 2, compOffDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
        { status: 'approved', daysEarned: 1.5, compOffDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { status: 'rejected', daysEarned: 1 },
        { status: 'cancelled', daysEarned: 0.5 },
      ];

      const stats = calculateStats(requests);
      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(2);
      expect(stats.rejected).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.totalDaysEarned).toBe(6);
      expect(stats.totalDaysUsed).toBe(1.5);
    });

    it('should return zero stats for empty array', () => {
      const stats = calculateStats([]);
      expect(stats.total).toBe(0);
      expect(stats.totalDaysEarned).toBe(0);
    });
  });

  // ─── WORK_TYPE_META ────────────────────────────────────────────────

  describe('WORK_TYPE_META', () => {
    it('should have metadata for all work types', () => {
      expect(WORK_TYPE_META.weekend).toBeDefined();
      expect(WORK_TYPE_META.publicHoliday).toBeDefined();
      expect(WORK_TYPE_META.restrictedHoliday).toBeDefined();
      expect(WORK_TYPE_META.nightShift).toBeDefined();
      expect(WORK_TYPE_META.overtime).toBeDefined();
    });

    it('should have label and description for each type', () => {
      for (const [key, meta] of Object.entries(WORK_TYPE_META)) {
        expect(meta.label).toBeTruthy();
        expect(meta.description).toBeTruthy();
        expect(meta.defaultHours).toBeGreaterThan(0);
      }
    });
  });
});
