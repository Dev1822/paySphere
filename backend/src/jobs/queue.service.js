const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');

let payrollQueue;
let bulkOperationQueue;
if (process.env.REDIS_URL) {
  payrollQueue = new Queue('payroll-processing', {
    connection: redisConnection,
  });
  payrollQueue.on('error', (err) => {
    logger.warn(
      'BullMQ payrollQueue error (likely Redis unreachable):',
      err.message,
    );
  });
  logger.info('BullMQ payroll-processing queue initialized');

  bulkOperationQueue = new Queue('bulk-operations', {
    connection: redisConnection,
  });
  bulkOperationQueue.on('error', (err) => {
    logger.warn(
      'BullMQ bulkOperationQueue error (likely Redis unreachable):',
      err.message,
    );
  });
  logger.info('BullMQ bulk-operations queue initialized');
} else {
  const mockQueue = {
    add: async () => {
      logger.warn('Redis is not configured. queue.add() ignored.');
      return { id: 'mock-job-id' };
    },
    on: () => {},
  };
  payrollQueue = mockQueue;
  bulkOperationQueue = mockQueue;
  logger.warn('BullMQ queues mocked (Redis disabled)');
}

const jobOrchestrator = require('../services/jobOrchestrator.service');

// Attach orchestrator hooks to queues
if (process.env.REDIS_URL) {
  payrollQueue.on('completed', async (job) => {
    const { workflowId, jobId, jobType } = job.data;
    if (workflowId) {
      await jobOrchestrator.completeJob(jobId, workflowId, job.returnvalue);
    }
  });

  payrollQueue.on('failed', async (job, err) => {
    const { workflowId, jobId } = job.data;
    if (workflowId) {
      await jobOrchestrator.failJob(jobId, workflowId, err);
    }
  });

  bulkOperationQueue.on('completed', async (job) => {
    const { workflowId, jobId } = job.data;
    if (workflowId) {
      await jobOrchestrator.completeJob(jobId, workflowId, job.returnvalue);
    }
  });

  bulkOperationQueue.on('failed', async (job, err) => {
    const { workflowId, jobId } = job.data;
    if (workflowId) {
      await jobOrchestrator.failJob(jobId, workflowId, err);
    }
  });
}

module.exports = {
  payrollQueue,
  bulkOperationQueue,
  connection: redisConnection,
  jobOrchestrator,
};