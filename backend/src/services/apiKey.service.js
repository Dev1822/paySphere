const crypto = require('crypto');
const ApiKey = require('../models/apiKey.model');
const logger = require('../utils/logger');

// The prefix for all our API keys.
const API_KEY_PREFIX = 'ps_';

/**
 * Generate a new API Key for a tenant.
 * The key format is ps_{id}_{random} where {id} is the database ObjectId and {random} is cryptographically secure.
 * @param {string} tenantId
 * @param {string} userId (creator)
 * @param {string} name
 * @param {string[]} scopes
 * @returns {Promise<{ apiKey: ApiKey, rawKey: string }>}
 */
async function generateApiKey(tenantId, userId, name, scopes = [], whitelistedCIDRs = []) {
  // Generate a random 32-byte hex string (64 characters)
  const randomSecret = crypto.randomBytes(32).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');

  // We'll save a placeholder first to get the _id
  const apiKeyDoc = new ApiKey({
    tenantId,
    name,
    createdBy: userId,
    prefix: API_KEY_PREFIX,
    scopes,
    secret,
    whitelistedCIDRs,
    hashedKey: 'temp', // will replace immediately
  });

  await apiKeyDoc.save();

  // The raw key the user will use
  const rawKey = `${API_KEY_PREFIX}${apiKeyDoc._id.toString()}_${randomSecret}`;

  // Hash the rawKey for storage
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  apiKeyDoc.hashedKey = hashedKey;
  await apiKeyDoc.save();

  logger.info(`Generated new API key for tenant ${tenantId}`, { name, scopes });

  return {
    apiKey: apiKeyDoc,
    rawKey,
  };
}

/**
 * Validate an API key from the Authorization header.
 * @param {string} rawKey
 * @returns {Promise<ApiKey|null>}
 */
async function validateApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  // Extract the ID
  const parts = rawKey.split('_');
  if (parts.length !== 3) {
    return null;
  }
  const id = parts[1];

  let apiKeyDoc;
  try {
    apiKeyDoc = await ApiKey.findById(id);
  } catch (err) {
    // Invalid object id format
    return null;
  }

  if (!apiKeyDoc || !apiKeyDoc.isActive) {
    return null;
  }

  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
  if (apiKeyDoc.hashedKey !== hashedKey) {
    return null;
  }

  // Update last used at in background
  ApiKey.findByIdAndUpdate(id, { lastUsedAt: new Date() })
    .exec()
    .catch((err) => {
      logger.error('Failed to update API Key lastUsedAt', {
        error: err.message,
        keyId: id,
      });
    });

  return apiKeyDoc;
}

/**
 * List active API keys for a tenant.
 * @param {string} tenantId
 * @returns {Promise<ApiKey[]>}
 */
async function listApiKeys(tenantId) {
  return ApiKey.find({ tenantId, isActive: true })
    .select('-hashedKey') // Never return the hash
    .sort({ createdAt: -1 });
}

/**
 * Revoke an API key.
 * @param {string} keyId
 * @param {string} tenantId
 * @returns {Promise<boolean>}
 */
async function revokeApiKey(keyId, tenantId) {
  const result = await ApiKey.findOneAndUpdate(
    { _id: keyId, tenantId },
    { isActive: false },
  );

  if (result) {
    logger.info(`Revoked API key ${keyId} for tenant ${tenantId}`);
    return true;
  }
  return false;
}

/**
 * Update whitelisted CIDR blocks for an API key.
 * @param {string} keyId
 * @param {string} tenantId
 * @param {string[]} cidrBlocks
 * @returns {Promise<ApiKey|null>}
 */
async function updateApiKeyCIDRs(keyId, tenantId, cidrBlocks) {
  const apiKey = await ApiKey.findOneAndUpdate(
    { _id: keyId, tenantId, isActive: true },
    { $set: { whitelistedCIDRs: cidrBlocks } },
    { new: true }
  );
  return apiKey;
}

module.exports = {
  API_KEY_PREFIX,
  generateApiKey,
  validateApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKeyCIDRs,
};
