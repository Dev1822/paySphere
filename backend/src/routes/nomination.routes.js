/**
 * @fileoverview Recognition & Nomination Routes
 * @description API routes for the value-based peer nomination system, approval
 * workflow, recognition cycles, and leaderboard analytics.
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createCategory,
  getCategories,
  updateCategory,
  createNomination,
  getFeed,
  getMyNominations,
  approveNomination,
  rejectNomination,
  addComment,
  getComments,
  createCycle,
  finalizeCycle,
  getLeaderboard,
  getDashboard,
} = require('../controllers/nomination.controller');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ============================================================================
// Dashboard
// ============================================================================

router.get('/dashboard', requirePermission('READ_EMPLOYEE'), getDashboard);

// ============================================================================
// Categories (admin only)
// ============================================================================

router.post(
  '/categories',
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createCategory,
);
router.get('/categories', requirePermission('READ_EMPLOYEE'), getCategories);
router.put(
  '/categories/:categoryId',
  requirePermission('WRITE_EMPLOYEE'),
  updateCategory,
);

// ============================================================================
// Nominations
// ============================================================================

router.post('/', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createNomination);
router.get('/feed', requirePermission('READ_EMPLOYEE'), getFeed);
router.get('/my-nominations', requirePermission('READ_EMPLOYEE'), getMyNominations);

// ============================================================================
// Approval workflow (managers only)
// ============================================================================

router.post(
  '/:nominationId/approve',
  requirePermission('WRITE_EMPLOYEE'),
  approveNomination,
);
router.post(
  '/:nominationId/reject',
  requirePermission('WRITE_EMPLOYEE'),
  rejectNomination,
);

// ============================================================================
// Comments
// ============================================================================

router.post(
  '/:nominationId/comments',
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  addComment,
);
router.get('/:nominationId/comments', requirePermission('READ_EMPLOYEE'), getComments);

// ============================================================================
// Recognition Cycles (admin only)
// ============================================================================

router.post(
  '/cycles',
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createCycle,
);
router.patch(
  '/cycles/:cycleId/finalize',
  requirePermission('WRITE_EMPLOYEE'),
  finalizeCycle,
);

// ============================================================================
// Leaderboard
// ============================================================================

router.get('/leaderboard', requirePermission('READ_EMPLOYEE'), getLeaderboard);

module.exports = router;
