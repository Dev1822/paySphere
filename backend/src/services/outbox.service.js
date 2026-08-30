/**
 * @fileoverview Transactional Outbox Service
 * @description Persists domain events in the same DB transaction as the
 * business write that produced them (#1801). Must be called with the same
 * mongoose session as that write, so both commit or both roll back together.
 */
const { OutboxEvent, OUTBOX_EVENT_TYPES } = require('../models/outboxEvent.model');
const logger = require('../utils/logger');

/**
 * Record a domain event in the outbox.
 *
 * @param {string} eventType - One of OUTBOX_EVENT_TYPES
 * @param {object} payload - Event body; kept small, only what a worker needs
 * @param {object} options
 * @param {string} [options.tenantId]
 * @param {import('mongoose').ClientSession|null} [options.session] - Pass the
 *   same session as the business write this event accompanies.
 * @returns {Promise<object>} the created outbox document
 */
async function recordEvent(eventType, payload, { tenantId, session } = {}) {
  if (!OUTBOX_EVENT_TYPES[eventType]) {
    throw new Error(`Unknown outbox event type: ${eventType}`);
  }

  const [doc] = await OutboxEvent.create(
    [{ eventType, tenantId, payload }],
    { session },
  );

  logger.info('Outbox event recorded', {
    eventId: doc.eventId,
    eventType,
    tenantId,
  });

  return doc;
}

module.exports = { recordEvent, OUTBOX_EVENT_TYPES };