const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { submitDisclosure, recordMilestone, injectToPayroll, getMyIP } = require('../controllers/ip.controller');

const router = express.Router();

router.post('/disclosures', auth, writeRateLimiter, submitDisclosure);
router.post('/milestones', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordMilestone);
router.post('/inject/:milestoneId', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, injectToPayroll);

router.get('/my-ip', auth, getMyIP);

module.exports = router;
