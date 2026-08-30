const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createPoolConfig, recordDailyTips, calculateDistributionBatch, getDashboardData } = require('../controllers/tipPool.controller');

const router = express.Router();

router.post('/config', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createPoolConfig);
router.post('/daily', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordDailyTips);
router.post('/calculate-batch', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, calculateDistributionBatch);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboardData);

module.exports = router;
