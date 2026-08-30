const cacheService = require('../services/cache.service');
const CronLock = require('../models/cronlock.model');
const logger = require('./logger');

/**
 * Acquire a lock for a key.
 * Uses Redis cacheService if available, otherwise falls back to MongoDB.
 * 
 * @param {string} key - Lock key, e.g., 'payroll_lock:tenantId:year:month'
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @returns {Promise<boolean>} - Returns true if lock was acquired, false otherwise.
 */
async function acquireLock(key, ttlMs = 300000) {
  const client = cacheService.redisClient;
  const isRedisReady = client && client.isOpen;

  if (isRedisReady) {
    try {
      const result = await client.set(key, '1', {
        NX: true,
        PX: ttlMs,
      });
      return result === 'OK';
    } catch (err) {
      logger.error('Redis lock acquisition failed, falling back to DB', { error: err.message });
    }
  }

  // Fallback: MongoDB-based lock
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    
    // Atomic compare-and-swap: update if expired, or insert if not exists
    await CronLock.findOneAndUpdate(
      {
        _id: key,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $lt: now } }
        ]
      },
      {
        $setOnInsert: { _id: key },
        $set: { lockedAt: now, expiresAt }
      },
      { upsert: true, new: true }
    );
    return true;
  } catch (err) {
    if (err.code === 11000) {
      // Lock exists and is not expired
      return false;
    }
    logger.error('DB lock acquisition failed', { error: err.message });
    throw err;
  }
}

/**
 * Release a lock for a key.
 * 
 * @param {string} key - Lock key
 * @returns {Promise<boolean>}
 */
async function releaseLock(key) {
  const client = cacheService.redisClient;
  const isRedisReady = client && client.isOpen;

  if (isRedisReady) {
    try {
      await client.del(key);
      return true;
    } catch (err) {
      logger.error('Redis lock release failed, falling back to DB release', { error: err.message });
    }
  }

  // Fallback: MongoDB release
  try {
    const res = await CronLock.deleteOne({ _id: key });
    return res.deletedCount > 0;
  } catch (err) {
    logger.error('DB lock release failed', { error: err.message });
    return false;
  }
}

module.exports = {
  acquireLock,
  releaseLock,
};
