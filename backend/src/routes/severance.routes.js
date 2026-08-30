/**
 * Severance Routes - Issue #1597
 * Mounted at /api/severance
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  calculatePreview,
  createSeverancePackage,
  getSeverancePackages,
  approveSeverancePackage,
  disburseSeverancePackage,
} = require('../controllers/severance.controller');

const router = Router();

router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), calculatePreview);
router.post('/packages', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, createSeverancePackage);
router.get('/packages', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getSeverancePackages);
router.put('/packages/:id/approve', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, approveSeverancePackage);
router.post('/packages/:id/disburse', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, disburseSeverancePackage);

module.exports = router;