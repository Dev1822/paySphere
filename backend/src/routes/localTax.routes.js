/**
 * @fileoverview Local Tax Routes
 * Issue: #2062
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    saveJurisdiction, saveCommuterRule, submitCertificate,
    processLocalTaxPayroll, getDashboard
} = require('../controllers/localTax.controller');

const router = express.Router();

router.post('/jurisdiction', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, saveJurisdiction);
router.post('/rule', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, saveCommuterRule);
router.post('/certificate', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, submitCertificate);
router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processLocalTaxPayroll);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
