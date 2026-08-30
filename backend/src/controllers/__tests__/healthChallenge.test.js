/**
 * @fileoverview Tests for the health challenge engine utilities.
 */

const {
  computeStreaks,
  computeLeaderboard,
  totalChallengeDays,
  allocateRewards,
  computeChallengeProgress,
} = require('../../utils/healthChallengeEngine');

describe('healthChallengeEngine', () => {
  describe('computeStreaks', () => {
    test('computes streak for consecutive days', () => {
      const dates = [
        new Date('2026-08-20'),
        new Date('2026-08-21'),
        new Date('2026-08-22'),
        new Date('2026-08-23'),
      ];
      const result = computeStreaks(dates, new Date('2026-08-25'));
      expect(result.longestStreak).toBe(4);
    });

    test('handles gap in dates', () => {
      const dates = [
        new Date('2026-08-20'),
        new Date('2026-08-21'),
        new Date('2026-08-23'), // gap
        new Date('2026-08-24'),
      ];
      const result = computeStreaks(dates, new Date('2026-08-25'));
      expect(result.longestStreak).toBe(2);
    });

    test('returns 0 for empty dates', () => {
      const result = computeStreaks([], new Date('2026-08-25'));
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    test('breaks streak if last check-in is too old', () => {
      const dates = [new Date('2026-08-20'), new Date('2026-08-21')];
      const result = computeStreaks(dates, new Date('2026-08-30'));
      expect(result.currentStreak).toBe(0);
    });
  });

  describe('totalChallengeDays', () => {
    test('counts inclusive days', () => {
      expect(totalChallengeDays('2026-08-01', '2026-08-07')).toBe(7);
    });

    test('same day = 1', () => {
      expect(totalChallengeDays('2026-08-25', '2026-08-25')).toBe(1);
    });
  });

  describe('allocateRewards', () => {
    const rewards = {
      first: 10000,
      second: 5000,
      third: 2000,
      participation: 500,
      extraLeaveDays: 2,
    };

    test('allocates top 3 rewards', () => {
      const leaderboard = [
        { employeeId: 'emp1', rank: 1, daysLogged: 30 },
        { employeeId: 'emp2', rank: 2, daysLogged: 28 },
        { employeeId: 'emp3', rank: 3, daysLogged: 25 },
      ];
      const allocations = allocateRewards(leaderboard, rewards, 30);
      expect(allocations).toHaveLength(3);
      expect(allocations[0].rewardAmount).toBe(10000);
      expect(allocations[0].extraLeaveDays).toBe(2);
      expect(allocations[1].rewardAmount).toBe(5000);
      expect(allocations[2].rewardAmount).toBe(2000);
    });

    test('awards participation reward for 80% completion', () => {
      const leaderboard = [
        { employeeId: 'emp1', rank: 1, daysLogged: 30 },
        { employeeId: 'emp4', rank: 10, daysLogged: 25 },
      ];
      const allocations = allocateRewards(leaderboard, rewards, 30);
      // emp4 at rank 10 gets participation (25 >= 24 = 80% of 30)
      const emp4Alloc = allocations.find(
        (a) => String(a.employeeId) === 'emp4',
      );
      expect(emp4Alloc).toBeDefined();
      expect(emp4Alloc.rewardAmount).toBe(500);
    });

    test('returns empty for no participants', () => {
      expect(allocateRewards([], rewards, 30)).toHaveLength(0);
    });
  });

  describe('computeChallengeProgress', () => {
    test('computes progress correctly', () => {
      const challenge = {
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-31'),
        maxParticipants: 50,
      };
      const result = computeChallengeProgress(challenge, 20, 400, 15);
      expect(result.totalDays).toBe(31);
      expect(result.participantCount).toBe(20);
      expect(result.participationRate).toBe(40);
    });
  });

  describe('computeLeaderboard', () => {
    test('sorts by total value descending', () => {
      const checkIns = [
        {
          employeeId: 'emp1',
          value: 100,
          goalMet: true,
          checkInDate: new Date('2026-08-20'),
        },
        {
          employeeId: 'emp1',
          value: 120,
          goalMet: true,
          checkInDate: new Date('2026-08-21'),
        },
        {
          employeeId: 'emp2',
          value: 90,
          goalMet: false,
          checkInDate: new Date('2026-08-20'),
        },
        {
          employeeId: 'emp2',
          value: 95,
          goalMet: true,
          checkInDate: new Date('2026-08-21'),
        },
      ];
      const challenge = {
        goalValue: 100,
        startDate: new Date('2026-08-20'),
        endDate: new Date('2026-08-21'),
      };
      const leaderboard = computeLeaderboard(checkIns, challenge);
      expect(leaderboard[0].employeeId).toBe('emp1');
      expect(leaderboard[0].totalValue).toBe(220);
      expect(leaderboard[1].employeeId).toBe('emp2');
    });
  });
});
