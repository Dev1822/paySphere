/**
 * Crypto Multi-Asset Custody & Staking Dashboard Component
 */

import React, { useState } from 'react';
import {
  evaluateCryptoStakingYieldRewards,
  calculateCustodyWalletBalanceUSD,
  generateCustodySecurityAuditReport,
  CRYPTO_ASSET_TYPES,
} from '../services/cryptoCustodyService';

export default function CryptoCustodyDashboard() {
  const [wallet, setWallet] = useState({
    walletId: 'WAL-ETH-502',
    merchantId: 'MERCHANT-901',
    assetType: CRYPTO_ASSET_TYPES.ETHEREUM_STAKING,
    tokenBalance: 120.0,
    tokenPriceUsd: 3450.0,
    annualPercentageYieldPercent: 5.4,
    stakedAtISO: new Date().toISOString(),
  });

  const yieldMetrics = evaluateCryptoStakingYieldRewards(wallet, 60);
  const balanceUSD = calculateCustodyWalletBalanceUSD(wallet.tokenBalance, wallet.tokenPriceUsd);
  const securityReport = generateCustodySecurityAuditReport(wallet.walletId, 'FIREBLOCKS_MPC_VAULT', 3, 5);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F8FAFC' }}>
      <header style={{ marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
        <h1 style={{ color: '#7C3AED', margin: 0 }}>⛓️ Crypto Multi-Asset Custody & Staking Hub</h1>
        <p style={{ color: '#64748B', marginTop: '6px' }}>
          Multi-sig cold storage telemetry, Proof-of-Stake yield rewards, spot balances, and MPC security audits.
        </p>
      </header>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #7C3AED' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Total Custody Value</span>
          <h2 style={{ color: '#7C3AED', margin: '4px 0 0 0' }}>${balanceUSD.totalValueUSD.toLocaleString()} USD</h2>
          <small style={{ color: '#64748B' }}>Balance: {wallet.tokenBalance} Tokens</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #16A34A' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Est. Annual Staking Yield</span>
          <h2 style={{ color: '#16A34A', margin: '4px 0 0 0' }}>${yieldMetrics.projectedAnnualYieldUSD.toLocaleString()} USD</h2>
          <small style={{ color: '#64748B' }}>APY: {wallet.annualPercentageYieldPercent}%</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563EB' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Monthly Yield Disbursed</span>
          <h2 style={{ color: '#2563EB', margin: '4px 0 0 0' }}>${yieldMetrics.projectedMonthlyYieldUSD.toLocaleString()} USD</h2>
          <small style={{ color: '#64748B' }}>Accrued Tokens: {yieldMetrics.accruedYieldTokenCount}</small>
        </div>

        <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #059669' }}>
          <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Custody Security Standard</span>
          <h2 style={{ color: '#059669', margin: '4px 0 0 0' }}>{securityReport.securityLevel}</h2>
          <small style={{ color: '#64748B' }}>Multi-Sig ({securityReport.requiredSignatures}/{securityReport.totalKeyholders})</small>
        </div>
      </div>
    </div>
  );
}
