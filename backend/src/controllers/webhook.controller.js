const crypto = require('crypto');
const mongoose = require('mongoose');
const WebhookEndpoint = require('../models/webhookEndpoint.model');
const WebhookDelivery = require('../models/webhookDelivery.model');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');

/**
 * Webhook endpoint CRUD (#474).
 *
 * A webhook endpoint is a standing instruction to POST company payroll and
 * employee data to an external URL, signed with a secret. That makes every one
 * of these handlers a security mutation, so each one validates its input
 * explicitly (mirroring `scheduler.controller.js`, #666), scopes every query to
 * the caller's tenant, and emits an audit event.
 *
 * The secret is generated server-side and returned exactly twice in this file's
 * lifetime: on create, and on `POST /:id/regenerate-secret`. Every read path
 * masks it, so a leaked secret can be rotated rather than being re-readable
 * from the list endpoint forever.
 */

/** The events a webhook may subscribe to. Mirrors the model enum. */
const SUBSCRIBABLE_EVENTS = [
  'EMPLOYEE_CREATE',
  'EMPLOYEE_UPDATE',
  'EMPLOYEE_DELETE',
  'PAYROLL_FINALIZE',
  'PAYROLL_APPROVE',
  'PAYROLL_REJECT',
  'PAYROLL_PAID',
];

const URL_PATTERN = /^https?:\/\/.+/i;
const MAX_DESCRIPTION_LENGTH = 200;
const DELIVERIES_LIMIT = 50;

/**
 * A new signing secret. 32 random bytes as hex (64 chars), comfortably over the
 * model's 16-char minimum, so the HMAC-SHA256 signatures it produces are not
 * brute-forceable.
 *
 * @returns {string}
 */
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Mask a secret for a read response — enough to recognise the endpoint you
 * created, not enough to use it.
 *
 * @param {string} secret
 * @returns {string}
 */
function maskSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 8) return '••••••••';
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

/**
 * @param {object} webhook a document or plain object with a `signingSecret` field
 * @returns {object} a plain object with the secret masked
 */
function toMaskedWebhook(webhook) {
  return { ...webhook, signingSecret: maskSecret(webhook.signingSecret) };
}

/**
 * Validate a list of subscribed events.
 *
 * @param {unknown} events
 * @returns {{ok: true, events: string[]} | {ok: false, message: string}}
 */
function validateEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      ok: false,
      message: 'subscribedEvents must be a non-empty array',
    };
  }

  const unknown = events.filter((e) => !SUBSCRIBABLE_EVENTS.includes(e));
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `subscribedEvents must be a subset of: ${SUBSCRIBABLE_EVENTS.join(', ')}`,
    };
  }

  return { ok: true, events: [...new Set(events)] };
}

/**
 * Validate a webhook URL.
 *
 * @param {unknown} url
 * @returns {{ok: true, url: string} | {ok: false, message: string}}
 */
function validateUrl(url) {
  if (typeof url !== 'string' || !URL_PATTERN.test(url.trim())) {
    return { ok: false, message: 'url must be a valid http(s) URL' };
  }
  return { ok: true, url: url.trim() };
}

exports.createWebhook = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { url, description, subscribedEvents } = req.body || {};

    const urlCheck = validateUrl(url);
    if (!urlCheck.ok) {
      return res.status(400).json({ message: urlCheck.message });
    }

    const eventsCheck = validateEvents(subscribedEvents);
    if (!eventsCheck.ok) {
      return res.status(400).json({ message: eventsCheck.message });
    }

    if (
      description !== undefined &&
      (typeof description !== 'string' ||
        description.length > MAX_DESCRIPTION_LENGTH)
    ) {
      return res.status(400).json({
        message: `description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
      });
    }

    // The secret is always generated here. A client-supplied secret would let a
    // caller reuse one that was already leaked, and "regenerate" would be
    // meaningless.
    const webhook = new WebhookEndpoint({
      tenantId,
      url: urlCheck.url,
      signingSecret: generateSecret(),
      subscribedEvents: eventsCheck.events,
      description: (description || '').trim().slice(0, MAX_DESCRIPTION_LENGTH),
      createdBy: req.userId,
    });

    await webhook.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WEBHOOK_CREATE',
      resourceType: 'Webhook',
      resourceIds: [webhook._id],
      details: { url: webhook.url, events: webhook.subscribedEvents },
      req,
    });

    logger.info('Webhook endpoint created', {
      webhookId: String(webhook._id),
      url: webhook.url,
      userId: req.userId,
    });

    // The raw secret is in this response so the caller can copy it once.
    res.status(201).json(webhook);
  } catch (error) {
    next(error);
  }
};

exports.getWebhooks = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);

    const webhooks = await WebhookEndpoint.find({ tenantId })
      .sort('-createdAt')
      .lean();

    res.status(200).json(webhooks.map(toMaskedWebhook));
  } catch (error) {
    next(error);
  }
};

exports.getWebhook = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    // An unparseable id used to reach findOne and throw a CastError — a 500 for
    // what is plainly a bad request (same pattern as scheduler.controller.js).
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid webhook id format' });
    }

    const webhook = await WebhookEndpoint.findOne({ _id: id, tenantId }).lean();

    if (!webhook) {
      // Indistinguishable from "does not exist", so a caller cannot probe for
      // another company's endpoint ids.
      return res.status(404).json({ message: 'Webhook endpoint not found' });
    }

    res.status(200).json(toMaskedWebhook(webhook));
  } catch (error) {
    next(error);
  }
};

exports.updateWebhook = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid webhook id format' });
    }

    const webhook = await WebhookEndpoint.findOne({ _id: id, tenantId });

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found' });
    }

    const { url, description, subscribedEvents, isActive } = req.body || {};

    if (url !== undefined) {
      const urlCheck = validateUrl(url);
      if (!urlCheck.ok) {
        return res.status(400).json({ message: urlCheck.message });
      }
      webhook.url = urlCheck.url;
    }

    if (subscribedEvents !== undefined) {
      const eventsCheck = validateEvents(subscribedEvents);
      if (!eventsCheck.ok) {
        return res.status(400).json({ message: eventsCheck.message });
      }
      webhook.subscribedEvents = eventsCheck.events;
    }

    if (description !== undefined) {
      if (
        typeof description !== 'string' ||
        description.length > MAX_DESCRIPTION_LENGTH
      ) {
        return res.status(400).json({
          message: `description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
        });
      }
      webhook.description = description.trim();
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive must be a boolean' });
      }
      webhook.isActive = isActive;
    }

    if (
      url === undefined &&
      subscribedEvents === undefined &&
      description === undefined &&
      isActive === undefined
    ) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    await webhook.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WEBHOOK_UPDATE',
      resourceType: 'Webhook',
      resourceIds: [webhook._id],
      details: {
        url: webhook.url,
        isActive: webhook.isActive,
        events: webhook.subscribedEvents,
      },
      req,
    });

    logger.info('Webhook endpoint updated', {
      webhookId: String(webhook._id),
      userId: req.userId,
    });

    res.status(200).json(toMaskedWebhook(webhook.toObject()));
  } catch (error) {
    next(error);
  }
};

exports.deleteWebhook = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid webhook id format' });
    }

    const webhook = await WebhookEndpoint.findOneAndDelete({
      _id: id,
      tenantId,
    });

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WEBHOOK_DELETE',
      resourceType: 'Webhook',
      resourceIds: [id],
      details: { url: webhook.url },
      req,
    });

    logger.info('Webhook endpoint deleted', {
      webhookId: id,
      userId: req.userId,
    });

    res.status(200).json({ message: 'Webhook endpoint deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.regenerateWebhookSecret = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid webhook id format' });
    }

    const webhook = await WebhookEndpoint.findOne({ _id: id, tenantId });

    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found' });
    }

    const newSecret = generateSecret();
    webhook.signingSecret = newSecret;
    await webhook.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WEBHOOK_SECRET_REGENERATED',
      resourceType: 'Webhook',
      resourceIds: [webhook._id],
      details: { url: webhook.url },
      req,
    });

    logger.info('Webhook secret regenerated', {
      webhookId: String(webhook._id),
      userId: req.userId,
    });

    res.status(200).json({
      message: 'Webhook secret regenerated. The new secret is shown once.',
      signingSecret: newSecret,
    });
  } catch (error) {
    next(error);
  }
};

exports.getWebhookDeliveries = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid webhook id format' });
    }

    // Scoped to the tenant, and the endpoint must exist first, so one company
    // cannot read another's delivery history.
    const webhook = await WebhookEndpoint.findOne({ _id: id, tenantId }).lean();
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found' });
    }

    const deliveries = await WebhookDelivery.find({ tenantId, endpointId: id })
      .sort('-createdAt')
      .limit(DELIVERIES_LIMIT)
      .lean();

    res.status(200).json(deliveries);
  } catch (error) {
    next(error);
  }
};

exports.retryWebhookDelivery = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid delivery id format' });
    }

    const webhookService = require('../services/webhook.service');
    const delivery = await webhookService.retryDlqJob(id, tenantId);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WEBHOOK_RETRY',
      resourceType: 'Webhook',
      resourceIds: [delivery.endpointId],
      details: { deliveryId: id },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Webhook delivery successfully enqueued for retry',
      delivery,
    });
  } catch (error) {
    if (
      error.message.includes('not found') ||
      error.message.includes('inactive')
    ) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

exports.testWebhook = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid webhook id format' });
    }

    const webhook = await WebhookEndpoint.findOne({ _id: id, tenantId });
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook endpoint not found' });
    }

    const testPayload = {
      event: 'TEST_EVENT',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test notification from PaySphere.',
        testId: crypto.randomBytes(8).toString('hex'),
      },
      resourceIds: [],
    };

    const webhookService = require('../services/webhook.service');
    await webhookService.webhookQueue.add('deliver', {
      endpointId: webhook._id.toString(),
      tenantId: tenantId.toString(),
      url: webhook.url,
      signingSecret: webhook.signingSecret,
      eventName: 'TEST_EVENT',
      payload: testPayload,
    });

    res
      .status(200)
      .json({ success: true, message: 'Test webhook enqueued successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.SUBSCRIBABLE_EVENTS = SUBSCRIBABLE_EVENTS;
exports.validateUrl = validateUrl;
exports.validateEvents = validateEvents;
exports.maskSecret = maskSecret;
exports.generateSecret = generateSecret;
