const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    createMaskingRule, recordConsent, requestErasure,
    processErasure, getMaskedEmployeeData, getDashboard,
    getPolicies, createOrUpdatePolicy, revealPII
} = require('../controllers/dataPrivacy.controller');

const router = express.Router();

router.post('/rules', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createMaskingRule);
router.post('/consent', auth, writeRateLimiter, recordConsent);

router.post('/erasure/request', auth, writeRateLimiter, requestErasure);
router.post('/erasure/process', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, processErasure);

router.get('/policies', auth, requirePermission('READ_EMPLOYEE'), getPolicies);
router.post('/policies', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createOrUpdatePolicy);

router.get('/employee/:employeeId', auth, getMaskedEmployeeData);
router.post('/employee/:employeeId/reveal-pii', auth, requirePermission('READ_EMPLOYEE'), revealPII);
router.get('/dashboard', auth, requirePermission('READ_EMPLOYEE'), getDashboard);

module.exports = router;
