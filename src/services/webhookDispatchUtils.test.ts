/**
 * Unit Tests for Webhook Dispatch Utilities
 */

import { describe, it, expect } from 'vitest';
import { dispatchMerchantPaymentWebhook } from './webhookDispatchUtils';

describe('WebhookDispatchUtils', () => {
  it('should dispatch merchant payment webhook and report HTTP 200 delivery status', () => {
    const res = dispatchMerchantPaymentWebhook('https://api.merchant.com/webhooks/pay', '{}', 1);
    expect(res.webhookId).toContain('EVT-WEBHOOK-');
    expect(res.httpStatusCode).toBe(200);
    expect(res.isDeliveredSuccessfully).toBe(true);
  });
});
