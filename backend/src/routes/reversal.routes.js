const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { requireMFA } = require('../middlewares/mfa.middleware');
const {
  // Legacy Endpoints (Issue #1166)
  initiateReversal,
  getReversals,
  approveReversal,
  checkPayrollBlockGuard,
  getTaxAdjustmentSummary,
  // New Endpoints (Issue #1936)
  initiateReversalOrder,
  generateReceivable,
  getDashboard,
} = require('../controllers/reversal.controller');

const router = express.Router();

// ==================== Legacy Reversal Routes (Issue #1166) ====================
router.post('/initiate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, requireMFA, initiateReversal);
router.get('/', auth, requirePermission('READ_PAYROLL'), getReversals);
router.get('/tax-adjustment-summary', auth, requirePermission('READ_PAYROLL'), getTaxAdjustmentSummary);
router.patch('/:id/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, requireMFA, approveReversal);
router.get('/block-guard', auth, requirePermission('WRITE_PAYROLL'), checkPayrollBlockGuard);

// ==================== New Reversal Order Routes (Issue #1936) ====================
router.post('/order/initiate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, requireMFA, initiateReversalOrder);
router.post('/order/receivable', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, requireMFA, generateReceivable);
router.get('/order/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);

module.exports = router;
