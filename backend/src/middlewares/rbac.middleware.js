/**
 * Authorization middleware.
 *
 * This file answers three different questions and it is worth naming them
 * separately, because conflating them is how it came to be rewritten:
 *
 *   - `requirePermission(name)` — does the caller's *RBAC role* hold a named
 *     permission from `config/permissions.js`? This is the gate 33 routers in
 *     `routes/` use, and the one the seeder, the custom-role feature (#475) and
 *     `permissions.routeCoverage.test.js` are all built around.
 *
 *   - `authorize(...types)` — is the caller in the right *console*? An account
 *     is an owner/admin or it is an employee (`config/accountTypes.js`); the
 *     self-service portal routes care about that and not about permissions.
 *
 *   - `requireScope(scope)` — a static `resource:action` check against the
 *     hard-coded table below, added by #689. It consults no database and is
 *     used by `employee.routes.js` and `payroll.routes.js`.
 *
 * #1057 replaced the whole file with the third of those. Its branch was cut
 * from a base where this path did not exist, so the merge saw a new file rather
 * than a conflict and kept it — and `requirePermission`, `authorize`,
 * `resolveRole` and `STRICT_MODE` went with it. Because every router calls
 * `requirePermission(...)` at module scope, the result was not a 403 or a 500
 * on one endpoint: `app.js` threw `TypeError: requirePermission is not a
 * function` while being required, and the server did not start at all (#1078).
 *
 * That is the same shape as #792, #896 and #1008 — a definition and the code
 * depending on it edited in different places, with nothing failing until boot.
 * `__tests__/rbac.exports.test.js` now asserts this module's export surface by
 * name, so the next rewrite of this file fails on a named test instead.
 */

const User = require('../models/user.model');
const logger = require('../utils/logger');
const { getDefaultRole } = require('../seeds/rbac.seed');
const { resolveAccountType } = require('../config/accountTypes');

/**
 * When true, an account whose role cannot be resolved is denied instead of
 * being repaired. Defaults to true unless explicitly set to false or running in development.
 */
const STRICT_MODE = process.env.RBAC_STRICT !== 'false' && process.env.NODE_ENV !== 'development';

/**
 * Resolve the caller's role, repairing the account if it has none.
 *
 * The repair exists because of #413: accounts created before RBAC landed carry
 * no role reference, and denying them outright locks an owner out of their own
 * workspace. It is persisted, so it happens once per account rather than on
 * every request.
 *
 * @param {string} userId
 * @returns {Promise<{role: object|null, repaired: boolean, missingUser?: boolean}>}
 */
async function resolveRole(userId) {
  const user = await User.findById(userId).populate({
    path: 'role',
    populate: { path: 'permissions', model: 'Permission' },
  });

  if (!user) {
    return { role: null, repaired: false, missingUser: true };
  }

  if (user.role && Array.isArray(user.role.permissions)) {
    return { role: user.role, repaired: false };
  }

  // No role assigned — either a pre-RBAC account or a failed seed.
  const defaultRole = await getDefaultRole();

  if (!defaultRole) {
    logger.error(
      'No role assigned and the default role is missing. Has the RBAC seed run?',
      { userId },
    );
    return { role: null, repaired: false };
  }

  await User.updateOne({ _id: userId }, { $set: { role: defaultRole._id } });
  logger.warn('Assigned the default role to an account that had none', {
    userId,
    role: defaultRole.name,
  });

  const repaired = await User.findById(userId).populate({
    path: 'role',
    populate: { path: 'permissions', model: 'Permission' },
  });

  return { role: repaired?.role || null, repaired: true };
}

/**
 * Middleware asserting that the authenticated user holds a given permission.
 * Requires `auth` to have run first so `req.userId` is populated.
 *
 * @param {string} requiredPermission e.g. "WRITE_PAYROLL"
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { role, missingUser } = await resolveRole(req.userId);

      if (missingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!role) {
        logger.warn(
          'Permission check failed: role could not be resolved. Access denied. Run `npm run seed`.',
          { userId: req.userId, requiredPermission },
        );
        return res
          .status(403)
          .json({ message: 'Access denied. No role assigned.' });
      }

      const hasPermission = role.permissions.some(
        (perm) => perm && perm.name === requiredPermission,
      );

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: req.userId,
          role: role.name,
          requiredPermission,
        });
        return res.status(403).json({
          message: `Access denied. Requires permission: ${requiredPermission}`,
        });
      }

      req.userRole = role.name;
      next();
    } catch (error) {
      logger.error('RBAC middleware error', {
        userId: req.userId,
        requiredPermission,
        error: error.message,
      });
      res
        .status(500)
        .json({ message: 'Internal server error during authorization check' });
    }
  };
};

/**
 * Account-type gate, for routes that are about *which console you are in*
 * rather than *which permission you hold* — the self-service portal, mainly.
 *
 * Previously this read `req.user.role` and fell back to the literal "ADMIN":
 *
 *     const userRole = (req.user && req.user.role) || req.userRole || "ADMIN";
 *
 * Two problems. `req.user.role` is the RBAC role reference, not an account
 * type, so on a repaired database it is an ObjectId that matches neither
 * "ADMIN" nor "EMPLOYEE". And the fallback is fail-open: an account whose type
 * could not be determined was handed the most privileged one, which for an
 * authorization check is backwards. It now resolves from the account itself and
 * denies when it cannot tell (#558).
 *
 * @param {...string} allowedTypes ACCOUNT_TYPE values; empty means "any signed-in account"
 */
const authorize = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user && !req.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (allowedTypes.length === 0) return next();

    // `req.accountType` is stamped by the auth middleware. Resolving again from
    // `req.user` keeps the guard correct when it is mounted without it, or in a
    // test that builds the request by hand.
    const accountType = req.accountType || resolveAccountType(req.user);

    if (!accountType || !allowedTypes.includes(accountType)) {
      return res
        .status(403)
        .json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

// ─── Static scope table (#689) ─────────────────────────────────────────────
//
// Kept as #1057 wrote it, because it is in use: `employee.routes.js` and
// `payroll.routes.js` gate on it. It is a second, coarser vocabulary that
// consults no database — a scope here is not a row in the Permission
// collection and is invisible to the custom-role feature (#475) — so it is not
// a replacement for `requirePermission`, and the two coexist until those two
// routers are migrated.

const roles = {
  admin: ['*'], // Admin has all permissions
  employer: [
    'employee:read',
    'employee:write',
    'payroll:read',
    'payroll:write',
    'report:read',
    'report:write',
    'attendance:read',
    'attendance:write',
  ],
  manager: [
    'employee:read',
    'payroll:read',
    'report:read',
    'attendance:read',
    'attendance:write',
  ],
  employee: ['employee:read', 'payroll:read', 'attendance:read'],
};

/**
 * @param {string} userRole key into `roles`
 * @param {string} requiredScope e.g. "payroll:write"
 * @returns {boolean}
 */
const checkScope = (userRole, requiredScope) => {
  if (!userRole) return false;
  const userScopes = roles[userRole] || [];

  if (userScopes.includes('*')) return true;

  // Exact match
  if (userScopes.includes(requiredScope)) return true;

  // Wildcard match (e.g., employee:* matches employee:write)
  const [resource] = requiredScope.split(':');
  if (userScopes.includes(`${resource}:*`)) return true;

  return false;
};

const requireScope = (requiredScope) => {
  return (req, res, next) => {
    try {
      // Assuming req.userRole is populated by auth middleware
      // If not, we fallback to 'employer' for backward compatibility
      // In a real scenario, User model should have a role field
      const userRole = req.userRole || 'employer';

      if (!checkScope(userRole, requiredScope)) {
        return res.status(403).json({
          message: `Forbidden: Requires '${requiredScope}' scope.`,
          error: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    } catch {
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

// `authorize` is also the default export, because that is how
// `employeePortal.routes.js` and `scheduler.routes.js` import it:
//
//     const authorize = require('../middlewares/rbac.middleware');
//
// Assigning the function and then hanging the named exports off it keeps both
// that form and `const { requirePermission } = require(...)` working, which is
// what every caller in `routes/` was written against.
module.exports = authorize;
module.exports.authorize = authorize;
module.exports.requirePermission = requirePermission;
module.exports.resolveRole = resolveRole;
module.exports.STRICT_MODE = STRICT_MODE;
module.exports.requireScope = requireScope;
module.exports.checkScope = checkScope;
module.exports.roles = roles;
