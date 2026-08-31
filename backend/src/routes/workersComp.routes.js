/**
 * @fileoverview Workers' Compensation Routes
 * Issue: #2061
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    saveClassCode, mapEmployee, processPayrollForWC,
    generateAuditReport, getDashboard
} = require('../controllers/workersComp.controller');

const router = express.Router();

router.post('/class-code', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, saveClassCode);
router.post('/map-employee', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, mapEmployee);
router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollForWC);
router.post('/audit', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateAuditReport);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
