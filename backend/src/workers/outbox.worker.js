/**
 * @fileoverview Transactional Outbox Publisher
 * @description Polls OutboxEvent rows written atomically alongside payroll
 * mutations (see services/outbox.service.js) and hands each one to BullMQ
 * (#1801). The only way an event can be lost is for this poll loop to never
 * run again — restart just resumes from whatever is still `pending`.
 */
const {
  OutboxEvent,
  OUTBOX_STATUS,
} = require('../models/outboxEvent.model');
const { outboxQueue } = require('../jobs/outboxQueue.service');
const logger = require('../utils/logger');

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS) || 5000;
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE) || 25;
const MAX_ATTEMPTS = 10;

/**
 * Backoff before retrying a publish failure: grows with each attempt, capped
 * at 5 minutes. Pure function so it's testable without timers.
 */
function nextAttemptDelayMs(attempts) {
  return Math.min(POLL_INTERVAL_MS * 2 ** attempts, 5 * 60 * 1000);
}

/**
 * Publish one outbox event to BullMQ and mark it published.
 * Exported so tests can drive it directly without a live poll loop.
 *
 * @param {import('mongoose').Document} event
 */
async function publishOutboxEvent(event) {
  try {
    // `jobId: event.eventId` is the dedup key: if this event was already
    // handed to BullMQ on a previous attempt (e.g. the process crashed right
    // after `.add()` resolved but before the status update below), BullMQ
    // no-ops the second `.add()` instead of creating a duplicate job.
    await outboxQueue.add(event.eventType, event.payload, {
      jobId: event.eventId,
    });

    event.status = OUTBOX_STATUS.PUBLISHED;
    event.publishedAt = new Date();
    event.lastError = null;
    await event.save();

    logger.info('Outbox event published', {
      eventId: event.eventId,
      eventType: event.eventType,
    });
  } catch (error) {
    event.attempts += 1;
    event.lastError = error.message;
    event.nextAttemptAt = new Date(
      Date.now() + nextAttemptDelayMs(event.attempts),
    );
    // Stays `pending` below MAX_ATTEMPTS so the next poll retries it
    // automatically. Past MAX_ATTEMPTS it's marked `failed` so it stops being
    // retried forever and surfaces for manual investigation instead.
    if (event.attempts >= MAX_ATTEMPTS) {
      event.status = OUTBOX_STATUS.FAILED;
    }
    await event.save();

    logger.error('Failed to publish outbox event', {
      eventId: event.eventId,
      eventType: event.eventType,
      attempts: event.attempts,
      error: error.message,
    });
  }
}

/**
 * Fetch and publish one batch of due, unpublished events.
 * @returns {Promise<number>} how many events were processed
 */
async function processBatch() {
  const events = await OutboxEvent.find({
    status: OUTBOX_STATUS.PENDING,
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE);

  for (const event of events) {
    await publishOutboxEvent(event);
  }

  return events.length;
}

let intervalHandle = null;

/**
 * Start the poll loop. Idempotent — same start/stop convention as
 * workers/webhook.worker.js.
 */
function startOutboxWorker() {
  if (intervalHandle) return intervalHandle;

  intervalHandle = setInterval(() => {
    processBatch().catch((error) => {
      logger.error('Outbox poll batch failed', { error: error.message });
    });
  }, POLL_INTERVAL_MS);

  intervalHandle.unref?.();

  logger.info('Outbox worker started', { pollIntervalMs: POLL_INTERVAL_MS });

  return intervalHandle;
}

function stopOutboxWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startOutboxWorker,
  stopOutboxWorker,
  processBatch,
  publishOutboxEvent,
};