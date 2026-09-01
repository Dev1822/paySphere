/**
 * @fileoverview Document Request Routes
 * @description REST endpoints for document templates, requests, approvals,
 *   e-signatures, delivery, SLA monitoring, and reporting.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const ctrl = require('../controllers/docRequest.controller');

const router = express.Router();

// ─── Template Management (Admin only) ───────────────────────────────────────

router.post(
  '/templates',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.createTemplate,
);

router.get(
  '/templates',
  auth,
  requirePermission('READ_EMPLOYEE'),
  ctrl.getTemplates,
);

router.put(
  '/templates/:templateId',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.updateTemplate,
);

router.delete(
  '/templates/:templateId',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.deactivateTemplate,
);

// ─── Request Submission ─────────────────────────────────────────────────────

router.post(
  '/',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  ctrl.submitRequest,
);

router.get(
  '/my',
  auth,
  ctrl.getMyRequests,
);

router.get(
  '/pending-manager',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getPendingManagerApprovals,
);

router.get(
  '/pending-hr',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getPendingHRReviews,
);

router.get(
  '/escalated',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getEscalatedRequests,
);

router.get(
  '/queue',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getProcessingQueue,
);

router.get(
  '/reports/dashboard',
  auth,
  requirePermission('READ_PAYROLL'),
  ctrl.getDashboardStats,
);

// ─── Individual Request ─────────────────────────────────────────────────────

router.get(
  '/:requestNumber',
  auth,
  ctrl.getRequestByNumber,
);

router.get(
  '/id/:requestId',
  auth,
  ctrl.getRequestById,
);

// ─── Approval Workflow ──────────────────────────────────────────────────────

router.put(
  '/:requestId/approve-manager',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.approveByManager,
);

router.put(
  '/:requestId/reject-manager',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.rejectByManager,
);

router.put(
  '/:requestId/approve-hr',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.approveByHR,
);

router.put(
  '/:requestId/reject-hr',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.rejectByHR,
);

router.put(
  '/:requestId/cancel',
  auth,
  writeRateLimiter,
  ctrl.cancelRequest,
);

router.put(
  '/:requestId/process',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.markProcessing,
);

router.put(
  '/:requestId/ready-for-signature',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.markReadyForSignature,
);

// ─── E-Signature ────────────────────────────────────────────────────────────

router.post(
  '/:requestId/sign',
  auth,
  writeRateLimiter,
  ctrl.signDocument,
);

router.post(
  '/:requestId/decline-signature',
  auth,
  writeRateLimiter,
  ctrl.declineSignature,
);

router.get(
  '/:requestId/signatures',
  auth,
  ctrl.getSignatureLogs,
);

// ─── Delivery ───────────────────────────────────────────────────────────────

router.post(
  '/:requestId/deliver',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  ctrl.initiateDelivery,
);

router.get(
  '/:requestId/deliveries',
  auth,
  ctrl.getDeliveryLogs,
);

// ─── SLA ────────────────────────────────────────────────────────────────────

router.get(
  '/:requestId/sla',
  auth,
  ctrl.checkSLA,
);

module.exports = router;
