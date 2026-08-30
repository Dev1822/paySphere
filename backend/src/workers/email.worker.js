/**
 * @fileoverview Email BullMQ Worker
 * @description Processes queued email jobs in the background (Issue #726).
 * 'payslip' jobs reuse the existing PDF-generation + delivery flow in
 * services/email.service.js; 'generic' jobs send plain transactional emails
 * (password resets, birthday/anniversary greetings, etc) via utils/email.js.
 */
const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const { sendPayslipEmail } = require('../services/email.service');
const { sendEmail } = require('../utils/email');
const PayrollUpdate = require('../models/payroll.model');
const logger = require('../utils/logger');

async function processEmailJob(job) {
  if (job.name === 'payslip') {
    const { employee, payroll } = job.data;
    await sendPayslipEmail(employee, payroll);
    if (payroll?._id) {
      await PayrollUpdate.updateOne(
        { _id: payroll._id },
        { payslipEmailed: true },
      );
    }
    return { delivered: true };
  }

  if (job.name === 'generic') {
    const result = await sendEmail(job.data);
    if (!result || result.success === false) {
      throw new Error(result?.error || 'Email delivery failed');
    }
    return { delivered: true };
  }

  throw new Error(`Unknown email job type: ${job.name}`);
}

let worker = null;

/**
 * Starts the BullMQ worker that drains the `email-processing` queue.
 * Idempotent — `index.js` calls this once during boot.
 * @returns {import('bullmq').Worker}
 */
function startEmailWorker() {
  if (worker) return worker;

  worker = new Worker('email-processing', processEmailJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.debug(`Email job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Email job ${job?.id} (${job?.name}) failed`, {
      error: err.message,
    });
  });

  logger.info('Email worker started', { queue: 'email-processing' });

  return worker;
}

/**
 * Gracefully shuts down the BullMQ worker.
 * Awaits completion of in-progress jobs.
 * @returns {Promise<void>}
 */
async function stopEmailWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

module.exports = { startEmailWorker, stopEmailWorker, processEmailJob };
