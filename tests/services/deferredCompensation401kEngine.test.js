/**
 * =============================================================================
 * Unit Tests — Enterprise Deferred Compensation & 401(k) Administration Engine
 * PaySphere Global HR & Payroll Platform
 * Engine Version: 2.8.0 | Test Framework: Jest
 *
 * Coverage Target: 100% statement and branch coverage across all engine methods.
 * Test Strategy: Deterministic fixtures with edge case and boundary testing.
 * Compliance: ERISA audit requires automated test evidence artifacts.
 * =============================================================================
 */

const DeferredCompensation401kEngine = require('../src/services/deferredCompensation401kEngine');

describe('DeferredCompensation401kEngine Unit Tests', () => {
  // ---------------------------------------------------------------------------
  // Section 1: IRS Contribution Limit Compliance Tests
  // ---------------------------------------------------------------------------
  describe('checkContributionLimits()', () => {
    test('should pass compliance for deferral within base limit', () => {
      const result = DeferredCompensation401kEngine.checkContributionLimits({
        annualElectiveDeferral: 20000,
        age: 35,
        annualCompensation: 120000,
      });
      expect(result.isWithinLimit).toBe(true);
      expect(result.catchUpType).toBe('NONE');
      expect(result.catchUpAmount).toBe(0);
    });

    test('should apply standard catch-up for age 50+', () => {
      const result = DeferredCompensation401kEngine.checkContributionLimits({
        annualElectiveDeferral: 28000,
        age: 55,
        annualCompensation: 200000,
      });
      expect(result.catchUpAmount).toBe(7500);
      expect(result.catchUpType).toBe('STANDARD_CATCH_UP');
      expect(result.totalAllowedDeferral).toBe(31000);
    });

    test('should apply SECURE 2.0 super catch-up for ages 60-63', () => {
      const result = DeferredCompensation401kEngine.checkContributionLimits({
        annualElectiveDeferral: 32000,
        age: 62,
        annualCompensation: 250000,
      });
      expect(result.catchUpAmount).toBe(11250);
      expect(result.catchUpType).toBe('SECURE_2_SUPER_CATCH_UP');
      expect(result.totalAllowedDeferral).toBe(34750);
    });

    test('should flag overage when deferral exceeds limit', () => {
      const result = DeferredCompensation401kEngine.checkContributionLimits({
        annualElectiveDeferral: 30000,
        age: 30,
        annualCompensation: 150000,
      });
      expect(result.isWithinLimit).toBe(false);
      expect(result.overageAmount).toBeGreaterThan(0);
      expect(result.section402gCompliant).toBe(false);
    });

    test('should flag compensation overage above §401(a)(17) limit', () => {
      const result = DeferredCompensation401kEngine.checkContributionLimits({
        annualElectiveDeferral: 23500,
        age: 45,
        annualCompensation: 500000,
      });
      expect(result.compensationCapped).toBe(true);
    });

    test('should throw error for negative deferral', () => {
      expect(() =>
        DeferredCompensation401kEngine.checkContributionLimits({
          annualElectiveDeferral: -5000,
          age: 30,
          annualCompensation: 100000,
        })
      ).toThrow('non-negative number');
    });

    test('should throw error for age below 18', () => {
      expect(() =>
        DeferredCompensation401kEngine.checkContributionLimits({
          annualElectiveDeferral: 5000,
          age: 16,
          annualCompensation: 30000,
        })
      ).toThrow('at least 18');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 2: ADP/ACP Non-Discrimination Testing
  // ---------------------------------------------------------------------------
  describe('performADPACPTest()', () => {
    test('should pass ADP and ACP when within safe harbor limits', () => {
      const result = DeferredCompensation401kEngine.performADPACPTest({
        nhceAvgDeferralPct: 6.0,
        hceAvgDeferralPct: 8.0,
        nhceAvgContribPct: 8.0,
        hceAvgContribPct: 10.0,
      });
      expect(result.adp.passed).toBe(true);
      expect(result.acp.passed).toBe(true);
      expect(result.overallPassed).toBe(true);
      expect(result.correctiveActionRequired).toBe(false);
    });

    test('should fail ADP when HCE exceeds extended limit', () => {
      const result = DeferredCompensation401kEngine.performADPACPTest({
        nhceAvgDeferralPct: 3.0,
        hceAvgDeferralPct: 10.0,
        nhceAvgContribPct: 5.0,
        hceAvgContribPct: 7.0,
      });
      expect(result.adp.passed).toBe(false);
      expect(result.overallPassed).toBe(false);
      expect(result.correctiveActionRequired).toBe(true);
    });

    test('should correctly compute ADP safe harbor limit (greater of 2% or 125%)', () => {
      const result = DeferredCompensation401kEngine.performADPACPTest({
        nhceAvgDeferralPct: 5.0,
        hceAvgDeferralPct: 6.5,
        nhceAvgContribPct: 6.0,
        hceAvgContribPct: 7.5,
      });
      // 125% of 5% = 6.25%, which is greater than 2%
      expect(result.adp.safeHarborLimit).toBe(6.25);
      expect(result.adp.passed).toBe(true); // 6.5 > 6.25 but within extended
    });

    test('should throw error for missing parameters', () => {
      expect(() =>
        DeferredCompensation401kEngine.performADPACPTest({})
      ).toThrow('must be provided');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 3: Vesting Schedule Computation
  // ---------------------------------------------------------------------------
  describe('computeVesting()', () => {
    test('should return 0% vested for cliff schedule before cliff year', () => {
      const result = DeferredCompensation401kEngine.computeVesting({
        totalEmployerMatch: 50000,
        yearsOfService: 2,
        vestingScheduleKey: 'CLIFF_3_YEAR',
      });
      expect(result.vestedPct).toBe(0);
      expect(result.vestedBalance).toBe(0);
      expect(result.isFullyVested).toBe(false);
    });

    test('should return 100% vested at cliff year', () => {
      const result = DeferredCompensation401kEngine.computeVesting({
        totalEmployerMatch: 50000,
        yearsOfService: 3,
        vestingScheduleKey: 'CLIFF_3_YEAR',
      });
      expect(result.vestedPct).toBe(100);
      expect(result.vestedBalance).toBe(50000);
      expect(result.isFullyVested).toBe(true);
    });

    test('should compute graded vesting correctly at year 2', () => {
      const result = DeferredCompensation401kEngine.computeVesting({
        totalEmployerMatch: 60000,
        yearsOfService: 2,
        vestingScheduleKey: 'GRADED_6_YEAR',
      });
      expect(result.vestedPct).toBe(20);
      expect(result.vestedBalance).toBe(12000);
      expect(result.unvestedBalance).toBe(48000);
    });

    test('should compute graded vesting correctly at year 4', () => {
      const result = DeferredCompensation401kEngine.computeVesting({
        totalEmployerMatch: 60000,
        yearsOfService: 4,
        vestingScheduleKey: 'GRADED_6_YEAR',
      });
      expect(result.vestedPct).toBe(60);
      expect(result.vestedBalance).toBe(36000);
    });

    test('should report years to full vest', () => {
      const result = DeferredCompensation401kEngine.computeVesting({
        totalEmployerMatch: 40000,
        yearsOfService: 1,
        vestingScheduleKey: 'GRADED_6_YEAR',
      });
      expect(result.yearsToFullVest).toBe(5);
    });

    test('should throw error for unknown vesting schedule', () => {
      expect(() =>
        DeferredCompensation401kEngine.computeVesting({
          totalEmployerMatch: 50000,
          yearsOfService: 2,
          vestingScheduleKey: 'NONEXISTENT',
        })
      ).toThrow('Unknown vesting schedule');
    });

    test('should throw error for negative employer match', () => {
      expect(() =>
        DeferredCompensation401kEngine.computeVesting({
          totalEmployerMatch: -10000,
          yearsOfService: 2,
          vestingScheduleKey: 'CLIFF_3_YEAR',
        })
      ).toThrow('non-negative number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 4: Employer Match Formula Modeling
  // ---------------------------------------------------------------------------
  describe('calculateEmployerMatch()', () => {
    test('should calculate dollar-for-dollar match at 3%', () => {
      const result = DeferredCompensation401kEngine.calculateEmployerMatch({
        annualCompensation: 100000,
        employeeContributionPct: 5,
        formulaKey: 'DOLLAR_FOR_DOLLAR_3',
      });
      expect(result.matchAmount).toBe(3000);
      expect(result.totalMatchPct).toBe(3);
    });

    test('should calculate 50% match on first 6%', () => {
      const result = DeferredCompensation401kEngine.calculateEmployerMatch({
        annualCompensation: 120000,
        employeeContributionPct: 8,
        formulaKey: 'FIFTY_CENT_6',
      });
      expect(result.matchAmount).toBe(3600);
      expect(result.totalMatchPct).toBe(3);
    });

    test('should handle 0% employee contribution', () => {
      const result = DeferredCompensation401kEngine.calculateEmployerMatch({
        annualCompensation: 100000,
        employeeContributionPct: 0,
        formulaKey: 'DOLLAR_FOR_DOLLAR_3',
      });
      expect(result.matchAmount).toBe(0);
    });

    test('should calculate tiered match correctly', () => {
      const result = DeferredCompensation401kEngine.calculateEmployerMatch({
        annualCompensation: 100000,
        employeeContributionPct: 6,
        formulaKey: 'TIERED_4_8',
      });
      // 100% on first 3% = 3% + 50% on next 3% = 1.5% = total 4.5%
      expect(result.totalMatchPct).toBe(4.5);
      expect(result.matchAmount).toBe(4500);
    });

    test('should project organizational cost with headcount', () => {
      const result = DeferredCompensation401kEngine.calculateEmployerMatch({
        annualCompensation: 100000,
        employeeContributionPct: 6,
        formulaKey: 'FIFTY_CENT_6',
        headcount: 200,
      });
      expect(result.projectedOrgCost).toBe(600000);
      expect(result.costPerPayPeriod).toBe(1250);
    });

    test('should throw error for invalid formula key', () => {
      expect(() =>
        DeferredCompensation401kEngine.calculateEmployerMatch({
          annualCompensation: 100000,
          employeeContributionPct: 6,
          formulaKey: 'NONEXISTENT',
        })
      ).toThrow('Unknown match formula');
    });

    test('should throw error for zero compensation', () => {
      expect(() =>
        DeferredCompensation401kEngine.calculateEmployerMatch({
          annualCompensation: 0,
          employeeContributionPct: 6,
          formulaKey: 'DOLLAR_FOR_DOLLAR_3',
        })
      ).toThrow('positive number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 5: §409A Deferred Compensation Compliance
  // ---------------------------------------------------------------------------
  describe('validate409ACompliance()', () => {
    test('should validate compliant arrangement', () => {
      const result = DeferredCompensation401kEngine.validate409ACompliance({
        electionTiming: 'WITHIN_30_DAYS_OF_ENROLLMENT',
        distributionTrigger: 'SEPARATION_FROM_SERVICE',
        hasDeferralElection: true,
        arrangementType: 'NONQUALIFIED_DEFERRED_COMP',
      });
      expect(result.isCompliant).toBe(true);
      expect(result.violationCount).toBe(0);
    });

    test('should flag missing deferral election', () => {
      const result = DeferredCompensation401kEngine.validate409ACompliance({
        electionTiming: 'WITHIN_30_DAYS_OF_ENROLLMENT',
        distributionTrigger: 'SEPARATION_FROM_SERVICE',
        hasDeferralElection: false,
        arrangementType: 'NONQUALIFIED_DEFERRED_COMP',
      });
      expect(result.isCompliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should flag invalid distribution trigger', () => {
      const result = DeferredCompensation401kEngine.validate409ACompliance({
        electionTiming: 'ANNUAL_ELECTION_PERIOD',
        distributionTrigger: 'EMPLOYEE_REQUEST',
        hasDeferralElection: true,
        arrangementType: 'NONQUALIFIED_DEFERRED_COMP',
      });
      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.includes('distribution trigger'))).toBe(true);
    });

    test('should flag invalid election timing', () => {
      const result = DeferredCompensation401kEngine.validate409ACompliance({
        electionTiming: 'MID_YEAR_CHANGE',
        distributionTrigger: 'SEPARATION_FROM_SERVICE',
        hasDeferralElection: true,
        arrangementType: 'NONQUALIFIED_DEFERRED_COMP',
      });
      expect(result.isCompliant).toBe(false);
      expect(result.violationCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 6: Participant Contribution Distribution Analysis
  // ---------------------------------------------------------------------------
  describe('analyzeContributionDistribution()', () => {
    const participants = [
      { id: 1, contributionPct: 0, salary: 80000, department: 'Eng' },
      { id: 2, contributionPct: 6, salary: 90000, department: 'Eng' },
      { id: 3, contributionPct: 10, salary: 110000, department: 'Sales' },
      { id: 4, contributionPct: 15, salary: 130000, department: 'Finance' },
      { id: 5, contributionPct: 4, salary: 75000, department: 'HR' },
    ];

    test('should correctly count total participants', () => {
      const result = DeferredCompensation401kEngine.analyzeContributionDistribution(participants);
      expect(result.totalParticipants).toBe(5);
    });

    test('should compute correct average contribution', () => {
      const result = DeferredCompensation401kEngine.analyzeContributionDistribution(participants);
      const expected = (0 + 6 + 10 + 15 + 4) / 5;
      expect(result.avgContributionPct).toBe(expected);
    });

    test('should compute opt-out rate', () => {
      const result = DeferredCompensation401kEngine.analyzeContributionDistribution(participants);
      expect(result.optOutRate).toBe(20);
      expect(result.zeroContributorCount).toBe(1);
    });

    test('should include distribution bands', () => {
      const result = DeferredCompensation401kEngine.analyzeContributionDistribution(participants);
      expect(result.distributionBands['0% (Opt-Out)']).toBe(1);
      expect(result.distributionBands['4-6%']).toBe(2);
    });

    test('should compute total projected deferral', () => {
      const result = DeferredCompensation401kEngine.analyzeContributionDistribution(participants);
      const expected = 0 + 5400 + 11000 + 19500 + 3000;
      expect(result.totalProjectedDeferral).toBe(expected);
    });

    test('should throw error for empty array', () => {
      expect(() =>
        DeferredCompensation401kEngine.analyzeContributionDistribution([])
      ).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 7: SECURE Act 2.0 Provision Tracking
  // ---------------------------------------------------------------------------
  describe('trackSecureActProvisions()', () => {
    test('should return an array of provisions', () => {
      const provisions = DeferredCompensation401kEngine.trackSecureActProvisions();
      expect(Array.isArray(provisions)).toBe(true);
      expect(provisions.length).toBeGreaterThan(0);
    });

    test('should include the Student Loan Match provision', () => {
      const provisions = DeferredCompensation401kEngine.trackSecureActProvisions();
      const studentLoan = provisions.find(p => p.section === 'SECURE 2.0 §110');
      expect(studentLoan).toBeDefined();
      expect(studentLoan.status).toBe('ACTIVE');
    });

    test('should include the Auto-Enrollment provision as MANDATORY', () => {
      const provisions = DeferredCompensation401kEngine.trackSecureActProvisions();
      const autoEnroll = provisions.find(p => p.section === 'SECURE 2.0 §101');
      expect(autoEnroll).toBeDefined();
      expect(autoEnroll.status).toBe('MANDATORY');
    });

    test('should return frozen (immutable) array elements', () => {
      const provisions = DeferredCompensation401kEngine.trackSecureActProvisions();
      expect(Object.isFrozen(provisions[0])).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 8: Multi-Entity Plan Aggregation
  // ---------------------------------------------------------------------------
  describe('aggregateMultiEntityPlans()', () => {
    const entities = [
      { entityName: 'HQ US', participants: 2000, totalAssets: 30000000, employerMatchCost: 2000000, planType: '401k' },
      { entityName: 'UK Ltd', participants: 500, totalAssets: 8000000, employerMatchCost: 600000, planType: '403b' },
      { entityName: 'India Pvt', participants: 300, totalAssets: 2000000, employerMatchCost: 150000, planType: '401k' },
    ];

    test('should aggregate participants across entities', () => {
      const result = DeferredCompensation401kEngine.aggregateMultiEntityPlans(entities);
      expect(result.totalParticipants).toBe(2800);
    });

    test('should aggregate total assets', () => {
      const result = DeferredCompensation401kEngine.aggregateMultiEntityPlans(entities);
      expect(result.totalAssets).toBe(40000000);
    });

    test('should compute average cost per participant', () => {
      const result = DeferredCompensation401kEngine.aggregateMultiEntityPlans(entities);
      const expected = Math.round(2750000 / 2800);
      expect(result.avgCostPerParticipant).toBe(expected);
    });

    test('should group by plan type', () => {
      const result = DeferredCompensation401kEngine.aggregateMultiEntityPlans(entities);
      expect(result.planBreakdown['401k'].entities).toBe(2);
      expect(result.planBreakdown['403b'].entities).toBe(1);
    });

    test('should throw error for empty array', () => {
      expect(() =>
        DeferredCompensation401kEngine.aggregateMultiEntityPlans([])
      ).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 9: Full Report Generation
  // ---------------------------------------------------------------------------
  describe('generateFullReport()', () => {
    test('should generate report with unique ID', () => {
      const report = DeferredCompensation401kEngine.generateFullReport({
        participants: [
          { id: 1, contributionPct: 6, salary: 90000, department: 'Eng' },
          { id: 2, contributionPct: 10, salary: 110000, department: 'Sales' },
        ],
        complianceData: {},
        vestingData: {},
      });
      expect(report.reportId).toMatch(/^401K-RPT-\d+-\d+$/);
      expect(report.engineVersion).toBe('2.8.0');
    });

    test('should include participant distribution and provision counts', () => {
      const report = DeferredCompensation401kEngine.generateFullReport({
        participants: [
          { id: 1, contributionPct: 8, salary: 100000, department: 'Eng' },
        ],
        complianceData: {},
        vestingData: {},
      });
      expect(report.participantDistribution).toBeDefined();
      expect(report.activeProvisions).toBeGreaterThan(0);
      expect(report.mandatoryProvisions).toBeGreaterThan(0);
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
// Test Fixtures: Deterministic employee and plan data with known outcomes.
// Mocking Strategy: None required — engine is pure-function static class design.
// Running: jest tests/services/deferredCompensation401kEngine.test.js --coverage
// =============================================================================
