const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createMeasurementPeriod, processMonthlyHours, generate1095C, getDashboard } = require('../controllers/aca.controller');

const router = express.Router();

router.post('/periods', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createMeasurementPeriod);
router.post('/process-monthly', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processMonthlyHours);
router.post('/generate-1095c', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generate1095C);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
