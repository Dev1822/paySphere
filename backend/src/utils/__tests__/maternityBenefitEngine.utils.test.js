const {
  evaluateMaternityEligibility,
  computeAverageDailyMaternityWage,
  generateMaternityDisbursementSchedule,
  STATUTORY_MINIMUM_WORKED_DAYS,
  STATUTORY_MEDICAL_BONUS,
  STANDARD_MATERNITY_WEEKS_FIRST_TWO,
  STANDARD_MATERNITY_WEEKS_SUBSEQUENT,
} = require('../maternityBenefitEngine.utils');

describe('maternityBenefitEngine.utils - Statutory Maternity & Paternity Engine', () => {
  describe('evaluateMaternityEligibility', () => {
    it('approves 26 weeks for eligible employee with < 2 surviving children', () => {
      const result = evaluateMaternityEligibility(150, 0, 'MATERNITY');

      expect(result.isEligible).toBe(true);
      expect(result.leaveDurationWeeks).toBe(STANDARD_MATERNITY_WEEKS_FIRST_TWO); // 26 weeks
      expect(result.totalLeaveDays).toBe(182);
      expect(result.statutoryMedicalBonus).toBe(STATUTORY_MEDICAL_BONUS);
      expect(result.rejectionReason).toBeNull();
    });

    it('limits leave to 12 weeks for 3rd or subsequent child', () => {
      const result = evaluateMaternityEligibility(200, 2, 'MATERNITY');

      expect(result.isEligible).toBe(true);
      expect(result.leaveDurationWeeks).toBe(STANDARD_MATERNITY_WEEKS_SUBSEQUENT); // 12 weeks
      expect(result.totalLeaveDays).toBe(84);
    });

    it('rejects claim if employee worked less than statutory 80 days in last 12 months', () => {
      const result = evaluateMaternityEligibility(65, 0, 'MATERNITY');

      expect(result.isEligible).toBe(false);
      expect(result.leaveDurationWeeks).toBe(0);
      expect(result.rejectionReason).toContain('statutory mandate requires >= 80 days');
    });

    it('approves 2 weeks for paternity leave', () => {
      const result = evaluateMaternityEligibility(30, 0, 'PATERNITY');

      expect(result.isEligible).toBe(true);
      expect(result.leaveDurationWeeks).toBe(2);
      expect(result.totalLeaveDays).toBe(14);
    });
  });

  describe('computeAverageDailyMaternityWage', () => {
    it('computes accurate average daily wage rate across 3 calendar months', () => {
      const last3Months = [66000, 66000, 66000]; // Total 198,000
      const workingDays = 66; // 198000 / 66 = 3000

      const result = computeAverageDailyMaternityWage(last3Months, workingDays);

      expect(result.totalEarnings3Months).toBe(198000);
      expect(result.totalDaysWorked).toBe(66);
      expect(result.averageDailyWage).toBe(3000);
    });
  });

  describe('generateMaternityDisbursementSchedule', () => {
    it('generates multi-month schedule including statutory medical bonus', () => {
      const dailyWage = 2000;
      const leaveWeeks = 26; // 182 days -> 364,000 wage + 3500 bonus
      const schedule = generateMaternityDisbursementSchedule(dailyWage, leaveWeeks, '2026-09-01', 3500);

      expect(schedule.totalLeaveDays).toBe(182);
      expect(schedule.totalWageBenefit).toBe(364000);
      expect(schedule.medicalBonus).toBe(3500);
      expect(schedule.totalPayableWithBonus).toBe(367500);
      expect(schedule.schedule.length).toBe(7); // ceil(182/30) = 7 months
      expect(schedule.schedule[0].medicalBonus).toBe(3500); // Disbursed in month 1
      expect(schedule.schedule[1].medicalBonus).toBe(0);
    });
  });
});
