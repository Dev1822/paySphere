/**
 * =============================================================================
 * Unit Tests — Enterprise Compensation Benchmarking & Pay Equity Intelligence
 * PaySphere Global HR & Payroll Platform
 * Engine Version: 3.2.0 | Test Framework: Jest
 *
 * Coverage Target: 100% statement and branch coverage across all engine methods.
 * Test Strategy: Property-based assertions with deterministic fixtures.
 * Compliance: SOC 2 Type II audit requires automated test evidence artifacts.
 * =============================================================================
 */

const CompensationBenchmarkingEngine = require('../src/services/compensationBenchmarkingEngine');

describe('CompensationBenchmarkingEngine Unit Tests', () => {
  // ---------------------------------------------------------------------------
  // Section 1: Percentile Calculation Tests
  // ---------------------------------------------------------------------------
  describe('calculatePercentile()', () => {
    test('should return the correct P50 (median) for an odd-length array', () => {
      const salaries = [60000, 70000, 80000, 90000, 100000];
      expect(CompensationBenchmarkingEngine.calculatePercentile(salaries, 50)).toBe(80000);
    });

    test('should return the correct P50 for an even-length array using interpolation', () => {
      const salaries = [60000, 70000, 80000, 90000];
      const p50 = CompensationBenchmarkingEngine.calculatePercentile(salaries, 50);
      expect(p50).toBe(75000);
    });

    test('should return the minimum value at P0', () => {
      const salaries = [50000, 60000, 70000, 80000];
      expect(CompensationBenchmarkingEngine.calculatePercentile(salaries, 0)).toBe(50000);
    });

    test('should return the maximum value at P100', () => {
      const salaries = [50000, 60000, 70000, 80000];
      expect(CompensationBenchmarkingEngine.calculatePercentile(salaries, 100)).toBe(80000);
    });

    test('should throw an error for an empty array', () => {
      expect(() => CompensationBenchmarkingEngine.calculatePercentile([], 50)).toThrow(
        'non-empty array'
      );
    });

    test('should throw an error for percentile out of range', () => {
      const salaries = [60000, 70000, 80000];
      expect(() => CompensationBenchmarkingEngine.calculatePercentile(salaries, 150)).toThrow(
        'between 0 and 100'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Section 2: Distribution Summary Tests
  // ---------------------------------------------------------------------------
  describe('computeDistributionSummary()', () => {
    const sampleSalaries = [55000, 65000, 75000, 85000, 95000, 105000, 115000];

    test('should return a frozen (immutable) object', () => {
      const summary = CompensationBenchmarkingEngine.computeDistributionSummary(sampleSalaries);
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test('should compute correct count and min/max', () => {
      const summary = CompensationBenchmarkingEngine.computeDistributionSummary(sampleSalaries);
      expect(summary.count).toBe(7);
      expect(summary.min).toBe(55000);
      expect(summary.max).toBe(115000);
    });

    test('should compute correct mean salary', () => {
      const summary = CompensationBenchmarkingEngine.computeDistributionSummary(sampleSalaries);
      const expectedMean = Math.round(sampleSalaries.reduce((s, v) => s + v, 0) / 7);
      expect(summary.mean).toBe(expectedMean);
    });

    test('should include computedAt timestamp', () => {
      const summary = CompensationBenchmarkingEngine.computeDistributionSummary(sampleSalaries);
      expect(summary.computedAt).toBeDefined();
      expect(new Date(summary.computedAt).toISOString()).toBe(summary.computedAt);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 3: Compa-Ratio Calculation Tests
  // ---------------------------------------------------------------------------
  describe('calculateCompRatio()', () => {
    test('should classify AT_MIDPOINT when compa-ratio is between 95-105%', () => {
      const result = CompensationBenchmarkingEngine.calculateCompRatio(100000, 100000);
      expect(result.compRatio).toBe(100);
      expect(result.classification).toBe('AT_MIDPOINT');
    });

    test('should classify BELOW_BAND when compa-ratio is below 80%', () => {
      const result = CompensationBenchmarkingEngine.calculateCompRatio(72000, 100000);
      expect(result.compRatio).toBe(72);
      expect(result.classification).toBe('BELOW_BAND');
    });

    test('should classify ABOVE_BAND when compa-ratio is above 120%', () => {
      const result = CompensationBenchmarkingEngine.calculateCompRatio(125000, 100000);
      expect(result.compRatio).toBe(125);
      expect(result.classification).toBe('ABOVE_BAND');
    });

    test('should throw an error for zero salary', () => {
      expect(() => CompensationBenchmarkingEngine.calculateCompRatio(0, 100000)).toThrow(
        'positive number'
      );
    });

    test('should throw an error for zero midpoint', () => {
      expect(() => CompensationBenchmarkingEngine.calculateCompRatio(100000, 0)).toThrow(
        'positive number'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Section 4: Pay Equity Gap Analysis Tests
  // ---------------------------------------------------------------------------
  describe('analyzePayEquityGap()', () => {
    const referenceGroup = { name: 'Male', medianSalary: 100000 };

    test('should classify as COMPLIANT when gap is within tolerance', () => {
      const comparison = [{ name: 'Female', medianSalary: 101500, headcount: 50 }];
      const result = CompensationBenchmarkingEngine.analyzePayEquityGap(referenceGroup, comparison);
      expect(result.segmentAnalyses[0].complianceStatus).toBe('COMPLIANT');
    });

    test('should classify as REVIEW_REQUIRED when gap exceeds tolerance but below threshold', () => {
      const comparison = [{ name: 'Female', medianSalary: 94000, headcount: 50 }];
      const result = CompensationBenchmarkingEngine.analyzePayEquityGap(referenceGroup, comparison);
      expect(result.segmentAnalyses[0].complianceStatus).toBe('REVIEW_REQUIRED');
    });

    test('should classify as ACTION_REQUIRED when gap exceeds review threshold', () => {
      const comparison = [{ name: 'Female', medianSalary: 88000, headcount: 50 }];
      const result = CompensationBenchmarkingEngine.analyzePayEquityGap(referenceGroup, comparison);
      expect(result.segmentAnalyses[0].complianceStatus).toBe('ACTION_REQUIRED');
    });

    test('should count compliant and non-compliant segments correctly', () => {
      const comparisons = [
        { name: 'Group A', medianSalary: 101000, headcount: 20 },
        { name: 'Group B', medianSalary: 88000, headcount: 30 },
      ];
      const result = CompensationBenchmarkingEngine.analyzePayEquityGap(referenceGroup, comparisons);
      expect(result.compliantSegments).toBe(1);
      expect(result.nonCompliantSegments).toBe(1);
    });

    test('should throw an error for missing reference group', () => {
      expect(() =>
        CompensationBenchmarkingEngine.analyzePayEquityGap(null, [{ name: 'A', medianSalary: 50000 }])
      ).toThrow('Reference group');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 5: 12-Month Cost Forecast Tests
  // ---------------------------------------------------------------------------
  describe('forecastCompensationCosts()', () => {
    const baseParams = {
      currentAnnualBasePayroll: 1200000,
      bonusPoolPct: 15,
      equityExpenseMonthly: 50000,
      monthlyBenefitsCost: 20000,
    };

    test('should return exactly 12 monthly projections', () => {
      const result = CompensationBenchmarkingEngine.forecastCompensationCosts(baseParams);
      expect(result.projections.length).toBe(12);
    });

    test('should compute correct projected annual total', () => {
      const result = CompensationBenchmarkingEngine.forecastCompensationCosts(baseParams);
      const totalFromProjections = result.projections.reduce(
        (sum, p) => sum + p.totalMonthlyCost, 0
      );
      expect(result.summary.projectedAnnualTotal).toBe(totalFromProjections);
    });

    test('should project increasing costs with positive headcount growth', () => {
      const growingParams = { ...baseParams, headcountGrowthPct: 2 };
      const result = CompensationBenchmarkingEngine.forecastCompensationCosts(growingParams);
      expect(result.projections[11].totalMonthlyCost).toBeGreaterThan(
        result.projections[0].totalMonthlyCost
      );
    });

    test('should throw an error for invalid base payroll', () => {
      expect(() =>
        CompensationBenchmarkingEngine.forecastCompensationCosts({
          ...baseParams,
          currentAnnualBasePayroll: -1,
        })
      ).toThrow('positive number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 6: Anomaly Detection Tests
  // ---------------------------------------------------------------------------
  describe('detectCompensationAnomalies()', () => {
    const employees = [
      { id: 1, name: 'Alice', salary: 90000, department: 'Eng', level: 'IC3' },
      { id: 2, name: 'Bob', salary: 92000, department: 'Eng', level: 'IC3' },
      { id: 3, name: 'Carol', salary: 88000, department: 'Eng', level: 'IC3' },
      { id: 4, name: 'Dave', salary: 250000, department: 'Eng', level: 'IC3' },
    ];

    test('should detect a salary anomaly with Z-score above threshold', () => {
      const result = CompensationBenchmarkingEngine.detectCompensationAnomalies(employees);
      expect(result.anomalies.length).toBeGreaterThanOrEqual(1);
      const daveAnomaly = result.anomalies.find(a => a.employeeName === 'Dave');
      expect(daveAnomaly).toBeDefined();
      expect(daveAnomaly.direction).toBe('ABOVE');
    });

    test('should return frozen anomaly result object', () => {
      const result = CompensationBenchmarkingEngine.detectCompensationAnomalies(employees);
      expect(Object.isFrozen(result)).toBe(true);
    });

    test('should throw an error with fewer than 3 employees', () => {
      const smallSet = [{ id: 1, name: 'A', salary: 50000, department: 'X', level: 'L1' }];
      expect(() =>
        CompensationBenchmarkingEngine.detectCompensationAnomalies(smallSet)
      ).toThrow('at least 3 employees');
    });

    test('should return empty anomalies when all salaries are identical (zero stdDev)', () => {
      const uniform = [
        { id: 1, name: 'A', salary: 80000, department: 'X', level: 'L1' },
        { id: 2, name: 'B', salary: 80000, department: 'X', level: 'L1' },
        { id: 3, name: 'C', salary: 80000, department: 'X', level: 'L1' },
      ];
      const result = CompensationBenchmarkingEngine.detectCompensationAnomalies(uniform);
      expect(result.anomalies.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 7: Currency Normalization Tests
  // ---------------------------------------------------------------------------
  describe('normalizeCurrency()', () => {
    test('should normalize EUR to USD correctly', () => {
      const result = CompensationBenchmarkingEngine.normalizeCurrency(100, 'EUR', 'USD');
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('USD');
      expect(result.normalizedAmount).toBeGreaterThan(0);
    });

    test('should return 1:1 ratio for same-currency conversion', () => {
      const result = CompensationBenchmarkingEngine.normalizeCurrency(50000, 'USD', 'USD');
      expect(result.normalizedAmount).toBe(50000);
      expect(result.exchangeRate).toBe(1);
    });

    test('should throw an error for unsupported currency', () => {
      expect(() =>
        CompensationBenchmarkingEngine.normalizeCurrency(100, 'XYZ', 'USD')
      ).toThrow('Unsupported currency');
    });

    test('should throw an error for negative amount', () => {
      expect(() =>
        CompensationBenchmarkingEngine.normalizeCurrency(-100, 'USD', 'EUR')
      ).toThrow('non-negative number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 8: Full Report Generation Tests
  // ---------------------------------------------------------------------------
  describe('generateFullReport()', () => {
    test('should generate a report with a unique report ID', () => {
      const dataset = {
        salaries: [80000, 90000, 100000, 110000, 120000],
        levels: ['IC2', 'IC3', 'IC4'],
        departments: ['Engineering', 'Product'],
        benchmarks: [],
      };
      const report = CompensationBenchmarkingEngine.generateFullReport(dataset);
      expect(report.reportId).toMatch(/^RPT-\d+-\d+$/);
      expect(report.engineVersion).toBe('3.2.0');
    });

    test('should include distribution and anomaly summary', () => {
      const dataset = {
        salaries: [70000, 75000, 80000, 85000, 90000, 95000],
        levels: ['IC3'],
        departments: ['Eng'],
        benchmarks: [],
      };
      const report = CompensationBenchmarkingEngine.generateFullReport(dataset);
      expect(report.distribution).toBeDefined();
      expect(report.anomalySummary).toBeDefined();
      expect(typeof report.anomalySummary.totalAnomalies).toBe('number');
    });
  });
});

// =============================================================================
// JEST AUTOMATED UNIT TEST COVERAGE SPECIFICATIONS
// =============================================================================
//
// Coverage Targets:
// - Statement Coverage: 100% (every executable line exercised)
// - Branch Coverage: 100% (every if/else and ternary path exercised)
// - Function Coverage: 100% (every static method called at least once)
//
// Test Fixtures: Deterministic salary arrays with known statistical properties.
// Mocking Strategy: None required — engine is pure-function static class design.
// Assertion Library: Jest built-in expect() with matchers.
// Running: jest tests/services/compensationBenchmarkingEngine.test.js --coverage
// =============================================================================
