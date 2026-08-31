'use strict';

const express = require('express');
const router = express.Router();

const payrollReconciliationController = require('../controllers/payrollReconciliation.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

/**
 * Payroll Determinism & Reconciliation Routes
 * 
 * These endpoints enable verification that finalized payroll records
 * are consistent with their input data through component-level comparison.
 */

/**
 * POST /api/payroll-reconciliation/verify/:payrollId
 * Verify a specific payroll for deterministic consistency
 * - Recalculates components from input data
 * - Compares against stored values
 * - Reports first component-level mismatch if found
 */
router.post(
  '/verify/:payrollId',
  authenticate,
  authorize('payroll:verify'),
  payrollReconciliationController.verifyPayrollDeterminism
);

/**
 * POST /api/payroll-reconciliation/batch
 * Batch reconcile multiple payrolls
 * Useful for monthly verification runs
 * Request body: { payrollIds: [id1, id2, ...] }
 */
router.post(
  '/batch',
  authenticate,
  authorize('payroll:verify'),
  payrollReconciliationController.batchReconcilePayrolls
);

/**
 * GET /api/payroll-reconciliation/history
 * Get reconciliation history for payrolls
 * Query params:
 *   - payrollId: Filter by specific payroll
 */
router.get(
  '/history',
  authenticate,
  authorize('payroll:view'),
  payrollReconciliationController.getReconciliationHistory
);

/**
 * PATCH /api/payroll-reconciliation/:reconciliationId/resolve
 * Mark a reconciliation as reviewed and resolved
 * Request body: { resolution: 'approved'|'rejected', notes: 'reason' }
 */
router.patch(
  '/:reconciliationId/resolve',
  authenticate,
  authorize('payroll:approve'),
  payrollReconciliationController.resolveReconciliation
);

/**
 * Deprecated endpoints (kept for backward compatibility)
 */

/**
 * POST /api/payroll-reconciliation/anomaly (DEPRECATED)
 * Use verifyPayrollDeterminism instead
 */
router.post(
  '/anomaly',
  authenticate,
  authorize('payroll:verify'),
  payrollReconciliationController.reconcileAnomaly
);

/**
 * GET /api/payroll-reconciliation (DEPRECATED)
 * Use /history instead
 */
router.get(
  '/',
  authenticate,
  authorize('payroll:view'),
  payrollReconciliationController.getReconciliations
);

module.exports = router;