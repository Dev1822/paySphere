/**
 * @fileoverview Service Milestone Routes
 * @description API endpoints for the employee service milestone recognition feature.
 * All routes are tenant-scoped and require authentication.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  getConfig,
  upsertConfig,
  evaluateSingle,
  evaluateBatch,
  getAchievements,
  getAchievementById,
  acknowledgeAchievement,
  disburseAchievement,
  skipAchievement,
  getMyMilestones,
  getDashboard,
  getEvaluationLogs,
  getEmployeeHistory,
} = require('../controllers/serviceMilestone.controller');

const router = express.Router();

// ─── Configuration ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/milestones/config:
 *   get:
 *     summary: Get milestone configuration
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Milestone configuration
 */
router.get('/config', auth, requirePermission('READ_PAYROLL'), getConfig);

/**
 * @swagger
 * /api/milestones/config:
 *   post:
 *     summary: Create or update milestone configuration
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/config',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  upsertConfig,
);

// ─── Evaluation ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/milestones/evaluate/{employeeId}:
 *   get:
 *     summary: Evaluate a single employee for milestones
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/evaluate/:employeeId',
  auth,
  requirePermission('READ_PAYROLL'),
  evaluateSingle,
);

/**
 * @swagger
 * /api/milestones/evaluate/batch:
 *   post:
 *     summary: Run batch evaluation across all active employees
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/evaluate/batch',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  evaluateBatch,
);

// ─── Achievements ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/milestones/achievements:
 *   get:
 *     summary: List milestone achievements
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/achievements',
  auth,
  requirePermission('READ_PAYROLL'),
  getAchievements,
);

/**
 * @swagger
 * /api/milestones/achievements/{id}:
 *   get:
 *     summary: Get a single achievement
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/achievements/:id',
  auth,
  requirePermission('READ_PAYROLL'),
  getAchievementById,
);

/**
 * @swagger
 * /api/milestones/achievements/{id}/acknowledge:
 *   patch:
 *     summary: Acknowledge a milestone achievement
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/achievements/:id/acknowledge',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  acknowledgeAchievement,
);

/**
 * @swagger
 * /api/milestones/achievements/{id}/disburse:
 *   patch:
 *     summary: Mark achievement as disbursed
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/achievements/:id/disburse',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  disburseAchievement,
);

/**
 * @swagger
 * /api/milestones/achievements/{id}/skip:
 *   patch:
 *     summary: Skip a milestone achievement
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/achievements/:id/skip',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  skipAchievement,
);

// ─── Self-Service ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/milestones/my-milestones:
 *   get:
 *     summary: Get milestones for the authenticated employee
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-milestones', auth, getMyMilestones);

// ─── Dashboard & Analytics ────────────────────────────────────────────────

/**
 * @swagger
 * /api/milestones/dashboard:
 *   get:
 *     summary: Milestone dashboard with stats and upcoming milestones
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

/**
 * @swagger
 * /api/milestones/evaluation-logs:
 *   get:
 *     summary: List evaluation run logs
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/evaluation-logs',
  auth,
  requirePermission('READ_PAYROLL'),
  getEvaluationLogs,
);

/**
 * @swagger
 * /api/milestones/employee/{employeeId}/history:
 *   get:
 *     summary: Full milestone history for an employee
 *     tags: [Milestones]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/employee/:employeeId/history',
  auth,
  requirePermission('READ_PAYROLL'),
  getEmployeeHistory,
);

module.exports = router;
