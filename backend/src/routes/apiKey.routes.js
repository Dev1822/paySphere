const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKey.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');

// All API key operations require auth and specific permissions (e.g., admin or developer settings)
router.use(auth);

// Typically only ADMIN or OWNER should generate API keys for the tenant
router.post(
  '/',
  requirePermission('settings:write'),
  apiKeyController.generateKey,
);

router.get('/', requirePermission('settings:read'), apiKeyController.listKeys);

router.delete(
  '/:id',
  requirePermission('settings:write'),
  apiKeyController.revokeKey,
);

router.put(
  '/:id/whitelisted-cidrs',
  requirePermission('settings:write'),
  apiKeyController.updateWhitelistedCIDRs,
);

module.exports = router;
