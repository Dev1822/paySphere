const {
  resolveMinimumWageFloor,
  evaluateEmployeeWageCompliance,
  calculateRetroactiveWageArrears,
  auditOrganizationWageCompliance,
  SKILL_TIERS,
} = require('../minimumWagesEngine.utils');

describe('minimumWagesEngine.utils - Minimum Wages Act Compliance Engine', () => {
  describe('resolveMinimumWageFloor', () => {
    it('returns Delhi statutory minimum wage for Skilled tier', () => {
      const floor = resolveMinimumWageFloor('DELHI', SKILL_TIERS.SKILLED);
      expect(floor).toBe(21215);
    });

    it('returns Maharashtra statutory minimum wage for Unskilled tier', () => {
      const floor = resolveMinimumWageFloor('MAHARASHTRA', SKILL_TIERS.UNSKILLED);
      expect(floor).toBe(15400);
    });
  });

  describe('evaluateEmployeeWageCompliance', () => {
    it('marks employee compliant when Basic + DA is at or above statutory floor', () => {
      // Basic = 22000, DA = 1000 -> Total = 23000 >= Delhi Skilled floor 21215
      const result = evaluateEmployeeWageCompliance(22000, 1000, SKILL_TIERS.SKILLED, 'DELHI');

      expect(result.isCompliant).toBe(true);
      expect(result.statutoryWageFloor).toBe(21215);
      expect(result.actualEligibleWages).toBe(23000);
      expect(result.monthlyShortfall).toBe(0);
      expect(result.auditStatus).toBe('COMPLIANT_ABOVE_STATUTORY_FLOOR');
    });

    it('marks employee non-compliant and computes monthly shortfall when below floor', () => {
      // Basic = 16000, DA = 0 -> Total = 16000 < Delhi Semi-skilled floor 19279
      // Shortfall = 19279 - 16000 = 3279
      const result = evaluateEmployeeWageCompliance(16000, 0, SKILL_TIERS.SEMI_SKILLED, 'DELHI');

      expect(result.isCompliant).toBe(false);
      expect(result.statutoryWageFloor).toBe(19279);
      expect(result.monthlyShortfall).toBe(3279);
      expect(result.auditStatus).toBe('NON_COMPLIANT_WAGE_DISCREPANCY');
    });
  });

  describe('calculateRetroactiveWageArrears', () => {
    it('computes cumulative arrear liability across retroactive months', () => {
      // Shortfall = 3279 * 4 months = 13,116
      const result = calculateRetroactiveWageArrears(16000, 0, SKILL_TIERS.SEMI_SKILLED, 'DELHI', 4);

      expect(result.monthlyShortfall).toBe(3279);
      expect(result.retroactiveMonths).toBe(4);
      expect(result.totalArrearLiability).toBe(13116);
    });
  });

  describe('auditOrganizationWageCompliance', () => {
    it('scans roster, flags non-compliant staff, and calculates compliance percentage', () => {
      const roster = [
        { basic: 25000, da: 0, skillTier: SKILL_TIERS.SKILLED },    // Compliant (>= 21215)
        { basic: 15000, da: 0, skillTier: SKILL_TIERS.UNSKILLED },  // Non-compliant (< 17494, shortfall = 2494)
      ];

      const report = auditOrganizationWageCompliance(roster, 'DELHI');

      expect(report.totalAudited).toBe(2);
      expect(report.compliantCount).toBe(1);
      expect(report.nonCompliantCount).toBe(1);
      expect(report.compliancePercentage).toBe(50);
      expect(report.totalMonthlyShortfallLiability).toBe(2494);
      expect(report.discrepancies.length).toBe(1);
    });
  });
});
