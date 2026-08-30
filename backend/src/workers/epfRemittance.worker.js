const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const { computePosition } = require('../services/epfRemittance.service');
const { acquireLock, releaseLock } = require('../utils/lockManager');
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

function getSimulationCacheKey(tenantId, establishment, range, asAt) {
  const fromKey = range?.from ? `${range.from.year}-${range.from.month}` : 'all';
  const toKey = range?.to ? `${range.to.year}-${range.to.month}` : 'all';
  return `epf_sim_cache:${tenantId}:${establishment || 'default'}:${fromKey}:${toKey}:${asAt || 'now'}`;
}

async function processEpfRemittanceJob(job) {
  const { tenantId, establishment, range, asAt } = job.data;

  // Calculate financial year based on range.from (default to current year)
  const month = range?.from?.month || 4;
  const year = range?.from?.year || new Date().getFullYear();
  const financialYear = month >= 4 ? year : year - 1;

  const lockKey = `epf_lock:${tenantId}:${financialYear}`;
  const acquired = await acquireLock(lockKey, 300000); // 5 minutes lock

  if (!acquired) {
    throw new Error(`Simulation or computation is already in progress for financial year ${financialYear}`);
  }

  try {
    logger.info(`Starting EPF Belated Remittance simulation job ${job.id} for tenant ${tenantId}`);

    // Update job progress to 50%
    await job.updateProgress(50);

    const data = await computePosition({
      tenantId,
      establishment,
      range,
      asAt: asAt ? new Date(asAt) : new Date(),
    });

    const cacheKey = getSimulationCacheKey(tenantId, establishment, range, asAt);
    await cacheService.setEx(cacheKey, 300, JSON.stringify(data)); // 5 minutes TTL

    // Update job progress to 100%
    await job.updateProgress(100);

    return data;
  } catch (err) {
    logger.error(`EPF Belated Remittance simulation job ${job.id} failed`, { error: err.message });
    throw err;
  } finally {
    await releaseLock(lockKey);
  }
}

let worker = null;

function startEpfRemittanceWorker() {
  if (worker) return worker;

  worker = new Worker('epf-remittance', processEpfRemittanceJob, {
    connection: redisConnection,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    logger.debug(`EPF Remittance job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`EPF Remittance job ${job?.id} failed`, { error: err.message });
  });

  logger.info('EPF Remittance worker started', { queue: 'epf-remittance' });

  return worker;
}

async function stopEpfRemittanceWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

module.exports = {
  startEpfRemittanceWorker,
  stopEpfRemittanceWorker,
  processEpfRemittanceJob,
  getSimulationCacheKey,
};
