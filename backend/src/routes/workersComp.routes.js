const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createClassification, mapEmployee, processPayrollBatch, runAnnualAudit, getDashboard } = require('../controllers/workersComp.controller');

const router = express.Router();

router.post('/classifications', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createClassification);
router.post('/map', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, mapEmployee);

router.post('/process-payroll', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollBatch);
router.post('/audit', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runAnnualAudit);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
