const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { triggerAggregation, generateMagneticMedia, getDashboard, downloadFile } = require('../controllers/yearEnd.controller');

const router = express.Router();

router.post('/aggregate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, triggerAggregation);
router.post('/generate-media', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateMagneticMedia);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);
router.get('/download/:fileId', auth, requirePermission('READ_PAYROLL'), downloadFile);

module.exports = router;
