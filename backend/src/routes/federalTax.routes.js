const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { calculateLookback, recordLiability, generateForm941, getDashboard } = require('../controllers/federalTax.controller');

const router = express.Router();

router.post('/lookback', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, calculateLookback);
router.post('/liability', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordLiability);
router.post('/941', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateForm941);
router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
