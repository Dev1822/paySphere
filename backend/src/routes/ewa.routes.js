const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { getMyBalance, requestWithdrawal, runPaydayOffsetBatch, getAdminDashboard } = require('../controllers/ewa.controller');

const router = express.Router();

router.get('/my-balance', auth, getMyBalance);
router.post('/withdraw', auth, writeRateLimiter, requestWithdrawal);

router.post('/offset-batch', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runPaydayOffsetBatch);
router.get('/admin', auth, requirePermission('READ_PAYROLL'), getAdminDashboard);

module.exports = router;
