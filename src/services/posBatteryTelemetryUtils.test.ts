/**
 * Unit Tests for POS Battery Telemetry Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculatePosBatteryTelemetry } from './posBatteryTelemetryUtils';

describe('PosBatteryTelemetryUtils', () => {
  it('should flag critical battery shutdown alert when battery < 15% and unplugged', () => {
    const res = calculatePosBatteryTelemetry('TERM-MOB-99', 10, false);
    expect(res.terminalId).toBe('TERM-MOB-99');
    expect(res.batteryHealthStatus).toBe('CRITICAL_BATTERY_SHUTDOWN');
  });
});
