/**
 * @fileoverview Shift Preference Routes
 * @description API endpoints for employee shift preference and availability management.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
  submitPreference,
  getMyPreferences,
  getAllPreferences,
  reviewPreference,
  createSwapRequest,
  getSwapRequests,
  acceptSwap,
  approveSwap,
  cancelSwap,
  findSwapMatches,
  runAutoAssignment,
  getAssignments,
  getScheduleMetrics,
  getDashboard,
} = require('../controllers/shiftPreference.controller');

const router = express.Router();

// ─── Templates ────────────────────────────────────────────────────────────

router.get(
  '/templates',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getTemplates,
);
router.post(
  '/templates',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createTemplate,
);
router.patch(
  '/templates/:id',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  updateTemplate,
);
router.delete(
  '/templates/:id',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  deleteTemplate,
);

// ─── Employee Preferences ─────────────────────────────────────────────────

router.get(
  '/preferences',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getAllPreferences,
);
router.get('/preferences/mine', auth, getMyPreferences);
router.post(
  '/preferences',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  submitPreference,
);
router.patch(
  '/preferences/:id/review',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  reviewPreference,
);

// ─── Shift Swap Requests ──────────────────────────────────────────────────

router.get('/swaps', auth, requirePermission('READ_EMPLOYEE'), getSwapRequests);
router.post(
  '/swaps',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createSwapRequest,
);
router.patch(
  '/swaps/:id/accept',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  acceptSwap,
);
router.patch(
  '/swaps/:id/approve',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  approveSwap,
);
router.patch(
  '/swaps/:id/cancel',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  cancelSwap,
);
router.get(
  '/swaps/:id/matches',
  auth,
  requirePermission('READ_EMPLOYEE'),
  findSwapMatches,
);

// ─── Auto-Assignment ──────────────────────────────────────────────────────

router.post(
  '/auto-assign',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  runAutoAssignment,
);

// ─── Assignments & Analytics ──────────────────────────────────────────────

router.get(
  '/assignments',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getAssignments,
);
router.get(
  '/metrics',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getScheduleMetrics,
);
router.get(
  '/dashboard',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getDashboard,
);

module.exports = router;
