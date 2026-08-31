/**
 * Unit Tests for POS Network Signal Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculatePosNetworkSignalMetrics } from './posNetworkSignalUtils';

describe('PosNetworkSignalUtils', () => {
  it('should activate cellular 5G failover when primary Ethernet LAN is offline', () => {
    const res = calculatePosNetworkSignalMetrics('TERM-POS-801', -75, false);
    expect(res.terminalId).toBe('TERM-POS-801');
    expect(res.isFailoverActivated).toBe(true);
    expect(res.primaryConnectionType).toBe('CELLULAR_LTE_5G');
  });
});
