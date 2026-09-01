/**
 * Expense claim routes (#719, #1082).
 *
 * Mounted at /api/expenses by app.js — it was not mounted anywhere until #792,
 * so every endpoint here was a 404 from the day the file was written, and the
 * permissions it asks for did not exist until #794, so they were a 403 after
 * that.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
// `receiptUpload`, not the default CSV uploader: that one rejects everything
// that is not `text/csv` and stores to memory, so a receipt could never be
// uploaded and would have had no filename to record if it had been (#794).
const { receiptUpload, validateMagicNumbers } = require('../middlewares/upload.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  submitExpense,
  getExpenses,
  updateExpenseStatus,
  getCategories,
  createCategory,
  updateCategory,
  parseReceipt,
  getPolicy,
  updatePolicy,
  submitClaim,
  getMyClaims,
  createCustomReport,
  getMyReports,
  exportExpenseReport,
  updateReportStatus,
  getFraudClaims,
  adjudicateClaimStatus,
} = require('../controllers/expense.controller');

const router = express.Router();

// --- Policy Management (#1082) --------------------------------------------
//
// Declared before parameterized routes so `/policy` cannot be swallowed by
// `/:id/status`. Policy read uses READ_EMPLOYEE since all employees need to
// see limits; policy write uses WRITE_PAYROLL since it controls reimbursement.

router.get('/policy', auth, requirePermission('READ_EMPLOYEE'), getPolicy);

router.post(
  '/policy',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  updatePolicy,
);

// --- Claims (New Policy-Driven Workflow, #1082) ---------------------------
//
// `/claims/my` must be declared before any `/:id` route to avoid being
// interpreted as an ID parameter. submitClaim does not require WRITE_EXPENSE
// because employees submit their own claims through this endpoint; ownership
// is enforced inside the controller via req.userId.

router.post('/claims', auth, writeRateLimiter, submitClaim);

router.get('/claims/my', auth, getMyClaims);

router.get(
  '/claims/fraud',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getFraudClaims,
);

router.put(
  '/claims/:id/adjudicate',
  auth,
  requirePermission(PERMISSIONS.APPROVE_EXPENSE),
  writeRateLimiter,
  adjudicateClaimStatus,
);

// --- Custom Expense Reports (#1285) ----------------------------------------

router.post('/reports/custom', auth, writeRateLimiter, createCustomReport);

router.get('/reports/my', auth, getMyReports);

router.get('/reports/export', auth, exportExpenseReport);

router.patch(
  '/reports/:id/status',
  auth,
  requirePermission(PERMISSIONS.APPROVE_EXPENSE),
  writeRateLimiter,
  updateReportStatus,
);

// --- Categories -----------------------------------------------------------
//
// Declared before `/:id/status` so `/categories` cannot be swallowed by a
// parameterised route, and kept on this router rather than a new mount point so
// the whole feature stays behind one prefix.
//
// A claim's category is required and there was no way to create one, so the
// collection was empty on every install and the first possible POST /api/expenses
// was a guaranteed 404 (#794).

router.get(
  '/categories',
  auth,
  requirePermission(PERMISSIONS.READ_EXPENSE),
  getCategories,
);

router.post(
  '/categories',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EXPENSE_CATEGORY),
  writeRateLimiter,
  createCategory,
);

router.patch(
  '/categories/:id',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EXPENSE_CATEGORY),
  writeRateLimiter,
  updateCategory,
);

// --- Legacy Claims --------------------------------------------------------

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_EXPENSE),
  writeRateLimiter,
  receiptUpload.array('receipts', 5),
  validateMagicNumbers,
  submitExpense,
);

router.get('/', auth, requirePermission(PERMISSIONS.READ_EXPENSE), getExpenses);

router.patch(
  '/:id/status',
  auth,
  requirePermission(PERMISSIONS.APPROVE_EXPENSE),
  writeRateLimiter,
  updateExpenseStatus,
);

router.post(
  '/parse-receipt',
  auth,
  requirePermission(PERMISSIONS.WRITE_EXPENSE),
  receiptUpload.single('receipt'),
  validateMagicNumbers,
  parseReceipt,
);

module.exports = router;
