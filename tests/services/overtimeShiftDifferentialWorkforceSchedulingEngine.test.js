/**
 * =============================================================================
 * Unit Tests — Enterprise Overtime, Shift Differential & Workforce Scheduling
 * PaySphere Global HR & Payroll Platform
 * Engine Version: 2.7.0 | Test Framework: Jest
 *
 * Coverage Target: 100% statement and branch coverage across all engine methods.
 * Test Strategy: Deterministic fixtures with edge case and boundary testing.
 * Compliance: DOL Wage & Hour Division audit requires automated test evidence.
 * =============================================================================
 */

const Engine = require('../src/services/overtimeShiftDifferentialWorkforceSchedulingEngine');

describe('OvertimeShiftDifferentialWorkforceSchedulingEngine Unit Tests', () => {
  // ---------------------------------------------------------------------------
  // Section 1: Overtime Rule Calculation
  // ---------------------------------------------------------------------------
  describe('calculateOvertime()', () => {
    test('should calculate weekly OT for federal FLSA (40+ hours)', () => {
      const result = Engine.calculateOvertime({
        state: 'FEDERAL',
        dailyHours: 10,
        weeklyHoursTotal: 45,
        regularHourlyRate: 25,
        dayOfWeek: 3,
      });
      expect(result.weeklyOTHours).toBe(5);
      expect(result.dailyOTHours).toBe(0); // Federal has no daily OT
      expect(result.regularOTPay).toBe(187.5); // 5 * 25 * 1.5
    });

    test('should calculate daily OT for California (8+ hours)', () => {
      const result = Engine.calculateOvertime({
        state: 'CA',
        dailyHours: 10,
        weeklyHoursTotal: 40,
        regularHourlyRate: 30,
        dayOfWeek: 2,
      });
      expect(result.dailyOTHours).toBe(2);
      expect(result.regularOTPay).toBe(90); // 2 * 30 * 1.5
    });

    test('should calculate California double-time (12+ hours)', () => {
      const result = Engine.calculateOvertime({
        state: 'CA',
        dailyHours: 14,
        weeklyHoursTotal: 40,
        regularHourlyRate: 30,
        dayOfWeek: 3,
      });
      expect(result.doubleTimeHours).toBe(2);
      expect(result.dailyOTHours).toBe(4); // 12 - 8 = 4 OT hours
      expect(result.doubleTimePay).toBe(120); // 2 * 30 * 2.0
    });

    test('should calculate California 7th-day rule (8+ hours on day 7)', () => {
      const result = Engine.calculateOvertime({
        state: 'CA',
        dailyHours: 10,
        weeklyHoursTotal: 48,
        regularHourlyRate: 25,
        dayOfWeek: 7,
      });
      expect(result.seventhDayOTHours).toBe(2); // 10 - 8 = 2
    });

    test('should handle California 7th-day double-time (12+ hours on day 7)', () => {
      const result = Engine.calculateOvertime({
        state: 'CA',
        dailyHours: 14,
        weeklyHoursTotal: 52,
        regularHourlyRate: 25,
        dayOfWeek: 7,
      });
      expect(result.seventhDayOTHours).toBe(4); // capped at 4
      expect(result.doubleTimeHours).toBe(2); // 14 - 12 = 2
    });

    test('should handle zero OT hours correctly', () => {
      const result = Engine.calculateOvertime({
        state: 'TX',
        dailyHours: 8,
        weeklyHoursTotal: 32,
        regularHourlyRate: 20,
        dayOfWeek: 5,
      });
      expect(result.totalOTHours).toBe(0);
      expect(result.totalOTPremium).toBe(0);
    });

    test('should throw error for missing state', () => {
      expect(() =>
        Engine.calculateOvertime({
          dailyHours: 10,
          weeklyHoursTotal: 45,
          regularHourlyRate: 25,
          dayOfWeek: 3,
        })
      ).toThrow('required');
    });

    test('should throw error for zero rate', () => {
      expect(() =>
        Engine.calculateOvertime({
          state: 'CA',
          dailyHours: 10,
          weeklyHoursTotal: 40,
          regularHourlyRate: 0,
          dayOfWeek: 2,
        })
      ).toThrow('positive');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 2: Shift Differential Calculation
  // ---------------------------------------------------------------------------
  describe('calculateShiftDifferential()', () => {
    test('should calculate zero differential for day shift', () => {
      const result = Engine.calculateShiftDifferential({
        shiftType: 'DAY',
        hoursWorked: 8,
        baseHourlyRate: 20,
      });
      expect(result.totalDiffPremium).toBe(0);
      expect(result.totalCompensation).toBe(160);
    });

    test('should calculate evening shift differential', () => {
      const result = Engine.calculateShiftDifferential({
        shiftType: 'EVENING',
        hoursWorked: 8,
        baseHourlyRate: 20,
      });
      expect(result.hourlyDiffRate).toBe(2.50);
      expect(result.totalDiffPremium).toBe(20);
    });

    test('should calculate night shift differential', () => {
      const result = Engine.calculateShiftDifferential({
        shiftType: 'NIGHT',
        hoursWorked: 8,
        baseHourlyRate: 20,
      });
      expect(result.hourlyDiffRate).toBe(5.00);
      expect(result.totalDiffPremium).toBe(40);
    });

    test('should apply CA minimum for night shift', () => {
      const result = Engine.calculateShiftDifferential({
        shiftType: 'NIGHT',
        hoursWorked: 8,
        baseHourlyRate: 20,
        state: 'CA',
      });
      expect(result.state).toBe('CA');
      expect(result.hourlyDiffRate).toBeGreaterThanOrEqual(3.00);
    });

    test('should calculate split shift differential', () => {
      const result = Engine.calculateShiftDifferential({
        shiftType: 'SPLIT',
        hoursWorked: 8,
        baseHourlyRate: 20,
      });
      expect(result.totalDiffPremium).toBe(14);
    });

    test('should calculate on-call differential', () => {
      const result = Engine.calculateShiftDifferential({
        shiftType: 'ON_CALL',
        hoursWorked: 4,
        baseHourlyRate: 20,
      });
      expect(result.hourlyDiffRate).toBe(1.25);
      expect(result.totalDiffPremium).toBe(5);
    });

    test('should throw error for unknown shift type', () => {
      expect(() =>
        Engine.calculateShiftDifferential({
          shiftType: 'INVALID',
          hoursWorked: 8,
          baseHourlyRate: 20,
        })
      ).toThrow('Unknown shift type');
    });

    test('should throw error for zero hourly rate', () => {
      expect(() =>
        Engine.calculateShiftDifferential({
          shiftType: 'NIGHT',
          hoursWorked: 8,
          baseHourlyRate: 0,
        })
      ).toThrow('positive');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 3: Overtime Premium Cost Analysis
  // ---------------------------------------------------------------------------
  describe('analyzeOTCosts()', () => {
    const employees = [
      { id: 1, name: 'Alice', department: 'Warehouse', regularRate: 20, otHours: 10, dtHours: 0 },
      { id: 2, name: 'Bob', department: 'Warehouse', regularRate: 22, otHours: 8, dtHours: 2 },
      { id: 3, name: 'Carol', department: 'Manufacturing', regularRate: 25, otHours: 15, dtHours: 0 },
      { id: 4, name: 'Dave', department: 'Manufacturing', regularRate: 18, otHours: 5, dtHours: 0 },
    ];

    test('should compute total OT hours and cost', () => {
      const result = Engine.analyzeOTCosts(employees);
      expect(result.totalOTHours).toBe(40);
      expect(result.totalOTCost).toBeGreaterThan(0);
    });

    test('should compute department breakdown', () => {
      const result = Engine.analyzeOTCosts(employees);
      expect(result.departmentBreakdown.length).toBe(2);
      const warehouse = result.departmentBreakdown.find(d => d.department === 'Warehouse');
      expect(warehouse.headcount).toBe(2);
    });

    test('should compute average OT hours per employee', () => {
      const result = Engine.analyzeOTCosts(employees);
      expect(result.avgOTHoursPerEmployee).toBe(10);
    });

    test('should include period label', () => {
      const result = Engine.analyzeOTCosts(employees, 'Pay Period 12');
      expect(result.periodLabel).toBe('Pay Period 12');
    });

    test('should throw error for empty array', () => {
      expect(() => Engine.analyzeOTCosts([])).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 4: Predictive Scheduling Compliance
  // ---------------------------------------------------------------------------
  describe('monitorPredictiveScheduling()', () => {
    test('should detect violations for short-notice schedule changes', () => {
      const changes = [
        { employeeId: 1, scheduledDate: '2026-09-01', changeDate: '2026-08-30', changeType: 'SHIFT_CHANGE' },
      ];
      const result = Engine.monitorPredictiveScheduling(changes);
      expect(result.violationCount).toBe(1);
      expect(result.totalPremiumHoursOwed).toBe(1);
    });

    test('should flag no violations for adequate notice', () => {
      const changes = [
        { employeeId: 1, scheduledDate: '2026-09-15', changeDate: '2026-08-01', changeType: 'SHIFT_CHANGE' },
      ];
      const result = Engine.monitorPredictiveScheduling(changes);
      expect(result.violationCount).toBe(0);
      expect(result.complianceRate).toBe(100);
    });

    test('should compute compliance rate', () => {
      const changes = [
        { employeeId: 1, scheduledDate: '2026-09-01', changeDate: '2026-08-30', changeType: 'SHIFT_CHANGE' },
        { employeeId: 2, scheduledDate: '2026-09-15', changeDate: '2026-08-01', changeType: 'SHIFT_CHANGE' },
      ];
      const result = Engine.monitorPredictiveScheduling(changes);
      expect(result.complianceRate).toBe(50);
    });

    test('should throw error for empty array', () => {
      expect(() => Engine.monitorPredictiveScheduling([])).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 5: Overtime Trend Analysis
  // ---------------------------------------------------------------------------
  describe('analyzeOTTrends()', () => {
    const periods = [
      { periodLabel: 'P1', totalOTHours: 100, totalOTCost: 5000, headcount: 50 },
      { periodLabel: 'P2', totalOTHours: 120, totalOTCost: 6000, headcount: 50 },
      { periodLabel: 'P3', totalOTHours: 110, totalOTCost: 5500, headcount: 50 },
      { periodLabel: 'P4', totalOTHours: 135, totalOTCost: 6750, headcount: 50 },
    ];

    test('should compute average OT hours across periods', () => {
      const result = Engine.analyzeOTTrends(periods);
      expect(result.avgOTHours).toBe(116.25);
    });

    test('should compute period-over-period growth rates', () => {
      const result = Engine.analyzeOTTrends(periods);
      expect(result.growthRates.length).toBe(3);
      expect(result.growthRates[0]).toBe(20); // (120-100)/100 * 100
    });

    test('should determine trend direction', () => {
      const result = Engine.analyzeOTTrends(periods);
      expect(result.trendDirection).toBeDefined();
      expect(typeof result.trendDirection).toBe('string');
    });

    test('should compute volatility', () => {
      const result = Engine.analyzeOTTrends(periods);
      expect(result.volatility).toBeGreaterThanOrEqual(0);
    });

    test('should throw error for insufficient periods', () => {
      expect(() => Engine.analyzeOTTrends([{ periodLabel: 'P1', totalOTHours: 100 }])).toThrow('At least 2 periods');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 6: Labor Cost Projection
  // ---------------------------------------------------------------------------
  describe('projectLaborCosts()', () => {
    const params = {
      monthlyBaseLaborCost: 500000,
      monthlyOTPremiumCost: 50000,
      monthlyShiftDiffCost: 15000,
      projectedOTGrowthPct: 5,
      projectedHeadcountGrowthPct: 2,
      months: 6,
    };

    test('should project correct number of months', () => {
      const result = Engine.projectLaborCosts(params);
      expect(result.projections.length).toBe(6);
    });

    test('should project increasing costs with growth', () => {
      const result = Engine.projectLaborCosts(params);
      expect(result.projections[5].totalMonthlyCost).toBeGreaterThan(
        result.projections[0].totalMonthlyCost
      );
    });

    test('should include cumulative cost', () => {
      const result = Engine.projectLaborCosts(params);
      expect(result.projections[5].cumulativeCost).toBeGreaterThan(0);
    });

    test('should compute summary variance', () => {
      const result = Engine.projectLaborCosts(params);
      expect(result.summary.variance).toBeDefined();
    });

    test('should throw error for zero base cost', () => {
      expect(() => Engine.projectLaborCosts({ ...params, monthlyBaseLaborCost: 0 })).toThrow('positive');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 7: Employee OT Leaderboard
  // ---------------------------------------------------------------------------
  describe('computeOTLeaderboard()', () => {
    const employees = [
      { id: 1, name: 'Alice', department: 'Warehouse', otHours: 25, regularHours: 35, regularRate: 20 },
      { id: 2, name: 'Bob', department: 'Manufacturing', otHours: 18, regularHours: 40, regularRate: 22 },
      { id: 3, name: 'Carol', department: 'Warehouse', otHours: 30, regularHours: 30, regularRate: 25 },
    ];

    test('should rank by OT hours descending', () => {
      const result = Engine.computeOTLeaderboard(employees);
      expect(result[0].name).toBe('Carol');
      expect(result[0].rank).toBe(1);
    });

    test('should flag anomalies above threshold', () => {
      const result = Engine.computeOTLeaderboard(employees, 10, 20);
      // Carol: 30 OT / 60 total = 50% > 20% threshold
      expect(result[0].isAnomaly).toBe(true);
    });

    test('should compute OT cost for each employee', () => {
      const result = Engine.computeOTLeaderboard(employees);
      const carol = result.find(e => e.name === 'Carol');
      expect(carol.otCost).toBe(1125); // 30 * 25 * 1.5
    });

    test('should limit results to topN', () => {
      const result = Engine.computeOTLeaderboard(employees, 2);
      expect(result.length).toBe(2);
    });

    test('should throw error for empty array', () => {
      expect(() => Engine.computeOTLeaderboard([])).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 8: Multi-Entity Workforce Aggregation
  // ---------------------------------------------------------------------------
  describe('aggregateMultiEntityWorkforce()', () => {
    const entities = [
      { entityName: 'US HQ', headcount: 500, totalOTHours: 2000, totalOTCost: 150000, totalShiftDiffCost: 30000 },
      { entityName: 'US West', headcount: 200, totalOTHours: 800, totalOTCost: 60000, totalShiftDiffCost: 12000 },
    ];

    test('should aggregate headcount across entities', () => {
      const result = Engine.aggregateMultiEntityWorkforce(entities);
      expect(result.totalHeadcount).toBe(700);
    });

    test('should aggregate OT hours and costs', () => {
      const result = Engine.aggregateMultiEntityWorkforce(entities);
      expect(result.totalOTHours).toBe(2800);
      expect(result.totalOTCost).toBe(210000);
      expect(result.totalShiftDiffCost).toBe(42000);
    });

    test('should compute average OT hours per employee', () => {
      const result = Engine.aggregateMultiEntityWorkforce(entities);
      expect(result.avgOTHoursPerEmployee).toBe(4);
    });

    test('should compute total labor premium cost', () => {
      const result = Engine.aggregateMultiEntityWorkforce(entities);
      expect(result.totalLaborPremiumCost).toBe(252000);
    });

    test('should throw error for empty array', () => {
      expect(() => Engine.aggregateMultiEntityWorkforce([])).toThrow('non-empty');
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
// Test Fixtures: Deterministic workforce data with known outcomes.
// Running: jest tests/services/overtimeShiftDifferentialWorkforceSchedulingEngine.test.js --coverage
// =============================================================================
