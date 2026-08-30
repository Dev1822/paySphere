/**
 * Enterprise Payroll Tax & Direct Deposit Command Center Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluatePayrollTaxWithholding,
  calculateDirectDepositNetPayUSD,
  generatePayrollW2TaxAuditReport,
  EMPLOYEE_TAX_FILING_STATUS,
} from '../services/payrollTaxService';

export default function PayrollTaxDashboard() {
  const [employee, setEmployee] = useState({
    employeeId: 'EMP-PAY-881',
    employeeName: 'David Banner',
    grossSalaryUSD: 9200.00,
    filingStatus: EMPLOYEE_TAX_FILING_STATUS.SINGLE,
    federalTaxExemptions: 2,
    stateTaxRatePercent: 5.0,
    medicareFicaRatePercent: 1.45,
    socialSecurityFicaRatePercent: 6.2,
    processedAt: new Date().toISOString(),
  });

  const withholding = evaluatePayrollTaxWithholding(employee);
  const netPay = calculateDirectDepositNetPayUSD(employee.grossSalaryUSD, withholding.totalTaxWithheldUSD, 450.00);
  const auditReport = generatePayrollW2TaxAuditReport(employee.employeeId, employee.employeeName, 110400.00, 28500.00);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#0F172A', margin: 0 }}>📊 Enterprise Payroll Tax & ACH Command Center</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Federal & state income tax withholding calculations, FICA deductions, ACH net pay clearing, and W-2 audit reports.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Direct Deposit Net Pay</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>${netPay.netPayUSD.toFixed(2)} USD</h2>
          <small style={{ color: '#64748B' }}>Gross: ${employee.grossSalaryUSD.toFixed(2)}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #DC2626' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Total Taxes Withheld</span>
          <h2 style={{ color: '#DC2626', margin: '4px 0 0 0' }}>${withholding.totalTaxWithheldUSD.toFixed(2)} USD</h2>
          <small style={{ color: '#64748B' }}>Fed: ${withholding.federalTaxWithheldUSD.toFixed(2)} | State: ${withholding.stateTaxWithheldUSD.toFixed(2)}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>FICA Social Security & Medicare</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>${(withholding.socialSecurityWithheldUSD + withholding.medicareWithheldUSD).toFixed(2)} USD</h2>
          <small style={{ color: '#64748B' }}>SS: ${withholding.socialSecurityWithheldUSD.toFixed(2)} | Med: ${withholding.medicareWithheldUSD.toFixed(2)}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #059669' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Annual W-2 Status</span>
          <h2 style={{ color: '#059669', margin: '4px 0 0 0' }}>{auditReport.irsFormStatus}</h2>
          <small style={{ color: '#64748B' }}>Annual Gross: ${auditReport.annualGrossWagesUSD.toLocaleString()}</small>
        </div>
      </div>
    </div>
  );
}
