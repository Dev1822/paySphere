const express = require('express');
const router = express.Router();
const {
  getArchivedEmployees,
  getArchivedEmployee,
  anonymizeEmployee,
  evaluateRetention,
  getRetentionPolicy,
  updateRetentionPolicy,
} = require('../controllers/archive.controller');const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { requireTenantScope } = require('../utils/tenantScope');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

router.get(
  '/employees',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getArchivedEmployees,
);

router.get(
  '/retention-check',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  evaluateRetention,
);
router.get(
  '/retention-policy',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getRetentionPolicy,
);

router.patch(
  '/retention-policy',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  updateRetentionPolicy,
);
router.get(
  '/employees/:id',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getArchivedEmployee,
);

router.post(
  '/employees/:id/anonymize',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  anonymizeEmployee,
);

module.exports = router;
