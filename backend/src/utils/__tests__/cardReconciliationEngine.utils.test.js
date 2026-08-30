const {
  matchCardTransactionsWithExpenses,
  identifyPersonalSwipesAndClawbacks,
  DEFAULT_AMOUNT_TOLERANCE,
  DEFAULT_DAY_TOLERANCE,
} = require('../cardReconciliationEngine.utils');

describe('cardReconciliationEngine.utils - Corporate Card Reconciliation & Match Engine', () => {
  describe('matchCardTransactionsWithExpenses', () => {
    it('detects exact match on amount, date, and cardholder', () => {
      const cardSwipes = [
        { id: 'SWIPE-1', cardholderId: 'EMP-01', amount: 150.0, date: '2026-08-20T10:00:00Z', merchant: 'Airline' },
      ];
      const expenseClaims = [
        { id: 'EXP-1', claimantId: 'EMP-01', amount: 150.0, date: '2026-08-20T10:00:00Z', merchant: 'Airline Ticket' },
      ];

      const result = matchCardTransactionsWithExpenses(cardSwipes, expenseClaims);

      expect(result.matchedPairs.length).toBe(1);
      expect(result.matchedPairs[0].matchType).toBe('EXACT_MATCH');
      expect(result.unmatchedCardTransactions.length).toBe(0);
      expect(result.matchRatePercent).toBe(100);
    });

    it('detects fuzzy match within tolerance limits (amount ±$1, date ±3 days)', () => {
      const cardSwipes = [
        { id: 'SWIPE-2', cardholderId: 'EMP-02', amount: 99.5, date: '2026-08-21T12:00:00Z', merchant: 'Hotel' },
      ];
      const expenseClaims = [
        { id: 'EXP-2', claimantId: 'EMP-02', amount: 100.0, date: '2026-08-22T08:00:00Z', merchant: 'Hotel Stay' },
      ];

      const result = matchCardTransactionsWithExpenses(cardSwipes, expenseClaims, {
        amountTolerance: 1.0,
        dayTolerance: 3,
      });

      expect(result.matchedPairs.length).toBe(1);
      expect(result.matchedPairs[0].matchType).toBe('FUZZY_MATCH');
    });

    it('isolates unmatched card transactions and unlinked expense claims', () => {
      const cardSwipes = [
        { id: 'SWIPE-3', cardholderId: 'EMP-03', amount: 500.0, date: '2026-08-10T00:00:00Z', merchant: 'Electronics' },
      ];
      const expenseClaims = [
        { id: 'EXP-3', claimantId: 'EMP-04', amount: 20.0, date: '2026-08-25T00:00:00Z', merchant: 'Coffee' },
      ];

      const result = matchCardTransactionsWithExpenses(cardSwipes, expenseClaims);

      expect(result.matchedPairs.length).toBe(0);
      expect(result.unmatchedCardTransactions.length).toBe(1);
      expect(result.unmatchedExpenseClaims.length).toBe(1);
      expect(result.matchRatePercent).toBe(0);
    });
  });

  describe('identifyPersonalSwipesAndClawbacks', () => {
    it('queues explicitly tagged personal swipes and overdue unmatched transactions for payroll clawback', () => {
      const unmatchedSwipes = [
        { id: 'SWIPE-P1', cardholderId: 'EMP-01', amount: 85.0, date: '2026-08-24T00:00:00Z', isPersonalUsage: true },
        { id: 'SWIPE-OLD', cardholderId: 'EMP-02', amount: 250.0, date: '2026-06-01T00:00:00Z', isPersonalUsage: false }, // > 30 days old
        { id: 'SWIPE-RECENT', cardholderId: 'EMP-03', amount: 40.0, date: new Date().toISOString(), isPersonalUsage: false }, // recent (< 30 days)
      ];

      const clawbacks = identifyPersonalSwipesAndClawbacks(unmatchedSwipes, 30);

      expect(clawbacks.totalClawbackCount).toBe(2); // P1 and OLD
      expect(clawbacks.totalClawbackAmount).toBe(335.0);
      expect(clawbacks.clawbackQueue[0].transactionId).toBe('SWIPE-P1');
      expect(clawbacks.clawbackQueue[1].transactionId).toBe('SWIPE-OLD');
    });
  });
});
