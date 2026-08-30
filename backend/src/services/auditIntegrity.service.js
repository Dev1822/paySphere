/**
 * Audit Integrity Service - Issue #1905
 *
 * Implements tamper-evident chaining for audit logs.
 * Each record contains hash of current data + previous record hash.
 * Detects modifications, deletions, and chain breaks.
 */
'use strict';

const crypto = require('crypto');
const AuditLog = require('../models/auditLog.model');
const logger = require('../utils/logger');

/**
 * Generate SHA256 hash from audit record data
 * Includes: event, action, userId, resourceType, resourceId, previousHash
 */
function calculateRecordHash(recordData, previousHash = null) {
  const dataToHash = {
    event: recordData.event,
    action: recordData.action,
    userId: String(recordData.userId),
    resourceType: recordData.resourceType,
    resourceId: String(recordData.resourceId),
    tenantId: String(recordData.tenantId),
    timestamp: recordData.timestamp || new Date().toISOString(),
    previousHash: previousHash || 'genesis'
  };

  const hashString = JSON.stringify(dataToHash);
  return crypto.createHash('sha256').update(hashString).digest('hex');
}

/**
 * Add integrity metadata when creating audit record
 * Links to previous record in tenant/resource chain
 */
async function addIntegrityMetadata(recordData) {
  const { tenantId, resourceType, resourceId } = recordData;

  // Find previous audit record in same chain
  const previousRecord = await AuditLog.findOne({
    tenantId,
    resourceType,
    resourceId
  }).sort({ createdAt: -1 });

  const previousHash = previousRecord ? previousRecord.recordHash : null;

  // Calculate new record hash
  const recordHash = calculateRecordHash(recordData, previousHash);

  return {
    ...recordData,
    recordHash,
    previousHash
  };
}

/**
 * Verify integrity of a single audit record
 * Re-calculates hash and compares to stored value
 */
function verifyRecordIntegrity(record) {
  if (!record.recordHash) {
    return {
      valid: false,
      reason: 'No hash stored'
    };
  }

  const calculatedHash = calculateRecordHash(record, record.previousHash);
  
  return {
    valid: calculatedHash === record.recordHash,
    storedHash: record.recordHash,
    calculatedHash,
    reason: calculatedHash === record.recordHash ? 'OK' : 'Hash mismatch'
  };
}

/**
 * Verify entire chain of audit records for a resource
 * Detects: modifications, deletions, insertions, ordering changes
 */
async function verifyChain(tenantId, resourceType, resourceId) {
  const records = await AuditLog.find({
    tenantId,
    resourceType,
    resourceId
  }).sort({ createdAt: 1 });

  if (records.length === 0) {
    return {
      valid: true,
      totalRecords: 0,
      issues: []
    };
  }

  const issues = [];
  let previousHash = null;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Verify record's own hash integrity
    const verification = verifyRecordIntegrity(record);
    if (!verification.valid) {
      issues.push({
        index: i,
        recordId: String(record._id),
        type: 'HASH_MISMATCH',
        message: `Record hash mismatch (modified or corrupted)`,
        timestamp: record.createdAt
      });
    }

    // Verify link to previous record
    if (i === 0) {
      // First record should have previousHash = null
      if (record.previousHash !== null) {
        issues.push({
          index: i,
          recordId: String(record._id),
          type: 'INVALID_GENESIS',
          message: 'First record should have previousHash = null',
          timestamp: record.createdAt
        });
      }
    } else {
      // Verify chain continuity
      if (record.previousHash !== previousHash) {
        issues.push({
          index: i,
          recordId: String(record._id),
          type: 'CHAIN_BREAK',
          message: 'Previous hash does not match previous record hash (possible deletion)',
          expected: previousHash,
          actual: record.previousHash,
          timestamp: record.createdAt
        });
      }
    }

    previousHash = record.recordHash;
  }

  return {
    valid: issues.length === 0,
    totalRecords: records.length,
    issues,
    chainIntegrity: issues.length === 0 ? 'VALID' : 'BROKEN'
  };
}

/**
 * Repair a broken chain by recalculating hashes
 * Only call after confirming no actual tampering
 * Logs all changes for audit trail
 */
async function repairChain(tenantId, resourceType, resourceId, repairReason) {
  logger.warn('Repairing audit chain', {
    tenantId,
    resourceType,
    resourceId,
    reason: repairReason
  });

  const records = await AuditLog.find({
    tenantId,
    resourceType,
    resourceId
  }).sort({ createdAt: 1 });

  let previousHash = null;
  let repaired = 0;

  for (const record of records) {
    const newRecordHash = calculateRecordHash(record, previousHash);

    if (newRecordHash !== record.recordHash) {
      record.recordHash = newRecordHash;
      await record.save();
      repaired++;
      logger.info('Repaired audit record hash', {
        recordId: String(record._id),
        oldHash: record.recordHash,
        newHash: newRecordHash
      });
    }

    previousHash = newRecordHash;
  }

  return {
    repaired,
    totalRecords: records.length,
    message: `Repaired ${repaired} records`
  };
}

module.exports = {
  calculateRecordHash,
  addIntegrityMetadata,
  verifyRecordIntegrity,
  verifyChain,
  repairChain
};