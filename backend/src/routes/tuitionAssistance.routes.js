/**
 * Tuition Assistance Routes - Issue #1816
 * Mounted at /api/tuition-assistance
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  previewClaim,
  submitClaim,
  getClaims,
  approveClaim,
} = require('../controllers/tuitionAssistance.controller');

const router = Router();

router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), previewClaim);
router.post('/claims', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, submitClaim);
router.get('/claims', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getClaims);
router.put('/claims/:id/approve', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, approveClaim);

module.exports = router;