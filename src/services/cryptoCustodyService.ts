/**
 * Crypto Multi-Asset Custody Wallet & Staking Yield Engine
 * Provides telemetry on institutional multi-sig cold storage wallets, Proof-of-Stake (PoS) yield rewards,
 * token price conversion, network gas fee estimation, and Hardware Security Module (HSM) compliance audits.
 */

export const CRYPTO_ASSET_TYPES = {
  ETHEREUM_STAKING: 'Ethereum (ETH 2.0 Staking)',
  SOLANA_VALIDATOR: 'Solana (SOL Delegated Stake)',
  BITCOIN_COLD_STORAGE: 'Bitcoin (BTC Institutional Custody)',
  USDC_STABLECOIN: 'USD Coin (USDC Yield Vault)',
};

export interface CryptoWalletData {
  walletId: string;
  merchantId: string;
  assetType: string;
  tokenBalance: number;
  tokenPriceUsd: number;
  annualPercentageYieldPercent: number;
  stakedAtISO: string;
}

export interface StakingYieldResult {
  isYieldActive: boolean;
  projectedMonthlyYieldUSD: number;
  projectedAnnualYieldUSD: number;
  accruedYieldTokenCount: number;
}

export interface WalletBalanceUSD {
  totalValueUSD: number;
  assetSymbol: string;
}

export interface CustodySecurityAuditReport {
  walletId: string;
  storageArchitecture: string;
  requiredSignatures: number;
  totalKeyholders: number;
  isMultiSigCompliant: boolean;
  securityLevel: 'ENTERPRISE_INSTITUTIONAL_GRADE' | 'SINGLE_KEY_RISK_WARNING';
}

/**
 * Evaluates crypto staking yield rewards and projected earnings.
 */
export function evaluateCryptoStakingYieldRewards(data: CryptoWalletData, daysStaked: number): StakingYieldResult {
  const annualTotalUsd = data.tokenBalance * data.tokenPriceUsd * (data.annualPercentageYieldPercent / 100.0);
  const monthlyUsd = Math.round((annualTotalUsd / 12.0) * 100) / 100;
  const annualUsd = Math.round(annualTotalUsd * 100) / 100;
  const accruedTokens = Math.round((data.tokenBalance * (data.annualPercentageYieldPercent / 100.0) * (daysStaked / 365.0)) * 10000) / 10000;

  return {
    isYieldActive: daysStaked > 0,
    projectedMonthlyYieldUSD: monthlyUsd,
    projectedAnnualYieldUSD: annualUsd,
    accruedYieldTokenCount: accruedTokens,
  };
}

/**
 * Calculates custody wallet balance in USD based on live token spot price.
 */
export function calculateCustodyWalletBalanceUSD(tokenBalance: number, tokenPriceUsd: number): WalletBalanceUSD {
  const total = Math.round(tokenBalance * tokenPriceUsd * 100) / 100;
  return {
    totalValueUSD: total,
    assetSymbol: 'USD_EQUIVALENT',
  };
}

/**
 * Generates crypto multi-sig cold storage custody security audit report.
 */
export function generateCustodySecurityAuditReport(
  walletId: string,
  storageArchitecture: string,
  requiredSigs: number,
  totalSigners: number
): CustodySecurityAuditReport {
  const multiSig = requiredSigs >= 2 && totalSigners >= 3;

  return {
    walletId,
    storageArchitecture,
    requiredSignatures: requiredSigs,
    totalKeyholders: totalSigners,
    isMultiSigCompliant: multiSig,
    securityLevel: multiSig ? 'ENTERPRISE_INSTITUTIONAL_GRADE' : 'SINGLE_KEY_RISK_WARNING',
  };
}
