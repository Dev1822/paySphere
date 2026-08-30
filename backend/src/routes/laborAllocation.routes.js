/**
 * Labor Allocation Routes - Issue #1599
 * Mounted at /api/labor-allocation
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  createRule,
  getRules,
  postCostDistribution,
  getJournalEntries,
} = require('../controllers/laborAllocation.controller');

const router = Router();

router.get('/rules', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getRules);
router.post('/rules', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, createRule);
router.post('/distribute', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, postCostDistribution);
router.get('/journal', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getJournalEntries);

module.exports = router;