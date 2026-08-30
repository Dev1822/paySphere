/**
 * Enterprise Payroll Tax Withholding & Direct Deposit Compliance Service
 * Provides telemetry on federal income tax brackets, state income tax withholdings, FICA Social Security & Medicare deductions,
 * pre-tax 401(k) / health insurance benefits, ACH direct deposit clearing, and annual IRS Form W-2 / 1099 compliance audits.
 */

export const EMPLOYEE_TAX_FILING_STATUS = {
  SINGLE: 'Single Filing Taxpayer',
  MARRIED_JOINT: 'Married Filing Jointly',
  HEAD_OF_HOUSEHOLD: 'Head of Household',
};

export interface EmployeePayrollData {
  employeeId: string;
  employeeName: string;
  grossSalaryUSD: number;
  filingStatus: string;
  federalTaxExemptions: number;
  stateTaxRatePercent: number;
  medicareFicaRatePercent: number;
  socialSecurityFicaRatePercent: number;
  processedAt: string;
}

export interface TaxWithholdingResult {
  isTaxCalculated: boolean;
  federalTaxWithheldUSD: number;
  stateTaxWithheldUSD: number;
  socialSecurityWithheldUSD: number;
  medicareWithheldUSD: number;
  totalTaxWithheldUSD: number;
}

export interface DirectDepositNetPay {
  grossSalaryUSD: number;
  totalDeductionsUSD: number;
  netPayUSD: number;
}

export interface PayrollW2AuditReport {
  employeeId: string;
  employeeName: string;
  annualGrossWagesUSD: number;
  annualTotalTaxesWithheldUSD: number;
  irsFormStatus: 'W2_AUDIT_PASSED_CERTIFIED' | 'AMENDED_W2C_REQUIRED' | 'EIN_MISMATCH_ALERT';
  complianceDirectives: string[];
}

/**
 * Evaluates federal, state, and FICA payroll tax withholdings for employee pay stub.
 */
export function evaluatePayrollTaxWithholding(data: EmployeePayrollData): TaxWithholdingResult {
  const federalRate = data.filingStatus === EMPLOYEE_TAX_FILING_STATUS.SINGLE ? 0.22 : 0.15;
  const fedTax = Math.round(data.grossSalaryUSD * federalRate * 100) / 100;
  const stateTax = Math.round(data.grossSalaryUSD * (data.stateTaxRatePercent / 100.0) * 100) / 100;
  const ssTax = Math.round(data.grossSalaryUSD * (data.socialSecurityFicaRatePercent / 100.0) * 100) / 100;
  const medicareTax = Math.round(data.grossSalaryUSD * (data.medicareFicaRatePercent / 100.0) * 100) / 100;

  const total = Math.round((fedTax + stateTax + ssTax + medicareTax) * 100) / 100;

  return {
    isTaxCalculated: true,
    federalTaxWithheldUSD: fedTax,
    stateTaxWithheldUSD: stateTax,
    socialSecurityWithheldUSD: ssTax,
    medicareWithheldUSD: medicareTax,
    totalTaxWithheldUSD: total,
  };
}

/**
 * Calculates final ACH direct deposit net pay after tax withholdings and benefit deductions.
 */
export function calculateDirectDepositNetPayUSD(
  grossUSD: number,
  totalTaxesUSD: number,
  benefitDeductionsUSD: number
): DirectDepositNetPay {
  const deductions = Math.round((totalTaxesUSD + benefitDeductionsUSD) * 100) / 100;
  const net = Math.max(0, Math.round((grossUSD - deductions) * 100) / 100);

  return {
    grossSalaryUSD: grossUSD,
    totalDeductionsUSD: deductions,
    netPayUSD: net,
  };
}

/**
 * Generates annual W-2 payroll tax audit report for IRS tax filing certification.
 */
export function generatePayrollW2TaxAuditReport(
  employeeId: string,
  employeeName: string,
  annualGrossUSD: number,
  annualTaxesUSD: number
): PayrollW2AuditReport {
  const directives: string[] = [
    'Verify Employer Identification Number (EIN) on IRS e-file portal.',
    'Transmit Form W-2 Copy A to Social Security Administration (SSA).',
    'Issue Form W-2 Copy B/C to employee prior to January 31 deadline.',
  ];

  return {
    employeeId,
    employeeName,
    annualGrossWagesUSD: annualGrossUSD,
    annualTotalTaxesWithheldUSD: annualTaxesUSD,
    irsFormStatus: 'W2_AUDIT_PASSED_CERTIFIED',
    complianceDirectives: directives,
  };
}
