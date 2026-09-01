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
  const { event, payload } = job.data;

  // Consume standardized EDA payloads
  switch (event) {
    case 'PdfGeneration':
    case 'EmailDispatch':
    case 'EmployeeOnboarded':
    case 'OffboardingInitiated':
    case 'PayrollFinalized': {
      if (payload.type === 'payslip' || job.name === 'payslip') {
        const { employee, payroll } = payload;
        await sendPayslipEmail(employee, payroll);
        if (payroll?._id) {
          await PayrollUpdate.updateOne(
            { _id: payroll._id },
            { payslipEmailed: true },
          );
        }
        return { delivered: true };
      }

      // Treat as generic email if no specific handling
      const result = await sendEmail(payload);
      if (!result || result.success === false) {
        throw new Error(result?.error || 'Email delivery failed');
      }
      return { delivered: true };
    }

    default:
      throw new Error(`Unknown email job event: ${event}`);
  }
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
