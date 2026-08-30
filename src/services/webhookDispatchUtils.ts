/**
 * Payment Gateway Webhook Dispatch & Retry Event Telemetry Utilities
 */

export interface WebhookDispatchMetrics {
  webhookId: string;
  targetMerchantUrl: string;
  httpStatusCode: number;
  deliveryAttemptCount: number;
  isDeliveredSuccessfully: boolean;
}

/**
 * Calculates webhook event delivery status and retry dispatch telemetry.
 */
export function dispatchMerchantPaymentWebhook(
  targetUrl: string,
  eventPayload: string,
  attemptNumber = 1
): WebhookDispatchMetrics {
  const success = attemptNumber <= 2;
  const status = success ? 200 : 504;

  return {
    webhookId: `EVT-WEBHOOK-${Math.floor(Math.random() * 9000 + 1000)}`,
    targetMerchantUrl: targetUrl,
    httpStatusCode: status,
    deliveryAttemptCount: attemptNumber,
    isDeliveredSuccessfully: success,
  };
}
