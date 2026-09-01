/**
 * Point-of-Sale (POS) Terminal EMV & NFC Telemetry Command Center Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluatePosTerminalTransaction,
  calculatePosTerminalDailyBatchTotals,
  generatePosEmvChipSecurityAuditReport,
  POS_ENTRY_MODES,
} from '../services/posTerminalService';

export default function PosTerminalDashboard() {
  const [transaction, setTransaction] = useState({
    transactionId: 'POS-TXN-402',
    terminalId: 'TERM-POS-801',
    merchantStoreId: 'STORE-SFO-09',
    transactionAmountUSD: 185.00,
    entryMode: POS_ENTRY_MODES.CONTACTLESS_NFC_TAP,
    emvCryptogram: 'A8B9C0D1E2F345678901',
    isPinVerified: true,
    processedAt: new Date().toISOString(),
  });

  const posResult = evaluatePosTerminalTransaction(transaction);
  const batchTotals = calculatePosTerminalDailyBatchTotals(transaction.terminalId, 128, 14250.00);
  const auditReport = generatePosEmvChipSecurityAuditReport(transaction.terminalId, 'v4.1.0', true);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#D97706', margin: 0 }}>🏪 POS Terminal EMV & NFC Telemetry Hub</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          In-person EMV chip reader telemetry, contactless NFC tap processing, batch reconciliation, and PCI-P2PE audits.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Transaction Approval</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>{posResult.terminalStatus}</h2>
          <small style={{ color: '#64748B' }}>Auth Code: {posResult.authorizationCode}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Daily Batch Total</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>${batchTotals.totalBatchAmountUSD.toLocaleString()} USD</h2>
          <small style={{ color: '#64748B' }}>Avg Ticket: ${batchTotals.averageTicketSizeUSD.toFixed(2)} ({batchTotals.transactionCount} Txns)</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #D97706' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Interchange Fee</span>
          <h2 style={{ color: '#D97706', margin: '4px 0 0 0' }}>${posResult.interchangeFeeUSD.toFixed(2)} USD</h2>
          <small style={{ color: '#64748B' }}>Entry: {transaction.entryMode}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #059669' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>PCI-P2PE Hardware Encryption</span>
          <h2 style={{ color: '#059669', margin: '4px 0 0 0' }}>{auditReport.pciP2peComplianceStatus}</h2>
          <small style={{ color: '#64748B' }}>Firmware: {auditReport.firmwareVersion}</small>
        </div>
      </div>
    </div>
  );
}
