/**
 * PSU Routes - Issue #1598
 * Mounted at /api/psu
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  createGrant,
  getGrants,
  evaluateGrantVesting,
} = require('../controllers/psu.controller');

const router = Router();

router.get('/grants', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getGrants);
router.post('/grants', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, createGrant);
router.post('/grants/:id/evaluate', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, evaluateGrantVesting);

module.exports = router;