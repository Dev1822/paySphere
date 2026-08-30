const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    initiateI9, completeSection1, verifySection2,
    addAuthorizationDocument, runDailyComplianceScan, getDashboard
} = require('../controllers/eligibility.controller');

const router = express.Router();

router.post('/initiate', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, initiateI9);
router.post('/section1', auth, writeRateLimiter, completeSection1);
router.post('/section2', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, verifySection2);

router.post('/document', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, addAuthorizationDocument);
router.post('/scan', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, runDailyComplianceScan);

router.get('/dashboard', auth, requirePermission('READ_EMPLOYEE'), getDashboard);

module.exports = router;
