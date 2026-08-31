const {
  calculateMaxStatutoryDeductionCap,
  generateOverpaymentInstallmentSchedule,
  processCycleOverpaymentDeduction,
  STATUTORY_MAX_DEDUCTION_RATIO,
} = require('../overpaymentRecoveryEngine.utils');

describe('overpaymentRecoveryEngine.utils - Statutory Overpayment Recovery Engine', () => {
  describe('calculateMaxStatutoryDeductionCap', () => {
    it('calculates 50% statutory deduction limit for general employees under Section 7', () => {
      const result = calculateMaxStatutoryDeductionCap(60000, false);
      expect(result.statutoryCeilingRatio).toBe(0.50);
      expect(result.maxAllowableDeduction).toBe(30000);
    });

    it('calculates 75% statutory deduction limit for cooperative society payments', () => {
      const result = calculateMaxStatutoryDeductionCap(60000, true);
      expect(result.statutoryCeilingRatio).toBe(0.75);
      expect(result.maxAllowableDeduction).toBe(45000);
    });
  });

  describe('generateOverpaymentInstallmentSchedule', () => {
    it('generates multi-month installment schedule within statutory 50% cap', () => {
      // Overpayment = 60,000, Monthly earnings = 50,000 -> Max 50% cap = 25,000
      // 3 installments -> 20,000 / month <= 25,000 cap
      const result = generateOverpaymentInstallmentSchedule(60000, 50000, 3, false);

      expect(result.totalOverpayment).toBe(60000);
      expect(result.statutoryMonthlyCap).toBe(25000);
      expect(result.numberOfInstallments).toBe(3);
      expect(result.monthlyInstallmentAmount).toBe(20000);
      expect(result.isCappedByStatute).toBe(false);
      expect(result.schedule[2].remainingBalance).toBe(0);
    });

    it('automatically increases installments when requested installment exceeds 50% cap', () => {
      // Overpayment = 60,000, Monthly earnings = 40,000 -> Max cap = 20,000
      // Requested 2 installments -> 30,000 > 20,000 cap -> Forced to minimum 3 installments
      const result = generateOverpaymentInstallmentSchedule(60000, 40000, 2, false);

      expect(result.statutoryMonthlyCap).toBe(20000);
      expect(result.numberOfInstallments).toBe(3);
      expect(result.monthlyInstallmentAmount).toBe(20000);
    });
  });

  describe('processCycleOverpaymentDeduction', () => {
    it('processes deduction within statutory limit and decrements balance', () => {
      const result = processCycleOverpaymentDeduction(40000, 50000, 15000);

      expect(result.actualDeducted).toBe(15000);
      expect(result.newBalance).toBe(25000);
      expect(result.isDeductionCapped).toBe(false);
    });

    it('clips cycle deduction to 50% wage ceiling when requested amount is higher', () => {
      // Balance = 40,000, Monthly earnings = 40,000 (Cap = 20,000), Requested = 30,000
      // Clips actual deduction to 20,000
      const result = processCycleOverpaymentDeduction(40000, 40000, 30000);

      expect(result.actualDeducted).toBe(20000);
      expect(result.newBalance).toBe(20000);
      expect(result.isDeductionCapped).toBe(true);
      expect(result.auditNotes).toContain('capped at statutory 50% limit');
    });
  });
});
