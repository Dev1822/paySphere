/**
 * Unit Tests for Recurring Billing Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateRecurringBillingSchedule } from './recurringBillingUtils';

describe('RecurringBillingUtils', () => {
  it('should trigger 3-day retry schedule when previous recurring payment fails', () => {
    const res = calculateRecurringBillingSchedule('SUB-9021', 30, true);
    expect(res.subscriptionId).toBe('SUB-9021');
    expect(res.isRetryScheduleTriggered).toBe(true);
  });
});
