/**
 * @fileoverview Employee Stock Purchase Plan (ESPP) & Section 423 Lookback Engine
 * @description Computes statutory 15% lookback stock purchase pricing, whole share allocation,
 * perquisite tax valuation, and residual fractional cash rollbacks.
 * Issue: #1667
 */

const STATUTORY_MAX_DISCOUNT_PERCENT = 15; // Section 423 statutory 15% maximum discount
const STATUTORY_MAX_CONTRIBUTION_PERCENT = 15; // 15% max gross salary deduction
const STATUTORY_MIN_CONTRIBUTION_PERCENT = 1;

/**
 * Computes monthly recurring ESPP payroll deduction amount.
 *
 * @param {number} monthlyGrossSalary - Employee's monthly gross wage
 * @param {number} contributionPercent - Elected percentage (1% to 15%)
 * @returns {{ monthlyDeduction: number, contributionPercent: number, annualProjectedDeduction: number }}
 */
function computeMonthlyEsppDeduction(monthlyGrossSalary, contributionPercent = 10) {
  const gross = Math.max(0, Number(monthlyGrossSalary) || 0);
  const percent = Math.max(
    STATUTORY_MIN_CONTRIBUTION_PERCENT,
    Math.min(STATUTORY_MAX_CONTRIBUTION_PERCENT, Number(contributionPercent) || 10),
  );

  const monthlyDeduction = Math.round((gross * percent) / 100);

  return {
    monthlyDeduction,
    contributionPercent: percent,
    annualProjectedDeduction: monthlyDeduction * 12,
  };
}

/**
 * Computes statutory Section 423 lookback purchase price.
 *
 * @param {number} grantDateFmv - Fair Market Value at start of offering period
 * @param {number} purchaseDateFmv - Fair Market Value on the purchase exercise date
 * @param {number} discountPercent - Plan discount percentage (default 15%)
 * @returns {{ benchmarkFmv: number, discountPercent: number, purchasePrice: number, perShareDiscount: number }}
 */
function computeEsppPurchasePrice(grantDateFmv, purchaseDateFmv, discountPercent = STATUTORY_MAX_DISCOUNT_PERCENT) {
  const grantFmv = Math.max(0.01, Number(grantDateFmv) || 0.01);
  const purchaseFmv = Math.max(0.01, Number(purchaseDateFmv) || 0.01);
  const discount = Math.max(0, Math.min(STATUTORY_MAX_DISCOUNT_PERCENT, Number(discountPercent) || 15));

  const benchmarkFmv = Math.min(grantFmv, purchaseFmv);
  const purchasePrice = Math.round(benchmarkFmv * (1 - discount / 100) * 100) / 100;
  const perShareDiscount = Math.round((purchaseFmv - purchasePrice) * 100) / 100;

  return {
    grantDateFmv: grantFmv,
    purchaseDateFmv: purchaseFmv,
    benchmarkFmv,
    discountPercent: discount,
    purchasePrice,
    perShareDiscount: Math.max(0, perShareDiscount),
  };
}

/**
 * Executes share allocation, calculates perquisite tax value, and rolls over unspent cash.
 *
 * @param {number} accumulatedDeductions - Total deductions accumulated during offering period
 * @param {number} priorCarryoverCash - Fractional cash carried over from previous offering
 * @param {number} grantDateFmv - FMV at Grant Date
 * @param {number} purchaseDateFmv - FMV at Purchase Date
 * @param {number} discountPercent - Discount rate (default 15%)
 * @returns {{ totalAvailableFunds: number, purchasePrice: number, sharesAllocated: number, totalPurchaseCost: number, residualCashCarryover: number, perquisiteTaxableValue: number }}
 */
function executeShareAllocation(
  accumulatedDeductions = 0,
  priorCarryoverCash = 0,
  grantDateFmv = 100,
  purchaseDateFmv = 120,
  discountPercent = STATUTORY_MAX_DISCOUNT_PERCENT,
) {
  const deductions = Math.max(0, Number(accumulatedDeductions) || 0);
  const carryover = Math.max(0, Number(priorCarryoverCash) || 0);
  const totalAvailableFunds = Math.round((deductions + carryover) * 100) / 100;

  const priceDetails = computeEsppPurchasePrice(grantDateFmv, purchaseDateFmv, discountPercent);
  const purchasePrice = priceDetails.purchasePrice;

  let sharesAllocated = 0;
  let totalPurchaseCost = 0;
  let residualCashCarryover = totalAvailableFunds;

  if (purchasePrice > 0 && totalAvailableFunds >= purchasePrice) {
    sharesAllocated = Math.floor(totalAvailableFunds / purchasePrice);
    totalPurchaseCost = Math.round(sharesAllocated * purchasePrice * 100) / 100;
    residualCashCarryover = Math.round((totalAvailableFunds - totalPurchaseCost) * 100) / 100;
  }

  // Taxable perquisite under Indian/US tax laws: Shares * (Purchase Date FMV - Purchase Price)
  const purchaseFmv = priceDetails.purchaseDateFmv;
  const perquisiteTaxableValue = Math.round(sharesAllocated * Math.max(0, purchaseFmv - purchasePrice) * 100) / 100;

  return {
    totalAvailableFunds,
    priceDetails,
    purchasePrice,
    sharesAllocated,
    totalPurchaseCost,
    residualCashCarryover,
    perquisiteTaxableValue,
  };
}

module.exports = {
  STATUTORY_MAX_DISCOUNT_PERCENT,
  STATUTORY_MAX_CONTRIBUTION_PERCENT,
  computeMonthlyEsppDeduction,
  computeEsppPurchasePrice,
  executeShareAllocation,
};
