const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createAgreement, updateEmployeeProfile, evaluateTaxLiability, getDashboard } = require('../controllers/stateTax.controller');

const router = express.Router();

router.post('/agreements', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createAgreement);
router.post('/profiles', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, updateEmployeeProfile);
router.post('/evaluate', auth, requirePermission('READ_PAYROLL'), writeRateLimiter, evaluateTaxLiability);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
