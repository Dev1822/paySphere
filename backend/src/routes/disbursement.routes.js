const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  configureOriginator,
  mapEmployeeBank,
  generateNachaFile,
  getDashboard,
  downloadFile,
  createBatch,
  getBatches,
  getBatch,
  validateBatchLines,
  getBatchFile,
  releaseBatch,
  recordReturns,
  getBankProfiles,
} = require('../controllers/disbursement.controller');

const router = express.Router();

router.post(
  '/originator',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  configureOriginator,
);
router.post(
  '/map-bank',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  mapEmployeeBank,
);
router.post(
  '/generate',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  generateNachaFile,
);

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);
router.get(
  '/download/:fileId',
  auth,
  requirePermission('READ_PAYROLL'),
  downloadFile,
);

/**
 * Salary disbursement routes — mounted at /api/disbursements (#1075).
 *
 * Three permissions, and the split is the same maker–checker reasoning that
 * keeps APPROVE_PAYROLL apart from WRITE_PAYROLL (#458):
 *
 *   - READ_DISBURSEMENT     see batches, lines and return status
 *   - MANAGE_DISBURSEMENT   build a batch, validate it, download the file
 *   - RELEASE_DISBURSEMENT  mark it released — the point of no return
 *
 * Whoever assembles a payment file should not be the only person standing
 * between it and a bank transfer. This is the highest-consequence write in the
 * product: everything else changes a record, this one moves money out of the
 * company's account into several hundred others.
 *
 * `GET /batches/:id/file` sits under MANAGE_DISBURSEMENT rather than
 * READ_DISBURSEMENT on purpose. It is the only response in the product that
 * carries full bank account numbers, so it is not a read in the sense the read
 * permission means.
 */

// Declared above `/batches/:id` so the literal segment is matched first — the
// other way round, `getBatch` would receive `id: 'profiles'`.
router.get(
  '/profiles',
  auth,
  requirePermission(PERMISSIONS.READ_DISBURSEMENT),
  getBankProfiles,
);

// --- Batches --------------------------------------------------------------
router.post(
  '/batches',
  auth,
  requirePermission(PERMISSIONS.MANAGE_DISBURSEMENT),
  writeRateLimiter,
  createBatch,
);
router.get(
  '/batches',
  auth,
  requirePermission(PERMISSIONS.READ_DISBURSEMENT),
  getBatches,
);
router.get(
  '/batches/:id',
  auth,
  requirePermission(PERMISSIONS.READ_DISBURSEMENT),
  getBatch,
);
router.post(
  '/batches/:id/validate',
  auth,
  requirePermission(PERMISSIONS.MANAGE_DISBURSEMENT),
  writeRateLimiter,
  validateBatchLines,
);

// The only response in the product carrying full account numbers.
router.get(
  '/batches/:id/file',
  auth,
  requirePermission(PERMISSIONS.MANAGE_DISBURSEMENT),
  getBatchFile,
);

// --- The point of no return -----------------------------------------------
router.post(
  '/batches/:id/release',
  auth,
  requirePermission(PERMISSIONS.RELEASE_DISBURSEMENT),
  writeRateLimiter,
  releaseBatch,
);

// Recording returns is bookkeeping about what the bank did, not an instruction
// to it, so it stays with MANAGE_DISBURSEMENT.
router.post(
  '/batches/:id/returns',
  auth,
  requirePermission(PERMISSIONS.MANAGE_DISBURSEMENT),
  writeRateLimiter,
  recordReturns,
);

module.exports = router;
