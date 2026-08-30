/**
 * Enterprise Payroll Tax Withholding & Direct Deposit Compliance Service Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluatePayrollTaxWithholding,
  calculateDirectDepositNetPayUSD,
  generatePayrollW2TaxAuditReport,
  EMPLOYEE_TAX_FILING_STATUS,
} from './payrollTaxService';

describe('PayrollTaxService', () => {
  const sampleEmployee = {
    employeeId: 'EMP-PAY-1002',
    employeeName: 'Sarah Conner',
    grossSalaryUSD: 8500.00,
    filingStatus: EMPLOYEE_TAX_FILING_STATUS.SINGLE,
    federalTaxExemptions: 1,
    stateTaxRatePercent: 4.5,
    medicareFicaRatePercent: 1.45,
    socialSecurityFicaRatePercent: 6.2,
    processedAt: '2026-08-30T10:00:00Z',
  };

  it('should evaluate federal, state, and FICA payroll tax withholdings', () => {
    const withholding = evaluatePayrollTaxWithholding(sampleEmployee);

    expect(withholding).toBeDefined();
    expect(withholding.isTaxCalculated).toBe(true);
    expect(withholding.federalTaxWithheldUSD).toBeGreaterThan(1000);
    expect(withholding.socialSecurityWithheldUSD).toBe(527.00);
    expect(withholding.medicareWithheldUSD).toBe(123.25);
  });

  it('should calculate direct deposit net pay after all tax and benefit deductions', () => {
    const netPay = calculateDirectDepositNetPayUSD(
      sampleEmployee.grossSalaryUSD,
      2100.00, // Total taxes withheld
      350.00   // 401(k) + Health insurance benefit deductions
    );

    expect(netPay).toBeDefined();
    expect(netPay.netPayUSD).toBe(6050.00);
    expect(netPay.totalDeductionsUSD).toBe(2450.00);
  });

  it('should generate annual W-2 payroll tax audit report for IRS compliance', () => {
    const report = generatePayrollW2TaxAuditReport(
      sampleEmployee.employeeId,
      sampleEmployee.employeeName,
      102000.00,
      25200.00
    );

    expect(report).toBeDefined();
    expect(report.employeeId).toBe('EMP-PAY-1002');
    expect(report.irsFormStatus).toBe('W2_AUDIT_PASSED_CERTIFIED');
    expect(report.complianceDirectives.length).toBeGreaterThanOrEqual(3);
  });
});
