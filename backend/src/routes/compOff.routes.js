/**
 * @fileoverview Comp-Off Management Routes
 * @description REST endpoints for comp-off policies, requests, approvals,
 *   balances, ledger, and reporting.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const ctrl = require('../controllers/compOff.controller');

const router = express.Router();

// ─── Policy Management (Admin only) ─────────────────────────────────────────

router.post(
  '/policies',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.createPolicy,
);

router.get(
  '/policies',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getPolicies,
);

router.put(
  '/policies/:policyId',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.updatePolicy,
);

router.delete(
  '/policies/:policyId',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.deactivatePolicy,
);

// ─── Request Submission ─────────────────────────────────────────────────────

router.post(
  '/requests',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.submitRequest,
);

router.get(
  '/requests/my',
  auth,
  ctrl.getMyRequests,
);

router.get(
  '/requests/pending',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getPendingApprovals,
);

// ─── Approval Workflow ──────────────────────────────────────────────────────

router.put(
  '/requests/:requestId/approve',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.approveRequest,
);

router.put(
  '/requests/:requestId/reject',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.rejectRequest,
);

router.put(
  '/requests/:requestId/cancel',
  auth,
  writeRateLimiter,
  ctrl.cancelRequest,
);

// ─── Balance & Ledger ───────────────────────────────────────────────────────

router.get(
  '/balance',
  auth,
  ctrl.getBalance,
);

router.get(
  '/balance/:employeeId',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getEmployeeBalance,
);

router.get(
  '/ledger',
  auth,
  ctrl.getLedger,
);

// ─── Admin / System ─────────────────────────────────────────────────────────

router.post(
  '/process-expiries',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.processExpiries,
);

router.get(
  '/reports/summary',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getSummaryReport,
);

module.exports = router;
