const express = require('express');

const {
  getRules,
  recordChange,
  classify,
  determinePopulation,
  serveNotice,
  moveEffectiveDate,
  recordProceeding,
  recordExemption,
  getQueue,
  getPosition,
} = require('../controllers/noticeOfChange.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Industrial Disputes Act section 9A (#1973) -----------------------------
//
// Three permissions, and the split is on which name can make a notice
// obligation disappear.
//
// MANAGE_NOTICE_OF_CHANGE records the change and moves the effective date.
// Moving the date is the ordinary remedy for a short notice — it is what the
// module exists to prompt — so it sits with the clerical name rather than
// behind a second signature.
//
// CLASSIFY_NOTICE_OF_CHANGE holds the Fourth Schedule item, the standing-orders
// and casual-fluctuation qualifiers, and the section 9B / settlement exemption.
// Each of the four can take a change out of the notice queue entirely, and none
// of them leaves any other trace that it did. Reclassifying a change from an
// item to null is how an obligation gets cleared without being discharged.
//
// RECORD_PENDING_PROCEEDING is separate again, and is the narrowest of the
// three. Clearing `expressPermissionReference` turns "you need the Tribunal's
// permission" into "you need to wait twenty-one days", which is the one error in
// this module that tells an employer to commit an offence on a date certain.
//
// Deliberately not the payroll or roster permissions. Those names change what a
// workman is paid and when they work; these record whether the employer was
// entitled to change it on the date they picked.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_NOTICE_OF_CHANGE),
  getRules,
);

// The queue is the feature. There is no notice from anybody that a change is
// about to take effect without one, so this is the only thing that raises it,
// and it lists the changes already in default ahead of the ones still in time.
router.get(
  '/queue',
  auth,
  requirePermission(PERMISSIONS.READ_NOTICE_OF_CHANGE),
  getQueue,
);

router.get(
  '/changes/:id',
  auth,
  requirePermission(PERMISSIONS.READ_NOTICE_OF_CHANGE),
  getPosition,
);

router.post(
  '/changes',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_NOTICE_OF_CHANGE),
  recordChange,
);

router.patch(
  '/changes/:id/effective-date',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_NOTICE_OF_CHANGE),
  moveEffectiveDate,
);

router.post(
  '/changes/:id/population',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_NOTICE_OF_CHANGE),
  determinePopulation,
);

// Serving the notice is clerical against a classification somebody else made,
// and the endpoint refuses outright to record one that would state less than a
// Form E has to — so it does not need the classifying permission.
router.post(
  '/changes/:id/notices',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_NOTICE_OF_CHANGE),
  serveNotice,
);

router.patch(
  '/changes/:id/classification',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.CLASSIFY_NOTICE_OF_CHANGE),
  classify,
);

router.patch(
  '/changes/:id/exemption',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.CLASSIFY_NOTICE_OF_CHANGE),
  recordExemption,
);

router.patch(
  '/changes/:id/proceeding',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.RECORD_PENDING_PROCEEDING),
  recordProceeding,
);

module.exports = router;
