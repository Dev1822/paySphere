/**
 * @fileoverview Salary Revision Simulator Utility Functions Unit Tests
 */

const {
  SCENARIO_TYPES,
  STATUTORY_RATES,
  VALID_SCENARIO_TRANSITIONS,
  calculateRevision,
  calculateStatutoryImpact,
  computeHikeStatistics,
  groupByDepartment,
  groupByLevel,
  validateScenarioTransition,
  compareScenarios,
  computeCompaRatio,
} = require('../salaryRevision.utils');

describe('Salary Revision Utilities', () => {
  // ─── calculateRevision ─────────────────────────────────────────────

  describe('calculateRevision', () => {
    it('should calculate 10% hike correctly', () => {
      const result = calculateRevision(50000, 10);
      expect(result.revisedSalary).toBe(55000);
      expect(result.hikeAmount).toBe(5000);
      expect(result.cappedHikePercent).toBe(10);
    });

    it('should apply hike cap', () => {
      const result = calculateRevision(50000, 30, 20);
      expect(result.cappedHikePercent).toBe(20);
      expect(result.hikeAmount).toBe(10000);
      expect(result.revisedSalary).toBe(60000);
    });

    it('should handle 0% hike', () => {
      const result = calculateRevision(50000, 0);
      expect(result.revisedSalary).toBe(50000);
      expect(result.hikeAmount).toBe(0);
    });

    it('should handle fractional percentages', () => {
      const result = calculateRevision(60000, 7.5);
      expect(result.hikeAmount).toBe(4500);
      expect(result.revisedSalary).toBe(64500);
    });

    it('should round correctly', () => {
      const result = calculateRevision(33333, 12);
      expect(result.hikeAmount).toBe(4000);
      expect(result.revisedSalary).toBe(37333);
    });
  });

  // ─── calculateStatutoryImpact ──────────────────────────────────────

  describe('calculateStatutoryImpact', () => {
    it('should calculate PF impact', () => {
      const result = calculateStatutoryImpact(25000, 27500, 50000, 55000);
      expect(result.pfImpact).toBe(300); // (27500-25000)*0.12
      expect(result.pfImpact).toBeGreaterThan(0);
    });

    it('should calculate gratuity impact', () => {
      const result = calculateStatutoryImpact(25000, 27500, 50000, 55000);
      expect(result.gratuityImpact).toBeGreaterThan(0);
    });

    it('should return total as sum of components', () => {
      const result = calculateStatutoryImpact(25000, 27500, 50000, 55000);
      expect(result.total).toBe(
        Math.round((result.pfImpact + result.esiImpact + result.gratuityImpact) * 100) / 100,
      );
    });

    it('should handle ESI when below ceiling', () => {
      const result = calculateStatutoryImpact(10000, 11000, 20000, 22000);
      expect(result.esiImpact).toBeGreaterThan(0);
    });

    it('should handle zero impact when no change', () => {
      const result = calculateStatutoryImpact(25000, 25000, 50000, 50000);
      expect(result.pfImpact).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  // ─── computeHikeStatistics ─────────────────────────────────────────

  describe('computeHikeStatistics', () => {
    it('should compute correct statistics', () => {
      const hikes = [5, 10, 15, 8, 12];
      const stats = computeHikeStatistics(hikes);
      expect(stats.mean).toBe(10);
      expect(stats.median).toBe(10);
      expect(stats.min).toBe(5);
      expect(stats.max).toBe(15);
      expect(stats.count).toBe(5);
    });

    it('should handle single value', () => {
      const stats = computeHikeStatistics([10]);
      expect(stats.mean).toBe(10);
      expect(stats.median).toBe(10);
      expect(stats.count).toBe(1);
    });

    it('should handle even count median', () => {
      const stats = computeHikeStatistics([5, 10, 15, 20]);
      expect(stats.median).toBe(12.5);
    });

    it('should handle empty array', () => {
      const stats = computeHikeStatistics([]);
      expect(stats.mean).toBe(0);
      expect(stats.count).toBe(0);
    });

    it('should compute standard deviation', () => {
      const stats = computeHikeStatistics([10, 10, 10, 10]);
      expect(stats.stddev).toBe(0);
    });
  });

  // ─── groupByDepartment ─────────────────────────────────────────────

  describe('groupByDepartment', () => {
    it('should group employees by department', () => {
      const items = [
        { department: 'Engineering', hikePercent: 10, hikeAmount: 5000, currentMonthlySalary: 50000 },
        { department: 'Engineering', hikePercent: 12, hikeAmount: 6000, currentMonthlySalary: 50000 },
        { department: 'Sales', hikePercent: 8, hikeAmount: 3200, currentMonthlySalary: 40000 },
      ];

      const result = groupByDepartment(items);
      expect(result).toHaveLength(2);

      const eng = result.find((r) => r.department === 'Engineering');
      expect(eng.count).toBe(2);
      expect(eng.avgHike).toBe(11);
      expect(eng.totalIncrement).toBe(11000);

      const sales = result.find((r) => r.department === 'Sales');
      expect(sales.count).toBe(1);
    });

    it('should handle empty array', () => {
      const result = groupByDepartment([]);
      expect(result).toHaveLength(0);
    });

    it('should handle missing department', () => {
      const items = [
        { department: '', hikePercent: 10, hikeAmount: 5000, currentMonthlySalary: 50000 },
      ];
      const result = groupByDepartment(items);
      expect(result[0].department).toBe('Unknown');
    });
  });

  // ─── groupByLevel ──────────────────────────────────────────────────

  describe('groupByLevel', () => {
    it('should group employees by level', () => {
      const items = [
        { level: 'Senior', hikePercent: 15, hikeAmount: 9000 },
        { level: 'Senior', hikePercent: 10, hikeAmount: 6000 },
        { level: 'Junior', hikePercent: 8, hikeAmount: 3200 },
      ];

      const result = groupByLevel(items);
      expect(result).toHaveLength(2);

      const senior = result.find((r) => r.level === 'Senior');
      expect(senior.count).toBe(2);
      expect(senior.avgHike).toBe(12.5);
    });

    it('should handle ungraded employees', () => {
      const items = [{ level: '', hikePercent: 10, hikeAmount: 5000 }];
      const result = groupByLevel(items);
      expect(result[0].level).toBe('Ungraded');
    });
  });

  // ─── validateScenarioTransition ────────────────────────────────────

  describe('validateScenarioTransition', () => {
    it('should allow Draft → Simulated', () => {
      const result = validateScenarioTransition('Draft', 'Simulated');
      expect(result.allowed).toBe(true);
    });

    it('should allow Simulated → Submitted', () => {
      const result = validateScenarioTransition('Simulated', 'Submitted');
      expect(result.allowed).toBe(true);
    });

    it('should allow Submitted → Approved', () => {
      const result = validateScenarioTransition('Submitted', 'Approved');
      expect(result.allowed).toBe(true);
    });

    it('should allow Approved → Applied', () => {
      const result = validateScenarioTransition('Approved', 'Applied');
      expect(result.allowed).toBe(true);
    });

    it('should reject Draft → Approved (skip approval)', () => {
      const result = validateScenarioTransition('Draft', 'Approved');
      expect(result.allowed).toBe(false);
    });

    it('should reject Applied → anything', () => {
      const result = validateScenarioTransition('Applied', 'Draft');
      expect(result.allowed).toBe(false);
    });

    it('should handle unknown status', () => {
      const result = validateScenarioTransition('Unknown', 'Draft');
      expect(result.allowed).toBe(false);
    });
  });

  // ─── compareScenarios ──────────────────────────────────────────────

  describe('compareScenarios', () => {
    it('should compare scenarios', () => {
      const scenarios = [
        { _id: 's1', name: 'Conservative', scenarioType: 'UniformPercent', status: 'Simulated', totalEmployees: 100, averageHikePercent: 8, totalIncrementCost: 400000, annualizedImpact: 4800000, budgetImpactPercent: 8 },
        { _id: 's2', name: 'Aggressive', scenarioType: 'PerformanceBased', status: 'Simulated', totalEmployees: 100, averageHikePercent: 15, totalIncrementCost: 750000, annualizedImpact: 9000000, budgetImpactPercent: 15 },
      ];

      const result = compareScenarios(scenarios);
      expect(result.count).toBe(2);
      expect(result.bestByCost).toBe('Conservative');
      expect(result.bestByAverageHike).toBe('Aggressive');
    });

    it('should handle empty scenarios', () => {
      const result = compareScenarios([]);
      expect(result.count).toBe(0);
      expect(result.bestByCost).toBeNull();
    });
  });

  // ─── computeCompaRatio ─────────────────────────────────────────────

  describe('computeCompaRatio', () => {
    it('should compute compa-ratio at midpoint', () => {
      const ratio = computeCompaRatio(75000, 50000, 100000);
      expect(ratio).toBe(100);
    });

    it('should compute compa-ratio above midpoint', () => {
      const ratio = computeCompaRatio(90000, 50000, 100000);
      expect(ratio).toBe(120);
    });

    it('should compute compa-ratio below midpoint', () => {
      const ratio = computeCompaRatio(60000, 50000, 100000);
      expect(ratio).toBe(80);
    });

    it('should handle zero band', () => {
      const ratio = computeCompaRatio(50000, 0, 0);
      expect(ratio).toBe(100);
    });
  });

  // ─── Constants ─────────────────────────────────────────────────────

  describe('SCENARIO_TYPES', () => {
    it('should have all scenario types', () => {
      expect(SCENARIO_TYPES.UniformPercent).toBeDefined();
      expect(SCENARIO_TYPES.DepartmentWise).toBeDefined();
      expect(SCENARIO_TYPES.PerformanceBased).toBeDefined();
      expect(SCENARIO_TYPES.MarketAdjustment).toBeDefined();
      expect(SCENARIO_TYPES.Custom).toBeDefined();
    });
  });

  describe('STATUTORY_RATES', () => {
    it('should have correct PF rates', () => {
      expect(STATUTORY_RATES.employerPF).toBe(0.12);
      expect(STATUTORY_RATES.employeePF).toBe(0.12);
    });

    it('should have correct ESI rates', () => {
      expect(STATUTORY_RATES.employerESI).toBe(0.0325);
      expect(STATUTORY_RATES.employeeESI).toBe(0.0075);
    });
  });
});
