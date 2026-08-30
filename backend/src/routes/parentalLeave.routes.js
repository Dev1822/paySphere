/**
 * Parental Leave Routes - Issue #1817
 * Mounted at /api/parental-leave
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  previewTopUp,
  submitClaim,
  getClaims,
  reconcileClaim,
} = require('../controllers/parentalLeave.controller');

const router = Router();

router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), previewTopUp);
router.post('/claims', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, submitClaim);
router.get('/claims', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getClaims);
router.post('/claims/:id/reconcile', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, reconcileClaim);

module.exports = router;