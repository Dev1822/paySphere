/**
 * Authenticate a request and resolve the tenant it is scoped to.
 *
 * This file was `auth.middleware.ts` and could not be loaded (#1008).
 *
 * `backend` is CommonJS and `package.json` starts the server with
 * `node src/index.js`. There is no build step in front of that, and no `dist/`
 * was ever produced, so `require('../middlewares/auth.middleware')` had nothing
 * to resolve to — Node does not read `.ts`. Forty-eight modules require this
 * one, effectively every router in the tree, so the first one Express reached
 * threw `MODULE_NOT_FOUND` and took the boot down with it. The same syntax also
 * defeated Babel, which is configured with `@babel/preset-env` and no
 * TypeScript preset, so the two suites written against this middleware could
 * not even parse — they reported "failed to run" rather than "failed", which
 * reads like an environment problem instead of a dead server.
 *
 * The annotations are preserved as JSDoc rather than discarded. Nothing in the
 * repo type-checks on CI, so they were documentation already; this way they
 * stay readable to an editor without requiring a toolchain the project does not
 * have.
 */

const jwt = require('jsonwebtoken');

const asyncContext = require('../utils/asyncContext');
const User = require('../models/user.model');
const { validateApiKey } = require('../services/apiKey.service');
const { resolveAccountType } = require('../config/accountTypes');
const { ensureTenantForUser } = require('../services/tenant.service');
const { isUsableTenantId } = require('../utils/tenantScope');
const redisClient = require('../config/redis');

/**
 * The claims carried by an access token.
 *
 * @typedef {object} DecodedAccessToken
 * @property {string} id
 * @property {string} [tenantId]
 * @property {number} [tokenVersion]
 */

/**
 * The projection of a User this middleware puts on the request.
 *
 * @typedef {object} AuthenticatedUser
 * @property {string} _id
 * @property {boolean} [isActive]
 * @property {number} [tokenVersion]
 * @property {string} [role]
 * @property {string} [accountType]
 * @property {string} [employeeId]
 * @property {string} [tenantId]
 * @property {string} [companyName]
 * @property {string} [fullName]
 */

/**
 * The fields the middleware needs, and nothing else.
 *
 * Kept as a named constant because two of the entries are load-bearing in ways
 * that are not obvious from the call site, and a well-meaning trim would be a
 * silent regression:
 *
 *   - `tenantId` is what the resolution below prefers over the token claim.
 *   - `companyName` is what `ensureTenantForUser` names a newly provisioned
 *     tenant after.
 *
 * `auth.tenant.middleware.test.js` asserts both are present for this reason.
 */
const AUTH_USER_PROJECTION =
  '_id isActive tokenVersion role accountType employeeId tenantId companyName fullName';

/**
 * Read the bearer token off a request.
 *
 * Split on whitespace rather than a single space so `Bearer  <token>` and a
 * tab-separated header do not read as a missing token, and check the scheme
 * instead of blindly taking the second field — `Basic dXNlcjpwYXNz` should be
 * "no token", not a token that fails verification with a confusing message.
 *
 * @param {import("express").Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') return null;

  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;

  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

/**
 * The tenant a request belongs to.
 *
 * Order matters and is the subject of #612. #585 read the claim straight off
 * the JWT; refresh tokens live seven days, so a session opened before the
 * account had a tenant carried `tenantId: undefined` for a week afterwards. An
 * undefined tenant is not a filter that matches nothing — mongoose drops the
 * key before the driver sees it, which turns every scoped read into an
 * unscoped one.
 *
 * So: the account row wins, because it is current. The claim is only a
 * fallback, and only when it is actually usable — `"undefined"` is what
 * interpolating a missing id into a template produces and it must never become
 * a filter value. Provisioning is last, and is not reached at all for an
 * account that is already scoped, because this runs on every authenticated
 * request and must not cost a write.
 *
 * Returning `null` rather than throwing is deliberate: 401 here would log
 * people out of endpoints that are not tenant-scoped at all, such as reading
 * their own settings. The refusal belongs at the scoped query, which is what
 * `utils/tenantScope.js` does.
 *
 * @param {AuthenticatedUser} user
 * @param {DecodedAccessToken} decoded
 * @returns {Promise<string|null>}
 */
async function resolveTenantId(user, decoded) {
  if (user.tenantId) return user.tenantId;

  if (isUsableTenantId(decoded.tenantId)) return decoded.tenantId;

  const tenantId = await ensureTenantForUser(user);
  if (tenantId) return tenantId;

  const { MissingTenantError } = require('../utils/tenantScope');
  throw new MissingTenantError('Request is not scoped to a company');
}

/**
 * Express middleware: verify the access token, load the account, scope the
 * request.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>}
 */
const auth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    // Check if it's an API Key
    if (token.startsWith('ps_')) {
      const apiKeyDoc = await validateApiKey(token);
      if (!apiKeyDoc) {
        res.status(401).json({ message: 'Invalid or revoked API key' });
        return;
      }

      req.tenantId = apiKeyDoc.tenantId.toString();
      req.isApiKey = true;
      req.apiKeyScopes = apiKeyDoc.scopes;

      // Setting a dummy user to satisfy downstream middlewares that expect req.user
      req.user = {
        _id: apiKeyDoc.createdBy,
        tenantId: req.tenantId,
        role: 'api_client',
        accountType: 'api',
      };
      req.userId = apiKeyDoc.createdBy.toString();

      asyncContext.run({ tenantId: req.tenantId, bypass: false }, () => {
        next();
      });
      return;
    }

    /** @type {DecodedAccessToken} */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is blacklisted in Redis (Token Replay Prevention #2088)
    if (redisClient && redisClient.status === "ready") {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        res.status(401).json({ message: 'Token has been revoked' });
        return;
      }
    }

    /** @type {AuthenticatedUser|null} */
    const user = await User.findById(decoded.id).select(AUTH_USER_PROJECTION);

    if (!user || user.isActive === false) {
      res.status(401).json({ message: 'User not found or deactivated' });
      return;
    }

    // `tokenVersion` is bumped on password change and on forced sign-out, so a
    // token minted before that is stale even though its signature is still
    // valid and it has not expired. Both sides are checked for `undefined`
    // first: a token or an account predating the field must not be read as
    // "version undefined !== version 0" and rejected.
    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      res.status(401).json({ message: 'Token is no longer valid' });
      return;
    }

    req.userId = decoded.id;
    req.user = user;
    req.accountType = resolveAccountType(user);
    req.tenantId = await resolveTenantId(user, decoded);

    if (decoded.isImpersonating) {
      req.isImpersonating = true;
      req.impersonatorId = decoded.impersonatorId;
      req.impersonatorName = decoded.impersonatorName;
      req.impersonatorEmail = decoded.impersonatorEmail;
    }

    asyncContext.run({ tenantId: req.tenantId, bypass: false }, () => {
      next();
    });
  } catch (error) {
    if (error.name === 'MissingTenantError') {
      res.status(403).json({ message: error.message });
      return;
    }
    // Deliberately opaque. Distinguishing "expired" from "malformed" from "bad
    // signature" in the response body tells an attacker which half of a forged
    // token to keep working on.
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = auth;
module.exports.extractBearerToken = extractBearerToken;
module.exports.resolveTenantId = resolveTenantId;
module.exports.AUTH_USER_PROJECTION = AUTH_USER_PROJECTION;
