/**
 * Employee Import Queue - Issue #1903
 *
 * BullMQ queue for bulk employee imports with resumable recovery.
 */
'use strict';

const Queue = require('bull');
const redis = require('../config/redis');
const { processBatch } = require('../workers/employeeImport.worker');
const EmployeeImport = require('../models/employeeImport.model');
const logger = require('../utils/logger');

const importQueue = new Queue('employee-import', {
  redis: redis.options,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true
  }
});

// Process batch jobs
importQueue.process('process-batch', 5, async (job) => {
  try {
    const result = await processBatch(job);
    return result;
  } catch (err) {
    logger.error('Batch processing failed', {
      jobId: job.id,
      error: err.message
    });
    throw err;
  }
});

// Track job completion
importQueue.on('completed', async (job, result) => {
  logger.info('Batch completed', {
    jobId: job.id,
    result
  });
});

// Update job status on failure
importQueue.on('failed', async (job, err) => {
  const { importJobId } = job.data;
  const importJob = await EmployeeImport.findById(importJobId);
  
  if (importJob && importJob.status === 'importing') {
    // Mark as failed after max retries
    if (job.attemptsMade >= job.opts.attempts) {
      importJob.status = 'failed';
      await importJob.save();
      logger.error('Import job failed after retries', { importJobId });
    }
  }
});

module.exports = importQueue;