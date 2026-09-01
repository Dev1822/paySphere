const express = require('express');

const {
  getRules,
  recordRegistration,
  recordParticular,
  syncHeadcount,
  recordClosure,
  listExpiring,
  getPosition,
} = require('../controllers/shopsEstablishments.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Shops and Commercial Establishments Acts (#1972) -----------------------
//
// Three permissions, and the split is on which name can make an establishment
// look registered when it is not.
//
// MANAGE_ESTABLISHMENT_REGISTRATION holds the certificate: the commencement
// date the window runs from, the registration date, and the expiry. Moving any
// of the three changes whether the establishment is trading lawfully, and a
// `validTo` set a year out makes a lapsed certificate look current with nothing
// else on the record changing.
//
// MANAGE_ESTABLISHMENT_PARTICULAR records what a particular says on the
// certificate against what it actually is, and syncs the headcount band.
// Clerical against the certificate itself — but separate, because a particular
// silently "corrected" to match the establishment closes an amendment
// obligation that was owed.
//
// Deliberately not the entity permissions. Those record who the company is;
// these record whether a place of business is lawfully open.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_ESTABLISHMENT_REGISTRATION),
  getRules,
);

router.get(
  '/position',
  auth,
  requirePermission(PERMISSIONS.READ_ESTABLISHMENT_REGISTRATION),
  getPosition,
);

// There is no notice from the department. This is the only thing that raises a
// renewal, and it lists the lapsed ones ahead of the expiring ones.
router.get(
  '/expiring',
  auth,
  requirePermission(PERMISSIONS.READ_ESTABLISHMENT_REGISTRATION),
  listExpiring,
);

// The three dates that decide whether the establishment is lawfully open.
router.post(
  '/registrations',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESTABLISHMENT_REGISTRATION),
  writeRateLimiter,
  recordRegistration,
);

router.put(
  '/registrations/:id/particulars',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESTABLISHMENT_PARTICULAR),
  writeRateLimiter,
  recordParticular,
);

// The bridge nothing else builds: an ordinary hire crosses a band on the
// certificate and starts a clock the hiring flow knows nothing about.
router.post(
  '/registrations/:id/sync-headcount',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESTABLISHMENT_PARTICULAR),
  writeRateLimiter,
  syncHeadcount,
);

// Closure is an obligation rather than the absence of one.
router.post(
  '/registrations/:id/closure',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESTABLISHMENT_REGISTRATION),
  writeRateLimiter,
  recordClosure,
);

module.exports = router;
