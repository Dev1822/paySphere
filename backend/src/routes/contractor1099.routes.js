const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { recordPayment, validateTIN, generateFIREFile, getDashboard } = require('../controllers/contractor1099.controller');

const router = express.Router();

router.post('/payment', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordPayment);
router.post('/validate-tin', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, validateTIN);
router.post('/generate-fire', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateFIREFile);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
