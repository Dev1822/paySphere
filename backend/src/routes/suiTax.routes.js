/**
 * @fileoverview SUI Tax Routes
 * Issue: #2012
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    uploadRateNotice, applyRateToPayroll, processPayrollWithholding,
    analyzeVoluntaryContribution, getDashboard
} = require('../controllers/suiTax.controller');

const router = express.Router();

router.post('/notice', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, uploadRateNotice);
router.post('/apply', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, applyRateToPayroll);
router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollWithholding);
router.post('/analyze', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, analyzeVoluntaryContribution);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
