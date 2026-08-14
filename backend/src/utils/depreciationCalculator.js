/**
 * @fileoverview Depreciation Calculation & Multi-Year Amortization Schedule Engine
 * @description Implements Straight Line Method (SLM) and Written Down Value (WDV)
 * depreciation logic, multi-year forecast schedule generator, and asset disposal realization.
 */

'use strict';

/**
 * Calculates monthly depreciation using Straight Line Method (SLM).
 * Formula: (Purchase Price - Salvage Value) / (Useful Life in Months)
 * 
 * @param {number} purchasePrice 
 * @param {number} salvageValue 
 * @param {number} usefulLifeYears 
 * @returns {number} Monthly depreciation amount
 */
function calculateSLM(purchasePrice, salvageValue, usefulLifeYears) {
  const usefulLifeMonths = usefulLifeYears * 12;
  if (usefulLifeMonths <= 0) return 0;
  return (purchasePrice - salvageValue) / usefulLifeMonths;
}

/**
 * Calculates monthly depreciation using Written Down Value (WDV) method.
 * Formula: Current Book Value * (1 - (Salvage/Purchase)^(1/UsefulLife)) / 12
 * 
 * @param {number} currentBookValue 
 * @param {number} purchasePrice 
 * @param {number} salvageValue 
 * @param {number} usefulLifeYears 
 * @returns {number} Monthly depreciation amount
 */
function calculateWDV(currentBookValue, purchasePrice, salvageValue, usefulLifeYears) {
  if (usefulLifeYears <= 0 || purchasePrice <= 0) return 0;
  if (currentBookValue <= salvageValue) return 0;

  const ratio = Math.max(0.01, salvageValue / purchasePrice);
  const annualRate = 1 - Math.pow(ratio, 1 / usefulLifeYears);
  const monthlyRate = annualRate / 12;

  return currentBookValue * monthlyRate;
}

/**
 * Main dispatcher to calculate monthly depreciation for an asset.
 * 
 * @param {Object} asset - The Asset document
 * @param {Object} category - The AssetCategory document
 * @returns {number} Depreciation expense for the current month
 */
function calculateMonthlyDepreciation(asset, category) {
  const salvagePercent = category?.salvageValuePercentage || 5;
  const salvageValue = asset.purchasePrice * (salvagePercent / 100);

  if (asset.currentBookValue <= salvageValue) {
    return 0; // Fully depreciated
  }

  let expense = 0;
  if (category.depreciationMethod === 'SLM') {
    expense = calculateSLM(asset.purchasePrice, salvageValue, category.usefulLifeYears);
  } else if (category.depreciationMethod === 'WDV') {
    expense = calculateWDV(asset.currentBookValue, asset.purchasePrice, salvageValue, category.usefulLifeYears);
  }

  const maxAllowed = asset.currentBookValue - salvageValue;
  return Math.min(expense, maxAllowed);
}

/**
 * Generates a complete multi-year depreciation schedule for financial forecasting.
 *
 * @param {object} asset
 * @param {object} category
 * @returns {Array<object>} Multi-year depreciation forecast
 */
function calculateDepreciationSchedule(asset, category) {
  const purchasePrice = Number(asset.purchasePrice) || 0;
  const salvagePercent = Number(category?.salvageValuePercentage ?? 5);
  const usefulLifeYears = Number(category?.usefulLifeYears ?? 5);
  const method = category?.depreciationMethod || 'SLM';
  const salvageValue = Math.round(purchasePrice * (salvagePercent / 100) * 100) / 100;

  const schedule = [];
  let openingValue = purchasePrice;
  let accumulated = 0;

  const ratio = Math.max(0.01, salvageValue / purchasePrice);
  const wdvAnnualRate = 1 - Math.pow(ratio, 1 / usefulLifeYears);
  const slmAnnualAmount = (purchasePrice - salvageValue) / usefulLifeYears;

  for (let year = 1; year <= usefulLifeYears; year++) {
    if (openingValue <= salvageValue) {
      schedule.push({
        year,
        openingBookValue: Math.round(openingValue * 100) / 100,
        depreciationExpense: 0,
        accumulatedDepreciation: Math.round(accumulated * 100) / 100,
        closingBookValue: Math.round(openingValue * 100) / 100,
      });
      continue;
    }

    let annualExpense = 0;
    if (method === 'WDV') {
      annualExpense = openingValue * wdvAnnualRate;
    } else {
      annualExpense = slmAnnualAmount;
    }

    // Cap at salvage floor
    const maxDepr = openingValue - salvageValue;
    annualExpense = Math.min(annualExpense, maxDepr);
    annualExpense = Math.round(annualExpense * 100) / 100;

    const closingValue = Math.max(salvageValue, Math.round((openingValue - annualExpense) * 100) / 100);
    accumulated = Math.round((accumulated + annualExpense) * 100) / 100;

    schedule.push({
      year,
      openingBookValue: Math.round(openingValue * 100) / 100,
      depreciationExpense: annualExpense,
      accumulatedDepreciation: accumulated,
      closingBookValue: closingValue,
    });

    openingValue = closingValue;
  }

  return schedule;
}

/**
 * Calculates scrap realization gain or loss on asset disposal.
 *
 * @param {number} currentBookValue
 * @param {number} saleProceeds
 * @param {number} [disposalCost=0]
 * @returns {object}
 */
function calculateDisposalGainLoss(currentBookValue, saleProceeds, disposalCost = 0) {
  const netProceeds = Number(saleProceeds) - Number(disposalCost);
  const gainOrLoss = Math.round((netProceeds - Number(currentBookValue)) * 100) / 100;

  return {
    currentBookValue: Math.round(Number(currentBookValue) * 100) / 100,
    saleProceeds: Number(saleProceeds),
    disposalCost: Number(disposalCost),
    netProceeds: Math.round(netProceeds * 100) / 100,
    gainOrLoss,
    isGain: gainOrLoss >= 0,
  };
}

module.exports = {
  calculateSLM,
  calculateWDV,
  calculateMonthlyDepreciation,
  calculateDepreciationSchedule,
  calculateDisposalGainLoss,
};
