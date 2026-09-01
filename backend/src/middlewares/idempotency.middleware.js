const redisClient = require('../config/redis');
const IdempotencyRecord = require('../models/idempotencyRecord.model');
const logger = require('../utils/logger');
const { createCircuitBreaker } = require('../utils/circuitBreaker');
const { acquireFallbackLock, getFallbackRecord, completeFallbackRecord } = require('../utils/idempotencyFallback');

const fetchBreaker = createCircuitBreaker(async ({ tenantId, idempotencyKey, isRedisAvailable, redisKey }) => {
  if (isRedisAvailable) {
    const data = await redisClient.get(redisKey);
    return data ? JSON.parse(data) : null;
  } else {
    return await IdempotencyRecord.findOne({ tenantId, idempotencyKey }).lean();
  }
}, 'idempotency-fetch');

const saveProcessingBreaker = createCircuitBreaker(async ({ tenantId, idempotencyKey, isRedisAvailable, redisKey, processingRecord }) => {
  if (isRedisAvailable) {
    const acquired = await redisClient.set(
      redisKey,
      JSON.stringify(processingRecord),
      'PX',
      24 * 60 * 60 * 1000,
      'NX',
    );
    if (!acquired) {
      const err = new Error('Duplicate Processing');
      err.code = 'DUPLICATE';
      throw err;
    }
  } else {
    try {
      await IdempotencyRecord.create(processingRecord);
    } catch (err) {
      if (err.code === 11000) {
        const error = new Error('Duplicate Processing');
        error.code = 'DUPLICATE';
        throw error;
      }
      throw err;
    }
  }
}, 'idempotency-save-processing');

const saveCompletionBreaker = createCircuitBreaker(async ({ tenantId, idempotencyKey, isRedisAvailable, redisKey, completedRecord }) => {
  if (isRedisAvailable) {
    await redisClient.set(
      redisKey,
      JSON.stringify(completedRecord),
      'PX',
      24 * 60 * 60 * 1000,
    );
  } else {
    await IdempotencyRecord.updateOne(
      { tenantId, idempotencyKey },
      { $set: completedRecord },
      { upsert: true },
    );
  }
}, 'idempotency-save-completion');

/**
 * Idempotency Middleware based on IETF Idempotency-Key draft.
 * Prevents duplicate execution of non-idempotent operations.
 * Implements circuit breaker and local disk fallback for resilience.
 */
const idempotencyMiddleware = async (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context required for idempotency' });
  }

  const redisKey = `idempotency:${tenantId}:${idempotencyKey}`;
  const isRedisAvailable = redisClient.isRedisAvailable && redisClient.isRedisAvailable();

  let existingRecord = null;
  let usedFallback = false;

  try {
    existingRecord = await fetchBreaker.fire({ tenantId, idempotencyKey, isRedisAvailable, redisKey });
  } catch (error) {
    logger.warn('Circuit breaker open or fetch failed, falling back to local disk', { error: error.message });
    usedFallback = true;
    try {
      existingRecord = await getFallbackRecord(tenantId, idempotencyKey);
    } catch (fallbackError) {
      return res.status(500).json({ error: 'Internal server error checking idempotency' });
    }
  }

  if (existingRecord) {
    if (existingRecord.status === 'processing') {
      return res.status(409).json({ error: 'A request with this Idempotency-Key is already processing' });
    }
    if (existingRecord.status === 'completed') {
      return res.status(existingRecord.responseStatus || 200).json(existingRecord.responseBody);
    }
  }

  const processingRecord = {
    tenantId,
    idempotencyKey,
    status: 'processing',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  if (!usedFallback) {
    try {
      await saveProcessingBreaker.fire({ tenantId, idempotencyKey, isRedisAvailable, redisKey, processingRecord });
    } catch (error) {
      if (error.code === 'DUPLICATE') {
        return res.status(409).json({ error: 'A request with this Idempotency-Key is already processing' });
      }
      logger.warn('Circuit breaker open or save failed, falling back to local disk', { error: error.message });
      usedFallback = true;
    }
  }

  if (usedFallback) {
    try {
      const acquired = await acquireFallbackLock(tenantId, idempotencyKey);
      if (!acquired) {
        return res.status(409).json({ error: 'A request with this Idempotency-Key is already processing' });
      }
    } catch (fallbackError) {
      return res.status(500).json({ error: 'Internal server error saving idempotency status' });
    }
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const saveCompletion = async (body, status) => {
    let parsedBody = body;
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {}
    }

    const completedRecord = {
      tenantId,
      idempotencyKey,
      status: 'completed',
      responseBody: parsedBody,
      responseStatus: status || res.statusCode || 200,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    if (usedFallback) {
      await completeFallbackRecord(tenantId, idempotencyKey, completedRecord.responseStatus, completedRecord.responseBody);
    } else {
      try {
        await saveCompletionBreaker.fire({ tenantId, idempotencyKey, isRedisAvailable, redisKey, completedRecord });
      } catch (error) {
        logger.warn('Circuit breaker open or save completion failed, falling back to local disk', { error: error.message });
        await completeFallbackRecord(tenantId, idempotencyKey, completedRecord.responseStatus, completedRecord.responseBody);
      }
    }
  };

  res.json = function (body) {
    saveCompletion(body, res.statusCode);
    return originalJson(body);
  };

  res.send = function (body) {
    if (typeof body === 'string') {
      saveCompletion(body, res.statusCode);
    }
    return originalSend(body);
  };

  next();
};

module.exports = idempotencyMiddleware;
