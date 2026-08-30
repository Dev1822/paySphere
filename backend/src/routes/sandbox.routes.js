const express = require('express');
const {
  createSession,
  runSimulation,
  getCompare,
  commitSession,
  rollbackSession,
} = require('../controllers/sandbox.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  createSession
);

router.post(
  '/:sessionId/simulate',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  runSimulation
);

router.get(
  '/:sessionId/compare',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getCompare
);

router.post(
  '/:sessionId/commit',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  commitSession
);

router.delete(
  '/:sessionId',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  rollbackSession
);

module.exports = router;
