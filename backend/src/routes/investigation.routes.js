/**
 * @fileoverview Investigation Workflow Routes
 * @description API routes for the investigation lifecycle: steps, comments,
 * evidence uploads, assignment management, and case timeline analytics.
 * All routes require authentication and are scoped to the caller's tenant.
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createStep,
  getSteps,
  updateStep,
  cancelStep,
  addComment,
  getComments,
  deleteComment,
  addEvidence,
  getEvidence,
  verifyEvidence,
  assignToCase,
  getAssignments,
  deactivateAssignment,
  getDashboard,
  getCaseTimeline,
} = require('../controllers/investigation.controller');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ============================================================================
// Dashboard & Analytics
// ============================================================================

router.get('/dashboard', requirePermission('READ_EMPLOYEE'), getDashboard);

// ============================================================================
// Investigation Steps
// ============================================================================

router.post(
  '/cases/:caseId/steps',
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createStep,
);

router.get('/cases/:caseId/steps', requirePermission('READ_EMPLOYEE'), getSteps);

router.patch(
  '/steps/:stepId',
  requirePermission('WRITE_EMPLOYEE'),
  updateStep,
);

router.patch(
  '/steps/:stepId/cancel',
  requirePermission('WRITE_EMPLOYEE'),
  cancelStep,
);

// ============================================================================
// Case Comments
// ============================================================================

router.post(
  '/cases/:caseId/comments',
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  addComment,
);

router.get('/cases/:caseId/comments', requirePermission('READ_EMPLOYEE'), getComments);

router.delete(
  '/comments/:commentId',
  requirePermission('WRITE_EMPLOYEE'),
  deleteComment,
);

// ============================================================================
// Evidence Management
// ============================================================================

router.post(
  '/cases/:caseId/evidence',
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  addEvidence,
);

router.get('/cases/:caseId/evidence', requirePermission('READ_EMPLOYEE'), getEvidence);

router.patch(
  '/evidence/:evidenceId/verify',
  requirePermission('WRITE_EMPLOYEE'),
  verifyEvidence,
);

// ============================================================================
// Case Assignment
// ============================================================================

router.post(
  '/cases/:caseId/assign',
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  assignToCase,
);

router.get('/cases/:caseId/assignments', requirePermission('READ_EMPLOYEE'), getAssignments);

router.patch(
  '/assignments/:assignmentId/deactivate',
  requirePermission('WRITE_EMPLOYEE'),
  deactivateAssignment,
);

// ============================================================================
// Unified Timeline
// ============================================================================

router.get('/cases/:caseId/timeline', requirePermission('READ_EMPLOYEE'), getCaseTimeline);

module.exports = router;
