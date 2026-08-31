const {
  isLwfApplicableMonth,
  computeLwfDeduction,
  generateFormARemittanceSummary,
  LWF_STATE_RULES,
} = require('../lwfEngine.utils');

describe('lwfEngine.utils - Multi-State Labour Welfare Fund Engine', () => {
  describe('isLwfApplicableMonth', () => {
    it('returns true for Maharashtra in June and December', () => {
      expect(isLwfApplicableMonth('MAHARASHTRA', 6)).toBe(true);
      expect(isLwfApplicableMonth('MAHARASHTRA', 12)).toBe(true);
      expect(isLwfApplicableMonth('MAHARASHTRA', 5)).toBe(false);
    });

    it('returns true for Karnataka only in December annual cycle', () => {
      expect(isLwfApplicableMonth('KARNATAKA', 12)).toBe(true);
      expect(isLwfApplicableMonth('KARNATAKA', 6)).toBe(false);
    });
  });

  describe('computeLwfDeduction', () => {
    it('computes Maharashtra half-yearly LWF for high gross wage in June', () => {
      // Gross = 35,000 > 3000 -> Employee = 12, Employer = 36 -> Total = 48
      const result = computeLwfDeduction('MAHARASHTRA', 35000, 6);

      expect(result.isApplicable).toBe(true);
      expect(result.employeeContribution).toBe(12);
      expect(result.employerContribution).toBe(36);
      expect(result.totalLwfRemittance).toBe(48);
    });

    it('returns zero deduction during non-applicable month in Maharashtra', () => {
      const result = computeLwfDeduction('MAHARASHTRA', 35000, 3); // March

      expect(result.isApplicable).toBe(false);
      expect(result.employeeContribution).toBe(0);
      expect(result.employerContribution).toBe(0);
    });

    it('computes Gujarat fixed half-yearly ₹6 employee + ₹12 employer in December', () => {
      const result = computeLwfDeduction('GUJARAT', 40000, 12);

      expect(result.isApplicable).toBe(true);
      expect(result.employeeContribution).toBe(6);
      expect(result.employerContribution).toBe(12);
      expect(result.totalLwfRemittance).toBe(18);
    });

    it('computes Karnataka annual ₹20 employee + ₹40 employer in December', () => {
      const result = computeLwfDeduction('KARNATAKA', 50000, 12);

      expect(result.isApplicable).toBe(true);
      expect(result.employeeContribution).toBe(20);
      expect(result.employerContribution).toBe(40);
      expect(result.totalLwfRemittance).toBe(60);
    });
  });

  describe('generateFormARemittanceSummary', () => {
    it('aggregates organization Form A remittance summary', () => {
      const staff = [
        { monthlyGross: 40000 },
        { monthlyGross: 2500 }, // low wage bracket in MH (6 + 18)
      ];

      const report = generateFormARemittanceSummary(staff, 'MAHARASHTRA', 6);

      expect(report.totalEmployees).toBe(2);
      expect(report.totalEmployeeDeductions).toBe(18); // 12 + 6
      expect(report.totalEmployerContributions).toBe(54); // 36 + 18
      expect(report.totalRemittanceDue).toBe(72);
    });
  });
});
