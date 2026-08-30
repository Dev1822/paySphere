const {
  computeMonthlyProfessionalTax,
  calculateAnnualProfessionalTaxSchedule,
  generateFormIIIAggregate,
  STATE_PT_SLABS,
} = require('../professionalTaxEngine.utils');

describe('professionalTaxEngine.utils - Multi-State Professional Tax Engine', () => {
  describe('computeMonthlyProfessionalTax', () => {
    it('computes Maharashtra standard ₹200 deduction and February ₹300 surcharge for male', () => {
      const janResult = computeMonthlyProfessionalTax('MAHARASHTRA', 35000, 1, 'M');
      expect(janResult.ptDeduction).toBe(200);
      expect(janResult.ruleApplied).toContain('₹200');

      const febResult = computeMonthlyProfessionalTax('MAHARASHTRA', 35000, 2, 'M');
      expect(febResult.ptDeduction).toBe(300);
      expect(febResult.ruleApplied).toContain('February statutory surcharge');
    });

    it('exempts Maharashtra female wage earner earning <= ₹25,000', () => {
      const result = computeMonthlyProfessionalTax('MAHARASHTRA', 22000, 2, 'F');
      expect(result.ptDeduction).toBe(0);
      expect(result.isExempt).toBe(true);
      expect(result.ruleApplied).toContain('female wage earner exemption');
    });

    it('deducts PT for Maharashtra female wage earner earning > ₹25,000', () => {
      const result = computeMonthlyProfessionalTax('MAHARASHTRA', 40000, 2, 'F');
      expect(result.ptDeduction).toBe(300); // February surcharge applies above 25k
    });

    it('computes Karnataka flat ₹200 for salary >= ₹25,000 and ₹0 below', () => {
      const lowSalary = computeMonthlyProfessionalTax('KARNATAKA', 20000, 5, 'M');
      expect(lowSalary.ptDeduction).toBe(0);

      const highSalary = computeMonthlyProfessionalTax('KARNATAKA', 50000, 5, 'M');
      expect(highSalary.ptDeduction).toBe(200);
    });

    it('computes West Bengal progressive slabs', () => {
      expect(computeMonthlyProfessionalTax('WEST_BENGAL', 8000, 1).ptDeduction).toBe(0);
      expect(computeMonthlyProfessionalTax('WEST_BENGAL', 12000, 1).ptDeduction).toBe(110);
      expect(computeMonthlyProfessionalTax('WEST_BENGAL', 18000, 1).ptDeduction).toBe(130);
      expect(computeMonthlyProfessionalTax('WEST_BENGAL', 25000, 1).ptDeduction).toBe(150);
      expect(computeMonthlyProfessionalTax('WEST_BENGAL', 45000, 1).ptDeduction).toBe(200);
    });

    it('returns ₹0 for states without PT mandate (e.g. Delhi)', () => {
      const result = computeMonthlyProfessionalTax('DELHI', 100000, 1);
      expect(result.ptDeduction).toBe(0);
      expect(result.isExempt).toBe(true);
    });
  });

  describe('calculateAnnualProfessionalTaxSchedule', () => {
    it('aggregates annual total with ₹2,500 cap for Maharashtra male employee', () => {
      const schedule = calculateAnnualProfessionalTaxSchedule('MAHARASHTRA', 50000, 'M');
      // 11 months * 200 + 1 month * 300 = 2500
      expect(schedule.annualTotalPt).toBe(2500);
      expect(schedule.monthlyBreakdown.length).toBe(12);
    });
  });

  describe('generateFormIIIAggregate', () => {
    it('aggregates Form III return line items', () => {
      const staff = [
        { grossSalary: 50000, gender: 'M' },
        { grossSalary: 20000, gender: 'F' }, // exempt in MH
      ];

      const report = generateFormIIIAggregate(staff, 'MAHARASHTRA');

      expect(report.totalEmployees).toBe(2);
      expect(report.totalPtDeducted).toBe(2500); // 2500 + 0
      expect(report.lineItems[1].annualPtDeducted).toBe(0);
    });
  });
});
