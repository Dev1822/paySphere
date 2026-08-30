const express = require('express');

const {
  getAssumptions,
  updateAssumptions,
  backfillWageHistory,
  previewValuation,
  commitValuation,
  listValuations,
  getMemberStatement,
} = require('../controllers/epsPension.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Employees' Pension Scheme, 1995 (#1769) -------------------------------
//
// Three permissions, split on the same principle as the gratuity valuation in
// #1344 and for a sharper version of the same reason. The assumptions decide the
// answer: the wage ceiling is the figure the whole capping question turns on,
// and moving it changes the pensionable salary of every member above the old
// one — for life, since a pension once fixed is not revisited.
//
// The backfill sits behind the write permission rather than the read one even
// though it produces no valuation, because it writes the wage history every
// future valuation is computed from. A backfill run with the wrong resolution of
// the ambiguous months is harder to notice than a wrong valuation and outlives
// it.

router.get(
  '/assumptions',
  auth,
  requirePermission(PERMISSIONS.READ_EPS_PENSION),
  getAssumptions,
);

router.put(
  '/assumptions',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPS_ASSUMPTIONS),
  writeRateLimiter,
  updateAssumptions,
);

// Writes the sixty-month wage history from the payroll ledger. Not a valuation,
// but every valuation rests on it.
router.post(
  '/wage-history/backfill',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EPS_ASSUMPTIONS),
  writeRateLimiter,
  backfillWageHistory,
);

// Writes nothing, and is run repeatedly — the wage history grows every month
// and the answer moves with it.
router.get(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_EPS_PENSION),
  previewValuation,
);

router.get(
  '/valuations',
  auth,
  requirePermission(PERMISSIONS.READ_EPS_PENSION),
  listValuations,
);

router.post(
  '/valuations',
  auth,
  requirePermission(PERMISSIONS.COMMIT_EPS_VALUATION),
  writeRateLimiter,
  commitValuation,
);

// One member's statement, with the sixty months the salary was averaged over.
// The window is returned because this is where the query "why is my pensionable
// salary ₹14,500 when I earned ₹40,000" lands, and it is only answerable by
// showing the capping month by month.
router.get(
  '/members/:employeeId',
  auth,
  requirePermission(PERMISSIONS.READ_EPS_PENSION),
  getMemberStatement,
);

module.exports = router;
