/**
 * Employee Import Routes - Issue #1112
 * Mounted at /api/employees in app.js
 */
'use strict';

const { Router }            = require('express');
const multer                = require('multer');
const auth                  = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS }       = require('../config/permissions');
const {
  startImport,
  getImportJob,
  commitJob,
  rollbackJob,
  getImportProgress,
} = require('../controllers/employeeImport.controller');
const { integrationSecurity } = require('../middlewares/integrationSecurity');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/import',               auth, requirePermission(PERMISSIONS.WRITE_EMPLOYEE), upload.single('csv'), startImport);
router.get('/import/:jobId',         auth, requirePermission(PERMISSIONS.READ_EMPLOYEE),  getImportJob);
router.post('/import/:jobId/commit', auth, requirePermission(PERMISSIONS.WRITE_EMPLOYEE), commitJob);
router.delete('/import/:jobId',      auth, requirePermission(PERMISSIONS.WRITE_EMPLOYEE), rollbackJob);
// GET progress/report for an import job
router.get('/import/:jobId/progress', auth,  requirePermission(PERMISSIONS.READ_EMPLOYEE),  getImportProgress);
router.post('/sync-receiver', integrationSecurity, async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Sync payload received and verified successfully',
    tenantId: req.tenantId,
    provider: req.provider,
  });
});

module.exports = router;