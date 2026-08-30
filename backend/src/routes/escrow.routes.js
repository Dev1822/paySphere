const express = require('express');
const { deposit, approve, getReconciliation, handleWireWebhook } = require('../controllers/escrow.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.post(
  '/deposit',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  deposit
);

router.post(
  '/deposit/:id/approve',
  auth,
  requirePermission(PERMISSIONS.APPROVE_PAYROLL),
  writeRateLimiter,
  approve
);

router.get(
  '/reconciliation/:payrollRunId',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getReconciliation
);

// Simulation hook for wire webhook bank deposits
router.post(
  '/reconcile-webhook',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  handleWireWebhook
);

module.exports = router;
