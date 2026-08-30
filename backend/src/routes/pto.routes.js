const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createComplianceRule, createPolicy, runAccrualBatch, processTerminationPayout, getDashboard } = require('../controllers/pto.controller');

const router = express.Router();

router.post('/rules', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createComplianceRule);
router.post('/policies', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createPolicy);

router.post('/run-accrual', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runAccrualBatch);
router.post('/terminate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processTerminationPayout);

router.get('/dashboard', auth, requirePermission('READ_EMPLOYEE'), getDashboard);

module.exports = router;
