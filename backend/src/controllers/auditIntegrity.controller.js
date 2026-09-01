/**
 * Audit Integrity Controller - Issue #1905
 *
 * Endpoints for verifying audit log integrity.
 * Detects tampering without modifying audit records.
 */
'use strict';

const auditIntegrity = require('../services/auditIntegrity.service');
const AuditLog = require('../models/auditLog.model');
const logger = require('../utils/logger');

/**
 * Verify integrity of a specific audit record
 */
async function verifyRecord(req, res) {
  try {
    const { recordId } = req.params;

    const record = await AuditLog.findOne({
      _id: recordId,
      ...{}
    });

    if (!record) {
      return res.status(404).json({ message: 'Audit record not found.' });
    }

    const verification = auditIntegrity.verifyRecordIntegrity(record);

    return res.json({
      recordId: String(record._id),
      valid: verification.valid,
      reason: verification.reason,
      event: record.event,
      action: record.action,
      timestamp: record.createdAt
    });
  } catch (err) {
    logger.error('verifyRecord error', { error: err.message });
    return res.status(500).json({ message: 'Failed to verify record.' });
  }
}

/**
 * Verify entire chain for a resource
 */
async function verifyChain(req, res) {
  try {
    const { resourceType, resourceId } = req.params;

    // Verify user has access to this resource/tenant
    const record = await AuditLog.findOne({
      resourceType,
      resourceId,
      ...{}
    });

    if (!record) {
      return res.status(404).json({ message: 'No audit records found for this resource.' });
    }

    const verification = await auditIntegrity.verifyChain(
      req.tenantId,
      resourceType,
      resourceId
    );

    return res.json({
      resourceType,
      resourceId,
      chainIntegrity: verification.chainIntegrity,
      valid: verification.valid,
      totalRecords: verification.totalRecords,
      issuesFound: verification.issues.length,
      issues: verification.issues.length > 0 ? verification.issues : null
    });
  } catch (err) {
    logger.error('verifyChain error', { error: err.message });
    return res.status(500).json({ message: 'Failed to verify chain.' });
  }
}

/**
 * Get integrity report for tenant
 * Summary of all chain statuses
 */
async function getIntegrityReport(req, res) {
  try {
    // Get all distinct resources for this tenant
    const resources = await AuditLog.distinct('resourceType', {});

    const report = {
      scanDate: new Date().toISOString(),
      resourcesScanned: 0,
      chainsValid: 0,
      chainsBroken: 0,
      issues: []
    };

    for (const resourceType of resources) {
      const resourceIds = await AuditLog.distinct('resourceId', {
        resourceType
      });

      for (const resourceId of resourceIds) {
        const verification = await auditIntegrity.verifyChain(
          req.tenantId,
          resourceType,
          resourceId
        );

        report.resourcesScanned++;

        if (verification.valid) {
          report.chainsValid++;
        } else {
          report.chainsBroken++;
          report.issues.push({
            resourceType,
            resourceId,
            issueCount: verification.issues.length
          });
        }
      }
    }

    return res.json(report);
  } catch (err) {
    logger.error('getIntegrityReport error', { error: err.message });
    return res.status(500).json({ message: 'Failed to generate report.' });
  }
}

module.exports = {
  verifyRecord,
  verifyChain,
  getIntegrityReport
};