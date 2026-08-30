/**
 * @fileoverview Corporate Card Reconciliation Controller
 * @description Manages card statement batch imports, automated heuristic reconciliation,
 * and personal swipe payroll clawback variance reporting.
 * Issue: #1666
 */

const {
  matchCardTransactionsWithExpenses,
  identifyPersonalSwipesAndClawbacks,
} = require('../utils/cardReconciliationEngine.utils');
const logger = require('../utils/logger');

// In-memory or database-backed feeds
const importedCardFeeds = [];
const recordedExpenseClaims = [];
const reconciliationHistory = [];

/**
 * POST /api/card-reconciliation/import-feed
 * Imports a batch of credit card transactions.
 */
async function importFeed(req, res, next) {
  try {
    const { batchId, transactions = [] } = req.body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-empty transactions array is required',
      });
    }

    const batch = {
      batchId: batchId || `FEED-BATCH-${Date.now()}`,
      importedAt: new Date().toISOString(),
      itemCount: transactions.length,
      transactions: transactions.map((t, idx) => ({
        id: t.id || `TX-${Date.now()}-${idx}`,
        cardholderId: String(t.cardholderId || t.employeeId || 'EMP-01'),
        amount: Number(t.amount) || 0,
        date: t.date || new Date().toISOString(),
        merchant: t.merchant || 'Vendor',
        isPersonalUsage: Boolean(t.isPersonalUsage),
      })),
    };

    importedCardFeeds.push(batch);

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${batch.itemCount} card transactions`,
      data: batch,
    });
  } catch (error) {
    logger.error('Error importing card feed:', error);
    return next(error);
  }
}

/**
 * POST /api/card-reconciliation/auto-match
 * Runs automated heuristic matching against expense vouchers.
 */
async function runAutoMatch(req, res, next) {
  try {
    const { cardTransactions, expenseClaims, tolerances } = req.body;

    const swipes = Array.isArray(cardTransactions) && cardTransactions.length > 0
      ? cardTransactions
      : importedCardFeeds.flatMap((b) => b.transactions);

    const expenses = Array.isArray(expenseClaims) && expenseClaims.length > 0
      ? expenseClaims
      : recordedExpenseClaims;

    const result = matchCardTransactionsWithExpenses(swipes, expenses, tolerances);
    const clawbacks = identifyPersonalSwipesAndClawbacks(result.unmatchedCardTransactions);

    const record = {
      runId: `RECON-RUN-${Date.now()}`,
      executedAt: new Date().toISOString(),
      ...result,
      clawbackSummary: clawbacks,
    };

    reconciliationHistory.push(record);

    return res.status(200).json({
      success: true,
      message: `Reconciliation completed with ${result.matchRatePercent}% match rate`,
      data: record,
    });
  } catch (error) {
    logger.error('Error running auto-match:', error);
    return next(error);
  }
}

/**
 * GET /api/card-reconciliation/variance-report
 * Retrieves variance report, unmatched swipes, and personal clawback queues.
 */
async function getVarianceReport(req, res, next) {
  try {
    const latestRun = reconciliationHistory[reconciliationHistory.length - 1] || null;

    return res.status(200).json({
      success: true,
      data: {
        totalReconciliationRuns: reconciliationHistory.length,
        latestRun,
      },
    });
  } catch (error) {
    logger.error('Error fetching variance report:', error);
    return next(error);
  }
}

module.exports = {
  importFeed,
  runAutoMatch,
  getVarianceReport,
  importedCardFeeds,
  recordedExpenseClaims,
  reconciliationHistory,
};
