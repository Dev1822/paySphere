/**
 * @fileoverview Integration Sync BullMQ Worker
 * @description Processes queued integration sync jobs in the background (e.g. BambooHR, Workday).
 */
const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');

async function processIntegrationSyncJob(job) {
  const { event, payload } = job.data;

  logger.info(`Integration sync processing event: ${event}`);

  // Refactored to consume standardized EDA payloads.
  switch (event) {
    case 'EmployeeOnboarded':
      // Here we would call external services like BambooHR or Workday to sync data
      logger.debug(
        `Syncing new employee ${payload.employeeId} to integrations...`,
      );
      // e.g., await BambooHRIntegration.syncNewEmployee(payload.employeeId);
      break;

    case 'OffboardingInitiated':
    case 'OffboardingCompleted':
      logger.debug(`Syncing offboarding for employee ${payload.employeeId}...`);
      // e.g., await BambooHRIntegration.terminateEmployee(payload.employeeId);
      break;

    case 'PayrollFinalized':
      logger.debug('Syncing payroll data to financial integrations...');
      break;

    default:
      logger.warn(`Unknown event for integration sync: ${event}`);
  }

  return { synced: true };
}

let worker = null;

function startIntegrationSyncWorker() {
  if (worker) return worker;

  worker = new Worker('integration-sync', processIntegrationSyncJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.debug(`Integration sync job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Integration sync job ${job?.id} (${job?.name}) failed`, {
      error: err.message,
    });
  });

  logger.info('Integration sync worker started', { queue: 'integration-sync' });

  return worker;
}

async function stopIntegrationSyncWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

module.exports = {
  startIntegrationSyncWorker,
  stopIntegrationSyncWorker,
  processIntegrationSyncJob,
};
