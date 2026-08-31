/**
 * POS Terminal Battery Level & Power Management Telemetry Utilities
 */

export interface PosBatteryTelemetryMetrics {
  terminalId: string;
  batteryPercent: number;
  isPowerConnected: boolean;
  batteryHealthStatus: 'GOOD_CHARGED' | 'LOW_BATTERY_WARNING' | 'CRITICAL_BATTERY_SHUTDOWN';
}

/**
 * Monitors POS wireless terminal battery percentage and charging state.
 */
export function calculatePosBatteryTelemetry(
  terminalId: string,
  batteryPercent: number,
  isPluggedIn: boolean
): PosBatteryTelemetryMetrics {
  let status: PosBatteryTelemetryMetrics['batteryHealthStatus'] = 'GOOD_CHARGED';
  if (batteryPercent < 15 && !isPluggedIn) status = 'CRITICAL_BATTERY_SHUTDOWN';
  else if (batteryPercent < 30 && !isPluggedIn) status = 'LOW_BATTERY_WARNING';

  return {
    terminalId,
    batteryPercent,
    isPowerConnected: isPluggedIn,
    batteryHealthStatus: status,
  };
}
