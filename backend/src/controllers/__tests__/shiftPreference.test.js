/**
 * @fileoverview Tests for the shift preference engine utilities.
 */

const {
  validateTimeSlot,
  hoursBetween,
  isBlackoutDate,
  scorePreferenceMatch,
  computeScheduleMetrics,
} = require('../../utils/shiftPreferenceEngine');

describe('shiftPreferenceEngine', () => {
  describe('validateTimeSlot', () => {
    test('validates correct slot', () => {
      const result = validateTimeSlot({
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: 1,
      });
      expect(result.valid).toBe(true);
    });

    test('rejects invalid startTime', () => {
      const result = validateTimeSlot({
        startTime: '25:00',
        endTime: '17:00',
        dayOfWeek: 1,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid startTime');
    });

    test('rejects endTime before startTime', () => {
      const result = validateTimeSlot({
        startTime: '17:00',
        endTime: '09:00',
        dayOfWeek: 1,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('before');
    });

    test('rejects invalid dayOfWeek', () => {
      const result = validateTimeSlot({
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: 8,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('hoursBetween', () => {
    test('computes 8-hour shift', () => {
      expect(hoursBetween('09:00', '17:00')).toBe(8);
    });

    test('computes 4.5-hour shift', () => {
      expect(hoursBetween('14:00', '18:30')).toBe(4.5);
    });

    test('computes overnight shift', () => {
      expect(hoursBetween('22:00', '06:00')).toBe(-16);
    });
  });

  describe('isBlackoutDate', () => {
    test('detects blackout date', () => {
      const date = new Date('2026-08-25');
      const blackouts = [new Date('2026-08-25'), new Date('2026-09-01')];
      expect(isBlackoutDate(date, blackouts)).toBe(true);
    });

    test('returns false for non-blackout', () => {
      const date = new Date('2026-08-26');
      const blackouts = [new Date('2026-08-25')];
      expect(isBlackoutDate(date, blackouts)).toBe(false);
    });

    test('handles empty blackouts', () => {
      expect(isBlackoutDate(new Date('2026-08-25'), [])).toBe(false);
    });
  });

  describe('scorePreferenceMatch', () => {
    const preferences = [
      { shiftType: 'Morning', shiftDate: new Date('2026-08-25'), priority: 1 },
      { shiftType: 'Evening', shiftDate: new Date('2026-08-25'), priority: 3 },
    ];

    test('scores a matching preference', () => {
      const result = scorePreferenceMatch(
        { shiftType: 'Morning', shiftDate: new Date('2026-08-25') },
        preferences,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(10); // 11 - 1 = 10
      expect(result.priority).toBe(1);
    });

    test('scores a lower priority match', () => {
      const result = scorePreferenceMatch(
        { shiftType: 'Evening', shiftDate: new Date('2026-08-25') },
        preferences,
      );
      expect(result.matched).toBe(true);
      expect(result.score).toBe(8); // 11 - 3 = 8
    });

    test('returns 0 for no match', () => {
      const result = scorePreferenceMatch(
        { shiftType: 'Night', shiftDate: new Date('2026-08-25') },
        preferences,
      );
      expect(result.matched).toBe(false);
      expect(result.score).toBe(0);
    });

    test('handles empty preferences', () => {
      const result = scorePreferenceMatch(
        { shiftType: 'Morning', shiftDate: new Date('2026-08-25') },
        [],
      );
      expect(result.matched).toBe(false);
    });
  });

  describe('computeScheduleMetrics', () => {
    test('computes metrics for a set of assignments', () => {
      const assignments = [
        { shiftType: 'Morning', preferenceMatch: true, autoAssigned: true },
        { shiftType: 'Morning', preferenceMatch: false, autoAssigned: true },
        { shiftType: 'Evening', preferenceMatch: true, autoAssigned: false },
      ];
      const metrics = computeScheduleMetrics(assignments, []);
      expect(metrics.totalAssignments).toBe(3);
      expect(metrics.preferenceMatchRate).toBe(67);
      expect(metrics.byShiftType.Morning).toBe(2);
      expect(metrics.byShiftType.Evening).toBe(1);
    });

    test('handles empty assignments', () => {
      const metrics = computeScheduleMetrics([], []);
      expect(metrics.totalAssignments).toBe(0);
      expect(metrics.preferenceMatchRate).toBe(0);
    });
  });
});
