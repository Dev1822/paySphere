/**
 * @fileoverview Corporate Credit Card Reconciliation & Auto-Match Engine
 * @description Ingests corporate credit card feeds, performs fuzzy date/amount matching
 * with expense claims, and queues personal or unverified swipes for payroll clawbacks.
 * Issue: #1666
 */

const DEFAULT_AMOUNT_TOLERANCE = 1.0; // ±$1 or ±₹1 variance allowance for FX/rounding
const DEFAULT_DAY_TOLERANCE = 3;       // ±3 days date window for settlement delays
const DEFAULT_UNMATCHED_GRACE_DAYS = 30; // 30 days before auto-clawback deduction

/**
 * Heuristically matches card transaction swipes against employee submitted expense claims.
 *
 * @param {Array<object>} cardTransactions - List of card feed transactions { id, cardholderId, amount, date, merchant }
 * @param {Array<object>} expenseClaims - List of expense vouchers { id, claimantId, amount, date, merchant }
 * @param {object} tolerances - Matching tolerances { amountTolerance, dayTolerance }
 * @returns {{ matchedPairs: Array<object>, unmatchedCardTransactions: Array<object>, unmatchedExpenseClaims: Array<object>, matchRatePercent: number }}
 */
function matchCardTransactionsWithExpenses(
  cardTransactions = [],
  expenseClaims = [],
  tolerances = {},
) {
  const amountTol = tolerances.amountTolerance !== undefined ? tolerances.amountTolerance : DEFAULT_AMOUNT_TOLERANCE;
  const dayTol = tolerances.dayTolerance !== undefined ? tolerances.dayTolerance : DEFAULT_DAY_TOLERANCE;

  const matchedPairs = [];
  const claimedMatchedIds = new Set();
  const unmatchedCardTransactions = [];

  for (const cardTx of cardTransactions) {
    const cardAmount = Number(cardTx.amount) || 0;
    const cardTime = new Date(cardTx.date).getTime();
    const cardUser = String(cardTx.cardholderId || cardTx.employeeId || '');

    let bestMatch = null;
    let matchType = null;

    for (const exp of expenseClaims) {
      if (claimedMatchedIds.has(exp.id || exp._id)) continue;

      const expUser = String(exp.claimantId || exp.employeeId || '');
      if (cardUser && expUser && cardUser !== expUser) continue;

      const expAmount = Number(exp.amount) || 0;
      const expTime = new Date(exp.date).getTime();
      const amountDiff = Math.abs(cardAmount - expAmount);
      const dayDiff = Math.abs(cardTime - expTime) / (1000 * 60 * 60 * 24);

      if (amountDiff === 0 && dayDiff === 0) {
        bestMatch = exp;
        matchType = 'EXACT_MATCH';
        break;
      } else if (amountDiff <= amountTol && dayDiff <= dayTol) {
        bestMatch = exp;
        matchType = 'FUZZY_MATCH';
      }
    }

    if (bestMatch) {
      claimedMatchedIds.add(bestMatch.id || bestMatch._id);
      matchedPairs.push({
        matchType,
        cardTransaction: cardTx,
        expenseClaim: bestMatch,
        reconciledAt: new Date().toISOString(),
      });
    } else {
      unmatchedCardTransactions.push(cardTx);
    }
  }

  const unmatchedExpenseClaims = expenseClaims.filter((exp) => !claimedMatchedIds.has(exp.id || exp._id));
  const totalItems = cardTransactions.length;
  const matchRatePercent = totalItems > 0 ? Math.round((matchedPairs.length / totalItems) * 1000) / 10 : 0;

  return {
    matchedPairs,
    unmatchedCardTransactions,
    unmatchedExpenseClaims,
    matchRatePercent,
  };
}

/**
 * Identifies unmatched swipes or personal card expenditures for payroll deduction clawbacks.
 */
function identifyPersonalSwipesAndClawbacks(unmatchedSwipes = [], graceDays = DEFAULT_UNMATCHED_GRACE_DAYS) {
  const now = Date.now();
  const clawbackQueue = [];
  let totalClawbackAmount = 0;

  for (const swipe of unmatchedSwipes) {
    const swipeTime = new Date(swipe.date).getTime();
    const ageDays = Math.floor((now - swipeTime) / (1000 * 60 * 60 * 24));
    const isPersonal = Boolean(swipe.isPersonalUsage);

    if (isPersonal || ageDays > graceDays) {
      const amount = Number(swipe.amount) || 0;
      totalClawbackAmount += amount;

      clawbackQueue.push({
        transactionId: swipe.id || swipe.transactionId,
        employeeId: String(swipe.cardholderId || swipe.employeeId),
        merchant: swipe.merchant || 'Corporate Card Swipe',
        amount,
        ageDays,
        reason: isPersonal ? 'Tagged as personal usage' : `Unreconciled beyond ${graceDays}-day grace period`,
        scheduledPayrollDeduction: true,
      });
    }
  }

  return {
    totalClawbackCount: clawbackQueue.length,
    totalClawbackAmount,
    clawbackQueue,
  };
}

module.exports = {
  DEFAULT_AMOUNT_TOLERANCE,
  DEFAULT_DAY_TOLERANCE,
  DEFAULT_UNMATCHED_GRACE_DAYS,
  matchCardTransactionsWithExpenses,
  identifyPersonalSwipesAndClawbacks,
};
