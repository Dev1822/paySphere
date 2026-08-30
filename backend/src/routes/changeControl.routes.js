const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { requestChange, approveChange, rejectChange, getAuditTrail, getDashboard } = require('../controllers/changeControl.controller');

const router = express.Router();

router.post('/request', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, requestChange);
router.post('/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, approveChange);
router.post('/reject', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, rejectChange);

router.get('/audit/:requestId', auth, requirePermission('READ_PAYROLL'), getAuditTrail);
router.get('/dashboard', auth, getDashboard);

module.exports = router;
