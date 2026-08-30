const express = require('express');
const router = express.Router();
const bulkOperationController = require('../controllers/bulkOperation.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');

// Apply auth middleware for all routes
router.use(authMiddleware);
// Apply permission check - assuming MANAGE_EMPLOYEES is sufficient for now
// as we are waiting on user feedback if a new RBAC is needed.
router.use(requirePermission([PERMISSIONS.MANAGE_EMPLOYEES]));

router.post('/preview', bulkOperationController.previewBulkOperation);
router.post('/execute', bulkOperationController.executeBulkOperation);
router.post('/:id/rollback', bulkOperationController.rollbackBulkOperation);
router.get('/', bulkOperationController.getBulkOperations);

module.exports = router;
