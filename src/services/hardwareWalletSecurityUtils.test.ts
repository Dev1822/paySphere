/**
 * Unit Tests for Hardware Wallet Security Utilities
 */

import { describe, it, expect } from 'vitest';
import { validateHardwareWalletSecurity } from './hardwareWalletSecurityUtils';

describe('HardwareWalletSecurityUtils', () => {
  it('should validate hardware wallet firmware version integrity', () => {
    const res = validateHardwareWalletSecurity('LEDGER-PRO-99', 'v2.5.1');
    expect(res.deviceSerial).toBe('LEDGER-PRO-99');
    expect(res.isLatestFirmwareInstalled).toBe(true);
    expect(res.tamperDetectionAlert).toBe(false);
  });
});
