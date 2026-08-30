/**
 * Payslip Generation Queue - Issue #1904
 *
 * BullMQ queue for deterministic payslip PDF generation.
 * Prevents duplicate generation via jobHash.
 */
'use strict';

const Queue = require('bull');
const redis = require('../config/redis');
const { generatePayslip } = require('../workers/payslipGeneration.worker');
const PayslipGeneration = require('../models/payslipGeneration.model');
const logger = require('../utils/logger');

const payslipQueue = new Queue('payslip-generation', {
  redis: redis.options,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 } // Keep for 1 hour
  }
});

// Process payslip generation jobs
payslipQueue.process(5, async (job) => {
  try {
    const result = await generatePayslip(job);
    return result;
  } catch (err) {
    logger.error('Payslip generation job failed', {
      jobId: job.id,
      jobHash: job.data.jobHash,
      error: err.message
    });
    throw err;
  }
});

// Track completion
payslipQueue.on('completed', async (job, result) => {
  logger.info('Payslip job completed', {
    jobId: job.id,
    jobHash: job.data.jobHash,
    skipped: result.skipped
  });
});

// Handle permanent failures
payslipQueue.on('failed', async (job, err) => {
  const { jobHash } = job.data;
  const generation = await PayslipGeneration.findOne({ jobHash });
  
  if (generation && job.attemptsMade >= job.opts.attempts) {
    generation.status = 'failed';
    generation.errorMessage = `Failed after ${job.attemptsMade} attempts: ${err.message}`;
    await generation.save();
    logger.error('Payslip job permanently failed', { jobHash, jobId: job.id });
  }
});

module.exports = payslipQueue;