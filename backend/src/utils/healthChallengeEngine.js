/**
 * @fileoverview Health Challenge Engine — pure computation utilities
 * @description Computes streaks, rankings, progress metrics, reward allocation,
 * and leaderboard data for health challenges. No I/O.
 */

/**
 * Compute consecutive-day streaks from a list of check-in dates.
 *
 * @param {Array<Date>} dates — sorted ascending
 * @param {Date|string} [asOf] — today's date
 * @returns {{ currentStreak: number, longestStreak: number }}
 */
function computeStreaks(dates, asOf) {
  if (!dates || dates.length === 0)
    return { currentStreak: 0, longestStreak: 0 };

  const sorted = dates
    .map((d) => new Date(d).toISOString().split('T')[0])
    .sort();

  const unique = [...new Set(sorted)];
  if (unique.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longest = 1;
  let current = 1;

  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  // Check if current streak is still active (last check-in was yesterday or today)
  const now = asOf ? new Date(asOf) : new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const lastCheckIn = unique[unique.length - 1];
  if (lastCheckIn !== todayStr && lastCheckIn !== yesterdayStr) {
    current = 0; // Streak broken
  }

  return { currentStreak: current, longestStreak: longest };
}

/**
 * Compute participation statistics for a challenge.
 *
 * @param {Array} checkIns — DailyCheckIn documents for this challenge
 * @param {object} challenge — HealthChallenge document (has goalValue)
 * @returns {Array} sorted by rank (best to worst)
 */
function computeLeaderboard(checkIns, challenge) {
  const employeeMap = new Map();

  for (const ci of checkIns) {
    const empId = String(ci.employeeId);
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        employeeId: ci.employeeId,
        totalValue: 0,
        daysLogged: 0,
        daysGoalMet: 0,
        checkInDates: [],
      });
    }
    const entry = employeeMap.get(empId);
    entry.totalValue += ci.value || 0;
    entry.daysLogged += 1;
    if (ci.goalMet) entry.daysGoalMet += 1;
    entry.checkInDates.push(ci.checkInDate);
  }

  const goalPerDay = challenge.goalValue || 1;

  // Compute stats and sort
  const leaderboard = [];
  for (const [, entry] of employeeMap) {
    const avg = entry.daysLogged > 0 ? entry.totalValue / entry.daysLogged : 0;
    const { currentStreak, longestStreak } = computeStreaks(entry.checkInDates);
    const completionRate =
      challenge.startDate && challenge.endDate
        ? Math.round(
            (entry.daysLogged /
              Math.max(
                1,
                totalChallengeDays(challenge.startDate, challenge.endDate),
              )) *
              100,
          )
        : 0;

    leaderboard.push({
      employeeId: entry.employeeId,
      totalValue: entry.totalValue,
      averagePerDay: Math.round(avg * 100) / 100,
      daysLogged: entry.daysLogged,
      daysGoalMet: entry.daysGoalMet,
      currentStreak,
      longestStreak,
      completionRate,
      goalMet:
        entry.daysGoalMet >=
        totalChallengeDays(challenge.startDate, challenge.endDate) * 0.8,
    });
  }

  // Sort by: totalValue DESC, then daysGoalMet DESC, then longestStreak DESC
  leaderboard.sort((a, b) => {
    if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
    if (b.daysGoalMet !== a.daysGoalMet) return b.daysGoalMet - a.daysGoalMet;
    return b.longestStreak - a.longestStreak;
  });

  // Assign ranks
  leaderboard.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return leaderboard;
}

/**
 * Calculate total days of a challenge.
 */
function totalChallengeDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Allocate rewards based on leaderboard position.
 *
 * @param {Array} leaderboard — sorted by rank
 * @param {object} rewards — { first, second, third, participation, extraLeaveDays }
 * @param {number} challengeDays — total challenge duration
 * @returns {Array<{ employeeId, rank, rewardAmount, extraLeaveDays, reason }>}
 */
function allocateRewards(leaderboard, rewards, challengeDays) {
  if (!leaderboard || leaderboard.length === 0) return [];

  const allocations = [];
  const completedThreshold = Math.floor(challengeDays * 0.8); // 80% completion = "completed"

  for (const entry of leaderboard) {
    let rewardAmount = 0;
    let extraLeaveDays = 0;
    let reason = '';

    if (entry.rank === 1 && rewards.first > 0) {
      rewardAmount = rewards.first;
      extraLeaveDays = rewards.extraLeaveDays || 0;
      reason = '1st Place Winner';
    } else if (entry.rank === 2 && rewards.second > 0) {
      rewardAmount = rewards.second;
      reason = '2nd Place';
    } else if (entry.rank === 3 && rewards.third > 0) {
      rewardAmount = rewards.third;
      reason = '3rd Place';
    } else if (
      entry.daysLogged >= completedThreshold &&
      rewards.participation > 0
    ) {
      rewardAmount = rewards.participation;
      reason = 'Participation Reward';
    }

    if (rewardAmount > 0 || extraLeaveDays > 0) {
      allocations.push({
        employeeId: entry.employeeId,
        rank: entry.rank,
        rewardAmount,
        extraLeaveDays,
        reason,
      });
    }
  }

  return allocations;
}

/**
 * Compute overall challenge progress for the dashboard.
 *
 * @param {object} challenge — HealthChallenge document
 * @param {number} participantCount
 * @param {number} totalCheckIns
 * @param {number} uniqueActiveDays — distinct days with at least one check-in
 * @returns {object}
 */
function computeChallengeProgress(
  challenge,
  participantCount,
  totalCheckIns,
  uniqueActiveDays,
) {
  const now = new Date();
  const totalDays = totalChallengeDays(challenge.startDate, challenge.endDate);
  const elapsedDays = Math.max(
    0,
    Math.min(
      totalDays,
      Math.ceil((now - new Date(challenge.startDate)) / (1000 * 60 * 60 * 24)) +
        1,
    ),
  );

  const participationRate =
    challenge.maxParticipants > 0
      ? Math.round((participantCount / challenge.maxParticipants) * 100)
      : participantCount > 0
        ? 100
        : 0;

  const engagementRate =
    participantCount > 0 && totalDays > 0
      ? Math.round(
          (totalCheckIns /
            (participantCount * Math.min(elapsedDays, totalDays))) *
            100,
        )
      : 0;

  return {
    totalDays,
    elapsedDays,
    daysRemaining: Math.max(0, totalDays - elapsedDays),
    progressPercent: Math.round((elapsedDays / totalDays) * 100),
    participantCount,
    participationRate,
    totalCheckIns,
    engagementRate,
  };
}

/**
 * Generate a summary message for challenge completion.
 *
 * @param {string} challengeTitle
 * @param {Array} topPerformers — top 3 from leaderboard
 * @param {number} totalParticipants
 * @returns {string}
 */
function formatChallengeSummary(
  challengeTitle,
  topPerformers,
  totalParticipants,
) {
  if (!topPerformers || topPerformers.length === 0) {
    return `${challengeTitle} has ended with ${totalParticipants} participant(s). No data recorded.`;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const top = topPerformers.slice(0, 3);
  const names = top
    .map((p, i) => `${medals[i]} #${p.rank} Employee (score: ${p.totalValue})`)
    .join(', ');

  return `🏆 ${challengeTitle} Results: ${totalParticipants} participants. Top performers: ${names}.`;
}

module.exports = {
  computeStreaks,
  computeLeaderboard,
  totalChallengeDays,
  allocateRewards,
  computeChallengeProgress,
  formatChallengeSummary,
};
