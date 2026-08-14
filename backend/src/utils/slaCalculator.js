/**
 * @fileoverview POSH Grievance Statutory 90-Day SLA & ICC Voting Tally Engine
 * @description Computes statutory inquiry timeline adherence, urgency warnings (< 15 days),
 * breach alerts, and Internal Complaints Committee (ICC) quorum vote calculations.
 */

'use strict';

/**
 * Evaluates SLA timeline adherence for a POSH inquiry (Statutory limit: 90 days).
 *
 * @param {Date|string} filedAt
 * @param {Date|string} slaDeadline
 * @param {Date|string} [now=new Date()]
 * @returns {object} SLA status breakdown
 */
function evaluateGrievanceSLA(filedAt, slaDeadline, now = new Date()) {
  const filedTime = new Date(filedAt).getTime();
  const deadlineTime = new Date(slaDeadline).getTime();
  const currentTime = new Date(now).getTime();

  const totalDurationDays = Math.max(1, Math.round((deadlineTime - filedTime) / (1000 * 60 * 60 * 24)));
  const daysElapsed = Math.max(0, Math.floor((currentTime - filedTime) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.ceil((deadlineTime - currentTime) / (1000 * 60 * 60 * 24));

  const isBreached = daysRemaining < 0;
  const isUrgentWarning = !isBreached && daysRemaining <= 15;

  let slaState = 'COMPLIANT';
  if (isBreached) {
    slaState = 'BREACHED';
  } else if (isUrgentWarning) {
    slaState = 'WARNING';
  }

  return {
    totalDurationDays,
    daysElapsed,
    daysRemaining,
    isBreached,
    isUrgentWarning,
    slaState,
  };
}

/**
 * Tallies ICC Committee votes and determines if quorum is satisfied.
 * Quorum requirement: at least 3 members, with simple majority.
 *
 * @param {Array<object>} votes
 * @param {number} [requiredQuorum=3]
 * @returns {object}
 */
function tallyICCVotes(votes = [], requiredQuorum = 3) {
  const tallies = {
    Upheld: 0,
    Dismissed: 0,
    Inconclusive: 0,
  };

  for (const v of votes) {
    if (tallies[v.verdict] !== undefined) {
      tallies[v.verdict]++;
    }
  }

  const totalVotes = votes.length;
  const hasQuorum = totalVotes >= requiredQuorum;

  let leadingVerdict = 'Pending';
  if (hasQuorum) {
    if (tallies.Upheld > tallies.Dismissed && tallies.Upheld > tallies.Inconclusive) {
      leadingVerdict = 'Upheld';
    } else if (tallies.Dismissed > tallies.Upheld && tallies.Dismissed > tallies.Inconclusive) {
      leadingVerdict = 'Dismissed';
    } else {
      leadingVerdict = 'Inconclusive';
    }
  }

  return {
    totalVotes,
    requiredQuorum,
    hasQuorum,
    tallies,
    leadingVerdict,
  };
}

module.exports = {
  evaluateGrievanceSLA,
  tallyICCVotes,
};
