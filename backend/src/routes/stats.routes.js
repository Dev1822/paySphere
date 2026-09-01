const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { getDepartments, getStats } = require('../controllers/stats.controller');
const cacheMiddleware = require('../middlewares/cache.middleware');

const router = express.Router();

router.get(
  '/departments',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  cacheMiddleware({
    ttl: 900,
    prefix: 'stats:departments',
    tags: ['dept:analytics'],
  }),
  getDepartments,
);

router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  cacheMiddleware({
    ttl: 900,
    prefix: 'stats:overview',
    tags: ['stats:overview'],
  }),
  getStats,
);

module.exports = router;
