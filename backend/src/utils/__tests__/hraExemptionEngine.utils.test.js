const {
  computeHraExemption,
  validateLandlordPanCompliance,
  calculateAnnualHraTaxSchedule,
  METRO_CITIES,
  ANNUAL_RENT_PAN_THRESHOLD,
} = require('../hraExemptionEngine.utils');

describe('hraExemptionEngine.utils - HRA Section 10(13A) Exemption Engine', () => {
  describe('computeHraExemption', () => {
    it('computes minimum of 3 clauses for Metro city (50% rule)', () => {
      // Basic = 50,000, DA = 0 -> Salary = 50,000
      // Actual HRA = 20,000
      // Rent Paid = 18,000
      // Clause 1: 20,000
      // Clause 2: 18,000 - (10% of 50,000 = 5,000) = 13,000
      // Clause 3 (Metro 50%): 50% of 50,000 = 25,000
      // Min = 13,000. Taxable HRA = 20,000 - 13,000 = 7,000
      const result = computeHraExemption(50000, 0, 20000, 18000, 'MUMBAI', 'ABCDE1234F');

      expect(result.isMetroCity).toBe(true);
      expect(result.metroRateApplied).toBe(50);
      expect(result.clause1ActualHra).toBe(20000);
      expect(result.clause2RentMinus10Percent).toBe(13000);
      expect(result.clause3CityPercentSalary).toBe(25000);
      expect(result.exemptHra).toBe(13000);
      expect(result.taxableHra).toBe(7000);
    });

    it('computes Non-Metro city with 40% rule', () => {
      // Basic = 50,000, DA = 0 -> Salary = 50,000
      // Actual HRA = 20,000
      // Rent Paid = 30,000
      // Clause 1: 20,000
      // Clause 2: 30,000 - 5,000 = 25,000
      // Clause 3 (Non-Metro 40%): 40% of 50,000 = 20,000
      // Min = 20,000. Taxable HRA = 0
      const result = computeHraExemption(50000, 0, 20000, 30000, 'PUNE', 'ABCDE1234F');

      expect(result.isMetroCity).toBe(false);
      expect(result.metroRateApplied).toBe(40);
      expect(result.clause3CityPercentSalary).toBe(20000);
      expect(result.exemptHra).toBe(20000);
      expect(result.taxableHra).toBe(0);
    });

    it('returns 0 exemption if rent paid is less than 10% of salary', () => {
      // Basic = 50,000 (10% = 5,000). Rent Paid = 4,000
      // Clause 2 = 4,000 - 5,000 = 0
      const result = computeHraExemption(50000, 0, 20000, 4000, 'MUMBAI', 'ABCDE1234F');

      expect(result.clause2RentMinus10Percent).toBe(0);
      expect(result.exemptHra).toBe(0);
      expect(result.taxableHra).toBe(20000);
    });

    it('denies exemption if annual rent > ₹1 Lakh and landlord PAN is missing/invalid', () => {
      // Monthly rent = 15,000 (Annual = 180,000 > 100,000)
      const result = computeHraExemption(50000, 0, 20000, 15000, 'MUMBAI', null);

      expect(result.panCompliance.isCompliant).toBe(false);
      expect(result.exemptHra).toBe(0);
      expect(result.taxableHra).toBe(20000);
    });
  });

  describe('validateLandlordPanCompliance', () => {
    it('validates PAN threshold logic', () => {
      expect(validateLandlordPanCompliance(80000, '').isCompliant).toBe(true);
      expect(validateLandlordPanCompliance(120000, '').isCompliant).toBe(false);
      expect(validateLandlordPanCompliance(120000, 'ABCDE1234F').isCompliant).toBe(true);
      expect(validateLandlordPanCompliance(120000, 'INVALIDPAN').isCompliant).toBe(false);
    });
  });

  describe('calculateAnnualHraTaxSchedule', () => {
    it('aggregates annual schedule across monthly periods', () => {
      const periods = [
        { month: 'Apr', basicPay: 50000, dearnessAllowance: 0, actualHraReceived: 20000, rentPaid: 15000, isMetro: 'DELHI', landlordPan: 'ABCDE1234F' },
        { month: 'May', basicPay: 50000, dearnessAllowance: 0, actualHraReceived: 20000, rentPaid: 15000, isMetro: 'DELHI', landlordPan: 'ABCDE1234F' },
      ];

      const schedule = calculateAnnualHraTaxSchedule(periods);

      expect(schedule.periodCount).toBe(2);
      expect(schedule.annualActualHra).toBe(40000);
      expect(schedule.annualRentPaid).toBe(30000);
      // Monthly exempt = min(20000, 15000 - 5000 = 10000, 25000) = 10000 -> Annual = 20000
      expect(schedule.annualExemptHra).toBe(20000);
      expect(schedule.annualTaxableHra).toBe(20000);
    });
  });
});
