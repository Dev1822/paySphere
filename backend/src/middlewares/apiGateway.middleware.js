const crypto = require('crypto');
const { validateApiKey } = require('../services/apiKey.service');
const { redisClient } = require('../services/cache.service');
const logger = require('../utils/logger');

/**
 * Checks if a given IP matches any of the whitelisted CIDR blocks.
 */
function ipInCidr(ip, cidr) {
  try {
    const cleanedIp = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
    const [range, bitsStr] = cidr.split('/');
    const cleanedRange = range.startsWith('::ffff:') ? range.substring(7) : range;

    const bits = bitsStr ? parseInt(bitsStr, 10) : 32;

    const isIp4 = cleanedIp.includes('.');
    const isRange4 = cleanedRange.includes('.');

    if (isIp4 && isRange4) {
      const ipInt = cleanedIp.split('.').reduce((int, octet) => (int << 8) + parseInt(octet, 10), 0) >>> 0;
      const rangeInt = cleanedRange.split('.').reduce((int, octet) => (int << 8) + parseInt(octet, 10), 0) >>> 0;
      
      const mask = bits === 0 ? 0 : (~(2 ** (32 - bits) - 1)) >>> 0;
      return (ipInt & mask) === (rangeInt & mask);
    }

    return cleanedIp === cleanedRange;
  } catch (err) {
    return false;
  }
}

/**
 * Slide-window rate limiter per API key using Redis zset.
 * Max 100 requests per minute by default.
 */
async function checkRateLimit(apiKeyId, limit = 100, windowMs = 60000) {
  if (!redisClient || !redisClient.isOpen) {
    return { allowed: true, retryAfter: 0 };
  }

  const key = `rate_limit:${apiKeyId}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const multi = redisClient.multi();
  multi.zRemRangeByScore(key, 0, cutoff);
  multi.zCard(key);
  const replies = await multi.exec();

  const currentRequests = replies[1];

  if (currentRequests >= limit) {
    const oldest = await redisClient.zRangeWithScores(key, 0, 0);
    const retryAfter = oldest.length > 0
      ? Math.ceil((oldest[0].score + windowMs - now) / 1000)
      : Math.ceil(windowMs / 1000);

    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  const randVal = `${now}:${Math.random()}`;
  await redisClient.multi()
    .zAdd(key, { score: now, value: randVal })
    .expire(key, Math.ceil(windowMs / 1000) + 1)
    .exec();

  return { allowed: true, retryAfter: 0 };
}

/**
 * API Gateway Middleware: HMAC validation, CIDR check, Sliding rate limit.
 */
async function apiGateway(req, res, next) {
  try {
    const apiKey = req.headers['x-paysphere-key'];
    const signature = req.headers['x-paysphere-signature'];
    const timestampHeader = req.headers['x-paysphere-timestamp'];

    if (!apiKey) {
      return next(); // Pass to next auth handler (JWT/Session) if no API key is present
    }

    const apiKeyDoc = await validateApiKey(apiKey);
    if (!apiKeyDoc) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }

    // 1. Signature & Timestamp check
    if (!signature || !timestampHeader) {
      return res.status(401).json({ error: 'Signature and Timestamp headers are required' });
    }

    const timestamp = parseInt(timestampHeader, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (isNaN(timestamp) || Math.abs(nowSec - timestamp) > 300) {
      return res.status(401).json({ error: 'Request timestamp is expired or invalid' });
    }

    const method = req.method.toUpperCase();
    const queryStr = Object.keys(req.query || {})
      .sort()
      .map((k) => `${k}=${req.query[k]}`)
      .join('&');
    const bodyStr = req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : '';

    const canonicalString = `${method}\n${timestampHeader}\n${queryStr}\n${bodyStr}`;

    const expectedSignature = crypto
      .createHmac('sha256', apiKeyDoc.secret)
      .update(canonicalString)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid request signature' });
    }

    // 2. IP Whitelisting (CIDR match)
    if (apiKeyDoc.whitelistedCIDRs && apiKeyDoc.whitelistedCIDRs.length > 0) {
      const clientIp = req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip;

      const ipAllowed = apiKeyDoc.whitelistedCIDRs.some((cidr) => ipInCidr(clientIp, cidr));
      if (!ipAllowed) {
        return res.status(403).json({ error: 'Forbidden: IP address not whitelisted' });
      }
    }

    // 3. Sliding-window rate limiter
    const rateLimit = await checkRateLimit(apiKeyDoc._id.toString());
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', rateLimit.retryAfter);
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    req.apiKey = apiKeyDoc;
    req.tenantId = apiKeyDoc.tenantId;
    
    return next();
  } catch (err) {
    logger.error('API Gateway error:', { error: err.message });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  apiGateway,
  ipInCidr,
  checkRateLimit,
};
