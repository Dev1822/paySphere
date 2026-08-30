const { OutboxEvent } = require('../../models/outboxEvent.model');
const { outboxQueue } = require('../../jobs/outboxQueue.service');
const { processBatch, publishOutboxEvent } = require('../outbox.worker');

jest.mock('../../models/outboxEvent.model', () => ({
  OutboxEvent: { find: jest.fn() },
  OUTBOX_STATUS: { PENDING: 'pending', PUBLISHED: 'published', FAILED: 'failed' },
}));

jest.mock('../../jobs/outboxQueue.service', () => ({
  outboxQueue: { add: jest.fn() },
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function makeEvent(overrides = {}) {
  return {
    eventId: 'evt-1',
    eventType: 'PAYROLL_FINALIZED',
    payload: { month: 1, year: 2026 },
    status: 'pending',
    attempts: 0,
    lastError: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('outbox.worker (#1801)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('publishes a pending event and marks it published, using the eventId as the BullMQ dedup key', async () => {
    const event = makeEvent();
    outboxQueue.add.mockResolvedValue({ id: 'job-1' });

    await publishOutboxEvent(event);

    expect(outboxQueue.add).toHaveBeenCalledWith(
      'PAYROLL_FINALIZED',
      { month: 1, year: 2026 },
      { jobId: 'evt-1' },
    );
    expect(event.status).toBe('published');
    expect(event.publishedAt).toBeInstanceOf(Date);
    expect(event.save).toHaveBeenCalled();
  });

  test('a publish failure between DB persistence and event publication leaves the event pending for retry, never lost', async () => {
    // The exact crash window #1801 describes: the DB write already
    // committed (the row exists, status: pending), but the hand-off to
    // BullMQ fails. It must survive as `pending` so the next poll retries —
    // never dropped, never marked published.
    const event = makeEvent();
    outboxQueue.add.mockRejectedValueOnce(new Error('Redis unreachable'));

    await publishOutboxEvent(event);

    expect(event.status).toBe('pending');
    expect(event.attempts).toBe(1);
    expect(event.lastError).toBe('Redis unreachable');
    expect(event.save).toHaveBeenCalled();
  });

  test('stops retrying and marks the event failed after exceeding the retry ceiling', async () => {
    const event = makeEvent({ attempts: 9 });
    outboxQueue.add.mockRejectedValueOnce(new Error('Still down'));

    await publishOutboxEvent(event);

    expect(event.attempts).toBe(10);
    expect(event.status).toBe('failed');
  });

  test('processBatch only fetches pending, due events — published events are never reprocessed', async () => {
    const event = makeEvent();
    OutboxEvent.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([event]),
    });
    outboxQueue.add.mockResolvedValue({ id: 'job-1' });

    const count = await processBatch();

    expect(OutboxEvent.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
    expect(count).toBe(1);
    expect(event.status).toBe('published');
  });
});