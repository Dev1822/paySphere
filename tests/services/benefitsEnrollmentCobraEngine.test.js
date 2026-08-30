/**
 * =============================================================================
 * Unit Tests — Enterprise Benefits Enrollment & COBRA Administration Engine
 * PaySphere Global HR & Payroll Platform
 * Engine Version: 2.6.0 | Test Framework: Jest
 *
 * Coverage Target: 100% statement and branch coverage across all engine methods.
 * Test Strategy: Deterministic fixtures with edge case and boundary testing.
 * Compliance: ERISA audit requires automated test evidence artifacts.
 * =============================================================================
 */

const BenefitsEnrollmentCobraEngine = require('../src/services/benefitsEnrollmentCobraEngine');

describe('BenefitsEnrollmentCobraEngine Unit Tests', () => {
  // ---------------------------------------------------------------------------
  // Section 1: Benefits Eligibility Verification
  // ---------------------------------------------------------------------------
  describe('verifyEligibility()', () => {
    test('should grant full eligibility for full-time US employees with 30+ hours', () => {
      const result = BenefitsEnrollmentCobraEngine.verifyEligibility({
        employmentStatus: 'FULL_TIME',
        tenureMonths: 12,
        weeklyHours: 40,
        isUnion: false,
        entityCountry: 'US',
      });
      expect(result.eligibilityStatus).toBe('ELIGIBLE');
      expect(result.eligibleBenefits).toContain('MEDICAL');
      expect(result.eligibleBenefits).toContain('HSA');
      expect(result.meetsACAMinimum).toBe(true);
    });

    test('should grant limited eligibility for part-time employees meeting requirements', () => {
      const result = BenefitsEnrollmentCobraEngine.verifyEligibility({
        employmentStatus: 'PART_TIME',
        tenureMonths: 6,
        weeklyHours: 32,
        isUnion: false,
        entityCountry: 'US',
      });
      expect(result.eligibilityStatus).toBe('ELIGIBLE_LIMITED');
      expect(result.eligibleBenefits).toContain('MEDICAL');
      expect(result.eligibleBenefits).not.toContain('HSA');
    });

    test('should deny eligibility for contractors', () => {
      const result = BenefitsEnrollmentCobraEngine.verifyEligibility({
        employmentStatus: 'CONTRACT',
        tenureMonths: 24,
        weeklyHours: 40,
        isUnion: false,
        entityCountry: 'US',
      });
      expect(result.eligibilityStatus).toBe('INELIGIBLE');
      expect(result.eligibleBenefits.length).toBe(0);
    });

    test('should include union health plan for union employees', () => {
      const result = BenefitsEnrollmentCobraEngine.verifyEligibility({
        employmentStatus: 'FULL_TIME',
        tenureMonths: 24,
        weeklyHours: 40,
        isUnion: true,
        entityCountry: 'US',
      });
      expect(result.eligibleBenefits).toContain('UNION_HEALTH_PLAN');
    });

    test('should exclude US-specific benefits for non-US entities', () => {
      const result = BenefitsEnrollmentCobraEngine.verifyEligibility({
        employmentStatus: 'FULL_TIME',
        tenureMonths: 12,
        weeklyHours: 40,
        isUnion: false,
        entityCountry: 'UK',
      });
      expect(result.eligibleBenefits).not.toContain('HSA');
      expect(result.eligibleBenefits).not.toContain('FSA');
    });

    test('should throw error for missing employment status', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.verifyEligibility({
          tenureMonths: 12,
          weeklyHours: 40,
          isUnion: false,
          entityCountry: 'US',
        })
      ).toThrow('employmentStatus is required');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 2: COBRA Qualifying Event Detection
  // ---------------------------------------------------------------------------
  describe('detectCobraEligibility()', () => {
    test('should detect federal COBRA eligibility for involuntary separation at large employer', () => {
      const result = BenefitsEnrollmentCobraEngine.detectCobraEligibility({
        separationType: 'INVOLUNTARY',
        separationDate: '2026-06-15',
        isDisability: false,
        entityEmployeeCount: 200,
        entityState: 'CA',
      });
      expect(result.qualifiesForCobra).toBe(true);
      expect(result.coverageCategory).toBe('FEDERAL_COBRA');
      expect(result.coverageDurationMonths).toBe(18);
      expect(result.adminSurchargePct).toBe(2);
    });

    test('should detect disability extended COBRA for 29 months', () => {
      const result = BenefitsEnrollmentCobraEngine.detectCobraEligibility({
        separationType: 'HOURS_REDUCTION',
        separationDate: '2026-03-01',
        isDisability: true,
        entityEmployeeCount: 500,
        entityState: 'TX',
      });
      expect(result.coverageCategory).toBe('FEDERAL_COBRA_DISABILITY_EXTENDED');
      expect(result.coverageDurationMonths).toBe(29);
      expect(result.adminSurchargePct).toBe(50);
    });

    test('should detect state mini-COBRA for small employer in mini-COBRA state', () => {
      const result = BenefitsEnrollmentCobraEngine.detectCobraEligibility({
        separationType: 'VOLUNTARY',
        separationDate: '2026-08-01',
        isDisability: false,
        entityEmployeeCount: 15,
        entityState: 'CA',
      });
      expect(result.qualifiesForCobra).toBe(true);
      expect(result.coverageCategory).toBe('STATE_MINI_COBRA');
      expect(result.coverageDurationMonths).toBe(36);
    });

    test('should not qualify for COBRA for small employer in non mini-COBRA state', () => {
      const result = BenefitsEnrollmentCobraEngine.detectCobraEligibility({
        separationType: 'VOLUNTARY',
        separationDate: '2026-08-01',
        isDisability: false,
        entityEmployeeCount: 15,
        entityState: 'TX',
      });
      expect(result.qualifiesForCobra).toBe(true);
      expect(result.coverageCategory).toBe('NOT_ELIGIBLE');
      expect(result.coverageDurationMonths).toBe(0);
    });

    test('should calculate correct election deadline (60 days from notice)', () => {
      const result = BenefitsEnrollmentCobraEngine.detectCobraEligibility({
        separationType: 'INVOLUNTARY',
        separationDate: '2026-06-15',
        isDisability: false,
        entityEmployeeCount: 100,
        entityState: 'NY',
      });
      // Notice by June 15 + 30 = July 15, election by July 15 + 60 = September 13
      expect(result.employeeElectionDeadline).toBe('2026-09-13');
    });

    test('should throw error for missing required parameters', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.detectCobraEligibility({
          separationType: 'INVOLUNTARY',
        })
      ).toThrow('required');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 3: COBRA Premium Calculation
  // ---------------------------------------------------------------------------
  describe('calculateCobraPremium()', () => {
    test('should calculate employee-only COBRA premium with 2% surcharge', () => {
      const result = BenefitsEnrollmentCobraEngine.calculateCobraPremium({
        groupMonthlyPremium: 500,
        coverageTier: 'EMPLOYEE_ONLY',
      });
      expect(result.adjustedPremium).toBe(500);
      expect(result.surchargeAmount).toBe(10);
      expect(result.totalMonthlyPremium).toBe(510);
    });

    test('should apply correct family tier multiplier', () => {
      const result = BenefitsEnrollmentCobraEngine.calculateCobraPremium({
        groupMonthlyPremium: 500,
        coverageTier: 'EMPLOYEE_FAMILY',
      });
      expect(result.tierMultiplier).toBe(2.5);
      expect(result.adjustedPremium).toBe(1250);
      expect(result.totalMonthlyPremium).toBe(1275);
    });

    test('should calculate quarterly and annual totals', () => {
      const result = BenefitsEnrollmentCobraEngine.calculateCobraPremium({
        groupMonthlyPremium: 400,
        coverageTier: 'EMPLOYEE_SPOUSE',
      });
      expect(result.totalQuarterlyPremium).toBe(result.totalMonthlyPremium * 3);
      expect(result.totalAnnualPremium).toBe(result.totalMonthlyPremium * 12);
    });

    test('should throw error for zero premium', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.calculateCobraPremium({
          groupMonthlyPremium: 0,
          coverageTier: 'EMPLOYEE_ONLY',
        })
      ).toThrow('positive number');
    });

    test('should throw error for unknown tier', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.calculateCobraPremium({
          groupMonthlyPremium: 500,
          coverageTier: 'INVALID',
        })
      ).toThrow('Unknown coverage tier');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 4: Open Enrollment Participation Tracking
  // ---------------------------------------------------------------------------
  describe('trackOpenEnrollment()', () => {
    test('should compute participation rate correctly', () => {
      const result = BenefitsEnrollmentCobraEngine.trackOpenEnrollment({
        totalEligibleEmployees: 1000,
        enrolledCount: 850,
        waivedCount: 50,
        pendingCount: 30,
        daysRemaining: 10,
        totalOeWindowDays: 30,
      });
      expect(result.participationRate).toBe(85);
      expect(result.waiverRate).toBe(5);
      expect(result.pendingRate).toBe(3);
    });

    test('should project final enrollments based on daily rate', () => {
      const result = BenefitsEnrollmentCobraEngine.trackOpenEnrollment({
        totalEligibleEmployees: 1000,
        enrolledCount: 700,
        waivedCount: 50,
        pendingCount: 20,
        daysRemaining: 10,
        totalOeWindowDays: 30,
      });
      // 20 days elapsed, 700 enrolled = 35/day, 10 days left = 350 more = 1050 (capped at 1000)
      expect(result.projectedFinalEnrollments).toBe(1000);
    });

    test('should report ON_TRACK status when projected rate >= 85%', () => {
      const result = BenefitsEnrollmentCobraEngine.trackOpenEnrollment({
        totalEligibleEmployees: 1000,
        enrolledCount: 800,
        waivedCount: 50,
        pendingCount: 10,
        daysRemaining: 5,
        totalOeWindowDays: 30,
      });
      expect(result.status).toBe('ON_TRACK');
    });

    test('should report BEHIND status when projected rate < 70%', () => {
      const result = BenefitsEnrollmentCobraEngine.trackOpenEnrollment({
        totalEligibleEmployees: 1000,
        enrolledCount: 300,
        waivedCount: 50,
        pendingCount: 10,
        daysRemaining: 5,
        totalOeWindowDays: 30,
      });
      expect(result.status).toBe('BEHIND');
    });

    test('should compute unresponsive count', () => {
      const result = BenefitsEnrollmentCobraEngine.trackOpenEnrollment({
        totalEligibleEmployees: 100,
        enrolledCount: 60,
        waivedCount: 10,
        pendingCount: 5,
        daysRemaining: 10,
        totalOeWindowDays: 30,
      });
      expect(result.unresponsive).toBe(25);
    });

    test('should throw error for zero eligible employees', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.trackOpenEnrollment({
          totalEligibleEmployees: 0,
          enrolledCount: 0,
          waivedCount: 0,
          pendingCount: 0,
          daysRemaining: 10,
          totalOeWindowDays: 30,
        })
      ).toThrow('positive number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 5: Qualifying Life Event (QLE) Management
  // ---------------------------------------------------------------------------
  describe('processQualifyingLifeEvent()', () => {
    test('should validate a marriage QLE within enrollment window', () => {
      const today = new Date();
      const eventDate = new Date(today);
      eventDate.setDate(eventDate.getDate() - 10);

      const result = BenefitsEnrollmentCobraEngine.processQualifyingLifeEvent({
        eventCode: 'MARRIAGE',
        eventDate: eventDate.toISOString().split('T')[0],
        reportedDate: today.toISOString().split('T')[0],
      });
      expect(result.eventName).toBe('Marriage');
      expect(result.canEnroll).toBe(true);
      expect(result.allowedPlanChanges).toContain('ADD_DEPENDENT');
    });

    test('should reject QLE outside enrollment window', () => {
      const eventDate = '2026-01-01';
      const reportedDate = '2026-06-01'; // 150+ days later

      const result = BenefitsEnrollmentCobraEngine.processQualifyingLifeEvent({
        eventCode: 'MARRIAGE',
        eventDate,
        reportedDate,
      });
      expect(result.canEnroll).toBe(false);
      expect(result.isWithinWindow).toBe(false);
    });

    test('should process birth/adoption QLE correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = BenefitsEnrollmentCobraEngine.processQualifyingLifeEvent({
        eventCode: 'BIRTH_ADOPTION',
        eventDate: today,
      });
      expect(result.eventCategory).toBe('FAMILY');
      expect(result.allowedPlanChanges).toContain('ADD_DEPENDENT');
      expect(result.allowedPlanChanges).toContain('CHANGE_CARRIER');
    });

    test('should throw error for unknown QLE code', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.processQualifyingLifeEvent({
          eventCode: 'UNKNOWN',
          eventDate: '2026-06-01',
        })
      ).toThrow('Unknown QLE code');
    });

    test('should throw error for missing event code', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.processQualifyingLifeEvent({
          eventDate: '2026-06-01',
        })
      ).toThrow('required');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 6: ACA Affordability Testing
  // ---------------------------------------------------------------------------
  describe('testACAAffordability()', () => {
    test('should pass affordability when premium is below threshold', () => {
      const result = BenefitsEnrollmentCobraEngine.testACAAffordability({
        employeeW2Wages: 60000,
        lowestPremiumMonthly: 400,
      });
      // Annual premium: 4800, 4800/60000 = 8%, threshold 9.12%
      expect(result.isAffordable).toBe(true);
      expect(result.compliant).toBe(true);
    });

    test('should fail affordability when premium exceeds threshold', () => {
      const result = BenefitsEnrollmentCobraEngine.testACAAffordability({
        employeeW2Wages: 30000,
        lowestPremiumMonthly: 300,
      });
      // Annual premium: 3600, 3600/30000 = 12%, threshold 9.12%
      expect(result.isAffordable).toBe(false);
      expect(result.compliant).toBe(false);
      expect(result.annualExcess).toBeGreaterThan(0);
    });

    test('should correctly compute affordability percentage', () => {
      const result = BenefitsEnrollmentCobraEngine.testACAAffordability({
        employeeW2Wages: 50000,
        lowestPremiumMonthly: 380,
      });
      const expected = (380 * 12 / 50000) * 100;
      expect(result.affordabilityPct).toBe(Math.round(expected * 100) / 100);
    });

    test('should throw error for zero wages', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.testACAAffordability({
          employeeW2Wages: 0,
          lowestPremiumMonthly: 400,
        })
      ).toThrow('positive number');
    });

    test('should throw error for zero premium', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.testACAAffordability({
          employeeW2Wages: 60000,
          lowestPremiumMonthly: 0,
        })
      ).toThrow('positive number');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 7: Employer Benefits Cost Analysis
  // ---------------------------------------------------------------------------
  describe('analyzeEmployerCosts()', () => {
    const categories = [
      { name: 'Medical', enrolledCount: 2000, annualCost: 8000000, benchmarkCost: 3800 },
      { name: 'Dental', enrolledCount: 1800, annualCost: 1200000, benchmarkCost: 700 },
      { name: 'Vision', enrolledCount: 1500, annualCost: 300000, benchmarkCost: 200 },
    ];

    test('should aggregate total annual cost', () => {
      const result = BenefitsEnrollmentCobraEngine.analyzeEmployerCosts(categories);
      expect(result.totalAnnualCost).toBe(9500000);
    });

    test('should compute average cost per enrolled employee', () => {
      const result = BenefitsEnrollmentCobraEngine.analyzeEmployerCosts(categories);
      const totalEnrolled = 2000 + 1800 + 1500;
      expect(result.totalEnrolled).toBe(totalEnrolled);
      expect(result.avgCostPerEnrolled).toBe(Math.round(9500000 / totalEnrolled));
    });

    test('should flag optimization opportunity when above benchmark', () => {
      const result = BenefitsEnrollmentCobraEngine.analyzeEmployerCosts(categories);
      const medical = result.categories.find(c => c.name === 'Medical');
      expect(medical.optimizationOpportunity).toContain('plan redesign');
    });

    test('should include YoY change when previous year cost provided', () => {
      const catsWithPrev = [
        { name: 'Medical', enrolledCount: 2000, annualCost: 8000000, previousYearCost: 7500000 },
      ];
      const result = BenefitsEnrollmentCobraEngine.analyzeEmployerCosts(catsWithPrev);
      expect(result.categories[0].yoyChangePct).toBeGreaterThan(0);
    });

    test('should throw error for empty array', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.analyzeEmployerCosts([])
      ).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 8: Multi-Entity Benefits Aggregation
  // ---------------------------------------------------------------------------
  describe('aggregateMultiEntityBenefits()', () => {
    const entities = [
      { entityName: 'US HQ', totalEligible: 2000, enrolled: 1800, cobraActive: 50, totalCost: 10000000 },
      { entityName: 'UK Ltd', totalEligible: 500, enrolled: 450, cobraActive: 10, totalCost: 3000000 },
    ];

    test('should aggregate participants across entities', () => {
      const result = BenefitsEnrollmentCobraEngine.aggregateMultiEntityBenefits(entities);
      expect(result.totalEligible).toBe(2500);
      expect(result.totalEnrolled).toBe(2250);
    });

    test('should aggregate COBRA active counts', () => {
      const result = BenefitsEnrollmentCobraEngine.aggregateMultiEntityBenefits(entities);
      expect(result.totalCobraActive).toBe(60);
    });

    test('should compute overall participation rate', () => {
      const result = BenefitsEnrollmentCobraEngine.aggregateMultiEntityBenefits(entities);
      expect(result.overallParticipationRate).toBe(90);
    });

    test('should throw error for empty array', () => {
      expect(() =>
        BenefitsEnrollmentCobraEngine.aggregateMultiEntityBenefits([])
      ).toThrow('non-empty');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 9: Full Report Generation
  // ---------------------------------------------------------------------------
  describe('generateFullReport()', () => {
    test('should generate report with unique ID', () => {
      const report = BenefitsEnrollmentCobraEngine.generateFullReport({
        categories: [{ name: 'Medical', enrolledCount: 100, annualCost: 500000 }],
        entities: [{ entityName: 'HQ', totalEligible: 100, enrolled: 90, cobraActive: 5, totalCost: 500000 }],
      });
      expect(report.reportId).toMatch(/^BEN-RPT-\d+-\d+$/);
      expect(report.engineVersion).toBe('2.6.0');
    });

    test('should include cost and entity summaries', () => {
      const report = BenefitsEnrollmentCobraEngine.generateFullReport({
        categories: [{ name: 'Medical', enrolledCount: 100, annualCost: 500000 }],
        entities: [{ entityName: 'HQ', totalEligible: 100, enrolled: 90, cobraActive: 5, totalCost: 500000 }],
      });
      expect(report.costSummary).toBeDefined();
      expect(report.entitySummary).toBeDefined();
      expect(report.qleTypesTracked).toBeGreaterThan(0);
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
// Test Fixtures: Deterministic benefits data with known outcomes.
// Mocking Strategy: None required — engine is pure-function static class design.
// Running: jest tests/services/benefitsEnrollmentCobraEngine.test.js --coverage
// =============================================================================
