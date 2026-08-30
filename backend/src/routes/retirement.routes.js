const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { configurePlan, runNDTTest, runTrueUpBatch, getDashboard } = require('../controllers/retirement.controller');

const router = express.Router();

router.post('/config', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, configurePlan);
router.post('/ndt-test', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runNDTTest);
router.post('/true-up', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runTrueUpBatch);
router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
