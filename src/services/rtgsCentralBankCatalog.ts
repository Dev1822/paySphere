/**
 * Central Bank Digital Currency (CBDC) & Real-Time Gross Settlement (RTGS) Catalog
 */

export const RTGS_CENTRAL_BANK_NETWORKS_CATALOG = [
  { networkId: 'RTGS-FEDWIRE', country: 'United States', clearingTimeMinutes: 0.5, isCbdcSupported: true },
  { networkId: 'RTGS-TARGET2', country: 'European Union', clearingTimeMinutes: 1.0, isCbdcSupported: true },
  { networkId: 'RTGS-CHAPS', country: 'United Kingdom', clearingTimeMinutes: 2.0, isCbdcSupported: false },
];

/**
 * Validates RTGS central bank network clearing speed and CBDC integration support.
 */
export function validateRtgsNetworkClearing(networkId: string): boolean {
  const match = RTGS_CENTRAL_BANK_NETWORKS_CATALOG.find(n => n.networkId === networkId);
  return match ? match.isCbdcSupported : false;
}
