'use strict';

const { calculateTuitionExemption } = require('../services/tuitionAssistance.service');

describe('Tuition Assistance Service', () => {
  describe('calculateTuitionExemption', () => {
    it('grants 100% tax exemption when claims remain under the $5,250 cap', () => {
      const result = calculateTuitionExemption({
        claimedAmount: 3000,
        cumulativePriorDisbursements: 1000,
        statutoryCap: 5250,
      });

      // Remaining = 5,250 - 1,000 = 4,250
      expect(result.remainingExemptionHeadroom).toBe(4250);
      // All 3,000 is exempt
      expect(result.exemptReimbursementAmount).toBe(3000);
      expect(result.taxableSpilloverPerquisiteAmount).toBe(0);
      expect(result.newCumulativeTotal).toBe(4000);
    });

    it('splits claim into exempt and taxable spillover when crossing the $5,250 cap', () => {
      const result = calculateTuitionExemption({
        claimedAmount: 4000,
        cumulativePriorDisbursements: 3000,
        statutoryCap: 5250,
      });

      // Remaining = 5,250 - 3,000 = 2,250
      expect(result.remainingExemptionHeadroom).toBe(2250);
      // Exempt = 2,250
      expect(result.exemptReimbursementAmount).toBe(2250);
      // Taxable = 4,000 - 2,250 = 1,750
      expect(result.taxableSpilloverPerquisiteAmount).toBe(1750);
      expect(result.newCumulativeTotal).toBe(7000);
    });

    it('treats entire claim as taxable when prior claims already exceed the statutory limit', () => {
      const result = calculateTuitionExemption({
        claimedAmount: 2000,
        cumulativePriorDisbursements: 5250,
        statutoryCap: 5250,
      });

      expect(result.remainingExemptionHeadroom).toBe(0);
      expect(result.exemptReimbursementAmount).toBe(0);
      expect(result.taxableSpilloverPerquisiteAmount).toBe(2000);
    });

    it('throws error for non-positive claimed amounts', () => {
      expect(() => {
        calculateTuitionExemption({ claimedAmount: 0 });
      }).toThrow('Claimed tuition amount must be strictly positive.');
    });
  });
});