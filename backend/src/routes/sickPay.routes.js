const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createPolicy, importCarrierFeed, injectToPayroll, getDashboard } = require('../controllers/sickPay.controller');

const router = express.Router();

router.post('/policy', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createPolicy);
router.post('/import', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, importCarrierFeed);
router.post('/inject', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, injectToPayroll);
router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
