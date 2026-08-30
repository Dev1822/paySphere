/**
 * @fileoverview Referral Bonus Routes
 * @description API endpoints for employee referral bonus tracking system.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  getConfig,
  upsertConfig,
  createReferral,
  getMyReferrals,
  getAllReferrals,
  getReferralById,
  updateReferralStatus,
  assignReferral,
  triggerBonus,
  approveBonus,
  markBonusPaid,
  getPayouts,
  expireReferrals,
  getDashboard,
  getMyStats,
} = require('../controllers/referralBonus.controller');

const router = express.Router();

// ─── Configuration ────────────────────────────────────────────────────────

router.get('/config', auth, requirePermission('READ_EMPLOYEE'), getConfig);
router.post(
  '/config',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  upsertConfig,
);

// ─── Referral Submissions ─────────────────────────────────────────────────

router.get(
  '/referrals',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getAllReferrals,
);
router.get('/referrals/mine', auth, getMyReferrals);
router.get(
  '/referrals/:id',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getReferralById,
);
router.post(
  '/referrals',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createReferral,
);

// ─── Pipeline Management ──────────────────────────────────────────────────

router.patch(
  '/referrals/:id/status',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  updateReferralStatus,
);
router.patch(
  '/referrals/:id/assign',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  assignReferral,
);

// ─── Bonus Payouts ────────────────────────────────────────────────────────

router.get('/payouts', auth, requirePermission('READ_PAYROLL'), getPayouts);
router.post(
  '/referrals/:id/trigger-bonus',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  triggerBonus,
);
router.patch(
  '/payouts/:payoutId/approve',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  approveBonus,
);
router.patch(
  '/payouts/:payoutId/paid',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  markBonusPaid,
);

// ─── Maintenance ──────────────────────────────────────────────────────────

router.post(
  '/expire',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  expireReferrals,
);

// ─── Analytics ────────────────────────────────────────────────────────────

router.get('/dashboard', auth, requirePermission('READ_PAYROLL'), getDashboard);
router.get('/my-stats', auth, getMyStats);

module.exports = router;
