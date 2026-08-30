const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createPolicy, processPayrollWithholdings, startLeaveProtection, runProtectionAudit, getDashboard } = require('../controllers/pfmlSdi.controller');

const router = express.Router();

router.post('/policies', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createPolicy);
router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollWithholdings);

router.post('/protection', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, startLeaveProtection);
router.post('/audit', auth, requirePermission('READ_EMPLOYEE'), writeRateLimiter, runProtectionAudit);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
