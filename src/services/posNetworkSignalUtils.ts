/**
 * POS Terminal Cellular 4G/5G Signal Strength & Failover Connectivity Utilities
 */

export interface PosNetworkSignalMetrics {
  terminalId: string;
  primaryConnectionType: 'ETHERNET_LAN' | 'WIFI_COMMERCIAL' | 'CELLULAR_LTE_5G';
  signalStrengthDbm: number;
  isFailoverActivated: boolean;
}

/**
 * Monitors POS network connection signal strength and cellular 4G/5G failover state.
 */
export function calculatePosNetworkSignalMetrics(
  terminalId: string,
  signalDbm: number,
  isLanOnline: boolean
): PosNetworkSignalMetrics {
  const failover = !isLanOnline;
  const connType = failover ? 'CELLULAR_LTE_5G' : 'ETHERNET_LAN';

  return {
    terminalId,
    primaryConnectionType: connType,
    signalStrengthDbm: signalDbm,
    isFailoverActivated: failover,
  };
}
