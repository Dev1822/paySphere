const { OutboxEvent } = require('../../models/outboxEvent.model');
const outboxService = require('../outbox.service');

jest.mock('../../models/outboxEvent.model', () => ({
  OutboxEvent: { create: jest.fn() },
  OUTBOX_EVENT_TYPES: {
    PAYROLL_FINALIZED: 'PAYROLL_FINALIZED',
    PAYSLIP_GENERATION_REQUESTED: 'PAYSLIP_GENERATION_REQUESTED',
    PAYSLIP_EMAIL_REQUESTED: 'PAYSLIP_EMAIL_REQUESTED',
    PAYROLL_REVERSAL_REQUESTED: 'PAYROLL_REVERSAL_REQUESTED',
  },
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('outbox.service (#1801)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('writes the event using the caller-supplied session so it commits atomically with the business write', async () => {
    const fakeDoc = { eventId: 'evt-1', eventType: 'PAYROLL_FINALIZED' };
    OutboxEvent.create.mockResolvedValue([fakeDoc]);
    const fakeSession = { id: 'session-1' };

    const result = await outboxService.recordEvent(
      'PAYROLL_FINALIZED',
      { month: 1, year: 2026 },
      { tenantId: 'tenant-1', session: fakeSession },
    );

    expect(OutboxEvent.create).toHaveBeenCalledWith(
      [
        {
          eventType: 'PAYROLL_FINALIZED',
          tenantId: 'tenant-1',
          payload: { month: 1, year: 2026 },
        },
      ],
      { session: fakeSession },
    );
    expect(result).toBe(fakeDoc);
  });

  test('rejects an unknown event type before writing anything', async () => {
    await expect(
      outboxService.recordEvent('NOT_A_REAL_EVENT', {}, {}),
    ).rejects.toThrow('Unknown outbox event type');
    expect(OutboxEvent.create).not.toHaveBeenCalled();
  });

  test('propagates a transaction abort instead of swallowing it (simulated crash mid-commit)', async () => {
    OutboxEvent.create.mockRejectedValue(new Error('Transaction aborted'));

    await expect(
      outboxService.recordEvent('PAYROLL_FINALIZED', {}, { session: {} }),
    ).rejects.toThrow('Transaction aborted');
  });
});