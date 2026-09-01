/**
 * @fileoverview Webhook BullMQ Worker
 * @description Processes webhook delivery jobs. Generates HMAC-SHA256 signatures,
 * sends HTTP POST requests, logs the results, and handles exponential backoff.
 *
 * Issue: #645, completed in #474.
 */

const { Worker } = require('bullmq');
const crypto = require('crypto');
const axios = require('axios');
const redisConnection = require('../config/redis');
const WebhookDelivery = require('../models/webhookDelivery.model');
const logger = require('../utils/logger');

/**
 * Generates HMAC-SHA256 signature for the payload.
 *
 * This is the signature a receiver verifies: the sender signs the exact body it
 * POSTs with the endpoint's secret, and the receiver recomputes the digest from
 * the body it received and the secret it was given. The header carries it as
 * `sha256=<hex>` so a receiver can implement the check without reading source.
 *
 * Exported separately from the worker so the delivery path and its tests share
 * one implementation.
 *
 * @param {Object} payload - The JSON payload to sign
 * @param {string} secret - The endpoint's secret key
 * @returns {string} The hex-encoded signature
 */
function generateSignature(payload, secret) {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

/**
 * Custom backoff strategy for BullMQ.
 * Implements exponential backoff: 60s, 120s, 240s, 480s, 960s (up to 5 attempts).
 */
const customBackoffStrategy = (attemptsMade) => {
  if (attemptsMade > 5) return null; // Stop retrying after 5 attempts
  // Math.pow(2, attemptsMade - 1) * 60000 -> 1m, 2m, 4m, 8m, 16m
  return Math.pow(2, attemptsMade - 1) * 60000;
};

/**
 * The core job processor.
 *
 * Exported so tests can call it directly instead of going through a live
 * BullMQ worker (which would need a real Redis connection).
 */
async function processWebhookJob(job) {
  const { endpointId, tenantId, url, signingSecret, eventName, payload } =
    job.data;
  const attempt = job.attemptsMade + 1;

  // 1. Generate HMAC Signature
  const signature = generateSignature(payload, signingSecret);

  // 2. Prepare Delivery Log Entry
  const deliveryLog = {
    endpointId,
    tenantId,
    eventName,
    payload,
    signature,
    attemptCount: attempt,
    isSuccess: false,
    nextRetryAt: null,
  };

  try {
    // 3. Send HTTP POST Request
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-PaySphere-Signature': `sha256=${signature}`,
        'X-PaySphere-Event': eventName,
        'User-Agent': 'PaySphere-Webhooks/1.0',
      },
      timeout: 10000, // 10 second timeout
      validateStatus: () => true, // Don't throw on 4xx/5xx, handle manually
    });

    // 4. Evaluate Success (2xx status codes are success)
    const isSuccess = response.status >= 200 && response.status < 300;

    deliveryLog.httpStatus = response.status;
    deliveryLog.responseBody =
      typeof response.data === 'string'
        ? response.data.slice(0, 1000)
        : JSON.stringify(response.data).slice(0, 1000);
    deliveryLog.isSuccess = isSuccess;

    if (isSuccess) {
      // A webhook that 2xx'd *was delivered*; a failure to persist the log
      // afterwards must not make BullMQ retry it, or the receiver gets the same
      // event twice. Log the miss and move on.
      try {
        await WebhookDelivery.create(deliveryLog);
      } catch (logError) {
        logger.error('Webhook delivered but delivery log could not be saved', {
          endpointId,
          url,
          event: eventName,
          error: logError.message,
        });
      }

      return { success: true, status: response.status };
    }

    throw new Error(`Received HTTP ${response.status}`);
  } catch (error) {
    // Handle network errors, timeouts, or non-2xx responses.
    //
    // A non-2xx is thrown as a plain `Error("Received HTTP ...")` with no
    // `error.response`, so `error.response?.status` is undefined there — keep
    // the status we already captured rather than wiping it back to null.
    deliveryLog.errorMessage = error.message;
    deliveryLog.httpStatus = error.response?.status ?? deliveryLog.httpStatus;

    // Calculate next retry time if it will be retried
    if (attempt < 5) {
      deliveryLog.nextRetryAt = new Date(
        Date.now() + Math.pow(2, attempt - 1) * 60000,
      );
    } else {
      deliveryLog.isDlq = true;
    }

    // Save Failure Log. If the log write itself fails, the original webhook
    // error must still propagate to BullMQ so the job is retried.
    try {
      await WebhookDelivery.create(deliveryLog);
    } catch (logError) {
      logger.error('Failed to persist webhook delivery failure', {
        endpointId,
        url,
        event: eventName,
        error: logError.message,
      });
    }

    logger.warn(`Webhook delivery failed (Attempt ${attempt}/5)`, {
      endpointId,
      url,
      event: eventName,
      error: error.message,
    });

    // Throw error to trigger BullMQ retry mechanism
    throw error;
  }
}

let worker = null;

/**
 * Start the BullMQ worker for the `webhook-deliveries` queue.
 *
 * The worker used to be created at require time, so any import — a test wanting
 * `generateSignature`, say — spun up a live worker against Redis (#664 pattern:
 * side-effect modules get deleted as unused or surprise you when imported).
 * `index.js` calls this once during boot. Idempotent.
 *
 * @returns {import("bullmq").Worker}
 */
function startWebhookWorker() {
  if (worker) return worker;

  worker = new Worker('webhook-deliveries', processWebhookJob, {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 webhooks simultaneously
    settings: {
      backoffStrategy: customBackoffStrategy,
    },
  });

  worker.on('completed', (job) => {
    logger.debug(`Webhook job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    if (job.attemptsMade >= 5) {
      logger.error(
        `Webhook job ${job.id} permanently failed after 5 attempts`,
        {
          endpointId: job.data.endpointId,
          error: err.message,
        },
      );
    }
  });

  logger.info('Webhook worker started', { queue: 'webhook-deliveries' });

  return worker;
}

/**
 * Gracefully shuts down the BullMQ worker.
 * Awaits completion of in-progress jobs.
 * @returns {Promise<void>}
 */
async function stopWebhookWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

module.exports = {
  startWebhookWorker,
  stopWebhookWorker,
  processWebhookJob,
  generateSignature,
  customBackoffStrategy,
};
