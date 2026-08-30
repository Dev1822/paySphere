const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createSnapshot, runReconciliationDiff, resolveException, signOffBatch, getDashboard } = require('../controllers/reconciliation.controller');

const router = express.Router();

router.post('/snapshot', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createSnapshot);
router.post('/diff', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runReconciliationDiff);

router.patch('/resolve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, resolveException);
router.patch('/signoff/:batchId', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, signOffBatch);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
