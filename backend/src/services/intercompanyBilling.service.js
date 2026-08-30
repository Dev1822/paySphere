/**
 * Intercompany Shared Services Billing Service - Issue #1815
 *
 * Calculates arm's length transfer pricing markups on cross-entity shared services payroll costs,
 * generates debit/credit intercompany accounting vouchers, and audits transfer pricing spreads.
 */
'use strict';

const logger = require('../utils/logger');

// Default Arm's Length Transfer Pricing Markup range (5.0% - 10.0%)
const DEFAULT_MARKUP_PERCENT = 7.5;

/**
 * Calculates intercompany transfer pricing billing metrics:
 * - Subtotal Direct Cost = Direct Labor + Allocated Benefits
 * - Markup Amount = Subtotal Direct Cost * (Markup % / 100)
 * - Total Billed = Subtotal Direct Cost + Markup Amount
 */
function calculateTransferPricingBilling({
  rawDirectLaborCost,
  rawAllocatedBenefitsCost = 0,
  transferPricingMarkupPercent = DEFAULT_MARKUP_PERCENT,
}) {
  if (rawDirectLaborCost < 0 || rawAllocatedBenefitsCost < 0) {
    throw new Error('Labor and benefits costs must be non-negative.');
  }

  if (transferPricingMarkupPercent < 0 || transferPricingMarkupPercent > 30) {
    throw new Error('Transfer pricing markup must be between 0% and 30%.');
  }

  const subtotalDirectCost = Math.round((rawDirectLaborCost + rawAllocatedBenefitsCost) * 100) / 100;
  const transferPricingMarkupAmount = Math.round(
    (subtotalDirectCost * (transferPricingMarkupPercent / 100)) * 100
  ) / 100;
  const totalBilledAmount = Math.round((subtotalDirectCost + transferPricingMarkupAmount) * 100) / 100;

  return {
    rawDirectLaborCost,
    rawAllocatedBenefitsCost,
    subtotalDirectCost,
    transferPricingMarkupPercent,
    transferPricingMarkupAmount,
    totalBilledAmount,
  };
}

module.exports = {
  calculateTransferPricingBilling,
  DEFAULT_MARKUP_PERCENT,
};