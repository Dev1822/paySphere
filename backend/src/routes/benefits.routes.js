/**
 * @fileoverview Company Benefits Enrollment Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');

const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  enroll,
  cancelEnrollment,
  getMyEnrollments,
  getAllEnrollments,
  getEnrollmentStats,
  terminateEnrollment,
} = require('../controllers/benefits.controller');

// Admin: Plan management
router.post(
  '/plans',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  createPlan,
);
router.get('/plans', auth, requirePermission('READ_SETTINGS'), getPlans);
router.get('/plans/:id', auth, getPlanById);
router.patch(
  '/plans/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  updatePlan,
);
router.delete(
  '/plans/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  deletePlan,
);

// Employee: Enrollment
router.post('/enroll', auth, writeRateLimiter, enroll);
router.delete(
  '/enroll/:enrollmentId',
  auth,
  writeRateLimiter,
  cancelEnrollment,
);
router.get('/my-enrollments', auth, getMyEnrollments);

// Admin: Enrollment management
router.get(
  '/enrollments',
  auth,
  requirePermission('READ_SETTINGS'),
  getAllEnrollments,
);
router.get(
  '/stats',
  auth,
  requirePermission('READ_SETTINGS'),
  getEnrollmentStats,
);
router.patch(
  '/enrollments/:enrollmentId/terminate',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  terminateEnrollment,
);

module.exports = router;
