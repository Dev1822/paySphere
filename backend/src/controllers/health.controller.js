'use strict';
const mongoose = require('mongoose');
const logger = require('../utils/logger');
function liveness(req, res) {
  res.json({ status: 'ok', uptime: process.uptime() });
}
async function readiness(req, res) {
  const { getIsShuttingDown } = require('../shutdown');
  if (getIsShuttingDown && getIsShuttingDown()) {
    return res
      .status(503)
      .json({
        status: 'shutting_down',
        checks: { mongo: false, redis: false },
        errors: ['Shutdown in progress'],
      });
  }

  const checks = { mongo: false, redis: false };
  const errors = [];
  try {
    await mongoose.connection.db.admin().ping();
    checks.mongo = true;
  } catch (err) {
    errors.push('MongoDB: ' + err.message);
    logger.warn('Readiness: MongoDB ping failed', { error: err.message });
  }
  try {
    const { isRedisAvailable } = require('../config/redis');
    checks.redis = isRedisAvailable();
  } catch (_e) {
    checks.redis = false;
  }
  const ready = checks.mongo;
  return res
    .status(ready ? 200 : 503)
    .json({ status: ready ? 'ready' : 'degraded', checks, errors });
}
async function metrics(req, res) {
  try {
    const c = require('prom-client');
    res.set('Content-Type', c.register.contentType);
    res.end(await c.register.metrics());
  } catch (err) {
    logger.error('Failed to serve metrics', { error: err.message });
    res.status(500).end('# metrics unavailable\n');
  }
}
module.exports = { liveness, readiness, metrics };
