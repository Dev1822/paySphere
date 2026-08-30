/**
 * Merchant Subscription Recurring Billing Schedule Utilities
 */

export interface RecurringBillingScheduleMetrics {
  subscriptionId: string;
  nextBillingDateISO: string;
  recurringAmountUSD: number;
  isRetryScheduleTriggered: boolean;
}

/**
 * Calculates recurring subscription billing schedule and retry logic for failed payments.
 */
export function calculateRecurringBillingSchedule(
  subscriptionId: string,
  billingCycleDays = 30,
  isPreviousPaymentFailed = false
): RecurringBillingScheduleMetrics {
  const days = isPreviousPaymentFailed ? 3 : billingCycleDays;
  const next = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  return {
    subscriptionId,
    nextBillingDateISO: next,
    recurringAmountUSD: 49.99,
    isRetryScheduleTriggered: isPreviousPaymentFailed,
  };
}
