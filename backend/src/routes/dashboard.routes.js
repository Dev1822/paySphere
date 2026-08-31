/**
 * @fileoverview Dashboard Routes
 * @description API endpoints for dashboard metrics, summaries and per-user
 * widget layouts.
 * Issues: #519 (summary), #663 (mounting and auth on the layout endpoints)
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { getDashboardSummary } = require('../controllers/dashboard.controller');
const { getAuditLogs } = require('../controllers/audit.controller');
const {
  getLayout,
  saveLayout,
} = require('../controllers/dashboardLayout.controller');
const cacheMiddleware = require('../middlewares/cache.middleware');

const router = express.Router();

// ==========================================
// DASHBOARD LAYOUT ROUTES
// ==========================================

/**
 * Both of these used to be unauthenticated (#663).
 *
 * `/summary` below has always had `auth` and a permission check. The two layout
 * routes had neither, and the handler resolved the caller with
 *
 *     req.user?.id || req.userId || 'anonymous'
 *
 * On a route with no `auth` in front of it neither of the first two is ever
 * set, so every request in the world — with or without a token — read and wrote
 * the entry stored under `'anonymous'`.
 *
 * `PUT` is the honest verb for "replace my layout with this one" and is what
 * the client uses now. `POST` is kept as an alias so a bundle cached from
 * before this change keeps working rather than 404ing mid-session.
 */
router.get('/layout', auth, getLayout);
router.put('/layout', auth, saveLayout);
router.post('/layout', auth, saveLayout);

// ==========================================
// DASHBOARD METRICS ROUTES (Issue #519)
// ==========================================

/**
 * GET /api/dashboard/summary
 * Retrieves comprehensive dashboard metrics with Redis caching.
 * Requires READ_EMPLOYEE permission.
 */
router.get(
  '/summary',
  auth,
  requirePermission('READ_EMPLOYEE'),
  cacheMiddleware({
    ttl: 900,
    prefix: 'dashboard:summary',
    tags: ['dashboard'],
  }),
  getDashboardSummary,
);

/**
 * GET /api/dashboard/recent-activity
 * Retrieves recent audit logs/activity feed for the dashboard.
 */
router.get(
  '/recent-activity',
  auth,
  requirePermission('READ_EMPLOYEE'),
  cacheMiddleware({
    ttl: 900,
    prefix: 'dashboard:recent',
    tags: ['dashboard'],
  }),
  getAuditLogs,
);

module.exports = router;
