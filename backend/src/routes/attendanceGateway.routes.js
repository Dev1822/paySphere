const express = require('express');
const { punch, syncBiometric } = require('../controllers/attendanceGateway.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.post(
  '/punch',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  writeRateLimiter,
  punch
);

router.post(
  '/biometric/sync',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  syncBiometric
);

module.exports = router;
