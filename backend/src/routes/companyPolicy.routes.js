/**
 * @fileoverview Company Policy Management Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');

const {
  createPolicy,
  getPolicies,
  getPolicyById,
  updatePolicy,
  publishVersion,
  deletePolicy,
  acknowledgePolicy,
  getPendingPolicies,
  getAcknowledgmentStats,
} = require('../controllers/companyPolicy.controller');

// Admin routes
router.post(
  '/',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  createPolicy,
);
router.get('/', auth, requirePermission('READ_SETTINGS'), getPolicies);
router.get('/:id', auth, getPolicyById);
router.patch(
  '/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  updatePolicy,
);
router.post(
  '/:id/versions',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  publishVersion,
);
router.delete(
  '/:id',
  auth,
  requirePermission('WRITE_SETTINGS'),
  writeRateLimiter,
  deletePolicy,
);
router.get(
  '/:id/acknowledgment-stats',
  auth,
  requirePermission('READ_SETTINGS'),
  getAcknowledgmentStats,
);

// Employee routes
router.post('/:id/acknowledge', auth, acknowledgePolicy);
router.get('/my/pending', auth, getPendingPolicies);

module.exports = router;
