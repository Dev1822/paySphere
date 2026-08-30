/**
 * @fileoverview Salary Revision Simulator Routes
 * @description REST endpoints for scenarios, simulation, line items,
 *   overrides, approvals, batches, and reporting.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const ctrl = require('../controllers/salaryRevision.controller');

const router = express.Router();

// ─── Scenario Management ────────────────────────────────────────────────────

router.post(
  '/scenarios',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.createScenario,
);

router.get(
  '/scenarios',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getScenarios,
);

router.get(
  '/scenarios/:scenarioId',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getScenario,
);

router.put(
  '/scenarios/:scenarioId',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.updateScenario,
);

// ─── Simulation ─────────────────────────────────────────────────────────────

router.put(
  '/scenarios/:scenarioId/simulate',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.runSimulation,
);

router.put(
  '/scenarios/:scenarioId/submit',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.submitScenario,
);

router.put(
  '/scenarios/:scenarioId/approve',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.approveScenario,
);

router.put(
  '/scenarios/:scenarioId/reject',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.rejectScenario,
);

// ─── Line Items ─────────────────────────────────────────────────────────────

router.get(
  '/scenarios/:scenarioId/line-items',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getLineItems,
);

router.put(
  '/line-items/:lineItemId/override',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.overrideRevision,
);

router.put(
  '/line-items/:lineItemId/approve',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.approveRevision,
);

router.put(
  '/line-items/:lineItemId/reject',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.rejectRevision,
);

// ─── Batches ────────────────────────────────────────────────────────────────

router.post(
  '/scenarios/:scenarioId/batch',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.createBatch,
);

router.put(
  '/batches/:batchId/apply',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.applyBatch,
);

// ─── Reports & Audit ────────────────────────────────────────────────────────

router.get(
  '/dashboard',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getDashboard,
);

router.post(
  '/compare',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.compareScenarios,
);

router.get(
  '/audit/:scenarioId',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getAuditLog,
);

module.exports = router;
