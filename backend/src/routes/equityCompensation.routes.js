/**
 * @fileoverview Equity Compensation Routes
 * Issue: #2010
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createGrant, executeVesting, getDashboard } = require('../controllers/equityCompensation.controller');

const router = express.Router();

router.post('/grant', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createGrant);
router.post('/vest', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, executeVesting);
router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
