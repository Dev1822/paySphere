const { jobOrchestrator } = require('./queue.service');
const JobDependency = require('../models/jobDependency.model');
const logger = require('../utils/logger');

/**
 * Periodic job to recover failed jobs eligible for retry
 * Scheduled to run every 5 minutes
 */
async function recoverFailedJobs() {
  try {
    const workflowsToRecover = await JobDependency.distinct('workflowId', {
      status: 'pending',
      nextRetryAt: { $lte: new Date() },
    });

    for (const workflowId of workflowsToRecover) {
      const tenantId = await JobDependency.findOne({ workflowId }).select('tenantId');
      if (tenantId) {
        const recovered = await jobOrchestrator.recoverFailedJobs(workflowId, tenantId.tenantId);
        logger.info('Recovery job completed', { workflowId, recoveredCount: recovered });
      }
    }
  } catch (error) {
    logger.error('Job recovery failed', { error: error.message });
  }
}

module.exports = { recoverFailedJobs };