const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { logQualifyingEvent, sendNotice, submitElection, recordPayment, getDashboard } = require('../controllers/cobra.controller');

const router = express.Router();

router.post('/events', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, logQualifyingEvent);
router.patch('/events/:eventId/notice', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, sendNotice);
router.post('/elections', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, submitElection);
router.post('/payments', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordPayment);

router.get('/dashboard', auth, requirePermission('READ_EMPLOYEE'), getDashboard);

module.exports = router;
