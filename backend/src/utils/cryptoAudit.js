const crypto = require('crypto');

// A system secret used to sign the hash (HMAC) to prevent complete recalculation if DB is compromised.
// In a real environment, this should be an environment variable.
const AUDIT_SECRET =
  process.env.AUDIT_SECRET || 'fallback_audit_secret_change_me';

/**
 * Normalizes and extracts the payload for hashing.
 * Removes non-deterministic fields or MongoDB internals.
 * @param {Object} payload
 * @returns {String} JSON string
 */
function normalizePayload(payload) {
  const obj =
    typeof payload.toObject === 'function'
      ? payload.toObject()
      : { ...payload };

  // Exclude MongoDB internals and hashing fields
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;
  delete obj.currentHash;
  delete obj.previousHash;
  delete obj.signature;
  delete obj.recordHash;
  delete obj.hashChainValid;

  // Sort keys to ensure deterministic stringification
  const sortedObj = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sortedObj[key] = obj[key];
    });

  return JSON.stringify(sortedObj);
}

/**
 * Computes a SHA-256 hash of the payload and previous hash.
 * @param {Object} payload
 * @param {String} previousHash
 * @returns {String} computed hash
 */
function generatePayloadHash(payload, previousHash = 'GENESIS') {
  const normalizedPayloadStr = normalizePayload(payload);
  const hash = crypto.createHash('sha256');
  hash.update(normalizedPayloadStr);
  hash.update(previousHash || 'GENESIS');
  return hash.digest('hex');
}

/**
 * Creates an HMAC signature for the given hash using the system secret.
 * @param {String} hash
 * @returns {String} signature
 */
function signHash(hash) {
  const hmac = crypto.createHmac('sha256', AUDIT_SECRET);
  hmac.update(hash);
  return hmac.digest('hex');
}

/**
 * Verifies if the signature matches the hash.
 * @param {String} hash
 * @param {String} signature
 * @returns {Boolean}
 */
function verifySignature(hash, signature) {
  if (!signature) return false;
  const expectedSignature = signHash(hash);
  // Prevent timing attacks and handle potential length differences safely
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature),
    );
  } catch (e) {
    return false;
  }
}

module.exports = {
  generatePayloadHash,
  signHash,
  verifySignature,
  normalizePayload,
};
