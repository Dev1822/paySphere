/**
 * @fileoverview Unit tests for Peer Nomination Engine
 */

const {
  checkNominatorEligibility,
  checkNomineeCapacity,
  checkVoterEligibility,
  computeVotingResults,
  selectWinners,
  computeNominationStats,
  checkWinCooldown,
  formatNominationMessage,
  formatWinnerMessage,
} = require('../../utils/peerNominationEngine');

describe('Peer Nomination Engine', () => {
  // ---------------------------------------------------------------------------
  // checkNominatorEligibility
  // ---------------------------------------------------------------------------
  describe('checkNominatorEligibility', () => {
    const makeCategory = (overrides = {}) => ({
      allowSelfNomination: false,
      maxNominationsPerNominator: 3,
      ...overrides,
    });
    const makeCycle = (status = 'Nominating') => ({ status });

    it('allows a valid nomination', () => {
      const result = checkNominatorEligibility({
        nominatorId: 'n1',
        nomineeId: 'n2',
        category: makeCategory(),
        cycle: makeCycle(),
        existingNominationCount: 1,
      });
      expect(result.eligible).toBe(true);
    });

    it('rejects self-nomination when not allowed', () => {
      const result = checkNominatorEligibility({
        nominatorId: 'n1',
        nomineeId: 'n1',
        category: makeCategory(),
        cycle: makeCycle(),
        existingNominationCount: 0,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Self-nomination');
    });

    it('allows self-nomination when enabled', () => {
      const result = checkNominatorEligibility({
        nominatorId: 'n1',
        nomineeId: 'n1',
        category: makeCategory({ allowSelfNomination: true }),
        cycle: makeCycle(),
        existingNominationCount: 0,
      });
      expect(result.eligible).toBe(true);
    });

    it('rejects when max nominations reached', () => {
      const result = checkNominatorEligibility({
        nominatorId: 'n1',
        nomineeId: 'n2',
        category: makeCategory(),
        cycle: makeCycle(),
        existingNominationCount: 3,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Maximum');
    });

    it('rejects when cycle is not in Nominating phase', () => {
      const result = checkNominatorEligibility({
        nominatorId: 'n1',
        nomineeId: 'n2',
        category: makeCategory(),
        cycle: makeCycle('Voting'),
        existingNominationCount: 0,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Voting');
    });
  });

  // ---------------------------------------------------------------------------
  // checkNomineeCapacity
  // ---------------------------------------------------------------------------
  describe('checkNomineeCapacity', () => {
    it('allows when under capacity', () => {
      expect(checkNomineeCapacity(2, 5).eligible).toBe(true);
    });

    it('rejects at capacity', () => {
      const result = checkNomineeCapacity(5, 5);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('maximum of 5');
    });
  });

  // ---------------------------------------------------------------------------
  // checkVoterEligibility
  // ---------------------------------------------------------------------------
  describe('checkVoterEligibility', () => {
    const makeCycle = (status = 'Voting') => ({ status });

    it('allows a valid vote', () => {
      const result = checkVoterEligibility({
        voterId: 'v1',
        nominationId: 'nom1',
        nominatorId: 'n1',
        nomineeId: 'n2',
        cycle: makeCycle(),
        existingVoteCount: 1,
        maxVotesPerVoter: 5,
      });
      expect(result.eligible).toBe(true);
    });

    it('rejects when not in voting phase', () => {
      const result = checkVoterEligibility({
        voterId: 'v1',
        nominationId: 'nom1',
        nominatorId: 'n1',
        nomineeId: 'n2',
        cycle: makeCycle('Nominating'),
        existingVoteCount: 0,
        maxVotesPerVoter: 5,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Nominating');
    });

    it('rejects self-voting (nominator)', () => {
      const result = checkVoterEligibility({
        voterId: 'n1',
        nominationId: 'nom1',
        nominatorId: 'n1',
        nomineeId: 'n2',
        cycle: makeCycle(),
        existingVoteCount: 0,
        maxVotesPerVoter: 5,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('own nomination');
    });

    it('rejects voting for yourself as nominee', () => {
      const result = checkVoterEligibility({
        voterId: 'n2',
        nominationId: 'nom1',
        nominatorId: 'n1',
        nomineeId: 'n2',
        cycle: makeCycle(),
        existingVoteCount: 0,
        maxVotesPerVoter: 5,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('yourself');
    });

    it('rejects at max votes', () => {
      const result = checkVoterEligibility({
        voterId: 'v1',
        nominationId: 'nom1',
        nominatorId: 'n1',
        nomineeId: 'n2',
        cycle: makeCycle(),
        existingVoteCount: 5,
        maxVotesPerVoter: 5,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Maximum');
    });
  });

  // ---------------------------------------------------------------------------
  // computeVotingResults
  // ---------------------------------------------------------------------------
  describe('computeVotingResults', () => {
    it('returns ranked results by vote count', () => {
      const noms = [
        {
          _id: 'n1',
          nomineeId: 'e1',
          nominatorId: 'e2',
          justification: 'j1',
          coreValues: ['Teamwork'],
        },
        {
          _id: 'n2',
          nomineeId: 'e3',
          nominatorId: 'e4',
          justification: 'j2',
          coreValues: [],
        },
      ];
      const votes = [
        { nominationId: 'n2' },
        { nominationId: 'n2' },
        { nominationId: 'n1' },
      ];

      const results = computeVotingResults(noms, votes);
      expect(results[0].nominationId).toBe('n2');
      expect(results[0].voteCount).toBe(2);
      expect(results[0].rank).toBe(1);
      expect(results[1].rank).toBe(2);
    });

    it('handles nominations with no votes', () => {
      const noms = [
        {
          _id: 'n1',
          nomineeId: 'e1',
          nominatorId: 'e2',
          justification: 'j1',
          coreValues: [],
        },
      ];
      const results = computeVotingResults(noms, []);
      expect(results[0].voteCount).toBe(0);
      expect(results[0].rank).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // selectWinners
  // ---------------------------------------------------------------------------
  describe('selectWinners', () => {
    it('selects top N winners by rank', () => {
      const ranked = [
        { nominationId: 'n1', nomineeId: 'e1', rank: 1, voteCount: 10 },
        { nominationId: 'n2', nomineeId: 'e2', rank: 2, voteCount: 8 },
        { nominationId: 'n3', nomineeId: 'e3', rank: 3, voteCount: 5 },
      ];

      const winners = selectWinners(ranked, 2, 0);
      expect(winners).toHaveLength(2);
      expect(winners[0].nominationId).toBe('n1');
      expect(winners[1].nominationId).toBe('n2');
    });

    it('filters by minVotes', () => {
      const ranked = [
        { nominationId: 'n1', nomineeId: 'e1', rank: 1, voteCount: 3 },
        { nominationId: 'n2', nomineeId: 'e2', rank: 2, voteCount: 1 },
      ];

      const winners = selectWinners(ranked, 5, 2);
      expect(winners).toHaveLength(1);
      expect(winners[0].nominationId).toBe('n1');
    });

    it('returns empty when no candidates meet minVotes', () => {
      const ranked = [
        { nominationId: 'n1', nomineeId: 'e1', rank: 1, voteCount: 0 },
      ];
      expect(selectWinners(ranked, 1, 5)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // computeNominationStats
  // ---------------------------------------------------------------------------
  describe('computeNominationStats', () => {
    it('computes correct statistics', () => {
      const noms = [
        { status: 'Approved', coreValues: ['Teamwork', 'Innovation'] },
        { status: 'Winner', coreValues: ['Teamwork'] },
        { status: 'Rejected', coreValues: [] },
        { status: 'Submitted', coreValues: ['Innovation'] },
      ];
      const votes = [{ voterId: 'v1' }, { voterId: 'v2' }, { voterId: 'v3' }];
      const category = { name: 'Test' };

      const stats = computeNominationStats(noms, votes, category);
      expect(stats.totalNominations).toBe(4);
      expect(stats.approvedNominations).toBe(2); // Approved + Winner
      expect(stats.winners).toBe(1);
      expect(stats.totalVotes).toBe(3);
      expect(stats.uniqueVoters).toBe(3);
      expect(stats.topCoreValues[0].value).toBe('Teamwork');
      expect(stats.topCoreValues[0].count).toBe(2);
    });

    it('handles empty data', () => {
      const stats = computeNominationStats([], [], {});
      expect(stats.totalNominations).toBe(0);
      expect(stats.nominationRate).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // checkWinCooldown
  // ---------------------------------------------------------------------------
  describe('checkWinCooldown', () => {
    it('returns no cooldown when never won', () => {
      const result = checkWinCooldown('e1', [], 30);
      expect(result.inCooldown).toBe(false);
    });

    it('detects active cooldown period', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);
      const recentNoms = [
        { nomineeId: 'e1', status: 'Winner', awardedAt: recentDate },
      ];
      const result = checkWinCooldown('e1', recentNoms, 30);
      expect(result.inCooldown).toBe(true);
      expect(result.daysUntilEligible).toBeGreaterThan(20);
      expect(result.daysUntilEligible).toBeLessThanOrEqual(30);
    });

    it('allows when cooldown has expired', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      const recentNoms = [
        { nomineeId: 'e1', status: 'Winner', awardedAt: oldDate },
      ];
      const result = checkWinCooldown('e1', recentNoms, 30);
      expect(result.inCooldown).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // formatNominationMessage
  // ---------------------------------------------------------------------------
  describe('formatNominationMessage', () => {
    it('includes nominee name, category, icon, and justification', () => {
      const msg = formatNominationMessage(
        {
          justification: 'Great teamwork on the project launch',
          coreValues: ['Teamwork'],
        },
        'John Doe',
        'Star Performer',
        '⭐',
      );
      expect(msg).toContain('John Doe');
      expect(msg).toContain('Star Performer');
      expect(msg).toContain('⭐');
      expect(msg).toContain('Teamwork');
    });

    it('handles empty core values', () => {
      const msg = formatNominationMessage(
        { justification: 'Exceptional work', coreValues: [] },
        'Jane',
        'Innovation',
        '💡',
      );
      expect(msg).toContain('Jane');
      expect(msg).not.toContain('embodying');
    });
  });

  // ---------------------------------------------------------------------------
  // formatWinnerMessage
  // ---------------------------------------------------------------------------
  describe('formatWinnerMessage', () => {
    it('includes winner details and reward amount', () => {
      const msg = formatWinnerMessage('Alice', 'Innovation', '🚀', 5000, 15);
      expect(msg).toContain('Alice');
      expect(msg).toContain('Innovation');
      expect(msg).toContain('₹5,000');
      expect(msg).toContain('15 vote(s)');
    });

    it('handles zero reward', () => {
      const msg = formatWinnerMessage('Bob', 'Teamwork', '🤝', 0, 8);
      expect(msg).not.toContain('₹');
      expect(msg).toContain('8 vote(s)');
    });
  });
});
