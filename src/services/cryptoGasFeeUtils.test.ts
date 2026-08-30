/**
 * Unit Tests for Crypto Gas Fee Utilities
 */

import { describe, it, expect } from 'vitest';
import { estimateBlockchainGasFee } from './cryptoGasFeeUtils';

describe('CryptoGasFeeUtils', () => {
  it('should calculate Ethereum mainnet gas fee in USD', () => {
    const res = estimateBlockchainGasFee('Ethereum Mainnet', 3000, 21000);
    expect(res.baseFeeGwei).toBe(25);
    expect(res.estimatedTransactionFeeUSD).toBeGreaterThan(1.50);
  });
});
