const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { configurePlanYear, submitElection, processPayrollDeductions, runYearEndTransition, getPortalData } = require('../controllers/fsaHsa.controller');

const router = express.Router();

router.post('/plan', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, configurePlanYear);
router.post('/election', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, submitElection);
router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollDeductions);
router.post('/transition', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runYearEndTransition);

router.get('/portal', auth, getPortalData);

module.exports = router;
