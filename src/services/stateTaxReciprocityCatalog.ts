/**
 * Multi-State Remote Worker Tax Nexus & Reciprocity Agreement Catalog
 */

export const MULTI_STATE_TAX_RECIPROCITY_CATALOG = [
  { residentState: 'PA', workState: 'NJ', reciprocityAgreementActive: true },
  { residentState: 'VA', workState: 'MD', reciprocityAgreementActive: true },
  { residentState: 'NY', workState: 'NJ', reciprocityAgreementActive: false },
];

/**
 * Validates whether multi-state tax reciprocity agreement applies to remote employee.
 */
export function validateStateTaxReciprocity(residentState: string, workState: string): boolean {
  const match = MULTI_STATE_TAX_RECIPROCITY_CATALOG.find(r => r.residentState === residentState && r.workState === workState);
  return match ? match.reciprocityAgreementActive : false;
}
