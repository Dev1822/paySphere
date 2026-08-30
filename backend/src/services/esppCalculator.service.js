/**
 * ESPP Calculation Service - Issue #1596
 *
 * Implements standard Section 423 Lookback calculation rules, 15% statutory safe-harbor discount,
 * share allocation integer constraints, and taxable compensation perquisite estimation.
 */
'use strict';

const EsppEnrollment = require('../models/esppEnrollment.model');
const EsppTransaction = require('../models/esppTransaction.model');
const logger = require('../utils/logger');

/**
 * Calculates lookback price and share count.
 * Lookback Price = min(Grant Price, Purchase Date Price)
 * Purchase Price = Lookback Price * (1 - discountPercent / 100)
 */
function calculatePurchaseMetrics({ grantPrice, purchaseDatePrice, accumulatedFunds, discountPercent = 15 }) {
  if (grantPrice <= 0 || purchaseDatePrice <= 0) {
    throw new Error('Stock prices must be strictly positive.');
  }

  const lookbackPrice = Math.min(grantPrice, purchaseDatePrice);
  const finalPurchasePrice = Math.round(lookbackPrice * (1 - discountPercent / 100) * 100) / 100;

  const sharesPurchased = Math.floor(accumulatedFunds / finalPurchasePrice);
  const totalSpent = Math.round(sharesPurchased * finalPurchasePrice * 100) / 100;
  const residualRefund = Math.round((accumulatedFunds - totalSpent) * 100) / 100;

  // Taxable perquisite is the discount spread on purchase date: (FMV on purchase - final purchase price) * shares
  const discountSpreadPerShare = Math.max(0, purchaseDatePrice - finalPurchasePrice);
  const taxablePerquisiteValue = Math.round(discountSpreadPerShare * sharesPurchased * 100) / 100;

  return {
    lookbackPrice,
    discountPercent,
    finalPurchasePrice,
    sharesPurchased,
    totalSpent,
    residualRefund,
    taxablePerquisiteValue,
  };
}

/**
 * Executes batch purchase for all active enrollments in an offering period.
 */
async function executeBatchPurchase({ tenantId, offeringPeriodName, purchaseDatePrice, discountPercent = 15 }) {
  const enrollments = await EsppEnrollment.find({
    tenantId,
    'offeringPeriod.name': offeringPeriodName,
    status: 'active',
    accumulatedFunds: { $gt: 0 },
  });

  if (!enrollments.length) {
    return { count: 0, transactions: [], totalShares: 0, totalCapitalDeployed: 0 };
  }

  const transactions = [];
  let totalShares = 0;
  let totalCapitalDeployed = 0;

  for (const enrollment of enrollments) {
    const metrics = calculatePurchaseMetrics({
      grantPrice: enrollment.offeringPeriod.grantPrice,
      purchaseDatePrice,
      accumulatedFunds: enrollment.accumulatedFunds,
      discountPercent,
    });

    if (metrics.sharesPurchased > 0) {
      const tx = await EsppTransaction.create({
        tenantId,
        employeeId: enrollment.employeeId,
        enrollmentId: enrollment._id,
        offeringPeriodName,
        grantPrice: enrollment.offeringPeriod.grantPrice,
        purchaseDatePrice,
        lookbackPrice: metrics.lookbackPrice,
        discountPercent: metrics.discountPercent,
        finalPurchasePrice: metrics.finalPurchasePrice,
        totalContributed: enrollment.accumulatedFunds,
        sharesPurchased: metrics.sharesPurchased,
        residualRefund: metrics.residualRefund,
        taxablePerquisiteValue: metrics.taxablePerquisiteValue,
      });

      // Update enrollment status and rollover residual funds
      enrollment.accumulatedFunds = metrics.residualRefund;
      enrollment.status = 'completed';
      await enrollment.save();

      transactions.push(tx);
      totalShares += metrics.sharesPurchased;
      totalCapitalDeployed += metrics.totalSpent;
    }
  }

  logger.info('ESPP Batch purchase completed', {
    tenantId,
    offeringPeriodName,
    transactionsCount: transactions.length,
    totalShares,
  });

  return {
    count: transactions.length,
    transactions,
    totalShares,
    totalCapitalDeployed: Math.round(totalCapitalDeployed * 100) / 100,
  };
}

module.exports = {
  calculatePurchaseMetrics,
  executeBatchPurchase,
};