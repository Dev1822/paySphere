const AuditLog = require('../models/auditLog.model');
const {
  generatePayloadHash,
  verifySignature,
} = require('../utils/cryptoAudit');

/**
 * Service to recalculate and verify the cryptographic chain of existing logs.
 */

/**
 * Verifies the integrity of the audit log chain for a specific tenant.
 * @param {String} tenantId
 * @returns {Object} report on chain validity
 */
const verifyTenantChain = async (tenantId) => {
  // Fetch all audit logs for the tenant in chronological order
  const logs = await AuditLog.find({ tenantId }).sort({ createdAt: 1 }).lean();

  if (!logs || logs.length === 0) {
    return {
      valid: true,
      message: 'No audit logs found for this tenant.',
      history: [],
    };
  }

  let expectedPreviousHash = 'GENESIS';
  let valid = true;
  let brokenAt = null;
  const history = [];

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Check previousHash link
    const isPreviousHashValid = log.previousHash === expectedPreviousHash;

    // Recalculate currentHash
    const computedHash = generatePayloadHash(log, expectedPreviousHash);
    const isCurrentHashValid = log.currentHash === computedHash;

    // Verify signature
    const isSignatureValid = verifySignature(computedHash, log.signature);

    const isBlockValid =
      isPreviousHashValid && isCurrentHashValid && isSignatureValid;

    history.push({
      index: i,
      id: log._id,
      timestamp: log.createdAt,
      action: log.action,
      valid: isBlockValid,
      details: {
        isPreviousHashValid,
        isCurrentHashValid,
        isSignatureValid,
      },
    });

    if (!isBlockValid && valid) {
      valid = false;
      brokenAt = i;
    }

    // Set the expected previous hash for the next block
    expectedPreviousHash = log.currentHash || computedHash;
  }

  return {
    valid,
    brokenAt,
    totalLogs: logs.length,
    history,
  };
};

module.exports = {
  verifyTenantChain,
};
