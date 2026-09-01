/**
 * Intercompany Billing Routes - Issue #1815
 * Mounted at /api/intercompany-billing
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  previewBilling,
  createVoucher,
  getVouchers,
  approveVoucher,
} = require('../controllers/intercompanyBilling.controller');

const router = Router();

router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), previewBilling);
router.post('/vouchers', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, createVoucher);
router.get('/vouchers', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getVouchers);
router.put('/vouchers/:id/approve', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, approveVoucher);

module.exports = router;