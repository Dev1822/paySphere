/**
 * @fileoverview Tests for the referral bonus evaluator utilities.
 */

const {
  extractDomain,
  isBlacklistedDomain,
  findBonusTier,
  evaluateBonusEligibility,
  checkExpiry,
  computeReferralMetrics,
  detectDuplicate,
  formatStatusMessage,
} = require('../../utils/referralBonusEvaluator');

describe('referralBonusEvaluator', () => {
  describe('extractDomain', () => {
    test('extracts domain from email', () => {
      expect(extractDomain('user@example.com')).toBe('example.com');
    });
    test('handles invalid email', () => {
      expect(extractDomain('')).toBe('');
      expect(extractDomain(null)).toBe('');
    });
  });

  describe('isBlacklistedDomain', () => {
    test('detects blacklisted domain', () => {
      expect(
        isBlacklistedDomain('user@competitor.com', ['competitor.com']),
      ).toBe(true);
    });
    test('returns false for clean domain', () => {
      expect(isBlacklistedDomain('user@partner.com', ['competitor.com'])).toBe(
        false,
      );
    });
    test('handles empty blacklist', () => {
      expect(isBlacklistedDomain('user@test.com', [])).toBe(false);
    });
  });

  describe('findBonusTier', () => {
    const tiers = [
      {
        targetRole: 'Engineering',
        bonusAmount: 15000,
        channelBonus: 2000,
        payoutTrigger: 'Hired',
      },
      {
        targetRole: 'All',
        bonusAmount: 5000,
        channelBonus: 0,
        payoutTrigger: 'Hired',
      },
    ];

    test('finds exact match tier', () => {
      const result = findBonusTier(tiers, 'Engineering', 'Tech');
      expect(result).not.toBeNull();
      expect(result.baseBonus).toBe(15000);
    });

    test('falls back to All tier', () => {
      const result = findBonusTier(tiers, 'Marketing', 'Sales');
      expect(result).not.toBeNull();
      expect(result.baseBonus).toBe(5000);
    });

    test('returns null for empty tiers', () => {
      expect(findBonusTier([], 'Engineering')).toBeNull();
      expect(findBonusTier(null, 'Engineering')).toBeNull();
    });
  });

  describe('evaluateBonusEligibility', () => {
    const config = {
      isEnabled: true,
      bonusTiers: [
        {
          targetRole: 'All',
          bonusAmount: 5000,
          channelBonus: 0,
          payoutTrigger: 'Hired',
        },
        {
          targetRole: 'Engineering',
          bonusAmount: 15000,
          channelBonus: 2000,
          payoutTrigger: '90Days',
        },
      ],
    };

    test('qualifies hired candidate with immediate trigger', () => {
      const referral = {
        status: 'Hired',
        hiredAt: new Date('2026-08-01'),
        positionReferred: 'Sales',
        department: 'Sales',
      };
      const result = evaluateBonusEligibility(referral, config);
      expect(result.qualifies).toBe(true);
      expect(result.totalBonus).toBe(5000);
    });

    test('does not qualify if not hired', () => {
      const referral = { status: 'Interviewing', positionReferred: 'Sales' };
      const result = evaluateBonusEligibility(referral, config);
      expect(result.qualifies).toBe(false);
    });

    test('does not qualify if program disabled', () => {
      const referral = {
        status: 'Hired',
        hiredAt: new Date(),
        positionReferred: 'Sales',
      };
      const result = evaluateBonusEligibility(referral, {
        ...config,
        isEnabled: false,
      });
      expect(result.qualifies).toBe(false);
    });

    test('evaluates 90-day trigger correctly', () => {
      const config90 = {
        isEnabled: true,
        bonusTiers: [
          {
            targetRole: 'Engineering',
            bonusAmount: 15000,
            channelBonus: 0,
            payoutTrigger: '90Days',
          },
        ],
      };
      // Hired 100 days ago
      const hiredAt = new Date();
      hiredAt.setDate(hiredAt.getDate() - 100);
      const referral = {
        status: 'Hired',
        hiredAt,
        positionReferred: 'Engineering',
      };
      const result = evaluateBonusEligibility(referral, config90);
      expect(result.qualifies).toBe(true);
      expect(result.totalBonus).toBe(15000);
    });
  });

  describe('checkExpiry', () => {
    test('detects expired referral', () => {
      const referral = {
        status: 'Submitted',
        expiresAt: new Date('2026-01-01'),
      };
      const result = checkExpiry(referral, new Date('2026-08-25'));
      expect(result.expired).toBe(true);
    });

    test('returns remaining days for active referral', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 10);
      const referral = { status: 'Submitted', expiresAt };
      const result = checkExpiry(referral);
      expect(result.expired).toBe(false);
      expect(result.daysRemaining).toBe(10);
    });

    test('skips expired check for hired referrals', () => {
      const referral = { status: 'Hired', expiresAt: new Date('2026-01-01') };
      const result = checkExpiry(referral);
      expect(result.expired).toBe(false);
    });
  });

  describe('computeReferralMetrics', () => {
    test('computes metrics correctly', () => {
      const submissions = [
        {
          status: 'Hired',
          channel: 'Direct',
          submittedAt: new Date('2026-01-01'),
          hiredAt: new Date('2026-02-01'),
          referrerId: 'emp1',
        },
        { status: 'Rejected', channel: 'LinkedIn', referrerId: 'emp1' },
        { status: 'Submitted', channel: 'Direct', referrerId: 'emp2' },
      ];
      const payouts = [
        { status: 'Paid', totalBonus: 5000 },
        { status: 'Pending', totalBonus: 3000 },
      ];
      const metrics = computeReferralMetrics(submissions, payouts);
      expect(metrics.totalReferrals).toBe(3);
      expect(metrics.conversionRate).toBe(33);
      expect(metrics.byChannel.Direct).toBe(2);
      expect(metrics.bonusSummary.totalPaid).toBe(5000);
      expect(metrics.bonusSummary.pendingBonuses).toBe(3000);
    });
  });

  describe('detectDuplicate', () => {
    test('detects duplicate email', () => {
      const existing = [
        { candidateEmail: 'john@test.com', status: 'Submitted' },
      ];
      const result = detectDuplicate('john@test.com', existing);
      expect(result.isDuplicate).toBe(true);
    });

    test('ignores withdrawn referrals', () => {
      const existing = [
        { candidateEmail: 'john@test.com', status: 'Withdrawn' },
      ];
      const result = detectDuplicate('john@test.com', existing);
      expect(result.isDuplicate).toBe(false);
    });

    test('returns false for new candidate', () => {
      const result = detectDuplicate('new@test.com', []);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('formatStatusMessage', () => {
    test('formats hire message', () => {
      const msg = formatStatusMessage(
        'Alice',
        'Engineer',
        'Interviewing',
        'Hired',
      );
      expect(msg).toContain('Alice');
      expect(msg).toContain('Hired');
      expect(msg).toContain('🎉');
    });
  });
});
