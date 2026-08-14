const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createVendor,
  createInvoice,
  getVendorLedger,
  getForm16ASummary,
} = require('../controllers/vendor.controller');

const router = express.Router();

router.post('/', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createVendor);
router.post('/:id/invoices', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createInvoice);
router.get('/:id/ledger', auth, requirePermission('READ_EMPLOYEE'), getVendorLedger);
router.get('/:id/form-16a', auth, requirePermission('READ_EMPLOYEE'), getForm16ASummary);

module.exports = router;
