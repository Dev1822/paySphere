/**
 * Unit Tests for Cross-Chain Bridge Utilities
 */

import { describe, it, expect } from 'vitest';
import { executeCrossChainBridgeTransfer } from './crossChainBridgeUtils';

describe('CrossChainBridgeUtils', () => {
  it('should execute cross-chain bridge transfer with 0.2% bridge fee', () => {
    const res = executeCrossChainBridgeTransfer('Ethereum Mainnet', 'Arbitrum One', 10000);
    expect(res.bridgeTransactionId).toContain('BRIDGE-TX-');
    expect(res.bridgeFeeUSD).toBe(20.0);
    expect(res.bridgeStatus).toBe('MINT_COMPLETED_ON_DESTINATION');
  });
});
