const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createBatch, confirmWiresSent, recordSettlement, getDashboard } = require('../controllers/fxPayroll.controller');

const router = express.Router();

router.post('/batch', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createBatch);
router.patch('/batch/:batchId/confirm-wires', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, confirmWiresSent);
router.post('/batch/:batchId/settle', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordSettlement);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
