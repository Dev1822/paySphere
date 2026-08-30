/**
 * Expat COLA Routes - Issue #1814
 * Mounted at /api/expat-cola
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  previewAllowance,
  upsertSetting,
  getSettings,
} = require('../controllers/expatCola.controller');

const router = Router();

router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), previewAllowance);
router.post('/settings', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, upsertSetting);
router.get('/settings', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getSettings);

module.exports = router;