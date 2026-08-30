/**
 * Real-Time Merchant Payment Gateway Settlement Command Center Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateMerchantTransactionSettlement,
  calculateMerchantGatewayFeeBreakdown,
  generateMerchantPayoutAuditReport,
  PAYMENT_METHOD_TYPES,
} from '../services/paymentSettlementService';

export default function PaymentSettlementDashboard() {
  const [transaction, setTransaction] = useState({
    transactionId: 'TXN-PAY-8802',
    merchantId: 'MERCHANT-501',
    merchantName: 'Apex FinTech Global Services',
    grossAmountUSD: 450.00,
    paymentMethod: PAYMENT_METHOD_TYPES.CREDIT_CARD_VISA,
    interchangeFeePercent: 1.75,
    gatewayFixedFeeUSD: 0.35,
    processedAt: new Date().toISOString(),
  });

  const settlement = evaluateMerchantTransactionSettlement(transaction);
  const feeBreakdown = calculateMerchantGatewayFeeBreakdown(transaction.grossAmountUSD, transaction.interchangeFeePercent, transaction.gatewayFixedFeeUSD);
  const auditReport = generateMerchantPayoutAuditReport(transaction.merchantId, transaction.merchantName, 185000.00, 3600.00);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#0F172A', margin: 0 }}>💳 Merchant Payment Settlement Command Center</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Real-time transaction processing, interchange fee telemetry, gross-to-net payout calculations, and ACH batch audits.
        </p>
      </header>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Net Payout Amount</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>${settlement.netPayoutAmountUSD.toFixed(2)} USD</h2>
          <small style={{ color: '#64748B' }}>Gross: ${transaction.grossAmountUSD.toFixed(2)}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #DC2626' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Total Fee Deduction</span>
          <h2 style={{ color: '#DC2626', margin: '4px 0 0 0' }}>${feeBreakdown.totalGatewayFeeUSD.toFixed(2)} USD</h2>
          <small style={{ color: '#64748B' }}>Effective Rate: {feeBreakdown.effectiveFeePercentage}%</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Settlement Status</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>{settlement.settlementStatus}</h2>
          <small style={{ color: '#64748B' }}>Approved & Cleared</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Batch ACH Net Payout</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>${auditReport.netPayoutUSD.toLocaleString()} USD</h2>
          <small style={{ color: '#64748B' }}>{auditReport.payoutStatus}</small>
        </div>
      </div>

      {/* Payout Audit Directives */}
      <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>📜 ACH Batch Wire Audit Directives</h3>

        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          {auditReport.payoutDirectives.map((dir, idx) => (
            <li key={idx} style={{ marginBottom: '8px', color: '#334155' }}>{dir}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
