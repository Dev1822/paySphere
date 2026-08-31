const express = require('express');

const {
  getRules,
  recordEstablishment,
  syncHeadcount,
  recordCertification,
  proposeModification,
  getQueue,
  getPosition,
} = require('../controllers/standingOrders.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Industrial Employment (Standing Orders) Act, 1946 (#2029) --------------
//
// Three permissions, and the split is on which name can make an establishment
// look like it has standing orders when the Model orders are what govern it.
//
// MANAGE_STANDING_ORDERS_CERTIFICATION holds the certified set: the date
// authenticated copies were sent, the appeal, and the Schedule matters the set
// covers. All three decide what actually binds the workmen. Moving
// `authenticatedCopiesSentOn` earlier brings the orders into force before they
// bind anybody, and adding a Schedule matter the set does not in fact cover
// takes that matter off the Model orders on paper and nowhere else.
//
// MANAGE_STANDING_ORDERS_REGISTER records the establishment and syncs the
// headcount. Clerical — but it is what dates applicability, and applicability
// starts the six months.
//
// PROPOSE_STANDING_ORDERS_MODIFICATION is separate because of section 10(1).
// The bar is on unilateral amendment and the exception is an agreement, so the
// name that records "we agreed this with the union" is the name that can make a
// barred modification look permitted. It is the narrowest of the three for that
// reason.
//
// Deliberately not the subsistence-allowance permissions from #1828. That
// module reads whether the orders are certified; it does not get to decide it.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_STANDING_ORDERS),
  getRules,
);

// The queue is the feature. Nothing tells an employer that six months have
// started running, so this is the only thing that raises it — and it lists the
// establishments already past the section 3(1) deadline first.
router.get(
  '/queue',
  auth,
  requirePermission(PERMISSIONS.READ_STANDING_ORDERS),
  getQueue,
);

router.get(
  '/establishments/:id',
  auth,
  requirePermission(PERMISSIONS.READ_STANDING_ORDERS),
  getPosition,
);

router.post(
  '/establishments',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_STANDING_ORDERS_REGISTER),
  recordEstablishment,
);

router.post(
  '/establishments/:id/headcount',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_STANDING_ORDERS_REGISTER),
  syncHeadcount,
);

router.post(
  '/establishments/:id/certifications',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_STANDING_ORDERS_CERTIFICATION),
  recordCertification,
);

router.post(
  '/establishments/:id/modifications',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.PROPOSE_STANDING_ORDERS_MODIFICATION),
  proposeModification,
);

module.exports = router;
