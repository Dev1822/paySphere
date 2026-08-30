const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { logIncident, updateIncidentStatus, generate300A, getDashboard } = require('../controllers/safety.controller');

const router = express.Router();

router.post('/log', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, logIncident);
router.patch('/update', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, updateIncidentStatus);
router.post('/generate-300a', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, generate300A);

router.get('/dashboard', auth, requirePermission('READ_EMPLOYEE'), getDashboard);

module.exports = router;
