/**
 * @fileoverview Document Vault & E-Signature Routes
 * @description API routes for document management, categorization, and
 * digital e-signature request workflows.
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createCategory,
  getCategories,
  uploadDocument,
  getEmployeeDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  createSignatureRequest,
  getSignatureRequests,
  signDocument,
  declineSignature,
  cancelSignatureRequest,
  getAuditTrail,
  getDashboard,
} = require('../controllers/documentVault.controller');

const router = express.Router();

router.use(auth);

// Dashboard
router.get('/dashboard', requirePermission('READ_EMPLOYEE'), getDashboard);

// Categories
router.post('/categories', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createCategory);
router.get('/categories', requirePermission('READ_EMPLOYEE'), getCategories);

// Documents
router.post('/', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, uploadDocument);
router.get('/employee/:employeeId', requirePermission('READ_EMPLOYEE'), getEmployeeDocuments);
router.get('/:documentId', requirePermission('READ_EMPLOYEE'), getDocument);
router.put('/:documentId', requirePermission('WRITE_EMPLOYEE'), updateDocument);
router.delete('/:documentId', requirePermission('WRITE_EMPLOYEE'), deleteDocument);

// E-Signature
router.post('/esign/request', requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createSignatureRequest);
router.get('/esign/requests', requirePermission('READ_EMPLOYEE'), getSignatureRequests);
router.post('/esign/:requestId/sign', writeRateLimiter, signDocument);
router.post('/esign/:requestId/decline', writeRateLimiter, declineSignature);
router.post('/esign/:requestId/cancel', requirePermission('WRITE_EMPLOYEE'), cancelSignatureRequest);
router.get('/esign/:requestId/audit', requirePermission('READ_EMPLOYEE'), getAuditTrail);

module.exports = router;
