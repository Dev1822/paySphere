/**
 * @fileoverview Union Remittance Routes
 * Issue: #2009
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { saveContract, processMonthlyRemittance, runDelinquencyAudit, getDashboard } = require('../controllers/unionRemittance.controller');

const router = express.Router();

router.post('/contract', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, saveContract);
router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processMonthlyRemittance);
router.post('/audit', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runDelinquencyAudit);
router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
