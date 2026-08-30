/**
 * @fileoverview Referral Bonus Evaluator — pure computation utilities
 * @description Evaluates referral bonus eligibility, detects expired referrals,
 * matches candidates to bonus tiers, and computes referral program metrics.
 * No I/O — callers handle persistence.
 */

/**
 * Extract the domain from an email address.
 * @param {string} email
 * @returns {string}
 */
function extractDomain(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.toLowerCase().trim().split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Check if a candidate's email domain is blacklisted.
 * @param {string} email
 * @param {Array<string>} blacklistedDomains
 * @returns {boolean}
 */
function isBlacklistedDomain(email, blacklistedDomains) {
  if (!Array.isArray(blacklistedDomains) || blacklistedDomains.length === 0)
    return false;
  const domain = extractDomain(email);
  return blacklistedDomains.some((d) => d.toLowerCase().trim() === domain);
}

/**
 * Find the matching bonus tier for a referred position.
 *
 * @param {Array} bonusTiers — from ReferralProgramConfig.bonusTiers
 * @param {string} position — the role being hired into
 * @param {string} [department] — optional department for more specific matching
 * @returns {{ tier: object, baseBonus: number, channelBonus: number } | null}
 */
function findBonusTier(bonusTiers, position, department) {
  if (!Array.isArray(bonusTiers) || bonusTiers.length === 0) return null;

  // Try exact match first
  for (const tier of bonusTiers) {
    const target = (tier.targetRole || '').toLowerCase().trim();
    if (target === 'all') continue; // 'All' is the fallback
    if (target === (position || '').toLowerCase().trim()) {
      return {
        tier,
        baseBonus: tier.bonusAmount,
        channelBonus: tier.channelBonus || 0,
      };
    }
    if (department && target === department.toLowerCase().trim()) {
      return {
        tier,
        baseBonus: tier.bonusAmount,
        channelBonus: tier.channelBonus || 0,
      };
    }
  }

  // Fallback to 'All' tier
  const allTier = bonusTiers.find(
    (t) => (t.targetRole || '').toLowerCase() === 'all',
  );
  if (allTier) {
    return {
      tier: allTier,
      baseBonus: allTier.bonusAmount,
      channelBonus: allTier.channelBonus || 0,
    };
  }

  return null;
}

/**
 * Evaluate whether a referral qualifies for a bonus payout.
 *
 * @param {object} referral — ReferralSubmission document
 * @param {object} config — ReferralProgramConfig document
 * @param {Date|string} [asOf] — evaluation date
 * @returns {{
 *   qualifies: boolean,
 *   reason: string,
 *   bonusTier: object|null,
 *   totalBonus: number,
 *   payoutTrigger: string
 * }}
 */
function evaluateBonusEligibility(referral, config, asOf) {
  const now = asOf ? new Date(asOf) : new Date();

  if (!config?.isEnabled) {
    return {
      qualifies: false,
      reason: 'Referral program is disabled',
      bonusTier: null,
      totalBonus: 0,
      payoutTrigger: null,
    };
  }

  if (referral.status !== 'Hired') {
    return {
      qualifies: false,
      reason: `Referral status is "${referral.status}", not "Hired"`,
      bonusTier: null,
      totalBonus: 0,
      payoutTrigger: null,
    };
  }

  if (!referral.hiredAt) {
    return {
      qualifies: false,
      reason: 'No hire date recorded',
      bonusTier: null,
      totalBonus: 0,
      payoutTrigger: null,
    };
  }

  const tierResult = findBonusTier(
    config.bonusTiers,
    referral.positionReferred,
    referral.department,
  );
  if (!tierResult) {
    return {
      qualifies: false,
      reason: 'No matching bonus tier',
      bonusTier: null,
      totalBonus: 0,
      payoutTrigger: null,
    };
  }

  const { tier, baseBonus, channelBonus } = tierResult;
  const totalBonus = baseBonus + channelBonus;

  // Check if payout condition is met based on trigger type
  switch (tier.payoutTrigger) {
    case 'Hired':
      return {
        qualifies: true,
        reason: 'Candidate hired — immediate payout',
        bonusTier: tier,
        totalBonus,
        payoutTrigger: 'Hired',
      };

    case 'Onboarding':
      return {
        qualifies: true,
        reason: 'Candidate completed onboarding',
        bonusTier: tier,
        totalBonus,
        payoutTrigger: 'Onboarding',
      };

    case '90Days': {
      if (!referral.probationEndDate) {
        return {
          qualifies: false,
          reason: 'Probation end date not set — cannot evaluate 90-day trigger',
          bonusTier: tier,
          totalBonus,
          payoutTrigger: '90Days',
        };
      }
      const daysSinceHire = Math.floor(
        (now - new Date(referral.hiredAt)) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceHire >= 90) {
        return {
          qualifies: true,
          reason: `Candidate passed 90-day mark (${daysSinceHire} days)`,
          bonusTier: tier,
          totalBonus,
          payoutTrigger: '90Days',
        };
      }
      return {
        qualifies: false,
        reason: `Candidate at ${daysSinceHire}/90 days`,
        bonusTier: tier,
        totalBonus,
        payoutTrigger: '90Days',
      };
    }

    case '6Months': {
      const daysSinceHire = Math.floor(
        (now - new Date(referral.hiredAt)) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceHire >= 180) {
        return {
          qualifies: true,
          reason: `Candidate passed 6-month mark (${daysSinceHire} days)`,
          bonusTier: tier,
          totalBonus,
          payoutTrigger: '6Months',
        };
      }
      return {
        qualifies: false,
        reason: `Candidate at ${daysSinceHire}/180 days`,
        bonusTier: tier,
        totalBonus,
        payoutTrigger: '6Months',
      };
    }

    default:
      return {
        qualifies: false,
        reason: `Unknown payout trigger: ${tier.payoutTrigger}`,
        bonusTier: tier,
        totalBonus,
        payoutTrigger: tier.payoutTrigger,
      };
  }
}

/**
 * Check if a referral has expired.
 *
 * @param {object} referral — must have submittedAt, expiresAt, status
 * @param {Date|string} [asOf]
 * @returns {{ expired: boolean, daysRemaining: number }}
 */
function checkExpiry(referral, asOf) {
  const now = asOf ? new Date(asOf) : new Date();
  if (
    ['Hired', 'Rejected', 'Withdrawn', 'Expired', 'BonusPaid'].includes(
      referral.status,
    )
  ) {
    return { expired: false, daysRemaining: Infinity };
  }

  if (!referral.expiresAt) return { expired: false, daysRemaining: Infinity };

  const expiresAt = new Date(referral.expiresAt);
  if (now > expiresAt) {
    return { expired: true, daysRemaining: 0 };
  }

  const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  return { expired: false, daysRemaining };
}

/**
 * Compute referral program metrics for a tenant.
 *
 * @param {Array} submissions — all referrals for the tenant
 * @param {Array} payouts — all bonus payouts for the tenant
 * @returns {object}
 */
function computeReferralMetrics(submissions, payouts) {
  const total = submissions.length;
  const byStatus = {};
  for (const s of submissions) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  }

  const hired = submissions.filter((s) => s.status === 'Hired');
  const conversionRate =
    total > 0 ? Math.round((hired.length / total) * 100) : 0;

  // Average time to hire
  const hireTimes = hired
    .filter((s) => s.hiredAt && s.submittedAt)
    .map((s) =>
      Math.floor(
        (new Date(s.hiredAt) - new Date(s.submittedAt)) / (1000 * 60 * 60 * 24),
      ),
    );
  const avgTimeToHire =
    hireTimes.length > 0
      ? Math.round(hireTimes.reduce((a, b) => a + b, 0) / hireTimes.length)
      : 0;

  // Top referrers
  const referrerCounts = {};
  for (const s of submissions) {
    const rid = String(s.referrerId);
    referrerCounts[rid] = (referrerCounts[rid] || 0) + 1;
  }
  const topReferrers = Object.entries(referrerCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, count]) => ({ referrerId: id, referralCount: count }));

  // Channel distribution
  const byChannel = {};
  for (const s of submissions) {
    byChannel[s.channel || 'Direct'] =
      (byChannel[s.channel || 'Direct'] || 0) + 1;
  }

  // Bonus summary
  const totalPaid = payouts
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + (p.totalBonus || 0), 0);
  const pendingBonuses = payouts
    .filter((p) => ['Pending', 'Approved'].includes(p.status))
    .reduce((sum, p) => sum + (p.totalBonus || 0), 0);

  return {
    totalReferrals: total,
    byStatus,
    conversionRate,
    avgTimeToHire,
    topReferrers,
    byChannel,
    bonusSummary: {
      totalPaid,
      pendingBonuses,
      totalPayouts: payouts.length,
      paidCount: payouts.filter((p) => p.status === 'Paid').length,
    },
  };
}

/**
 * Find potential duplicate referrals for a candidate email.
 *
 * @param {string} candidateEmail
 * @param {Array} existingSubmissions
 * @returns {{ isDuplicate: boolean, duplicateOf: object|null }}
 */
function detectDuplicate(candidateEmail, existingSubmissions) {
  if (!candidateEmail) return { isDuplicate: false, duplicateOf: null };

  const email = candidateEmail.toLowerCase().trim();
  const duplicate = existingSubmissions.find(
    (s) =>
      s.candidateEmail.toLowerCase().trim() === email &&
      s.status !== 'Withdrawn',
  );

  if (duplicate) {
    return { isDuplicate: true, duplicateOf: duplicate };
  }
  return { isDuplicate: false, duplicateOf: null };
}

/**
 * Format a referral status change notification message.
 *
 * @param {string} candidateName
 * @param {string} newPosition
 * @param {string} oldStatus
 * @param {string} newStatus
 * @returns {string}
 */
function formatStatusMessage(candidateName, newPosition, oldStatus, newStatus) {
  const statusEmojis = {
    Submitted: '📋',
    Screening: '🔍',
    Interviewing: '🎤',
    Offered: '📝',
    Hired: '🎉',
    Rejected: '❌',
    Withdrawn: '↩️',
    Expired: '⏰',
    BonusPaid: '💰',
  };
  const emoji = statusEmojis[newStatus] || '📌';
  return `${emoji} Your referral ${candidateName} for ${newPosition} has been updated: ${oldStatus} → ${newStatus}`;
}

module.exports = {
  extractDomain,
  isBlacklistedDomain,
  findBonusTier,
  evaluateBonusEligibility,
  checkExpiry,
  computeReferralMetrics,
  detectDuplicate,
  formatStatusMessage,
};
