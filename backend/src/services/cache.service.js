/**
 * @fileoverview Advanced Redis Cache Service
 * @description Provides a comprehensive caching layer for PaySphere. Supports
 * complex MongoDB aggregation caching, tag-based invalidation, pattern matching,
 * safe JSON serialization/deserialization, and an in-memory fallback for
 * environments without Redis.
 *
 * Issues: #722 (Reports Caching), #519 (Dashboard Caching)
 */

const { createClient } = require('redis');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * In-Memory Fallback Cache
 * Used when REDIS_URI is not provided or connection fails.
 */
class MemoryCache {
  constructor() {
    this.store = new Map();
    // Prevent memory leak by periodically cleaning up expired keys
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.store.entries()) {
        if (now > item.expiresAt) {
          this.store.delete(key);
        }
      }
    }, 60000);
    this.cleanupInterval.unref(); // Don't block Node.js from exiting
    logger.info(
      'Redis is disabled/unavailable. Using in-memory fallback cache.',
    );
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.data;
  }

  setEx(key, ttlSeconds, data) {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  del(key) {
    this.store.delete(key);
  }

  deleteByPattern(pattern) {
    // Simple substring match for in-memory fallback
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Redis Client Configuration
 */
const redisUrl = process.env.REDIS_URI || process.env.REDIS_URL;
let redisClient = null;
let memoryCache = null;
let isRedisEnabled = false;

if (redisUrl) {
  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error(
            'Redis: Maximum reconnection attempts reached. Falling back to memory cache.',
          );
          return new Error('Redis max retries reached.');
        }
        // Exponential backoff with jitter
        const delay = Math.min(retries * 50, 500) + Math.random() * 100;
        logger.warn(
          `Redis: Reconnecting in ${Math.round(delay)}ms (Attempt ${retries})`,
        );
        return delay;
      },
    },
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
  redisClient.on('connect', () => logger.info('Redis Client Connected'));
  redisClient.on('reconnecting', () =>
    logger.info('Redis Client Reconnecting'),
  );
} else {
  memoryCache = new MemoryCache();
}

/**
 * Connect to Redis on application startup
 */
async function connectRedis() {
  if (!redisClient) return;
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      isRedisEnabled = true;
    }
  } catch (error) {
    logger.error(
      'Failed to connect to Redis, falling back to memory cache:',
      error.message,
    );
    memoryCache = new MemoryCache();
    isRedisEnabled = false;
  }
}

/**
 * Generates a deterministic MD5 hash for cache keys
 * @param {string} str - The string to hash
 * @returns {string} MD5 hex digest
 */
function generateHash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Retrieves a value from the cache
 * @param {string} key - The cache key
 * @returns {Promise<any>} The parsed JSON value or null
 */
async function get(key) {
  try {
    if (isRedisEnabled && redisClient?.isOpen) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } else if (memoryCache) {
      return memoryCache.get(key);
    }
    return null;
  } catch (error) {
    logger.error(`Cache GET error for key ${key}:`, error.message);
    return null;
  }
}

/**
 * Sets a value in the cache with a TTL
 * @param {string} key - The cache key
 * @param {number} ttl - Time to live in seconds
 * @param {any} value - The value to cache (will be JSON stringified)
 * @param {string[]} [tags=[]] - Optional tags for group invalidation
 */
async function setEx(key, ttl, value, tags = []) {
  try {
    if (isRedisEnabled && redisClient?.isOpen) {
      const serialized = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serialized);

      // Store tag associations for bulk invalidation
      if (tags.length > 0) {
        const pipeline = redisClient.multi();
        tags.forEach((tag) => pipeline.sAdd(`tag:${tag}`, key));
        await pipeline.exec();
      }
    } else if (memoryCache) {
      memoryCache.setEx(key, ttl, value);
    }
  } catch (error) {
    logger.error(`Cache SETEX error for key ${key}:`, error.message);
  }
}

/**
 * Deletes a specific key from the cache
 * @param {string} key - The cache key
 */
async function del(key) {
  try {
    if (isRedisEnabled && redisClient?.isOpen) {
      await redisClient.del(key);
    } else if (memoryCache) {
      memoryCache.del(key);
    }
  } catch (error) {
    logger.error(`Cache DEL error for key ${key}:`, error.message);
  }
}

/**
 * Invalidates all cache keys associated with a specific tag
 * @param {string} tag - The tag to invalidate
 */
async function invalidateTag(tag) {
  if (!isRedisEnabled || !redisClient?.isOpen) return;
  try {
    const tagKey = `tag:${tag}`;
    const keys = await redisClient.sMembers(tagKey);

    if (keys.length > 0) {
      const pipeline = redisClient.multi();
      keys.forEach((k) => pipeline.del(k));
      pipeline.del(tagKey);
      await pipeline.exec();
      logger.debug(`Invalidated ${keys.length} keys for tag: ${tag}`);
    }
  } catch (error) {
    logger.error(`Redis Tag Invalidation error for tag ${tag}:`, error.message);
  }
}

/**
 * Invalidates multiple tags at once
 * @param {string[]} tags - The tags to invalidate
 */
async function invalidateTags(tags) {
  if (!Array.isArray(tags)) tags = [tags];
  for (const tag of tags) {
    await invalidateTag(tag);
  }
}

/**
 * Deletes keys matching a specific pattern
 * @param {string} pattern - The Redis SCAN pattern (e.g., `reports:*`)
 */
async function deleteByPattern(pattern) {
  try {
    if (isRedisEnabled && redisClient?.isOpen) {
      let cursor = '0';
      do {
        const reply = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = reply.cursor;
        if (reply.keys.length > 0) {
          await redisClient.del(reply.keys);
        }
      } while (cursor !== '0');
    } else if (memoryCache) {
      memoryCache.deleteByPattern(pattern);
    }
  } catch (error) {
    logger.error(
      `Cache Pattern Delete error for pattern ${pattern}:`,
      error.message,
    );
  }
}

// ============================================================
// Domain-Specific Invalidation Helpers
// ============================================================

/**
 * Invalidates analytics cache for a user (Issue #415)
 * @param {string} userId
 */
const invalidateAnalytics = (userId) => invalidateTag(`analytics:${userId}`);

/**
 * Invalidates reports cache for a user (Issue #722)
 * @param {string} userId
 */
const invalidateReports = (userId) => invalidateTag(`reports:${userId}`);

/**
 * Invalidates the dashboard summary cache for a specific user (Issue #519)
 * @param {string} userId
 */
async function invalidateDashboardSummary(userId) {
  if (!userId) return;
  try {
    const cacheKey = `dashboard:summary:${userId}`;
    await del(cacheKey);
    logger.info(`Dashboard summary cache invalidated for user ${userId}`);
  } catch (error) {
    logger.error(
      `Failed to invalidate dashboard summary cache for user ${userId}:`,
      error.message,
    );
  }
}

/**
 * Invalidates all dashboard-related caches for a user (Issue #519)
 * @param {string} userId
 */
async function invalidateAllDashboardCaches(userId) {
  if (!userId) return;
  try {
    await deleteByPattern(`dashboard:*:${userId}`);
    logger.info(`All dashboard caches invalidated for user ${userId}`);
  } catch (error) {
    logger.error(
      `Failed to invalidate all dashboard caches for user ${userId}:`,
      error.message,
    );
  }
}

/**
 * Invalidates all audit logs cache for a specific tenant.
 * @param {string} tenantId
 */
async function invalidateAuditLogs(tenantId) {
  if (!tenantId) return;
  try {
    await deleteByPattern(`audit:logs:${tenantId}:*`);
    logger.info(`Audit logs cache invalidated for tenant ${tenantId}`);
  } catch (error) {
    logger.error(
      `Failed to invalidate audit logs cache for tenant ${tenantId}:`,
      error.message,
    );
  }
}

/**
 * Backward-compatible alias for deleteByPattern
 */
const invalidatePattern = deleteByPattern;

/**
 * Gracefully shuts down the cache service
 */
async function destroy() {
  if (memoryCache) memoryCache.destroy();
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis Client Disconnected');
  }
}

module.exports = {
  redisClient,
  connectRedis,
  get,
  setEx,
  del,
  invalidateTag,
  invalidateTags,
  deleteByPattern,
  invalidatePattern,
  generateHash,
  invalidateAnalytics,
  invalidateReports,
  invalidateDashboardSummary,
  invalidateAllDashboardCaches,
  invalidateAuditLogs,
  destroy,
};
