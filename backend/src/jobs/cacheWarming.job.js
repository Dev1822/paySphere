/**
 * @fileoverview Cache Warming Background Job
 * @description Pre-calculates heavy analytics, dashboard metrics, and report data
 * for enterprise users prior to the start of the business day.
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const User = require('../models/user.model');
const { getDashboardSummary } = require('../controllers/dashboard.controller');
const cacheService = require('../services/cache.service');

function startCacheWarming() {
  // Run daily at 4:00 AM server time
  const task = cron.schedule('0 4 * * *', async () => {
    logger.info('Starting daily cache warming process');
    try {
      // Find active tenant admins to warm their caches
      const usersToWarm = await User.find({
        isActive: true,
        role: 'admin',
      }).limit(50);

      for (const user of usersToWarm) {
        try {
          const req = {
            userId: user._id.toString(),
            tenantId: user.tenantId ? user.tenantId.toString() : null,
            originalUrl: '/api/dashboard/summary',
            query: {},
          };

          let responseData = null;
          let statusCode = 200;

          const res = {
            status: (code) => {
              statusCode = code;
              return res;
            },
            json: (data) => {
              responseData = data;
              return res;
            },
            set: () => res,
          };

          await getDashboardSummary(req, res, (err) => {
            if (err) throw err;
          });

          if (statusCode === 200 && responseData) {
            const queryHash = cacheService.generateHash(
              JSON.stringify(req.query),
            );
            const cacheKey = `dashboard:summary:${req.userId}:${req.originalUrl}:${queryHash}`;

            // Match the tags defined in dashboard.routes.js
            const tags = ['dashboard', `dashboard:summary:${req.userId}`];
            // Cache for 24 hours (86400 seconds) since we warm it daily
            await cacheService.setEx(cacheKey, 86400, responseData, tags);
            logger.debug(`Warmed dashboard cache for user ${user._id}`);
          }
        } catch (err) {
          logger.error(
            `Error warming cache for user ${user._id}: ${err.message}`,
          );
        }
      }
      logger.info('Cache warming completed successfully.');
    } catch (error) {
      logger.error('Failed to run cache warming job:', error.message);
    }
  });
  return task;
}

module.exports = { startCacheWarming };
