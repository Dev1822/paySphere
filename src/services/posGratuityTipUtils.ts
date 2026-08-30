/**
 * Restaurant & Hospitality POS Gratuity Tip Allocation Utilities
 */

import { calculatePosTerminalDailyBatchTotals } from './posTerminalService';

export interface PosGratuityTipMetrics {
  serverEmployeeId: string;
  totalGrossSalesUSD: number;
  tipPercentage: number;
  calculatedTipAmountUSD: number;
  netPayoutWithTipUSD: number;
}

/**
 * Calculates POS restaurant tip allocation and server payout.
 */
export function calculatePosGratuityTipAllocation(
  serverId: string,
  grossSalesUSD: number,
  tipPct = 18.0
): PosGratuityTipMetrics {
  const tip = Math.round(grossSalesUSD * (tipPct / 100.0) * 100) / 100;
  const net = Math.round((grossSalesUSD + tip) * 100) / 100;

  return {
    serverEmployeeId: serverId,
    totalGrossSalesUSD: grossSalesUSD,
    tipPercentage: tipPct,
    calculatedTipAmountUSD: tip,
    netPayoutWithTipUSD: net,
  };
}
