/**
 * @fileoverview Department Budget Utility Functions Unit Tests
 */

const {
  PERIOD_META,
  VALID_STATUS_TRANSITIONS,
  ALERT_THRESHOLDS,
  calculateVariance,
  calculateYoYChange,
  validateStatusTransition,
  determineAlerts,
  projectEndOfPeriod,
  getFiscalYear,
  getCurrentFiscalPeriod,
  formatBudgetSummary,
  aggregateLineItems,
  generateVarianceReport,
} = require('../deptBudget.utils');

describe('Department Budget Utilities', () => {
  // ─── calculateVariance ─────────────────────────────────────────────

  describe('calculateVariance', () => {
    it('should calculate positive variance (under budget)', () => {
      const result = calculateVariance(100000, 75000);
      expect(result.variance).toBe(25000);
      expect(result.variancePercent).toBe(25);
      expect(result.utilizationRate).toBe(75);
      expect(result.status).toBe('Warning');
    });

    it('should calculate negative variance (over budget)', () => {
      const result = calculateVariance(100000, 120000);
      expect(result.variance).toBe(-20000);
      expect(result.variancePercent).toBe(-20);
      expect(result.utilizationRate).toBe(120);
      expect(result.status).toBe('Exceeded');
    });

    it('should handle zero budget', () => {
      const result = calculateVariance(0, 5000);
      expect(result.variance).toBe(-5000);
      expect(result.status).toBe('OverBudget');
    });

    it('should handle zero budget and zero actual', () => {
      const result = calculateVariance(0, 0);
      expect(result.variance).toBe(0);
      expect(result.status).toBe('OnTrack');
    });

    it('should return OnTrack for low utilization', () => {
      const result = calculateVariance(100000, 50000);
      expect(result.status).toBe('OnTrack');
      expect(result.utilizationRate).toBe(50);
    });

    it('should return Critical for high utilization', () => {
      const result = calculateVariance(100000, 95000);
      expect(result.status).toBe('Critical');
      expect(result.utilizationRate).toBe(95);
    });
  });

  // ─── calculateYoYChange ────────────────────────────────────────────

  describe('calculateYoYChange', () => {
    it('should calculate positive YoY change', () => {
      const result = calculateYoYChange(120000, 100000);
      expect(result).toBe(20);
    });

    it('should calculate negative YoY change', () => {
      const result = calculateYoYChange(80000, 100000);
      expect(result).toBe(-20);
    });

    it('should return 100 when previous is zero and current is positive', () => {
      const result = calculateYoYChange(50000, 0);
      expect(result).toBe(100);
    });

    it('should return 0 when both are zero', () => {
      const result = calculateYoYChange(0, 0);
      expect(result).toBe(0);
    });
  });

  // ─── validateStatusTransition ──────────────────────────────────────

  describe('validateStatusTransition', () => {
    it('should allow Draft → Submitted', () => {
      const result = validateStatusTransition('Draft', 'Submitted');
      expect(result.allowed).toBe(true);
    });

    it('should allow Submitted → UnderReview', () => {
      const result = validateStatusTransition('Submitted', 'UnderReview');
      expect(result.allowed).toBe(true);
    });

    it('should allow UnderReview → Approved', () => {
      const result = validateStatusTransition('UnderReview', 'Approved');
      expect(result.allowed).toBe(true);
    });

    it('should allow UnderReview → Rejected', () => {
      const result = validateStatusTransition('UnderReview', 'Rejected');
      expect(result.allowed).toBe(true);
    });

    it('should allow Approved → Closed', () => {
      const result = validateStatusTransition('Approved', 'Closed');
      expect(result.allowed).toBe(true);
    });

    it('should reject Draft → Approved (skip approval)', () => {
      const result = validateStatusTransition('Draft', 'Approved');
      expect(result.allowed).toBe(false);
    });

    it('should reject Closed → anything', () => {
      const result = validateStatusTransition('Closed', 'Draft');
      expect(result.allowed).toBe(false);
    });

    it('should handle unknown status', () => {
      const result = validateStatusTransition('Unknown', 'Draft');
      expect(result.allowed).toBe(false);
    });
  });

  // ─── determineAlerts ───────────────────────────────────────────────

  describe('determineAlerts', () => {
    it('should return no alerts below warning threshold', () => {
      const alerts = determineAlerts(50);
      expect(alerts).toHaveLength(0);
    });

    it('should return Warning at 75%', () => {
      const alerts = determineAlerts(75);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('Warning');
    });

    it('should return Critical at 90%', () => {
      const alerts = determineAlerts(90);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('Critical');
    });

    it('should return Exceeded at 100%', () => {
      const alerts = determineAlerts(100);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('Exceeded');
    });

    it('should return Exceeded above 100%', () => {
      const alerts = determineAlerts(110);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('Exceeded');
    });

    it('should use custom thresholds', () => {
      const alerts = determineAlerts(70, 60, 80);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('Warning');
    });
  });

  // ─── projectEndOfPeriod ────────────────────────────────────────────

  describe('projectEndOfPeriod', () => {
    it('should project based on current run rate', () => {
      const periodStart = new Date(2026, 0, 1);
      const periodEnd = new Date(2026, 11, 31);
      const currentDate = new Date(2026, 5, 30); // June 30 = ~6 months

      const result = projectEndOfPeriod(600000, periodStart, periodEnd, currentDate);

      expect(result.monthlyRunRate).toBe(100000);
      expect(result.projectedTotal).toBe(1200000);
      expect(result.monthsRemaining).toBeGreaterThan(0);
    });

    it('should handle start of period', () => {
      const periodStart = new Date(2026, 0, 1);
      const periodEnd = new Date(2026, 11, 31);
      const currentDate = new Date(2026, 0, 5);

      const result = projectEndOfPeriod(0, periodStart, periodEnd, currentDate);

      expect(result.projectedTotal).toBe(0);
      expect(result.monthlyRunRate).toBe(0);
    });
  });

  // ─── getFiscalYear ─────────────────────────────────────────────────

  describe('getFiscalYear', () => {
    it('should return current year for April (Indian FY start)', () => {
      const date = new Date(2026, 3, 1); // April 1
      expect(getFiscalYear(date)).toBe(2026);
    });

    it('should return previous year for March (end of FY)', () => {
      const date = new Date(2027, 2, 31); // March 31
      expect(getFiscalYear(date)).toBe(2026);
    });

    it('should return current year for December', () => {
      const date = new Date(2026, 11, 31);
      expect(getFiscalYear(date)).toBe(2026);
    });

    it('should return previous year for January', () => {
      const date = new Date(2027, 0, 15);
      expect(getFiscalYear(date)).toBe(2026);
    });
  });

  // ─── getCurrentFiscalPeriod ────────────────────────────────────────

  describe('getCurrentFiscalPeriod', () => {
    it('should return correct Q1 for May', () => {
      const date = new Date(2026, 4, 15); // May 15
      const period = getCurrentFiscalPeriod(date);
      expect(period.quarter).toBe('Q1');
      expect(period.fiscalYear).toBe(2026);
      expect(period.monthName).toBe('May');
    });

    it('should return correct Q4 for February', () => {
      const date = new Date(2027, 1, 15); // Feb 15
      const period = getCurrentFiscalPeriod(date);
      expect(period.quarter).toBe('Q4');
      expect(period.fiscalYear).toBe(2026);
    });
  });

  // ─── aggregateLineItems ────────────────────────────────────────────

  describe('aggregateLineItems', () => {
    it('should aggregate line items correctly', () => {
      const items = [
        {
          categoryId: { toString: () => 'cat1' },
          budgetedAmount: 50000,
          actualAmount: 40000,
          committedAmount: 5000,
        },
        {
          categoryId: { toString: () => 'cat1' },
          budgetedAmount: 30000,
          actualAmount: 35000,
          committedAmount: 0,
        },
        {
          categoryId: { toString: () => 'cat2' },
          budgetedAmount: 20000,
          actualAmount: 10000,
          committedAmount: 2000,
        },
      ];

      const result = aggregateLineItems(items);

      expect(result.totalBudgeted).toBe(100000);
      expect(result.totalActual).toBe(85000);
      expect(result.totalCommitted).toBe(7000);
      expect(result.byCategory.cat1.budgeted).toBe(80000);
      expect(result.byCategory.cat2.budgeted).toBe(20000);
    });

    it('should handle empty array', () => {
      const result = aggregateLineItems([]);
      expect(result.totalBudgeted).toBe(0);
      expect(result.totalActual).toBe(0);
    });
  });

  // ─── generateVarianceReport ────────────────────────────────────────

  describe('generateVarianceReport', () => {
    it('should generate variance report', () => {
      const budgets = [
        {
          department: 'Engineering',
          fiscalYear: 2026,
          period: 'Annual',
          totalBudgeted: 500000,
          totalActual: 400000,
          utilizationRate: 80,
          status: 'Approved',
        },
        {
          department: 'Sales',
          fiscalYear: 2026,
          period: 'Annual',
          totalBudgeted: 300000,
          totalActual: 320000,
          utilizationRate: 106.67,
          status: 'Approved',
        },
      ];

      const report = generateVarianceReport(budgets);

      expect(report.totalBudgeted).toBe(800000);
      expect(report.totalActual).toBe(720000);
      expect(report.totalVariance).toBe(80000);
      expect(report.departments).toHaveLength(2);
      // Sorted by worst utilization first
      expect(report.departments[0].department).toBe('Sales');
      expect(report.departments[1].department).toBe('Engineering');
    });
  });

  // ─── formatBudgetSummary ───────────────────────────────────────────

  describe('formatBudgetSummary', () => {
    it('should format budget summary', () => {
      const budget = {
        _id: 'b1',
        fiscalYear: 2026,
        period: 'Annual',
        totalBudgeted: 100000,
        totalActual: 80000,
        totalCommitted: 5000,
        variance: 20000,
        variancePercent: 20,
        utilizationRate: 80,
        status: 'Approved',
        warningThreshold: 75,
        criticalThreshold: 90,
      };

      const summary = formatBudgetSummary(budget, 'Engineering');
      expect(summary.department).toBe('Engineering');
      expect(summary.fiscalYear).toBe(2026);
      expect(summary.alertLevel).toBe('Warning');
    });

    it('should detect Critical alert level', () => {
      const budget = {
        _id: 'b1',
        fiscalYear: 2026,
        period: 'Annual',
        totalBudgeted: 100000,
        totalActual: 95000,
        totalCommitted: 0,
        variance: 5000,
        variancePercent: 5,
        utilizationRate: 95,
        status: 'Approved',
        warningThreshold: 75,
        criticalThreshold: 90,
      };

      const summary = formatBudgetSummary(budget, 'Sales');
      expect(summary.alertLevel).toBe('Critical');
    });
  });

  // ─── Constants ─────────────────────────────────────────────────────

  describe('PERIOD_META', () => {
    it('should have all periods', () => {
      expect(PERIOD_META.Annual).toBeDefined();
      expect(PERIOD_META.Q1).toBeDefined();
      expect(PERIOD_META.Q2).toBeDefined();
      expect(PERIOD_META.Q3).toBeDefined();
      expect(PERIOD_META.Q4).toBeDefined();
    });

    it('should have correct month ranges', () => {
      expect(PERIOD_META.Q1.months).toEqual([4, 5, 6]);
      expect(PERIOD_META.Annual.months).toHaveLength(12);
    });
  });

  describe('VALID_STATUS_TRANSITIONS', () => {
    it('should have entries for all statuses', () => {
      const statuses = ['Draft', 'Submitted', 'UnderReview', 'Approved', 'Rejected', 'Revised', 'Closed'];
      for (const s of statuses) {
        expect(VALID_STATUS_TRANSITIONS[s]).toBeDefined();
      }
    });

    it('should have empty transitions for Closed', () => {
      expect(VALID_STATUS_TRANSITIONS.Closed).toHaveLength(0);
    });
  });
});
