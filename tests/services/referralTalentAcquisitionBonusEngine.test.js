/**
 * =============================================================================
 * Unit Tests — Enterprise Referral & Talent Acquisition Bonus Tracking Engine
 * PaySphere Global HR & Payroll Platform
 * Engine Version: 2.4.0 | Test Framework: Jest
 *
 * Coverage Target: 100% statement and branch coverage across all engine methods.
 * Test Strategy: Deterministic fixtures with edge case and boundary testing.
 * Compliance: OFCCP audit requires automated test evidence artifacts.
 * =============================================================================
 */

const ReferralTalentAcquisitionBonusEngine = require('../src/services/referralTalentAcquisitionBonusEngine');

describe('ReferralTalentAcquisitionBonusEngine Unit Tests', () => {
  // ---------------------------------------------------------------------------
  // Section 1: Referral Bonus Calculation
  // ---------------------------------------------------------------------------
  describe('calculateReferralBonus()', () => {
    test('should calculate standard referral bonus for IC3 role', () => {
      const result = ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
        roleLevel: 'IC3',
      });
      expect(result.totalBonusAmount).toBe(7500);
      expect(result.roleLevel).toBe('Senior');
      expect(result.referrerType).toBe('employee');
    });

    test('should apply 25% diversity referral uplift', () => {
      const result = ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
        roleLevel: 'IC3',
        isDiversityReferral: true,
      });
      expect(result.totalBonusAmount).toBe(9375);
      expect(result.isDiversityReferral).toBe(true);
    });

    test('should apply 15% executive referral multiplier', () => {
      const result = ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
        roleLevel: 'IC2',
        referrerType: 'executive',
      });
      // 4000 * 1.15 = 4600
      expect(result.totalBonusAmount).toBe(4600);
    });

    test('should not apply executive multiplier when role level is EXECUTIVE', () => {
      const result = ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
        roleLevel: 'EXECUTIVE',
        referrerType: 'executive',
      });
      expect(result.totalBonusAmount).toBe(25000);
    });

    test('should compute correct split amounts for STANDARD schedule', () => {
      const result = ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
        roleLevel: 'IC3',
        splitSchedule: 'STANDARD',
      });
      expect(result.splitAmounts.length).toBe(2);
      expect(result.splitAmounts[0].amount).toBe(3750);
      expect(result.splitAmounts[1].amount).toBe(3750);
      expect(result.splitAmounts[0].milestone).toBe('HIRED');
      expect(result.splitAmounts[1].milestone).toBe('6_MONTHS');
    });

    test('should compute correct split for FRONT_LOADED schedule', () => {
      const result = ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
        roleLevel: 'IC2',
        splitSchedule: 'FRONT_LOADED',
      });
      // 4000 * 70% = 2800 upfront
      expect(result.splitAmounts[0].amount).toBe(2800);
      expect(result.splitAmounts[1].amount).toBe(1200);
    });

    test('should handle UPFRONT schedule (100% at hire)', () => {
      const result = ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
        roleLevel: 'IC1',
        splitSchedule: 'UPFRONT',
      });
      expect(result.splitAmounts.length).toBe(1);
      expect(result.splitAmounts[0].amount).toBe(2500);
    });

    test('should throw error for unknown role level', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
          roleLevel: 'UNKNOWN',
        })
      ).toThrow('Unknown role level');
    });

    test('should throw error for unknown split schedule', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.calculateReferralBonus({
          roleLevel: 'IC3',
          splitSchedule: 'NONEXISTENT',
        })
      ).toThrow('Unknown split schedule');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 2: Pipeline Conversion Rate Analysis
  // ---------------------------------------------------------------------------
  describe('analyzePipelineConversion()', () => {
    test('should compute correct conversion rates for each stage', () => {
      const result = ReferralTalentAcquisitionBonusEngine.analyzePipelineConversion({
        applied: 100,
        screened: 60,
        interviewed: 30,
        offered: 15,
        hired: 12,
      });
      expect(result.conversionRates.length).toBe(4);
      expect(result.conversionRates[0].conversionPct).toBe(60);      // Applied → Screened
      expect(result.conversionRates[1].conversionPct).toBe(50);      // Screened → Interviewed
      expect(result.conversionRates[2].conversionPct).toBe(50);      // Interviewed → Offered
      expect(result.conversionRates[3].conversionPct).toBe(80);      // Offered → Hired
    });

    test('should compute correct overall conversion rate', () => {
      const result = ReferralTalentAcquisitionBonusEngine.analyzePipelineConversion({
        applied: 200,
        screened: 120,
        interviewed: 60,
        offered: 20,
        hired: 15,
      });
      // 15/200 = 7.5%
      expect(result.overallConversionRate).toBe(7.5);
    });

    test('should identify the bottleneck stage (lowest conversion)', () => {
      const result = ReferralTalentAcquisitionBonusEngine.analyzePipelineConversion({
        applied: 100,
        screened: 50,
        interviewed: 10,  // 20% conversion - bottleneck
        offered: 8,
        hired: 7,
      });
      expect(result.bottleneck.stage).toBe('Screened → Interviewed');
      expect(result.bottleneck.isCritical).toBe(true); // < 30%
    });

    test('should flag non-critical bottleneck when conversion is above 30%', () => {
      const result = ReferralTalentAcquisitionBonusEngine.analyzePipelineConversion({
        applied: 100,
        screened: 60,
        interviewed: 30,
        offered: 15,
        hired: 10,
      });
      expect(result.bottleneck.isCritical).toBe(false);
    });

    test('should throw error for negative counts', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.analyzePipelineConversion({
          applied: -1,
          screened: 0,
          interviewed: 0,
          offered: 0,
          hired: 0,
        })
      ).toThrow('non-negative numbers');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 3: Time-to-Fill Comparison
  // ---------------------------------------------------------------------------
  describe('compareTimeToFill()', () => {
    const referralHires = [
      { hireDate: '2026-03-18', requisitionOpenDate: '2026-03-01' },
      { hireDate: '2026-04-10', requisitionOpenDate: '2026-03-20' },
    ];
    const otherHires = [
      { hireDate: '2026-04-15', requisitionOpenDate: '2026-03-01' },
      { hireDate: '2026-05-01', requisitionOpenDate: '2026-03-15' },
    ];

    test('should compute average days for each group', () => {
      const result = ReferralTalentAcquisitionBonusEngine.compareTimeToFill(referralHires, otherHires);
      expect(result.referralAvgDaysToFill).toBeGreaterThan(0);
      expect(result.otherAvgDaysToFill).toBeGreaterThan(0);
    });

    test('should correctly determine referral channel is faster', () => {
      const result = ReferralTalentAcquisitionBonusEngine.compareTimeToFill(referralHires, otherHires);
      expect(result.referralFaster).toBe(true);
      expect(result.timeSavingsDays).toBeGreaterThan(0);
    });

    test('should compute time savings percentage', () => {
      const result = ReferralTalentAcquisitionBonusEngine.compareTimeToFill(referralHires, otherHires);
      expect(result.timeSavingsPct).toBeGreaterThan(0);
    });

    test('should handle empty arrays gracefully', () => {
      const result = ReferralTalentAcquisitionBonusEngine.compareTimeToFill([], []);
      expect(result.referralAvgDaysToFill).toBe(0);
      expect(result.otherAvgDaysToFill).toBe(0);
    });

    test('should throw error for non-array inputs', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.compareTimeToFill(null, [])
      ).toThrow('must be arrays');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 4: Cost-Per-Hire Benchmarking
  // ---------------------------------------------------------------------------
  describe('benchmarkCostPerHire()', () => {
    const channels = [
      { name: 'REFERRAL', hires: 50, totalCost: 75000 },
      { name: 'AGENCY', hires: 10, totalCost: 180000 },
      { name: 'JOB_BOARD', hires: 30, totalCost: 135000 },
    ];

    test('should compute cost per hire for each channel', () => {
      const result = ReferralTalentAcquisitionBonusEngine.benchmarkCostPerHire(channels);
      const referral = result.channels.find(c => c.channelName === 'REFERRAL');
      expect(referral.costPerHire).toBe(1500);
    });

    test('should compare against industry benchmarks', () => {
      const result = ReferralTalentAcquisitionBonusEngine.benchmarkCostPerHire(channels);
      const referral = result.channels.find(c => c.channelName === 'REFERRAL');
      expect(referral.industryBenchmark).toBe(1500);
      expect(referral.costEfficiency).toBe('BELOW_BENCHMARK');
    });

    test('should compute weighted average cost per hire', () => {
      const result = ReferralTalentAcquisitionBonusEngine.benchmarkCostPerHire(channels);
      const totalCost = 75000 + 180000 + 135000;
      const totalHires = 50 + 10 + 30;
      expect(result.weightedAvgCostPerHire).toBe(Math.round(totalCost / totalHires));
    });

    test('should throw error for empty array', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.benchmarkCostPerHire([])
      ).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 5: Referral Program ROI Computation
  // ---------------------------------------------------------------------------
  describe('computeReferralROI()', () => {
    test('should compute positive ROI when savings exceed program cost', () => {
      const result = ReferralTalentAcquisitionBonusEngine.computeReferralROI({
        referralHires: 50,
        referralProgramCost: 250000,
        agencyCostPerHire: 18000,
        referralCostPerHire: 5000,
      });
      // Agency savings: (18000 - 5000) * 50 = 650000
      // Quality premium: 250000 * 0.15 = 37500
      expect(result.agencySavings).toBe(650000);
      expect(result.qualityPremium).toBe(37500);
      expect(result.roiPositive).toBe(true);
    });

    test('should compute negative ROI when costs exceed value', () => {
      const result = ReferralTalentAcquisitionBonusEngine.computeReferralROI({
        referralHires: 5,
        referralProgramCost: 100000,
        agencyCostPerHire: 5000,
        referralCostPerHire: 20000,
      });
      expect(result.roiPositive).toBe(false);
      expect(result.netReturn).toBeLessThan(0);
    });

    test('should compute cost per referral hire', () => {
      const result = ReferralTalentAcquisitionBonusEngine.computeReferralROI({
        referralHires: 40,
        referralProgramCost: 200000,
        agencyCostPerHire: 15000,
        referralCostPerHire: 5000,
      });
      expect(result.costPerReferralHire).toBe(5000);
    });

    test('should throw error for zero referrals', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.computeReferralROI({
          referralHires: 0,
          referralProgramCost: 100000,
          agencyCostPerHire: 15000,
          referralCostPerHire: 5000,
        })
      ).toThrow('positive number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 6: Bonus Clawback Eligibility
  // ---------------------------------------------------------------------------
  describe('assessClawbackEligibility()', () => {
    test('should flag full clawback for voluntary departure within window', () => {
      const result = ReferralTalentAcquisitionBonusEngine.assessClawbackEligibility({
        bonusAmount: 5000,
        hireDate: '2026-01-01',
        departureDate: '2026-06-01',
        involuntaryReason: null,
      });
      expect(result.clawbackStatus).toBe('FULL_CLAWBACK');
      expect(result.clawbackAmount).toBe(5000);
      expect(result.withinClawbackWindow).toBe(true);
    });

    test('should not clawback for involuntary RIF within window', () => {
      const result = ReferralTalentAcquisitionBonusEngine.assessClawbackEligibility({
        bonusAmount: 5000,
        hireDate: '2026-01-01',
        departureDate: '2026-06-01',
        involuntaryReason: 'RIF',
      });
      expect(result.clawbackStatus).toBe('EXEMPT');
      expect(result.clawbackAmount).toBe(0);
    });

    test('should flag outside window for departure after 12 months', () => {
      const result = ReferralTalentAcquisitionBonusEngine.assessClawbackEligibility({
        bonusAmount: 5000,
        hireDate: '2024-01-01',
        departureDate: '2026-06-01',
        involuntaryReason: null,
      });
      expect(result.clawbackStatus).toBe('OUTSIDE_WINDOW');
      expect(result.clawbackAmount).toBe(0);
      expect(result.withinClawbackWindow).toBe(false);
    });

    test('should flag partial clawback for non-exempt involuntary departure', () => {
      const result = ReferralTalentAcquisitionBonusEngine.assessClawbackEligibility({
        bonusAmount: 8000,
        hireDate: '2026-02-01',
        departureDate: '2026-08-01',
        involuntaryReason: 'PERFORMANCE',
      });
      expect(result.clawbackStatus).toBe('PARTIAL_CLAWBACK');
      expect(result.clawbackAmount).toBe(4000);
    });

    test('should throw error for zero bonus amount', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.assessClawbackEligibility({
          bonusAmount: 0,
          hireDate: '2026-01-01',
          departureDate: '2026-06-01',
        })
      ).toThrow('positive number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 7: Top Referrer Leaderboard
  // ---------------------------------------------------------------------------
  describe('computeLeaderboard()', () => {
    const referrers = [
      { id: 1, name: 'Alice', department: 'Eng', referralHires: 8, totalBonusEarned: 60000, qualityScore: 90 },
      { id: 2, name: 'Bob', department: 'Sales', referralHires: 5, totalBonusEarned: 35000, qualityScore: 80 },
      { id: 3, name: 'Carol', department: 'Product', referralHires: 12, totalBonusEarned: 90000, qualityScore: 95 },
    ];

    test('should rank referrers by composite score', () => {
      const result = ReferralTalentAcquisitionBonusEngine.computeLeaderboard(referrers);
      expect(result[0].name).toBe('Carol');
      expect(result[0].rank).toBe(1);
    });

    test('should limit results to topN', () => {
      const result = ReferralTalentAcquisitionBonusEngine.computeLeaderboard(referrers, 2);
      expect(result.length).toBe(2);
    });

    test('should include composite score in results', () => {
      const result = ReferralTalentAcquisitionBonusEngine.computeLeaderboard(referrers);
      expect(result[0].compositeScore).toBeGreaterThan(0);
    });

    test('should throw error for empty array', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.computeLeaderboard([])
      ).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 8: Multi-Entity Referral Aggregation
  // ---------------------------------------------------------------------------
  describe('aggregateMultiEntityReferrals()', () => {
    const entities = [
      { entityName: 'US HQ', totalReferrals: 300, hires: 100, bonusPaid: 400000, programCost: 350000 },
      { entityName: 'UK Ltd', totalReferrals: 80, hires: 25, bonusPaid: 80000, programCost: 70000 },
    ];

    test('should aggregate referral counts across entities', () => {
      const result = ReferralTalentAcquisitionBonusEngine.aggregateMultiEntityReferrals(entities);
      expect(result.totalReferrals).toBe(380);
      expect(result.totalHires).toBe(125);
    });

    test('should compute overall hire rate', () => {
      const result = ReferralTalentAcquisitionBonusEngine.aggregateMultiEntityReferrals(entities);
      // 125/380 = 32.89%
      expect(result.overallHireRate).toBe(Math.round((125 / 380) * 10000) / 100);
    });

    test('should compute average bonus per hire', () => {
      const result = ReferralTalentAcquisitionBonusEngine.aggregateMultiEntityReferrals(entities);
      expect(result.avgBonusPerHire).toBe(Math.round(480000 / 125));
    });

    test('should throw error for empty array', () => {
      expect(() =>
        ReferralTalentAcquisitionBonusEngine.aggregateMultiEntityReferrals([])
      ).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 9: Full Report Generation
  // ---------------------------------------------------------------------------
  describe('generateFullReport()', () => {
    test('should generate report with unique ID', () => {
      const report = ReferralTalentAcquisitionBonusEngine.generateFullReport({
        referrers: [
          { id: 1, name: 'A', department: 'Eng', referralHires: 5, totalBonusEarned: 30000, qualityScore: 85 },
        ],
        channels: [{ name: 'REFERRAL', hires: 50, totalCost: 75000 }],
      });
      expect(report.reportId).toMatch(/^REF-RPT-\d+-\d+$/);
      expect(report.engineVersion).toBe('2.4.0');
    });

    test('should include top referrer and channel summary', () => {
      const report = ReferralTalentAcquisitionBonusEngine.generateFullReport({
        referrers: [
          { id: 1, name: 'A', department: 'Eng', referralHires: 5, totalBonusEarned: 30000, qualityScore: 85 },
        ],
        channels: [{ name: 'REFERRAL', hires: 50, totalCost: 75000 }],
      });
      expect(report.topReferrer).toBeDefined();
      expect(report.totalChannels).toBe(1);
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
// Test Fixtures: Deterministic referral data with known outcomes.
// Mocking Strategy: None required — engine is pure-function static class design.
// Running: jest tests/services/referralTalentAcquisitionBonusEngine.test.js --coverage
// =============================================================================
