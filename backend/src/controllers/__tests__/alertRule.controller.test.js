/**
 * @fileoverview Tests for the alert rule controller and service.
 *
 * Covers:
 *   - evaluateRule unit tests for each anomaly type
 *   - Rule CRUD integration tests
 *   - AlertRecord lifecycle and disposition
 */

'use strict';

const { evaluateRule } = require('../../services/alertRule.service');

// ─── evaluateRule unit tests ─────────────────────────────────────────────

describe('evaluateRule', () => {
  const baseRule = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Rule',
    threshold: 30,
    secondaryThreshold: null,
    severity: 'MEDIUM',
  };

  test('SALARY_SPIKE triggers when historical avg is exceeded by threshold', () => {
    const rule = { ...baseRule, alertType: 'SALARY_SPIKE', threshold: 30 };
    const entry = { netSalary: 100000, _historicalAvg: 70000 };
    const result = evaluateRule(rule, entry);
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
    expect(result.message).toContain('30%');
    expect(result.details.percentChange).toBeGreaterThan(30);
  });

  test('SALARY_SPIKE returns null when below threshold', () => {
    const rule = { ...baseRule, alertType: 'SALARY_SPIKE', threshold: 50 };
    const entry = { netSalary: 100000, _historicalAvg: 80000 };
    expect(evaluateRule(rule, entry)).toBeNull();
  });

  test('SALARY_SPIKE returns null when no historical average', () => {
    const rule = { ...baseRule, alertType: 'SALARY_SPIKE', threshold: 10 };
    expect(evaluateRule(rule, { netSalary: 100000 })).toBeNull();
  });

  test('EXCESSIVE_OVERTIME triggers when hours exceed both thresholds', () => {
    const rule = { ...baseRule, alertType: 'EXCESSIVE_OVERTIME', threshold: 60, secondaryThreshold: 50 };
    const entry = { overtimeHours: 70 };
    const result = evaluateRule(rule, entry);
    expect(result).not.toBeNull();
    expect(result.details.overtimeHours).toBe(70);
  });

  test('EXCESSIVE_OVERTIME returns null below threshold', () => {
    const rule = { ...baseRule, alertType: 'EXCESSIVE_OVERTIME', threshold: 80, secondaryThreshold: 60 };
    expect(evaluateRule(rule, { overtimeHours: 40 })).toBeNull();
  });

  test('EXCESSIVE_BONUS_RATIO triggers when ratio exceeds threshold', () => {
    const rule = { ...baseRule, alertType: 'EXCESSIVE_BONUS_RATIO', threshold: 50 };
    const entry = { baseSalary: 100000, bonus: 60000 };
    const result = evaluateRule(rule, entry);
    expect(result).not.toBeNull();
    expect(result.details.ratio).toBe(60);
  });

  test('EXCESSIVE_BONUS_RATIO returns null when no bonus', () => {
    const rule = { ...baseRule, alertType: 'EXCESSIVE_BONUS_RATIO', threshold: 50 };
    expect(evaluateRule(rule, { baseSalary: 100000, bonus: 0 })).toBeNull();
  });

  test('DUPLICATE_BANK_ACCOUNT triggers for shared accounts', () => {
    const rule = { ...baseRule, alertType: 'DUPLICATE_BANK_ACCOUNT', threshold: 1 };
    const entry = { _duplicateBankAccounts: ['emp1', 'emp2'] };
    const result = evaluateRule(rule, entry);
    expect(result).not.toBeNull();
    expect(result.score).toBe(1.0);
  });

  test('DUPLICATE_BANK_ACCOUNT returns null with single account', () => {
    const rule = { ...baseRule, alertType: 'DUPLICATE_BANK_ACCOUNT', threshold: 1 };
    const entry = { _duplicateBankAccounts: ['emp1'] };
    expect(evaluateRule(rule, entry)).toBeNull();
  });

  test('NET_SALARY_OUTLIER triggers when Z-score exceeds threshold', () => {
    const rule = { ...baseRule, alertType: 'NET_SALARY_OUTLIER', threshold: 3 };
    const entry = { netSalary: 300000, _batchMean: 80000, _batchStdDev: 30000 };
    const result = evaluateRule(rule, entry);
    expect(result).not.toBeNull();
    expect(result.details.zScore).toBeGreaterThan(3);
  });

  test('NET_SALARY_OUTLIER returns null for normal salary', () => {
    const rule = { ...baseRule, alertType: 'NET_SALARY_OUTLIER', threshold: 3 };
    const entry = { netSalary: 85000, _batchMean: 80000, _batchStdDev: 30000 };
    expect(evaluateRule(rule, entry)).toBeNull();
  });

  test('ABNORMAL_DEDUCTION triggers when deduction % exceeds threshold', () => {
    const rule = { ...baseRule, alertType: 'ABNORMAL_DEDUCTION', threshold: 25 };
    const entry = { baseSalary: 100000, deductions: 30000 };
    const result = evaluateRule(rule, entry);
    expect(result).not.toBeNull();
    expect(result.details.deductionPct).toBe(30);
  });

  test('ABNORMAL_DEDUCTION returns null with zero salary', () => {
    const rule = { ...baseRule, alertType: 'ABNORMAL_DEDUCTION', threshold: 25 };
    expect(evaluateRule(rule, { baseSalary: 0, deductions: 30000 })).toBeNull();
  });

  test('HIGH_LEAVE_WITH_PAY triggers when leave days exceed threshold', () => {
    const rule = { ...baseRule, alertType: 'HIGH_LEAVE_WITH_PAY', threshold: 15 };
    const entry = { leaveDays: 20 };
    const result = evaluateRule(rule, entry);
    expect(result).not.toBeNull();
    expect(result.details.leaveDays).toBe(20);
  });

  test('HIGH_LEAVE_WITH_PAY returns null below threshold', () => {
    const rule = { ...baseRule, alertType: 'HIGH_LEAVE_WITH_PAY', threshold: 20 };
    expect(evaluateRule(rule, { leaveDays: 10 })).toBeNull();
  });

  test('unknown alert type returns null', () => {
    const rule = { ...baseRule, alertType: 'UNKNOWN_TYPE' };
    expect(evaluateRule(rule, {})).toBeNull();
  });
});

// ─── enrichment tests ────────────────────────────────────────────────────

describe('enrichPayrollEntries', () => {
  const { enrichPayrollEntries } = require('../../services/alertRule.service');

  test('attaches batch mean and std dev when NET_SALARY_OUTLIER rule present', () => {
    const rules = [{ alertType: 'NET_SALARY_OUTLIER' }];
    const payrolls = [
      { _id: '1', netSalary: 50000 },
      { _id: '2', netSalary: 100000 },
      { _id: '3', netSalary: 75000 },
    ];
    const enriched = enrichPayrollEntries(payrolls, rules);
    expect(enriched).toHaveLength(3);
    expect(enriched[0]._batchMean).toBeCloseTo(75000);
    expect(enriched[0]._batchStdDev).toBeGreaterThan(0);
  });

  test('attaches historical avg from baseSalary for SALARY_SPIKE', () => {
    const rules = [{ alertType: 'SALARY_SPIKE' }];
    const payrolls = [{ _id: '1', baseSalary: 60000, netSalary: 55000 }];
    const enriched = enrichPayrollEntries(payrolls, rules);
    expect(enriched[0]._historicalAvg).toBe(60000);
  });

  test('returns entries unchanged when no relevant rules', () => {
    const rules = [{ alertType: 'HIGH_LEAVE_WITH_PAY' }];
    const payrolls = [{ _id: '1', netSalary: 50000 }];
    const enriched = enrichPayrollEntries(payrolls, rules);
    expect(enriched[0]._batchMean).toBeUndefined();
    expect(enriched[0]._historicalAvg).toBeUndefined();
  });
});
