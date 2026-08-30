/**
 * @fileoverview Webhook Dispatch Service
 * @description Listens to the internal EventBus and enqueues matching webhook
 * deliveries into the BullMQ queue for asynchronous, retryable processing.
 *
 * Issue: #645, completed in #474.
 */

const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const { isRedisAvailable } = require('../config/redis');
const WebhookEndpoint = require('../models/webhookEndpoint.model');
const logger = require('../utils/logger');
const eventBus = require('./event.service');

const { AUDIT_LOG_EVENT } = eventBus;

/**
 * BullMQ Queue for Webhook Deliveries.
 *
 * `new Queue` is lazy — creating it does not touch Redis — so this module can
 * be required in environments where Redis is down or unset. `add()` is where
 * the connection matters, and the dispatch handler guards on
 * `isRedisAvailable()` before it gets there.
 *
 * Configured with exponential backoff for failed deliveries.
 */
let webhookQueue;
if (process.env.REDIS_URL) {
  webhookQueue = new Queue('webhook-deliveries', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: 5,
      backoff: {
        type: 'custom',
      },
    },
  });

  webhookQueue.on('error', () => {
    // Suppress unhandled error crashes when Redis is offline. config/redis.js already logs this.
  });
} else {
  webhookQueue = {
    add: async () => ({ id: 'mock-webhook-job-id' }),
    on: () => {},
  };
}

/**
 * Maps internal event bus actions to webhook event names.
 *
 * The webhook vocabulary is deliberately a subset of the audit vocabulary: the
 * seven events an external system might care about, and nothing else. An action
 * that is not here (e.g. `LOAN_ISSUE`) is audited but never dispatched.
 */
const EVENT_MAPPING = {
  EMPLOYEE_CREATE: 'EMPLOYEE_CREATE',
  EMPLOYEE_UPDATE: 'EMPLOYEE_UPDATE',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE',
  PAYROLL_FINALIZE: 'PAYROLL_FINALIZE',
  PAYROLL_APPROVE: 'PAYROLL_APPROVE',
  PAYROLL_REJECT: 'PAYROLL_REJECT',
  PAYROLL_PAID: 'PAYROLL_PAID',
  COMPLIANCE_VIOLATION: 'COMPLIANCE_VIOLATION',
};

/** Idempotence guard: requiring twice must not double-subscribe. */
let registered = false;

/**
 * Handle one emitted audit event: find every active endpoint subscribed to the
 * event and enqueue a delivery job for each.
 *
 * Runs detached from the request, so it must never throw — an exception here is
 * an unhandled rejection. Everything is wrapped, and a delivery problem is
 * logged, never raised.
 *
 * @param {object} eventData the payload controllers emit on `AUDIT_LOG`
 * @returns {Promise<void>}
 */
async function handleAuditEvent(eventData) {
  try {
    const internalAction = eventData.action;
    const webhookEvent = EVENT_MAPPING[internalAction];

    // If this internal event doesn't map to a webhook event, ignore it.
    if (!webhookEvent) return;

    const tenantId = eventData.tenantId || eventData.req?.tenantId;
    if (!tenantId) {
      logger.warn('Webhook dispatch skipped: Missing tenantId in event', {
        action: internalAction,
      });
      return;
    }

    if (!isRedisAvailable()) {
      // BullMQ cannot enqueue without Redis, and webhooks are best-effort — a
      // quiet skip beats five attempts to `add()` that each fail and log an
      // error that reads like a crash.
      logger.warn(
        'Webhook dispatch skipped: Redis is not available. Deliveries will resume when Redis is reachable.',
        { action: internalAction, tenantId: String(tenantId) },
      );
      return;
    }

    // Find all active endpoints subscribed to this event for this tenant.
    const endpoints = await WebhookEndpoint.find({
      tenantId,
      isActive: true,
      subscribedEvents: webhookEvent,
    }).lean();

    if (endpoints.length === 0) return;

    // One payload per event; each subscribed endpoint gets a copy.
    const payload = {
      event: webhookEvent,
      timestamp: new Date().toISOString(),
      data: eventData.details || {},
      resourceIds: eventData.resourceIds || [],
    };

    for (const endpoint of endpoints) {
      await webhookQueue.add(
        'deliver',
        {
          endpointId: endpoint._id.toString(),
          tenantId: tenantId.toString(),
          url: endpoint.url,
          signingSecret: endpoint.signingSecret,
          eventName: webhookEvent,
          payload,
        },
        // No jobId: two identical events in the same millisecond are two
        // legitimate deliveries, and BullMQ treats a repeated jobId as a
        // duplicate of the first.
      );
    }

    logger.debug(
      `Enqueued ${endpoints.length} webhook deliveries for event: ${webhookEvent}`,
    );
  } catch (error) {
    // Never let webhook dispatch crash the main event bus.
    logger.error('Webhook dispatch listener failed', {
      action: eventData.action,
      error: error.message,
    });
  }
}

/**
 * Subscribe to `AUDIT_LOG`. Called once during server startup (index.js).
 * Safe to call more than once.
 *
 * @returns {boolean} true if this call performed the registration
 */
function initializeWebhookService() {
  if (registered) return false;

  eventBus.on(AUDIT_LOG_EVENT, handleAuditEvent);
  registered = true;

  logger.info('Webhook dispatch service initialized', {
    event: AUDIT_LOG_EVENT,
  });
  return true;
}

/**
 * Is the webhook dispatch handler actually subscribed?
 *
 * Asks the emitter whether *this* handler is among the listeners, rather than
 * reading the flag, so it stays honest if a listener is removed out from under
 * us.
 *
 * @returns {boolean}
 */
function isWebhookServiceRegistered() {
  return eventBus.listeners(AUDIT_LOG_EVENT).includes(handleAuditEvent);
}

/** Test seam: drop the subscription and reset the guard. */
function unregisterWebhookService() {
  eventBus.off(AUDIT_LOG_EVENT, handleAuditEvent);
  registered = false;
}

async function retryDlqJob(deliveryLogId, tenantId) {
  const WebhookDelivery = require('../models/webhookDelivery.model');
  const delivery = await WebhookDelivery.findOne({
    _id: deliveryLogId,
    tenantId,
  });
  if (!delivery) {
    throw new Error('Webhook delivery log not found.');
  }

  const endpoint = await WebhookEndpoint.findOne({
    _id: delivery.endpointId,
    tenantId,
    isActive: true,
  });
  if (!endpoint) {
    throw new Error('Webhook endpoint is inactive or not found.');
  }

  await webhookQueue.add('deliver', {
    endpointId: endpoint._id.toString(),
    tenantId: tenantId.toString(),
    url: endpoint.url,
    signingSecret: endpoint.signingSecret,
    eventName: delivery.eventName,
    payload: delivery.payload,
  });

  delivery.isDlq = false;
  delivery.errorMessage = 'Retried manually by admin';
  await delivery.save();

  return delivery;
}

module.exports = {
  webhookQueue,
  EVENT_MAPPING,
  initializeWebhookService,
  isWebhookServiceRegistered,
  unregisterWebhookService,
  handleAuditEvent,
  retryDlqJob,
};
