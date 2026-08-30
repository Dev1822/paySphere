const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { updateElection, uploadVendorFeed, processPayrollDeductions, getMyElections } = require('../controllers/commuter.controller');

const router = express.Router();

router.post('/election', auth, writeRateLimiter, updateElection);
router.get('/my-elections', auth, getMyElections);

router.post('/vendor-feed', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, uploadVendorFeed);
router.post('/process-deductions', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollDeductions);

module.exports = router;
