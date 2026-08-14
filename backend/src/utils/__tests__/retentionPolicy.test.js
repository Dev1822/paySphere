'use strict';

const {
  anonymizeEmployeePII,
  evaluateRetentionEligibility,
} = require('../retentionPolicy');

describe('Data Retention & GDPR Right-to-be-Forgotten Policy Engine', () => {
  describe('anonymizeEmployeePII', () => {
    it('redacts sensitive PII fields and sets anonymization flag', () => {
      const emp = {
        _id: 'emp123',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+91 9876543210',
        pan: 'ABCDE1234F',
        bankAccountNumber: '123456789012',
      };

      const result = anonymizeEmployeePII(emp);
      expect(result.fullName).toMatch(/^Anonymized Employee [a-f0-9]{8}$/);
      expect(result.email).toMatch(/^anonymized-[a-f0-9]{8}@pay-sphere\.internal$/);
      expect(result.phone).toBe('0000000000');
      expect(result.pan).toBe('ANONPAN000');
      expect(result.bankAccountNumber).toBe('0000000000');
      expect(result.isAnonymized).toBe(true);
      expect(result.anonymizedAt).toBeInstanceOf(Date);
    });
  });

  describe('evaluateRetentionEligibility', () => {
    it('returns isEligibleForPurge = false when deleted time is within retention window', () => {
      const emp = {
        _id: 'emp1',
        deletedAt: new Date('2024-01-01T00:00:00Z'),
      };
      const now = new Date('2026-08-14T00:00:00Z'); // ~2.6 years

      const result = evaluateRetentionEligibility(emp, 7, now);
      expect(result.isEligibleForPurge).toBe(false);
      expect(result.daysArchived).toBeGreaterThan(900);
      expect(result.remainingDays).toBeGreaterThan(0);
    });

    it('returns isEligibleForPurge = true when deleted time exceeds retention window (7 years)', () => {
      const emp = {
        _id: 'emp2',
        deletedAt: new Date('2018-01-01T00:00:00Z'),
      };
      const now = new Date('2026-08-14T00:00:00Z'); // ~8.6 years

      const result = evaluateRetentionEligibility(emp, 7, now);
      expect(result.isEligibleForPurge).toBe(true);
      expect(result.remainingDays).toBe(0);
    });
  });
});
