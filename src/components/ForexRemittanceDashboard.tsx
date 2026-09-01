/**
 * Cross-Border Multi-Currency Forex Remittance Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateCrossBorderRemittanceTransfer,
  calculateForexExchangeSpreadUSD,
  generateSwiftFinMessageAuditReport,
  CURRENCY_PAIR_TYPES,
} from '../services/forexRemittanceService';

export default function ForexRemittanceDashboard() {
  const [remittance, setRemittance] = useState({
    remittanceId: 'REM-SWIFT-802',
    senderMerchantId: 'MERCHANT-771',
    recipientBankBic: 'CHASUS33XXX',
    sourceCurrency: CURRENCY_PAIR_TYPES.USD_TO_EUR.source,
    targetCurrency: CURRENCY_PAIR_TYPES.USD_TO_EUR.target,
    sendAmountUSD: 75000.00,
    spotExchangeRate: 0.92,
    forexSpreadPercent: 0.85,
    swiftWireFeeUSD: 40.00,
    processedAt: new Date().toISOString(),
  });

  const transfer = evaluateCrossBorderRemittanceTransfer(remittance);
  const spread = calculateForexExchangeSpreadUSD(remittance.sendAmountUSD, remittance.forexSpreadPercent);
  const swiftReport = generateSwiftFinMessageAuditReport(remittance.remittanceId, remittance.recipientBankBic, remittance.sendAmountUSD, 'DE89370400440532013000');

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#0284C7', margin: 0 }}>🌍 Cross-Border Forex & SWIFT Wire Remittance Hub</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Multi-currency spot FX conversions, SWIFT MT103 wire telemetry, IBAN/BIC validation, and OFAC compliance screening.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #0284C7' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Gross Target Amount</span>
          <h2 style={{ color: '#0284C7', margin: '4px 0 0 0' }}>€{transfer.grossTargetCurrencyAmount.toLocaleString()} EUR</h2>
          <small style={{ color: '#64748B' }}>Send USD: ${remittance.sendAmountUSD.toLocaleString()}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Net Received Beneficiary EUR</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>€{transfer.netReceivedTargetCurrencyAmount.toLocaleString()} EUR</h2>
          <small style={{ color: '#64748B' }}>Spot Rate: {remittance.spotExchangeRate}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>FX Spread Fee Revenue</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>${spread.forexSpreadFeeUSD.toFixed(2)} USD</h2>
          <small style={{ color: '#64748B' }}>Spread: {remittance.forexSpreadPercent}%</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>SWIFT MT103 Status</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>{swiftReport.swiftMt103Status}</h2>
          <small style={{ color: '#64748B' }}>BIC: {swiftReport.recipientBankBic}</small>
        </div>
      </div>
    </div>
  );
}
