const express = require('express');

const {
  getRules,
  updateRules,
  listSpells,
  createSpell,
  getServiceSuggestion,
  listActions,
  recordAction,
  recordPermission,
  getSeniority,
  recordSeniority,
  getReemploymentPreference,
  recordReemploymentCandidate,
  getClosureQuote,
  previewAssessment,
  listAssessments,
  commitAssessment,
} = require('../controllers/layoffCompensation.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Industrial Disputes Act, Chapters VA and VB (#1830) -------------------
//
// Three permissions, and the split is on the *lawfulness* rather than on the
// money — which is unusual here and follows the chapter.
//
// Recording a spell of lay-off and the days behind it is register-keeping and
// sits under MANAGE_LAYOFF_SPELL. Recording a Chapter VB act and where its
// permission stands is not: that single field decides whether the establishment
// owes half pay for forty-five days or full wages for the whole period, and the
// difference is several times the first. It sits behind
// MANAGE_CHAPTER_VB_ACTION with the thresholds, and whoever holds it does not
// also certify the establishment against the result.
//
// The Chapter VB threshold is in the same bracket for the same reason: raising
// it from one hundred to three hundred turns an illegal act into a compensable
// one on paper without anything changing on the ground.
//
// Deliberately not the settlement permissions, though #1597's retrenchment
// calculator is the nearest neighbour. That answers what a lawful separation
// costs; this answers whether the act was lawful at all, and the second is not
// a payroll question.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  getRules,
);

router.put(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CHAPTER_VB_ACTION),
  writeRateLimiter,
  updateRules,
);

router.get(
  '/spells',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  listSpells,
);

router.post(
  '/spells',
  auth,
  requirePermission(PERMISSIONS.MANAGE_LAYOFF_SPELL),
  writeRateLimiter,
  createSpell,
);

// Read-only, and under the read permission: it offers a worked-days count from
// attendance and says in its own payload that section 25B counts three kinds of
// day the ledger records as absence. Looking at it changes nothing.
router.get(
  '/spells/:id/service-suggestion',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  getServiceSuggestion,
);

router.get(
  '/actions',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  listActions,
);

router.post(
  '/actions',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CHAPTER_VB_ACTION),
  writeRateLimiter,
  recordAction,
);

// The field that decides which of two liabilities applies — see the note above.
router.put(
  '/actions/:id/permission',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CHAPTER_VB_ACTION),
  writeRateLimiter,
  recordPermission,
);

router.get(
  '/actions/:id/seniority',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  getSeniority,
);

// Under MANAGE_CHAPTER_VB_ACTION rather than the spell permission: section 25G
// makes the *selection* reviewable, and a departure with no recorded reason is
// unlawful — so who is proposed is part of the lawfulness question.
router.put(
  '/actions/:id/seniority',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CHAPTER_VB_ACTION),
  writeRateLimiter,
  recordSeniority,
);

// Meant to be called when a vacancy is opened, which is why it is a plain read.
router.get(
  '/reemployment',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  getReemploymentPreference,
);

router.put(
  '/reemployment',
  auth,
  requirePermission(PERMISSIONS.MANAGE_LAYOFF_SPELL),
  writeRateLimiter,
  recordReemploymentCandidate,
);

// A quote for an act that has not happened, so it writes nothing.
router.get(
  '/closure-quote',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  getClosureQuote,
);

router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_LAYOFF),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CHAPTER_VB_ACTION),
  writeRateLimiter,
  commitAssessment,
);

module.exports = router;
