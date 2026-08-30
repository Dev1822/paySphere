/**
 * @fileoverview Offboarding Utility Functions Unit Tests
 */

const {
  VALID_TRANSITIONS,
  DEFAULT_CLEARANCE_ITEMS,
  STATUS_META,
  LEAVING_REASON_META,
  validateTransition,
  calculateProgress,
  checkMandatoryClearance,
  estimateSettlement,
  calculateNoticePeriod,
  generateAttritionAnalytics,
} = require('../offboarding.utils');

describe('Offboarding Utilities', () => {
  // ─── validateTransition ────────────────────────────────────────────

  describe('validateTransition', () => {
    it('should allow Initiated → InProgress', () => {
      const result = validateTransition('Initiated', 'InProgress');
      expect(result.allowed).toBe(true);
    });

    it('should allow Initiated → OnHold', () => {
      const result = validateTransition('Initiated', 'OnHold');
      expect(result.allowed).toBe(true);
    });

    it('should allow InProgress → ClearancePending', () => {
      const result = validateTransition('InProgress', 'ClearancePending');
      expect(result.allowed).toBe(true);
    });

    it('should allow ClearancePending → SettlementPending', () => {
      const result = validateTransition('ClearancePending', 'SettlementPending');
      expect(result.allowed).toBe(true);
    });

    it('should allow SettlementPending → Completed', () => {
      const result = validateTransition('SettlementPending', 'Completed');
      expect(result.allowed).toBe(true);
    });

    it('should allow OnHold → any active status', () => {
      expect(validateTransition('OnHold', 'Initiated').allowed).toBe(true);
      expect(validateTransition('OnHold', 'InProgress').allowed).toBe(true);
      expect(validateTransition('OnHold', 'ClearancePending').allowed).toBe(true);
      expect(validateTransition('OnHold', 'SettlementPending').allowed).toBe(true);
    });

    it('should reject Completed → anything', () => {
      const result = validateTransition('Completed', 'Initiated');
      expect(result.allowed).toBe(false);
    });

    it('should reject Initiated → Completed (skip steps)', () => {
      const result = validateTransition('Initiated', 'Completed');
      expect(result.allowed).toBe(false);
    });

    it('should handle unknown status', () => {
      const result = validateTransition('Unknown', 'Draft');
      expect(result.allowed).toBe(false);
    });
  });

  // ─── calculateProgress ─────────────────────────────────────────────

  describe('calculateProgress', () => {
    it('should calculate progress with completed checklist', () => {
      const items = [
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
      ];
      const process = {
        handoverStatus: 'NotStarted',
        exitInterviewConducted: false,
        settlementStatus: 'NotInitiated',
      };

      const progress = calculateProgress(items, process);
      expect(progress).toBe(60); // 4/4 * 60 = 60
    });

    it('should include handover milestone', () => {
      const items = [
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
      ];
      const process = {
        handoverStatus: 'Completed',
        exitInterviewConducted: false,
        settlementStatus: 'NotInitiated',
      };

      const progress = calculateProgress(items, process);
      expect(progress).toBe(75); // 60 + 15
    });

    it('should include exit interview milestone', () => {
      const items = [
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
      ];
      const process = {
        handoverStatus: 'NotStarted',
        exitInterviewConducted: true,
        settlementStatus: 'NotInitiated',
      };

      const progress = calculateProgress(items, process);
      expect(progress).toBe(70); // 60 + 10
    });

    it('should include settlement milestone', () => {
      const items = [
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
        { status: 'Cleared' },
      ];
      const process = {
        handoverStatus: 'NotStarted',
        exitInterviewConducted: false,
        settlementStatus: 'Processed',
      };

      const progress = calculateProgress(items, process);
      expect(progress).toBe(75); // 60 + 15
    });

    it('should return 100 for fully complete', () => {
      const items = [
        { status: 'Cleared' },
        { status: 'Cleared' },
      ];
      const process = {
        handoverStatus: 'Completed',
        exitInterviewConducted: true,
        settlementStatus: 'Processed',
      };

      const progress = calculateProgress(items, process);
      expect(progress).toBe(100);
    });

    it('should return 0 for empty items', () => {
      const progress = calculateProgress([], {});
      expect(progress).toBe(0);
    });
  });

  // ─── checkMandatoryClearance ───────────────────────────────────────

  describe('checkMandatoryClearance', () => {
    it('should pass when all mandatory items cleared', () => {
      const items = [
        { isMandatory: true, status: 'Cleared' },
        { isMandatory: true, status: 'Cleared' },
        { isMandatory: false, status: 'Pending' },
      ];
      const result = checkMandatoryClearance(items);
      expect(result.allCleared).toBe(true);
      expect(result.pendingMandatory).toHaveLength(0);
    });

    it('should fail when mandatory items pending', () => {
      const items = [
        { isMandatory: true, status: 'Cleared' },
        { isMandatory: true, status: 'Pending' },
        { isMandatory: false, status: 'Pending' },
      ];
      const result = checkMandatoryClearance(items);
      expect(result.allCleared).toBe(false);
      expect(result.pendingMandatory).toHaveLength(1);
    });
  });

  // ─── estimateSettlement ────────────────────────────────────────────

  describe('estimateSettlement', () => {
    it('should calculate pro-rated salary', () => {
      const result = estimateSettlement({
        monthlySalary: 60000,
        lastWorkingDayIndex: 15,
      });
      expect(result.components.proRatedSalary).toBe(30000);
    });

    it('should calculate leave encashment', () => {
      const result = estimateSettlement({
        monthlySalary: 60000,
        lastWorkingDayIndex: 30,
        pendingLeaveDays: 10,
      });
      expect(result.components.leaveEncashment).toBe(20000);
    });

    it('should calculate notice period buyout when not served', () => {
      const result = estimateSettlement({
        monthlySalary: 60000,
        lastWorkingDayIndex: 30,
        noticePeriodDays: 30,
        isNoticeServed: false,
      });
      expect(result.components.noticePeriodBuyout).toBe(60000);
    });

    it('should not charge buyout when notice is served', () => {
      const result = estimateSettlement({
        monthlySalary: 60000,
        lastWorkingDayIndex: 30,
        noticePeriodDays: 30,
        isNoticeServed: true,
      });
      expect(result.components.noticePeriodBuyout).toBe(0);
    });

    it('should deduct loans and assets', () => {
      const result = estimateSettlement({
        monthlySalary: 60000,
        lastWorkingDayIndex: 30,
        pendingLoanAmount: 10000,
        assetDeductions: 5000,
      });
      expect(result.components.loanRecovery).toBe(-10000);
      expect(result.components.assetDeduction).toBe(-5000);
    });
  });

  // ─── calculateNoticePeriod ─────────────────────────────────────────

  describe('calculateNoticePeriod', () => {
    it('should calculate notice period shortfall', () => {
      const result = calculateNoticePeriod(
        new Date(2026, 7, 1),  // Aug 1
        new Date(2026, 7, 15), // Aug 15 = 14 days
        30,
      );
      expect(result.servedDays).toBe(14);
      expect(result.shortfallDays).toBe(16);
      expect(result.isBuyoutRequired).toBe(true);
    });

    it('should calculate notice period excess', () => {
      const result = calculateNoticePeriod(
        new Date(2026, 7, 1),  // Aug 1
        new Date(2026, 8, 15), // Sep 15 = 45 days
        30,
      );
      expect(result.servedDays).toBe(45);
      expect(result.excessDays).toBe(15);
      expect(result.isBuyoutRequired).toBe(false);
    });

    it('should handle exact notice period', () => {
      const result = calculateNoticePeriod(
        new Date(2026, 7, 1),
        new Date(2026, 7, 31),
        30,
      );
      expect(result.shortfallDays).toBe(0);
      expect(result.isBuyoutRequired).toBe(false);
    });
  });

  // ─── generateAttritionAnalytics ────────────────────────────────────

  describe('generateAttritionAnalytics', () => {
    it('should generate analytics', () => {
      const processes = [
        { exitType: 'Resignation', leavingReason: 'BetterOpportunity', exitInterviewRating: 4 },
        { exitType: 'Resignation', leavingReason: 'Compensation', exitInterviewRating: 3 },
        { exitType: 'Termination', leavingReason: 'Performance', exitInterviewRating: null },
      ];

      const analytics = generateAttritionAnalytics(processes, 100);

      expect(analytics.totalExits).toBe(3);
      expect(analytics.attritionRate).toBe(3);
      expect(analytics.voluntaryVsInvoluntary.voluntary).toBe(2);
      expect(analytics.voluntaryVsInvoluntary.involuntary).toBe(1);
      expect(analytics.averageExitInterviewRating).toBe(3.5);
    });

    it('should handle empty processes', () => {
      const analytics = generateAttritionAnalytics([], 100);
      expect(analytics.totalExits).toBe(0);
      expect(analytics.attritionRate).toBe(0);
    });
  });

  // ─── Constants ─────────────────────────────────────────────────────

  describe('DEFAULT_CLEARANCE_ITEMS', () => {
    it('should have items in multiple categories', () => {
      const categories = new Set(DEFAULT_CLEARANCE_ITEMS.map((i) => i.category));
      expect(categories.has('IT')).toBe(true);
      expect(categories.has('HR')).toBe(true);
      expect(categories.has('Finance')).toBe(true);
      expect(categories.has('Manager')).toBe(true);
    });

    it('should have mandatory items', () => {
      const mandatory = DEFAULT_CLEARANCE_ITEMS.filter((i) => i.isMandatory);
      expect(mandatory.length).toBeGreaterThan(0);
    });
  });

  describe('STATUS_META', () => {
    it('should have metadata for all statuses', () => {
      expect(STATUS_META.Initiated).toBeDefined();
      expect(STATUS_META.InProgress).toBeDefined();
      expect(STATUS_META.ClearancePending).toBeDefined();
      expect(STATUS_META.SettlementPending).toBeDefined();
      expect(STATUS_META.Completed).toBeDefined();
      expect(STATUS_META.OnHold).toBeDefined();
    });
  });

  describe('LEAVING_REASON_META', () => {
    it('should categorize reasons', () => {
      expect(LEAVING_REASON_META.BetterOpportunity.category).toBe('External');
      expect(LEAVING_REASON_META.Compensation.category).toBe('Retention');
      expect(LEAVING_REASON_META.Retirement.category).toBe('Natural');
      expect(LEAVING_REASON_META.Performance.category).toBe('Involuntary');
    });
  });
});
