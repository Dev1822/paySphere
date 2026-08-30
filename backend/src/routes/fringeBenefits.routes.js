/**
 * Fringe Benefits Routes - Issue #1600
 * Mounted at /api/fringe-benefits
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  calculatePreview,
  recordBenefit,
  getRecords,
  getQuarterlySummaryReport,
} = require('../controllers/fringeBenefits.controller');

const router = Router();

router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), calculatePreview);
router.post('/records', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, recordBenefit);
router.get('/records', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getRecords);
router.get('/quarterly-report', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getQuarterlySummaryReport);

module.exports = router;