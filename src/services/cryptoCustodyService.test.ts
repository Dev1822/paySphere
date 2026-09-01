/**
 * Crypto Multi-Asset Custody Wallet & Staking Yield Engine Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCryptoStakingYieldRewards,
  calculateCustodyWalletBalanceUSD,
  generateCustodySecurityAuditReport,
  CRYPTO_ASSET_TYPES,
} from './cryptoCustodyService';

describe('CryptoCustodyService', () => {
  const sampleWallet = {
    walletId: 'WAL-ETH-901',
    merchantId: 'MERCHANT-8821',
    assetType: CRYPTO_ASSET_TYPES.ETHEREUM_STAKING,
    tokenBalance: 45.5,
    tokenPriceUsd: 3200.0,
    annualPercentageYieldPercent: 5.2,
    stakedAtISO: '2026-08-30T10:00:00Z',
  };

  it('should evaluate crypto staking yield rewards and projected annual return', () => {
    const yieldMetrics = evaluateCryptoStakingYieldRewards(sampleWallet, 30);

    expect(yieldMetrics).toBeDefined();
    expect(yieldMetrics.isYieldActive).toBe(true);
    expect(yieldMetrics.projectedMonthlyYieldUSD).toBeGreaterThan(500);
    expect(yieldMetrics.projectedAnnualYieldUSD).toBeGreaterThan(7000);
  });

  it('should calculate custody wallet USD balance and net asset value', () => {
    const balance = calculateCustodyWalletBalanceUSD(sampleWallet.tokenBalance, sampleWallet.tokenPriceUsd);

    expect(balance).toBeDefined();
    expect(balance.totalValueUSD).toBe(145600.00);
  });

  it('should generate crypto multi-sig cold storage custody security audit report', () => {
    const report = generateCustodySecurityAuditReport(
      sampleWallet.walletId,
      'HSM_HARDWARE_SECURITY_MODULE',
      3,
      5
    );

    expect(report).toBeDefined();
    expect(report.walletId).toBe('WAL-ETH-901');
    expect(report.isMultiSigCompliant).toBe(true);
    expect(report.securityLevel).toBe('ENTERPRISE_INSTITUTIONAL_GRADE');
  });
});
