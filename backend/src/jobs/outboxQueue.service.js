/**
 * @fileoverview Outbox BullMQ Queue
 * @description Destination queue for events handed off by
 * workers/outbox.worker.js (#1801). Mirrors the lazy-init/mock pattern used
 * by jobs/queue.service.js and jobs/email.queue.js: no Redis connection is
 * opened until `.add()` is called, and without REDIS_URL it falls back to a
 * mock so local/dev setups without Redis don't crash the poll loop.
 */
const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');

let outboxQueue;
if (process.env.REDIS_URL) {
  outboxQueue = new Queue('payroll-outbox-events', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
    },
  });
  outboxQueue.on('error', (err) => {
    logger.warn(
      'BullMQ outboxQueue error (likely Redis unreachable):',
      err.message,
    );
  });
  logger.info('BullMQ payroll-outbox-events queue initialized');
} else {
  outboxQueue = {
    add: async () => {
      logger.warn('Redis is not configured. outboxQueue.add() ignored.');
      return { id: 'mock-outbox-job-id' };
    },
    on: () => {},
  };
  logger.warn('BullMQ payroll-outbox-events queue mocked (Redis disabled)');
}

module.exports = { outboxQueue };