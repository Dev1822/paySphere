/**
 * @fileoverview Tests for the milestone evaluator utility functions.
 * @description Pure-function unit tests for completedYearsOfService,
 * findMatchingTier, evaluateEmployee, batchEvaluate, upcomingMilestones,
 * and formatMilestoneMessage.
 *
 * These tests do NOT require Mongoose, Express, or a running server — they
 * exercise the computation engine in isolation.
 */

const {
  completedYearsOfService,
  findMatchingTier,
  evaluateEmployee,
  batchEvaluate,
  upcomingMilestones,
  formatMilestoneMessage,
} = require('../../utils/milestoneEvaluator');

describe('milestoneEvaluator', () => {
  // ─── completedYearsOfService ──────────────────────────────────────────

  describe('completedYearsOfService', () => {
    test('returns 0 when joined less than 1 year ago', () => {
      const joined = new Date();
      joined.setFullYear(
        joined.getFullYear() - 0,
        joined.getMonth() - 6,
        joined.getDate(),
      );
      expect(completedYearsOfService(joined)).toBe(0);
    });

    test('returns 1 on the exact anniversary', () => {
      const now = new Date();
      const joined = new Date(now);
      joined.setFullYear(joined.getFullYear() - 1);
      expect(completedYearsOfService(joined, now)).toBe(1);
    });

    test('returns correct years for a multi-year employee', () => {
      const asOf = new Date('2026-08-25');
      const joined = new Date('2020-03-15');
      expect(completedYearsOfService(joined, asOf)).toBe(6);
    });

    test('returns 0 for invalid date', () => {
      expect(completedYearsOfService('not-a-date')).toBe(0);
    });

    test('handles leap year birthdays (Feb 29)', () => {
      const joined = new Date('2020-02-29');
      const asOf = new Date('2026-08-25');
      expect(completedYearsOfService(joined, asOf)).toBe(6);
    });
  });

  // ─── findMatchingTier ────────────────────────────────────────────────

  describe('findMatchingTier', () => {
    const tiers = [
      {
        yearsOfService: 1,
        label: 'First Year',
        isActive: true,
        reward: { type: 'Certificate' },
      },
      {
        yearsOfService: 5,
        label: 'Five Star',
        isActive: true,
        reward: { type: 'Cash', cashAmount: 5000 },
      },
      {
        yearsOfService: 10,
        label: 'Decade',
        isActive: false,
        reward: { type: 'Cash', cashAmount: 20000 },
      },
    ];

    test('finds an active tier', () => {
      const tier = findMatchingTier(tiers, 1);
      expect(tier).not.toBeNull();
      expect(tier.label).toBe('First Year');
    });

    test('returns null for inactive tier', () => {
      expect(findMatchingTier(tiers, 10)).toBeNull();
    });

    test('returns null when no match', () => {
      expect(findMatchingTier(tiers, 3)).toBeNull();
    });

    test('returns null for empty/null tiers', () => {
      expect(findMatchingTier(null, 5)).toBeNull();
      expect(findMatchingTier([], 5)).toBeNull();
    });
  });

  // ─── evaluateEmployee ───────────────────────────────────────────────

  describe('evaluateEmployee', () => {
    const config = {
      isEnabled: true,
      maxEvaluationYears: 30,
      tiers: [
        {
          yearsOfService: 1,
          label: 'First Year',
          isActive: true,
          reward: { type: 'Certificate' },
          announcePublicly: true,
        },
        {
          yearsOfService: 5,
          label: 'Five Star',
          isActive: true,
          reward: { type: 'Cash', cashAmount: 5000 },
          announcePublicly: true,
        },
      ],
    };

    test('qualifies employee with matching years', () => {
      const employee = { joiningDate: new Date('2021-08-25') };
      const result = evaluateEmployee(employee, config, new Date('2026-08-25'));
      expect(result.qualifies).toBe(true);
      expect(result.yearsOfService).toBe(5);
      expect(result.matchedTier.label).toBe('Five Star');
    });

    test('does not qualify when no tier matches', () => {
      const employee = { joiningDate: new Date('2024-08-25') };
      const result = evaluateEmployee(employee, config, new Date('2026-08-25'));
      expect(result.qualifies).toBe(false);
      expect(result.yearsOfService).toBe(2);
      expect(result.matchedTier).toBeNull();
    });

    test('does not qualify when program is disabled', () => {
      const employee = { joiningDate: new Date('2021-08-25') };
      const disabledConfig = { ...config, isEnabled: false };
      const result = evaluateEmployee(employee, disabledConfig);
      expect(result.qualifies).toBe(false);
    });

    test('does not qualify when employee has no joiningDate', () => {
      const result = evaluateEmployee({}, config);
      expect(result.qualifies).toBe(false);
    });
  });

  // ─── batchEvaluate ──────────────────────────────────────────────────

  describe('batchEvaluate', () => {
    const config = {
      isEnabled: true,
      maxEvaluationYears: 30,
      tiers: [
        {
          yearsOfService: 5,
          label: 'Five Star',
          isActive: true,
          reward: { type: 'Cash', cashAmount: 5000 },
          announcePublicly: true,
        },
      ],
    };

    test('detects new milestones and skips existing ones', () => {
      const employees = [
        {
          _id: 'emp1',
          fullName: 'Alice',
          department: 'Eng',
          joiningDate: new Date('2021-08-25'),
        },
        {
          _id: 'emp2',
          fullName: 'Bob',
          department: 'Sales',
          joiningDate: new Date('2021-08-25'),
        },
        {
          _id: 'emp3',
          fullName: 'Charlie',
          department: 'HR',
          joiningDate: new Date('2025-01-01'),
        },
      ];
      const existing = new Set(['emp1:5']);

      const result = batchEvaluate(
        employees,
        config,
        existing,
        new Date('2026-08-25'),
      );
      expect(result.evaluated).toBe(3);
      expect(result.detected.length).toBe(1);
      expect(result.detected[0].employeeId).toBe('emp2');
      expect(result.skipped).toBe(1);
    });

    test('returns empty when no milestones qualify', () => {
      const employees = [
        {
          _id: 'emp4',
          fullName: 'Dana',
          department: 'Eng',
          joiningDate: new Date('2025-06-01'),
        },
      ];
      const result = batchEvaluate(
        employees,
        config,
        new Set(),
        new Date('2026-08-25'),
      );
      expect(result.detected.length).toBe(0);
    });
  });

  // ─── upcomingMilestones ─────────────────────────────────────────────

  describe('upcomingMilestones', () => {
    const config = {
      isEnabled: true,
      maxEvaluationYears: 30,
      tiers: [
        {
          yearsOfService: 5,
          label: 'Five Star',
          isActive: true,
          reward: { type: 'Cash', cashAmount: 5000 },
        },
      ],
    };

    test('finds milestones within horizon', () => {
      const employees = [
        {
          _id: 'emp1',
          fullName: 'Alice',
          department: 'Eng',
          joiningDate: new Date('2021-09-01'),
        },
      ];
      // 5th anniversary is 2026-09-01, which is within 90 days of 2026-08-25
      const result = upcomingMilestones(
        employees,
        config,
        90,
        new Date('2026-08-25'),
      );
      expect(result.length).toBe(1);
      expect(result[0].yearsOfService).toBe(5);
    });

    test('excludes milestones outside horizon', () => {
      const employees = [
        {
          _id: 'emp1',
          fullName: 'Alice',
          department: 'Eng',
          joiningDate: new Date('2022-12-01'),
        },
      ];
      // 5th anniversary is 2027-12-01, outside 90 days
      const result = upcomingMilestones(
        employees,
        config,
        90,
        new Date('2026-08-25'),
      );
      expect(result.length).toBe(0);
    });

    test('returns empty for disabled config', () => {
      const employees = [
        {
          _id: 'emp1',
          fullName: 'Alice',
          department: 'Eng',
          joiningDate: new Date('2021-09-01'),
        },
      ];
      const disabledConfig = { ...config, isEnabled: false };
      const result = upcomingMilestones(employees, disabledConfig, 90);
      expect(result.length).toBe(0);
    });
  });

  // ─── formatMilestoneMessage ─────────────────────────────────────────

  describe('formatMilestoneMessage', () => {
    test('formats a Cash reward message', () => {
      const tier = {
        label: 'Five Star',
        reward: { type: 'Cash', cashAmount: 5000 },
      };
      const msg = formatMilestoneMessage('Alice', 5, tier);
      expect(msg).toContain('Alice');
      expect(msg).toContain('5 years');
      expect(msg).toContain('₹5,000');
      expect(msg).toContain('Five Star');
    });

    test('formats an ExtraLeave reward message', () => {
      const tier = {
        label: 'First Year',
        reward: { type: 'ExtraLeave', extraLeaveDays: 2 },
      };
      const msg = formatMilestoneMessage('Bob', 1, tier);
      expect(msg).toContain('1 year');
      expect(msg).toContain('2 extra leave days');
    });

    test('formats a generic reward message', () => {
      const tier = {
        label: 'Decade',
        reward: { type: 'Certificate', description: '' },
      };
      const msg = formatMilestoneMessage('Charlie', 10, tier);
      expect(msg).toContain('10 years');
      expect(msg).toContain('Decade');
    });
  });
});
