const express = require('express');

const {
  getRules,
  recordNomination,
  openClaim,
  recordNotices,
  recordForfeiture,
  recordPayment,
  getQueue,
  getPosition,
} = require('../controllers/gratuityEntitlement.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Payment of Gratuity Act, 1972 (#2031) ---------------------------------
//
// Four permissions, and the split is on which name can reduce what an employee
// or their family is paid.
//
// MANAGE_GRATUITY_CLAIM opens the obligation and records the two section 7(2)
// notices. `payableFrom` is on this permission and it is the sharpest field in
// the module — moving it forward makes an overdue gratuity look current and
// reduces the 7(3A) interest with nothing else on the record changing.
//
// MANAGE_GRATUITY_NOMINATION holds the Form F. Editing a share moves money
// between two named people on the day it is most contested, and the person it
// was taken from is dead. Separate from the EPF nomination permission for the
// same reason the record is separate.
//
// FORFEIT_GRATUITY is separate again, and is the one that takes money away. The
// engine caps it at what section 4(6) permits, but the sub-section chosen, the
// damage figure under (a) and `terminatedForTheAct` under (b) are all on this
// permission — and each of the three moves the cap.
//
// RECORD_GRATUITY_PAYMENT is narrowest. It carries the 7(3A) relief, and a
// controlling-authority permission recorded that does not exist writes off a
// statutory interest liability outright.
//
// Deliberately not the #1344 valuation names. Those measure the workforce's
// obligation under Ind AS 19; these decide what one person is owed.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_CLAIM),
  getRules,
);

// The queue is the feature. Nothing else raises a section 7(3) breach, and the
// interest runs at ten per cent whether or not anybody is looking.
router.get(
  '/queue',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_CLAIM),
  getQueue,
);

router.get(
  '/claims/:id',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_CLAIM),
  getPosition,
);

router.post(
  '/nominations',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_GRATUITY_NOMINATION),
  recordNomination,
);

router.post(
  '/claims',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_GRATUITY_CLAIM),
  openClaim,
);

router.patch(
  '/claims/:id/notices',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.MANAGE_GRATUITY_CLAIM),
  recordNotices,
);

router.post(
  '/claims/:id/forfeiture',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.FORFEIT_GRATUITY),
  recordForfeiture,
);

router.patch(
  '/claims/:id/payment',
  auth,
  writeRateLimiter,
  requirePermission(PERMISSIONS.RECORD_GRATUITY_PAYMENT),
  recordPayment,
);

module.exports = router;
