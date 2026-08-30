const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createDetermination, addFringeOffset, evaluateWeeklyPayroll, getDashboard } = require('../controllers/prevailingWage.controller');

const router = express.Router();

router.post('/determinations', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createDetermination);
router.post('/fringe-offsets', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, addFringeOffset);
router.post('/evaluate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, evaluateWeeklyPayroll);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
