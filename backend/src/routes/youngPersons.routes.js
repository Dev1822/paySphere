const express = require('express');

const {
  getRules,
  listAgeRecords,
  recordAge,
  getRegister,
  upsertRegisterEntry,
  recordDays,
  getAssessment,
  listFindings,
  resolveFinding,
  listAssessments,
  commitAssessment,
} = require('../controllers/adolescentEmployment.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Child and Adolescent Labour Act, 1986 (#1877) -------------------------
//
// Three permissions, and the split is on which field can turn a prohibited
// engagement into a permitted one.
//
// Keeping the section 11 register — who is engaged, in what work, for which
// hours — sits under MANAGE_YOUNG_PERSON_REGISTER. It is administration, and
// every entry is checkable against the person standing in the establishment.
//
// Recording an age is not. That one date decides whether section 3's total bar
// applies at all, and moving it by a year moves somebody across the fourteen or
// the eighteen boundary. It sits behind MANAGE_AGE_RECORD together with
// resolving a finding, because a resolution is the statement that the
// establishment has acted — and whoever writes the age is then the one account
// that could both create the appearance of lawfulness and close the finding
// that would have said otherwise.
//
// Deliberately not the working-hours permissions, though the section 7 limits
// look like theirs. That router computes an overtime rate for excess hours; for
// anybody under eighteen there is no rate at which the hour becomes lawful, and
// the two answers should not sit behind one name.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_YOUNG_PERSON),
  getRules,
);

router.get(
  '/age-records',
  auth,
  requirePermission(PERMISSIONS.READ_YOUNG_PERSON),
  listAgeRecords,
);

// The date that decides whether the total bar applies — see the note above.
router.post(
  '/age-records',
  auth,
  requirePermission(PERMISSIONS.MANAGE_AGE_RECORD),
  writeRateLimiter,
  recordAge,
);

router.get(
  '/register',
  auth,
  requirePermission(PERMISSIONS.READ_YOUNG_PERSON),
  getRegister,
);

router.post(
  '/register',
  auth,
  requirePermission(PERMISSIONS.MANAGE_YOUNG_PERSON_REGISTER),
  writeRateLimiter,
  upsertRegisterEntry,
);

// Append-only. Section 7's limits are per day and per spell, and replacing the
// list would let a long day be smoothed into a compliant one after the fact.
router.post(
  '/register/:id/days',
  auth,
  requirePermission(PERMISSIONS.MANAGE_YOUNG_PERSON_REGISTER),
  writeRateLimiter,
  recordDays,
);

// Read-only. It computes and returns counts of people and occurrences; there is
// no monetary figure in the response and the controller guards against one.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_YOUNG_PERSON),
  getAssessment,
);

router.get(
  '/findings',
  auth,
  requirePermission(PERMISSIONS.READ_YOUNG_PERSON),
  listFindings,
);

// Records what was done. It does not delete the finding — the register exists
// to show what happened, and clearing the row destroys the evidence that it did.
router.post(
  '/findings/:id/resolve',
  auth,
  requirePermission(PERMISSIONS.MANAGE_AGE_RECORD),
  writeRateLimiter,
  resolveFinding,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_YOUNG_PERSON),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_AGE_RECORD),
  writeRateLimiter,
  commitAssessment,
);

module.exports = router;
