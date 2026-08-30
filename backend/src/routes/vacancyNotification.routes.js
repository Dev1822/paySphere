const express = require('express');

const {
  getRules,
  listHeadcounts,
  recordHeadcount,
  suggestHeadcount,
  listDeterminations,
  recordDetermination,
  recordOutcome,
  recordNotification,
  listReturns,
  recordReturn,
  getPosition,
} = require('../controllers/vacancyNotification.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Employment Exchanges (CNV) Act, 1959 (#1879) --------------------------
//
// Three permissions, and the split is on which name can take a vacancy out of
// the Act.
//
// Recording that the exchange was told, and filing ER-I and ER-II, sits under
// MANAGE_VACANCY_NOTIFICATION. It is clerical: every row is checkable against
// an acknowledgement from the exchange.
//
// Recording a section 3 determination is not. Marking a vacancy "to be filled
// by promotion" or "less than three months' duration" removes it from the Act
// entirely, and the second of those is contradicted later by the engagement's
// own length. It sits behind MANAGE_CNV_DETERMINATION together with the
// headcount, which does the same thing by a different route — a headcount of
// twenty-four as at the date a requisition opened takes every requisition that
// month outside the threshold.
//
// Deliberately not the recruitment permissions. Those decide who is hired; these
// decide what the state was told, and section 5 means the second creates no
// obligation about the first.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_VACANCY_NOTIFICATION),
  getRules,
);

router.get(
  '/headcounts',
  auth,
  requirePermission(PERMISSIONS.READ_VACANCY_NOTIFICATION),
  listHeadcounts,
);

// Read-only, and under the read permission: it offers today's employee count
// and says in its own payload that section 2(f) counts a wider class than the
// payroll. Looking at it writes nothing.
router.get(
  '/headcounts/suggestion',
  auth,
  requirePermission(PERMISSIONS.READ_VACANCY_NOTIFICATION),
  suggestHeadcount,
);

// The figure that decides whether the Act reached a requisition at all.
router.post(
  '/headcounts',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CNV_DETERMINATION),
  writeRateLimiter,
  recordHeadcount,
);

router.get(
  '/determinations',
  auth,
  requirePermission(PERMISSIONS.READ_VACANCY_NOTIFICATION),
  listDeterminations,
);

// The ground that takes a vacancy out of the Act — see the note above.
router.post(
  '/determinations',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CNV_DETERMINATION),
  writeRateLimiter,
  recordDetermination,
);

// How the vacancy actually turned out. This is what lets a "less than three
// months" exclusion be contradicted by a twelve-month engagement, so it sits
// with the ledger rather than with the determination it may contradict.
router.patch(
  '/determinations/:id/outcome',
  auth,
  requirePermission(PERMISSIONS.MANAGE_VACANCY_NOTIFICATION),
  writeRateLimiter,
  recordOutcome,
);

router.post(
  '/notifications',
  auth,
  requirePermission(PERMISSIONS.MANAGE_VACANCY_NOTIFICATION),
  writeRateLimiter,
  recordNotification,
);

router.get(
  '/returns',
  auth,
  requirePermission(PERMISSIONS.READ_VACANCY_NOTIFICATION),
  listReturns,
);

router.post(
  '/returns',
  auth,
  requirePermission(PERMISSIONS.MANAGE_VACANCY_NOTIFICATION),
  writeRateLimiter,
  recordReturn,
);

// Read-only. It computes and returns; the position changes nothing.
router.get(
  '/position',
  auth,
  requirePermission(PERMISSIONS.READ_VACANCY_NOTIFICATION),
  getPosition,
);

module.exports = router;
