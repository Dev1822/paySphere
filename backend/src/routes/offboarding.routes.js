/**
 * @fileoverview Offboarding Routes
 * @description REST endpoints for offboarding lifecycle, clearance, assets,
 *   knowledge transfer, exit interviews, settlements, and analytics.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const ctrl = require('../controllers/offboarding.controller');

const router = express.Router();

// ─── Process Management ─────────────────────────────────────────────────────

router.post(
  '/',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.initiateOffboarding,
);

router.get(
  '/',
  auth,
  requirePermission('READ_EMPLOYEE'),
  ctrl.getProcesses,
);

router.get(
  '/dashboard',
  auth,
  requirePermission('READ_EMPLOYEE'),
  ctrl.getDashboard,
);

router.get(
  '/reports/attrition',
  auth,
  requirePermission('READ_EMPLOYEE'),
  ctrl.getAttritionReport,
);

router.get(
  '/:processId',
  auth,
  requirePermission('READ_EMPLOYEE'),
  ctrl.getProcess,
);

router.put(
  '/:processId/status',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.transitionProcess,
);

router.put(
  '/:processId/handover',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.updateHandover,
);

// ─── Clearance Checklist ────────────────────────────────────────────────────

router.post(
  '/:processId/checklist',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.addClearanceItem,
);

router.put(
  '/checklist/:itemId',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.updateClearanceItem,
);

// ─── Asset Returns ──────────────────────────────────────────────────────────

router.post(
  '/:processId/assets',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.addAssetReturn,
);

router.put(
  '/assets/:assetId',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.updateAssetReturn,
);

// ─── Knowledge Transfer ─────────────────────────────────────────────────────

router.post(
  '/:processId/knowledge-transfer',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.addKnowledgeTransfer,
);

router.put(
  '/knowledge-transfer/:ktId',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.updateKnowledgeTransfer,
);

// ─── Exit Interview ─────────────────────────────────────────────────────────

router.post(
  '/:processId/exit-interview/schedule',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.scheduleExitInterview,
);

router.post(
  '/:processId/exit-interview/complete',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.completeExitInterview,
);

// ─── Settlement ─────────────────────────────────────────────────────────────

router.post(
  '/:processId/settlement/initiate',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.initiateSettlement,
);

router.post(
  '/:processId/settlement/process',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.processSettlement,
);

module.exports = router;
