/**
 * Unit Tests for State Tax Reciprocity Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { validateStateTaxReciprocity, MULTI_STATE_TAX_RECIPROCITY_CATALOG } from './stateTaxReciprocityCatalog';

describe('StateTaxReciprocityCatalog', () => {
  it('should validate multi-state tax reciprocity agreement correctly', () => {
    const active = validateStateTaxReciprocity('PA', 'NJ');
    expect(active).toBe(true);
  });

  it('should contain catalog of multi-state tax reciprocity agreements', () => {
    expect(MULTI_STATE_TAX_RECIPROCITY_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
