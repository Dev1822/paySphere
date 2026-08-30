/**
 * Audit Integrity Routes - Issue #1905
 *
 * GET  /api/audit/record/:recordId/verify       - verify single record
 * GET  /api/audit/chain/:resourceType/:resourceId/verify - verify resource chain
 * GET  /api/audit/integrity-report              - tenant integrity report
 */
'use strict';

const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const auditIntegrityController = require('../controllers/auditIntegrity.controller');

const router = express.Router();

router.use(authMiddleware);

// Verify specific record
router.get('/record/:recordId/verify', auditIntegrityController.verifyRecord);

// Verify entire chain for a resource
router.get('/chain/:resourceType/:resourceId/verify', auditIntegrityController.verifyChain);

// Tenant-wide integrity report
router.get('/integrity-report', auditIntegrityController.getIntegrityReport);

module.exports = router;