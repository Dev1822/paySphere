/**
 * @fileoverview Peer Nomination Engine — pure computation utilities
 * @description Validates nomination eligibility, computes voting results,
 * selects winners, and generates nomination analytics. No I/O.
 */

/**
 * Check if a nominator is eligible to nominate.
 *
 * @param {object} params
 * @param {string} params.nominatorId
 * @param {string} params.nomineeId
 * @param {object} params.category — AwardCategory document
 * @param {object} params.cycle — AwardCycle document
 * @param {number} params.existingNominationCount — nominator's existing nominations this cycle
 * @returns {{ eligible: boolean, reason?: string }}
 */
function checkNominatorEligibility({
  nominatorId,
  nomineeId,
  category,
  cycle,
  existingNominationCount,
}) {
  // Self-nomination check
  if (!category.allowSelfNomination && nominatorId === nomineeId) {
    return {
      eligible: false,
      reason: 'Self-nomination is not allowed for this award',
    };
  }

  // Max nominations per nominator
  if (existingNominationCount >= category.maxNominationsPerNominator) {
    return {
      eligible: false,
      reason: `Maximum ${category.maxNominationsPerNominator} nominations per cycle reached`,
    };
  }

  // Cycle status check
  if (cycle.status !== 'Nominating') {
    return {
      eligible: false,
      reason: `Cycle is in "${cycle.status}" phase, not accepting nominations`,
    };
  }

  return { eligible: true };
}

/**
 * Check if a nominee has capacity to receive more nominations.
 *
 * @param {number} existingReceivedCount
 * @param {number} maxPerNominee
 * @returns {{ eligible: boolean, reason?: string }}
 */
function checkNomineeCapacity(existingReceivedCount, maxPerNominee) {
  if (existingReceivedCount >= maxPerNominee) {
    return {
      eligible: false,
      reason: `Nominee has reached the maximum of ${maxPerNominee} nominations`,
    };
  }
  return { eligible: true };
}

/**
 * Check if a voter is eligible to vote.
 *
 * @param {object} params
 * @param {string} params.voterId
 * @param {string} params.nominationId
 * @param {string} params.nominatorId — who made the nomination
 * @param {string} params.nomineeId — who is nominated
 * @param {object} params.cycle
 * @param {number} params.existingVoteCount — voter's votes this cycle
 * @param {number} params.maxVotesPerVoter
 * @returns {{ eligible: boolean, reason?: string }}
 */
function checkVoterEligibility({
  voterId,
  nominationId,
  nominatorId,
  nomineeId,
  cycle,
  existingVoteCount,
  maxVotesPerVoter,
}) {
  if (cycle.status !== 'Voting') {
    return {
      eligible: false,
      reason: `Cycle is in "${cycle.status}" phase, not accepting votes`,
    };
  }

  // Can't vote for your own nomination
  if (voterId === nominatorId) {
    return { eligible: false, reason: 'Cannot vote for your own nomination' };
  }

  // Can't vote for yourself as nominee
  if (voterId === nomineeId) {
    return { eligible: false, reason: 'Cannot vote for yourself' };
  }

  // Max votes per voter
  if (existingVoteCount >= maxVotesPerVoter) {
    return {
      eligible: false,
      reason: `Maximum ${maxVotesPerVoter} votes per cycle reached`,
    };
  }

  return { eligible: true };
}

/**
 * Compute voting results for a cycle.
 *
 * @param {Array} nominations — Nomination documents for the cycle
 * @param {Array} votes — Vote documents for the cycle
 * @returns {Array} sorted by vote count descending
 */
function computeVotingResults(nominations, votes) {
  const voteCounts = new Map();
  for (const vote of votes) {
    const nomId = String(vote.nominationId);
    voteCounts.set(nomId, (voteCounts.get(nomId) || 0) + 1);
  }

  const results = nominations.map((nom) => ({
    nominationId: nom._id,
    nomineeId: nom.nomineeId,
    nominatorId: nom.nominatorId,
    voteCount: voteCounts.get(String(nom._id)) || 0,
    justification: nom.justification,
    coreValues: nom.coreValues || [],
  }));

  results.sort((a, b) => b.voteCount - a.voteCount);

  results.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return results;
}

/**
 * Select winners from a ranked list.
 *
 * @param {Array} rankedNominations — sorted by rank
 * @param {number} maxWinners — how many winners to select (default 1)
 * @param {number} minVotes — minimum votes to be eligible (0 = no minimum)
 * @returns {Array<{ nominationId, rank, voteCount }>}
 */
function selectWinners(rankedNominations, maxWinners = 1, minVotes = 0) {
  return rankedNominations
    .filter((n) => n.voteCount >= minVotes)
    .slice(0, maxWinners)
    .map((n) => ({
      nominationId: n.nominationId,
      nomineeId: n.nomineeId,
      rank: n.rank,
      voteCount: n.voteCount,
    }));
}

/**
 * Compute nomination statistics for a cycle.
 *
 * @param {Array} nominations
 * @param {Array} votes
 * @param {object} category
 * @returns {object}
 */
function computeNominationStats(nominations, votes, category) {
  const total = nominations.length;
  const approved = nominations.filter(
    (n) => n.status === 'Approved' || n.status === 'Winner',
  ).length;
  const winners = nominations.filter((n) => n.status === 'Winner').length;

  // Unique nominators
  const nominators = new Set(nominations.map((n) => String(n.nominatorId)));
  // Unique nominees
  const nominees = new Set(nominations.map((n) => String(n.nomineeId)));

  // Core values frequency
  const valuesFreq = {};
  for (const nom of nominations) {
    for (const v of nom.coreValues || []) {
      valuesFreq[v] = (valuesFreq[v] || 0) + 1;
    }
  }
  const topValues = Object.entries(valuesFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  // Votes stats
  const totalVotes = votes.length;
  const uniqueVoters = new Set(votes.map((v) => String(v.voterId)));
  const avgVotesPerNomination =
    approved > 0 ? Math.round(totalVotes / approved) : 0;

  return {
    totalNominations: total,
    approvedNominations: approved,
    winners,
    uniqueNominators: nominators.size,
    uniqueNominees: nominees.size,
    totalVotes,
    uniqueVoters: uniqueVoters.size,
    avgVotesPerNomination,
    topCoreValues: topValues,
    nominationRate: total > 0 ? Math.round((approved / total) * 100) : 0,
  };
}

/**
 * Check if a nominee has won any awards recently.
 *
 * @param {string} nomineeId
 * @param {Array} recentNominations — recent winning nominations
 * @param {number} cooldownDays — days before another win
 * @param {Date|string} [asOf]
 * @returns {{ inCooldown: boolean, daysUntilEligible: number }}
 */
function checkWinCooldown(nomineeId, recentNominations, cooldownDays, asOf) {
  const now = asOf ? new Date(asOf) : new Date();
  const lastWin = recentNominations
    .filter(
      (n) =>
        String(n.nomineeId) === String(nomineeId) &&
        n.status === 'Winner' &&
        n.awardedAt,
    )
    .sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt))[0];

  if (!lastWin) return { inCooldown: false, daysUntilEligible: 0 };

  const cooldownEnd = new Date(lastWin.awardedAt);
  cooldownEnd.setDate(cooldownEnd.getDate() + cooldownDays);

  if (now < cooldownEnd) {
    const daysUntil = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60 * 24));
    return { inCooldown: true, daysUntilEligible: daysUntil };
  }

  return { inCooldown: false, daysUntilEligible: 0 };
}

/**
 * Generate a nomination announcement message.
 *
 * @param {object} nomination
 * @param {string} nomineeName
 * @param {string} categoryName
 * @param {string} icon
 * @returns {string}
 */
function formatNominationMessage(nomination, nomineeName, categoryName, icon) {
  const values =
    nomination.coreValues?.length > 0
      ? ` embodying ${nomination.coreValues.join(', ')}`
      : '';
  return (
    `${icon} ${nomineeName} has been nominated for the ${categoryName} award! ` +
    `"${nomination.justification.substring(0, 100)}..."${values}`
  );
}

/**
 * Generate a winner announcement message.
 *
 * @param {string} nomineeName
 * @param {string} categoryName
 * @param {string} icon
 * @param {number} rewardAmount
 * @param {number} voteCount
 * @returns {string}
 */
function formatWinnerMessage(
  nomineeName,
  categoryName,
  icon,
  rewardAmount,
  voteCount,
) {
  const reward =
    rewardAmount > 0
      ? ` with a reward of ₹${rewardAmount.toLocaleString()}`
      : '';
  return (
    `${icon} 🎉 Congratulations to ${nomineeName} for winning the ${categoryName} award! ` +
    `Received ${voteCount} vote(s)${reward}. Thank you for your outstanding contribution!`
  );
}

module.exports = {
  checkNominatorEligibility,
  checkNomineeCapacity,
  checkVoterEligibility,
  computeVotingResults,
  selectWinners,
  computeNominationStats,
  checkWinCooldown,
  formatNominationMessage,
  formatWinnerMessage,
};
