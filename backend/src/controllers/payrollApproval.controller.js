/**
 * Payroll Approval Controller - Issue #1247
 *
 * POST /api/payroll/:payrollId/approve          - approve the current stage
 * POST /api/payroll/:payrollId/reject           - reject with mandatory comment
 * POST /api/payroll/:payrollId/lock             - lock the current stage
 * DELETE /api/payroll/:payrollId/lock           - release the lock
 * GET  /api/payroll/:payrollId/approval-status  - full stage history + lock info
 */
'use strict';

const WorkflowInstance  = require('../models/workflowInstance.model');
const approvalEngine    = require('../services/approvalEngine');
const approvalService   = require('../services/payrollApproval.service');
const logger            = require('../utils/logger');

async function findInstance(payrollId, tenantId) {
  return WorkflowInstance.findOne({
    ...{},
    targetEntityId: payrollId,
    targetEntityType: 'PayrollUpdate',
    status: { $in: ['pending', 'in_progress'] },
  });
}

async function approveStage(req, res) {
  try {
    const instance = await findInstance(req.params.payrollId, req.tenantId);
    if (!instance) return res.status(404).json({ message: 'No open approval workflow found for this payroll run.' });

    const updated = await approvalEngine.processStageApproval({
      instanceId: instance._id,
      actorId: req.userId,
      action: 'approve',
      comment: req.body.comment || '',
      expectedVersion: instance.__v,
    });

    return res.json({ message: 'Stage approved.', status: updated.status, currentNode: updated.currentNodeId });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('approveStage error', { error: err.message });
    return res.status(500).json({ message: 'Approval failed. Please try again.' });
  }
}

async function rejectStage(req, res) {
  try {
    const instance = await findInstance(req.params.payrollId, req.tenantId);
    if (!instance) return res.status(404).json({ message: 'No open approval workflow found for this payroll run.' });

    if (!req.body.comment || !req.body.comment.trim()) {
      return res.status(422).json({ message: 'A rejection reason is required.' });
    }

    const updated = await approvalEngine.processStageApproval({
      instanceId: instance._id,
      actorId: req.userId,
      action: 'reject',
      comment: req.body.comment,
      expectedVersion: instance.__v,
    });

    return res.json({ message: 'Stage rejected.', status: updated.status });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('rejectStage error', { error: err.message });
    return res.status(500).json({ message: 'Rejection failed. Please try again.' });
  }
}

/**
 * POST /api/payroll/:payrollId/lock
 *
 * Lock the current approval stage so only the lock holder can act on it.
 * The lock auto-expires after 10 minutes (configurable via ttlMs body param).
 */
async function lockStage(req, res) {
  try {
    const instance = await findInstance(req.params.payrollId, req.tenantId);
    if (!instance) return res.status(404).json({ message: 'No open approval workflow found.' });

    const ttlMs = parseInt(req.body.ttlMs, 10) || undefined;
    const updated = await approvalService.lockStage(instance._id, req.userId, ttlMs);

    return res.json({
      message: 'Stage locked.',
      lockedBy: updated.lockedBy,
      lockedAt: updated.lockedAt,
      lockExpiresAt: updated.lockExpiresAt,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('lockStage error', { error: err.message });
    return res.status(500).json({ message: 'Could not lock stage.' });
  }
}

/**
 * DELETE /api/payroll/:payrollId/lock
 *
 * Release the lock if the caller is the lock holder.
 */
async function releaseLock(req, res) {
  try {
    const instance = await findInstance(req.params.payrollId, req.tenantId);
    if (!instance) return res.status(404).json({ message: 'No open approval workflow found.' });

    await approvalService.releaseLock(instance._id, req.userId);

    return res.json({ message: 'Lock released.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('releaseLock error', { error: err.message });
    return res.status(500).json({ message: 'Could not release lock.' });
  }
}

/**
 * GET /api/payroll/:payrollId/approval-status
 *
 * Returns the full approval status including:
 *   - Current stage and status
 *   - Stage chain with per-stage actor, timestamp, comment
 *   - Lock information (who holds it, when it expires)
 *   - Escalation deadline
 *   - Version number for optimistic locking
 */
async function getApprovalStatus(req, res) {
  try {
    const instance = await WorkflowInstance.findOne({
      ...{},
      targetEntityId: req.params.payrollId,
      targetEntityType: 'PayrollUpdate',
    })
      .populate('history.actionBy', 'fullName email')
      .populate('lockedBy', 'fullName email')
      .populate('stageChain.actorId', 'fullName email');

    if (!instance) return res.status(404).json({ message: 'No approval workflow found for this payroll run.' });

    // Check if lock has expired
    const lockExpired = instance.lockExpiresAt && instance.lockExpiresAt < new Date();

    return res.json({
      status: instance.status,
      currentNode: instance.currentNodeId,
      history: instance.history,
      stageLog: instance.stageLog || [],
      stageChain: instance.stageChain || [],
      lock: {
        lockedBy: lockExpired ? null : instance.lockedBy,
        lockedAt: lockExpired ? null : instance.lockedAt,
        lockExpiresAt: instance.lockExpiresAt,
        isExpired: lockExpired,
      },
      escalation: {
        deadlineAt: instance.escalationDeadlineAt,
        escalatedAt: instance.escalatedAt,
      },
      version: instance.__v,
    });
  } catch (err) {
    logger.error('getApprovalStatus error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch approval status.' });
  }
}

async function saveApprovalWorkflow(req, res, next) {
  try {
    const { name, sequence } = req.body;
    if (!name || !sequence || !Array.isArray(sequence) || sequence.length === 0) {
      return res.status(400).json({ message: 'name and sequence are required' });
    }

    const ApprovalWorkflow = require('../models/approvalWorkflow.model');
    await ApprovalWorkflow.updateMany(
      {
        isActive: true
      },
      { $set: { isActive: false, effectiveTo: new Date() } }
    );

    const workflow = await ApprovalWorkflow.create({
      name,
      sequence,
      isActive: true,
      effectiveFrom: new Date()
    });

    res.status(201).json({ message: 'Approval workflow configuration saved', workflow });
  } catch (error) {
    next(error);
  }
}

module.exports = { approveStage, rejectStage, lockStage, releaseLock, getApprovalStatus, saveApprovalWorkflow };
