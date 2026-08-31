/**
 * @fileoverview Charitable Giving Routes
 * Issue: #2011
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    createCampaign, submitPledge, processPayrollDeductions,
    exportDisbursements, getDashboard
} = require('../controllers/charitableGiving.controller');

const router = express.Router();

router.post('/campaign', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createCampaign);
router.post('/pledge', auth, writeRateLimiter, submitPledge);
router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollDeductions);
router.post('/export', auth, requirePermission('READ_PAYROLL'), writeRateLimiter, exportDisbursements);

router.get('/dashboard', auth, getDashboard);

module.exports = router;
