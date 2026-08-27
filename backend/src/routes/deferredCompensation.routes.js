/**
 * Deferred Compensation Routes - Issue #1813
 * Mounted at /api/deferred-compensation
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  previewDeferral,
  createPlan,
  getPlans,
  accrueQuarterlyInterest,
} = require('../controllers/deferredCompensation.controller');

const router = Router();

router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), previewDeferral);
router.post('/plans', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, createPlan);
router.get('/plans', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getPlans);
router.post('/plans/:id/accrue-interest', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, accrueQuarterlyInterest);

module.exports = router;