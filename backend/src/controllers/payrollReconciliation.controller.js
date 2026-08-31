'use strict';

const PayrollReconciliation = require('../models/payrollReconciliation.model');
const Payroll = require('../models/payroll.model');
const Anomaly = require('../models/anomaly.model');
const payrollDeterminismService = require('../services/PayrollDeterminismService');
const logger = require('../utils/logger');

/**
 * Verify payroll determinism and reconcile against stored records
 * Performs component-level comparison and reports first mismatch
 */
async function verifyPayrollDeterminism(req, res) {
  try {
    const { payrollId } = req.params;

    if (!payrollId) {
      return res.status(400).json({
        message: 'payrollId is required',
      });
    }

    // Fetch the stored payroll record
    const payroll = await Payroll.findById(payrollId).lean();
    if (!payroll) {
      return res.status(404).json({
        message: 'Payroll record not found',
      });
    }

    // Reconstruct input data from payroll metadata
    const inputData = {
      baseSalary: payroll.baseSalary,
      dailyRate: payroll.dailyRate || payroll.baseSalary / 30,
      leaveDays: payroll.leaveDays || 0,
      overtimeHours: payroll.overtimeHours || 0,
      overtimeRate: payroll.overtimeRate || 0,
      bonuses: payroll.bonuses || 0,
      deductions: payroll.deductions || 0,
      taxRate: payroll.taxRate || 0,
    };

    // Reconcile: compare stored vs recalculated
    const reconciliationResult = payrollDeterminismService.reconcilePayroll(
      payroll,
      inputData
    );

    if (!reconciliationResult.isConsistent) {
      // Log the mismatch
      const reconciliationRecord = await PayrollReconciliation.create({
        payrollId,
        status: 'mismatch_detected',
        mismatchedComponent: reconciliationResult.mismatchedComponent,
        differences: reconciliationResult.differences,
        detectedBy: req.userId,
        detectedAt: new Date(),
      });

      return res.status(200).json({
        isConsistent: false,
        message: `Component-level mismatch detected: ${reconciliationResult.mismatchedComponent}`,
        reconciliation: reconciliationRecord,
        differences: reconciliationResult.differences,
      });
    }

    // Update reconciliation record on success
    const reconciliationRecord = await PayrollReconciliation.findOneAndUpdate(
      { payrollId },
      {
        status: 'verified',
        verifiedBy: req.userId,
        verifiedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      isConsistent: true,
      message: 'Payroll is deterministically consistent',
      reconciliation: reconciliationRecord,
    });
  } catch (err) {
    logger.error('verifyPayrollDeterminism error', { error: err.message });
    return res.status(500).json({
      message: 'Failed to verify payroll determinism',
      error: err.message,
    });
  }
}

/**
 * Batch reconcile multiple payrolls
 * Useful for monthly verification runs
 */
async function batchReconcilePayrolls(req, res) {
  try {
    const { payrollIds } = req.body;

    if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
      return res.status(400).json({
        message: 'payrollIds array is required and must not be empty',
      });
    }

    const results = {
      total: payrollIds.length,
      consistent: 0,
      inconsistent: 0,
      errors: 0,
      mismatches: [],
    };

    for (const payrollId of payrollIds) {
      try {
        const payroll = await Payroll.findById(payrollId).lean();
        if (!payroll) {
          results.errors++;
          results.mismatches.push({
            payrollId,
            error: 'Payroll record not found',
          });
          continue;
        }

        const inputData = {
          baseSalary: payroll.baseSalary,
          dailyRate: payroll.dailyRate || payroll.baseSalary / 30,
          leaveDays: payroll.leaveDays || 0,
          overtimeHours: payroll.overtimeHours || 0,
          overtimeRate: payroll.overtimeRate || 0,
          bonuses: payroll.bonuses || 0,
          deductions: payroll.deductions || 0,
          taxRate: payroll.taxRate || 0,
        };

        const reconciliationResult = payrollDeterminismService.reconcilePayroll(
          payroll,
          inputData
        );

        if (reconciliationResult.isConsistent) {
          results.consistent++;
        } else {
          results.inconsistent++;
          results.mismatches.push({
            payrollId,
            mismatchedComponent: reconciliationResult.mismatchedComponent,
            differences: reconciliationResult.differences,
          });

          // Record mismatch
          await PayrollReconciliation.create({
            payrollId,
            status: 'mismatch_detected',
            mismatchedComponent: reconciliationResult.mismatchedComponent,
            differences: reconciliationResult.differences,
            detectedBy: req.userId,
            detectedAt: new Date(),
          });
        }
      } catch (err) {
        results.errors++;
        results.mismatches.push({
          payrollId,
          error: err.message,
        });
      }
    }

    return res.status(200).json({
      message: 'Batch reconciliation completed',
      results,
    });
  } catch (err) {
    logger.error('batchReconcilePayrolls error', { error: err.message });
    return res.status(500).json({
      message: 'Failed to reconcile payrolls',
      error: err.message,
    });
  }
}

/**
 * Get reconciliation history for a payroll
 */
async function getReconciliationHistory(req, res) {
  try {
    const { payrollId } = req.query;
    const filter = {};

    if (payrollId) {
      filter.payrollId = payrollId;
    }

    const reconciliations = await PayrollReconciliation.find(filter)
      .populate('detectedBy verifiedBy', 'fullName email')
      .sort('-createdAt')
      .lean();

    return res.json({
      reconciliations,
      count: reconciliations.length,
    });
  } catch (err) {
    logger.error('getReconciliationHistory error', { error: err.message });
    return res.status(500).json({
      message: 'Failed to fetch reconciliation history',
    });
  }
}

/**
 * Mark reconciliation as reviewed/resolved
 */
async function resolveReconciliation(req, res) {
  try {
    const { reconciliationId } = req.params;
    const { resolution, notes } = req.body;

    if (!reconciliationId || !resolution) {
      return res.status(400).json({
        message: 'reconciliationId and resolution are required',
      });
    }

    const reconciliation = await PayrollReconciliation.findByIdAndUpdate(
      reconciliationId,
      {
        status: resolution,
        resolvedBy: req.userId,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      },
      { new: true }
    );

    if (!reconciliation) {
      return res.status(404).json({
        message: 'Reconciliation record not found',
      });
    }

    return res.status(200).json({
      message: 'Reconciliation resolved',
      reconciliation,
    });
  } catch (err) {
    logger.error('resolveReconciliation error', { error: err.message });
    return res.status(500).json({
      message: 'Failed to resolve reconciliation',
    });
  }
}

/**
 * Deprecated: Old reconciliation method - kept for backward compatibility
 */
async function reconcileAnomaly(req, res) {
  try {
    const { payrollId, anomalyType, justification } = req.body;

    if (!payrollId || !anomalyType || !justification) {
      return res.status(400).json({
        message: 'payrollId, anomalyType, and justification are required.',
      });
    }

    if (justification.length < 20) {
      return res.status(400).json({
        message: 'Justification must be at least 20 characters long.',
      });
    }

    const reconciliation = await PayrollReconciliation.create({
      payrollId,
      anomalyType,
      reconciledBy: req.userId,
      justification,
      status: 'reconciled',
    });

    await Anomaly.updateMany(
      { payrollRunId: payrollId },
      { $set: { resolved: true } }
    );

    return res.status(201).json({
      message: 'Anomaly reconciled successfully.',
      reconciliation,
    });
  } catch (err) {
    logger.error('reconcileAnomaly error', { error: err.message });
    return res.status(500).json({ message: 'Failed to reconcile anomaly.' });
  }
}

/**
 * Deprecated: Old method - kept for backward compatibility
 */
async function getReconciliations(req, res) {
  try {
    const { payrollId } = req.query;
    const filter = {};

    if (payrollId) {
      filter.payrollId = payrollId;
    }

    const reconciliations = await PayrollReconciliation.find(filter)
      .populate('reconciledBy', 'fullName email')
      .sort('-createdAt')
      .lean();

    return res.json({ reconciliations });
  } catch (err) {
    logger.error('getReconciliations error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch reconciliations.' });
  }
}

module.exports = {
  verifyPayrollDeterminism,
  batchReconcilePayrolls,
  getReconciliationHistory,
  resolveReconciliation,
  // Deprecated methods for backward compatibility
  reconcileAnomaly,
  getReconciliations,
};