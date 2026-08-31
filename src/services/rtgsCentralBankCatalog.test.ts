/**
 * Unit Tests for RTGS Central Bank Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { validateRtgsNetworkClearing, RTGS_CENTRAL_BANK_NETWORKS_CATALOG } from './rtgsCentralBankCatalog';

describe('RtgsCentralBankCatalog', () => {
  it('should validate FedWire RTGS central bank network CBDC support', () => {
    const supported = validateRtgsNetworkClearing('RTGS-FEDWIRE');
    expect(supported).toBe(true);
  });

  it('should contain catalog of global central bank RTGS clearing networks', () => {
    expect(RTGS_CENTRAL_BANK_NETWORKS_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
