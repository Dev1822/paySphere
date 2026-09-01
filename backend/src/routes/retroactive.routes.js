const express = require('express');
const { calculateArrears, approveAdjustment } = require('../controllers/retroactive.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.post(
  '/calculate',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  calculateArrears
);

router.post(
  '/approve',
  auth,
  requirePermission(PERMISSIONS.APPROVE_PAYROLL),
  writeRateLimiter,
  approveAdjustment
);

module.exports = router;
