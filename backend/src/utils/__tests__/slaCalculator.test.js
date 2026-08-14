'use strict';

const {
  evaluateGrievanceSLA,
  tallyICCVotes,
} = require('../slaCalculator');

describe('POSH Grievance Statutory SLA & ICC Voting Engine', () => {
  describe('evaluateGrievanceSLA', () => {
    it('marks case as COMPLIANT when well within statutory 90 days', () => {
      const filedAt = new Date('2026-06-01T00:00:00Z');
      const slaDeadline = new Date('2026-08-30T00:00:00Z');
      const now = new Date('2026-06-15T00:00:00Z'); // 14 days in, 76 remaining

      const result = evaluateGrievanceSLA(filedAt, slaDeadline, now);
      expect(result.isBreached).toBe(false);
      expect(result.isUrgentWarning).toBe(false);
      expect(result.slaState).toBe('COMPLIANT');
      expect(result.daysRemaining).toBe(76);
    });

    it('marks case as WARNING when remaining days <= 15', () => {
      const filedAt = new Date('2026-06-01T00:00:00Z');
      const slaDeadline = new Date('2026-08-30T00:00:00Z');
      const now = new Date('2026-08-20T00:00:00Z'); // 10 days remaining

      const result = evaluateGrievanceSLA(filedAt, slaDeadline, now);
      expect(result.isBreached).toBe(false);
      expect(result.isUrgentWarning).toBe(true);
      expect(result.slaState).toBe('WARNING');
    });

    it('marks case as BREACHED when deadline has passed', () => {
      const filedAt = new Date('2026-05-01T00:00:00Z');
      const slaDeadline = new Date('2026-07-30T00:00:00Z');
      const now = new Date('2026-08-05T00:00:00Z'); // 6 days overdue

      const result = evaluateGrievanceSLA(filedAt, slaDeadline, now);
      expect(result.isBreached).toBe(true);
      expect(result.slaState).toBe('BREACHED');
      expect(result.daysRemaining).toBeLessThan(0);
    });
  });

  describe('tallyICCVotes', () => {
    it('returns Pending when quorum of 3 is not met', () => {
      const votes = [
        { verdict: 'Upheld' },
        { verdict: 'Upheld' },
      ];

      const result = tallyICCVotes(votes, 3);
      expect(result.hasQuorum).toBe(false);
      expect(result.leadingVerdict).toBe('Pending');
    });

    it('determines majority verdict once quorum is reached', () => {
      const votes = [
        { verdict: 'Upheld' },
        { verdict: 'Upheld' },
        { verdict: 'Dismissed' },
      ];

      const result = tallyICCVotes(votes, 3);
      expect(result.hasQuorum).toBe(true);
      expect(result.tallies.Upheld).toBe(2);
      expect(result.tallies.Dismissed).toBe(1);
      expect(result.leadingVerdict).toBe('Upheld');
    });
  });
});
