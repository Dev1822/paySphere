/**
 * @fileoverview Peer Nomination & Awards Routes
 * @description REST endpoints for award categories, cycles, nominations, voting, and analytics.
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const authMiddleware = require('../middlewares/auth.middleware');
const rbacMiddleware = require('../middlewares/rbac.middleware');
const rateLimiter = require('../middlewares/rateLimiter.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  createCycle,
  listCycles,
  advanceCycleStatus,
  submitNomination,
  listNominations,
  reviewNomination,
  castVote,
  removeVote,
  selectCycleWinners,
  getDashboard,
  getCycleStats,
  getEmployeeStats,
} = require('../controllers/peerNomination.controller');

// ============================================================================
// Award Category Routes
// ============================================================================

/**
 * @swagger
 * /api/peer-nominations/categories:
 *   post:
 *     summary: Create a new award category
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/categories',
  authMiddleware,
  rbacMiddleware(['HR_ADMIN', 'SUPER_ADMIN']),
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('rewardAmount').optional().isFloat({ min: 0 }),
    body('extraLeaveDays').optional().isInt({ min: 0, max: 10 }),
    body('frequency')
      .optional()
      .isIn(['Monthly', 'Quarterly', 'Annual', 'OneTime']),
    body('maxNominationsPerNominator').optional().isInt({ min: 1, max: 20 }),
    body('maxNominationsPerNominee').optional().isInt({ min: 1, max: 50 }),
    body('nominationScope').optional().isIn(['All', 'Manager', 'Peer']),
  ],
  validate,
  createCategory,
);

/**
 * @swagger
 * /api/peer-nominations/categories:
 *   get:
 *     summary: List all active award categories
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/categories', authMiddleware, listCategories);

/**
 * @swagger
 * /api/peer-nominations/categories/{categoryId}:
 *   get:
 *     summary: Get a single award category
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/categories/:categoryId',
  authMiddleware,
  [param('categoryId').isMongoId()],
  validate,
  getCategory,
);

/**
 * @swagger
 * /api/peer-nominations/categories/{categoryId}:
 *   put:
 *     summary: Update an award category
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.put(
  '/categories/:categoryId',
  authMiddleware,
  rbacMiddleware(['HR_ADMIN', 'SUPER_ADMIN']),
  [param('categoryId').isMongoId()],
  validate,
  updateCategory,
);

// ============================================================================
// Award Cycle Routes
// ============================================================================

/**
 * @swagger
 * /api/peer-nominations/cycles:
 *   post:
 *     summary: Create a new award cycle
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/cycles',
  authMiddleware,
  rbacMiddleware(['HR_ADMIN', 'SUPER_ADMIN']),
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
  [
    body('categoryId').isMongoId().withMessage('Valid categoryId required'),
    body('name').isString().notEmpty(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('votingStartDate').optional().isISO8601(),
    body('votingEndDate').optional().isISO8601(),
  ],
  validate,
  createCycle,
);

/**
 * @swagger
 * /api/peer-nominations/cycles:
 *   get:
 *     summary: List award cycles
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/cycles',
  authMiddleware,
  [
    query('categoryId').optional().isMongoId(),
    query('status')
      .optional()
      .isIn(['Upcoming', 'Nominating', 'Voting', 'Reviewing', 'Completed']),
  ],
  validate,
  listCycles,
);

/**
 * @swagger
 * /api/peer-nominations/cycles/{cycleId}/status:
 *   patch:
 *     summary: Advance a cycle to the next status
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/cycles/:cycleId/status',
  authMiddleware,
  rbacMiddleware(['HR_ADMIN', 'SUPER_ADMIN']),
  [
    param('cycleId').isMongoId(),
    body('status').isIn([
      'Upcoming',
      'Nominating',
      'Voting',
      'Reviewing',
      'Completed',
    ]),
  ],
  validate,
  advanceCycleStatus,
);

/**
 * @swagger
 * /api/peer-nominations/cycles/{cycleId}/select-winners:
 *   post:
 *     summary: Select winners for a cycle
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/cycles/:cycleId/select-winners',
  authMiddleware,
  rbacMiddleware(['HR_ADMIN', 'SUPER_ADMIN']),
  [param('cycleId').isMongoId()],
  validate,
  selectCycleWinners,
);

/**
 * @swagger
 * /api/peer-nominations/cycles/{cycleId}/stats:
 *   get:
 *     summary: Get detailed cycle stats
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/cycles/:cycleId/stats',
  authMiddleware,
  [param('cycleId').isMongoId()],
  validate,
  getCycleStats,
);

// ============================================================================
// Nomination Routes
// ============================================================================

/**
 * @swagger
 * /api/peer-nominations/nominate:
 *   post:
 *     summary: Submit a peer nomination
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/nominate',
  authMiddleware,
  rateLimiter({ windowMs: 60 * 1000, max: 10 }),
  [
    body('cycleId').isMongoId(),
    body('categoryId').isMongoId(),
    body('nomineeId').isMongoId(),
    body('justification').isString().isLength({ min: 20, max: 2000 }),
    body('example').optional().isString().isLength({ max: 2000 }),
    body('coreValues').optional().isArray(),
    body('isAnonymous').optional().isBoolean(),
  ],
  validate,
  submitNomination,
);

/**
 * @swagger
 * /api/peer-nominations/nominations:
 *   get:
 *     summary: List nominations with filters
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/nominations',
  authMiddleware,
  [
    query('cycleId').optional().isMongoId(),
    query('categoryId').optional().isMongoId(),
    query('status')
      .optional()
      .isIn([
        'Submitted',
        'UnderReview',
        'Approved',
        'Rejected',
        'Winner',
        'Withdrawn',
      ]),
    query('nomineeId').optional().isMongoId(),
  ],
  validate,
  listNominations,
);

/**
 * @swagger
 * /api/peer-nominations/nominations/{nominationId}/review:
 *   patch:
 *     summary: Approve or reject a nomination
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/nominations/:nominationId/review',
  authMiddleware,
  rbacMiddleware(['HR_ADMIN', 'MANAGER', 'SUPER_ADMIN']),
  [
    param('nominationId').isMongoId(),
    body('action').isIn(['approve', 'reject']),
    body('reviewNotes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  reviewNomination,
);

// ============================================================================
// Voting Routes
// ============================================================================

/**
 * @swagger
 * /api/peer-nominations/vote:
 *   post:
 *     summary: Cast a vote on a nomination
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/vote',
  authMiddleware,
  rateLimiter({ windowMs: 60 * 1000, max: 20 }),
  [
    body('nominationId').isMongoId(),
    body('comment').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  castVote,
);

/**
 * @swagger
 * /api/peer-nominations/vote/{voteId}:
 *   delete:
 *     summary: Remove a vote
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/vote/:voteId',
  authMiddleware,
  [param('voteId').isMongoId()],
  validate,
  removeVote,
);

// ============================================================================
// Analytics & Dashboard Routes
// ============================================================================

/**
 * @swagger
 * /api/peer-nominations/dashboard:
 *   get:
 *     summary: Get overall dashboard
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/dashboard', authMiddleware, getDashboard);

/**
 * @swagger
 * /api/peer-nominations/stats/employee/{employeeId}:
 *   get:
 *     summary: Get personal nomination stats for an employee
 *     tags: [PeerNominations]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/stats/employee/:employeeId',
  authMiddleware,
  [param('employeeId').isMongoId()],
  validate,
  getEmployeeStats,
);

module.exports = router;
