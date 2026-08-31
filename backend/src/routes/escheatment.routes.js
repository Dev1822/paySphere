/**
 * @fileoverview Escheatment Routes
 * Issue: #2013
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { ingestUncashedCheck, runDormancyAudit, generateNAUPAFile, getDashboard } = require('../controllers/escheatment.controller');

const router = express.Router();

router.post('/ingest', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, ingestUncashedCheck);
router.post('/audit', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runDormancyAudit);
router.post('/naupa', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateNAUPAFile);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
