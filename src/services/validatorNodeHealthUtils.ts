/**
 * Crypto Staking Validator Node Health & Uptime Telemetry Utilities
 */

export interface ValidatorNodeHealthMetrics {
  validatorAddress: string;
  uptimePercent: number;
  slashingRiskAlert: boolean;
  totalDelegatedStakeTokens: number;
}

/**
 * Monitors Proof-of-Stake validator node health and uptime percentage.
 */
export function evaluateValidatorNodeHealth(
  validatorAddress: string,
  blocksSignedCount: number,
  totalBlocksExpected: number
): ValidatorNodeHealthMetrics {
  const uptime = totalBlocksExpected > 0 ? Math.round((blocksSignedCount / totalBlocksExpected) * 100.0 * 10) / 10 : 0;
  const slashing = uptime < 98.0;

  return {
    validatorAddress,
    uptimePercent: uptime,
    slashingRiskAlert: slashing,
    totalDelegatedStakeTokens: 450000.0,
  };
}
