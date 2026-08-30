const eventBus = require("../services/event.service");
const { createAuditLog } = require("../services/audit.service");
const { AUDIT_LOG_EVENT } = require("../services/event.service");
const logger = require("../utils/logger");

/**
 * The subscriber for `AUDIT_LOG`.
 *
 * This file registered its listener as a side effect of being required, and
 * then nothing ever required it — not `index.js`, not `app.js`, not a
 * controller. `grep -rn "listeners/" backend/src` returned nothing outside the
 * tests. So thirty-three `eventBus.emit('AUDIT_LOG', ...)` calls across nine
 * controllers fired into an EventEmitter with no subscribers, which is a silent
 * no-op, and the `AuditLog` collection was empty for the entire life of the
 * product (#664).
 *
 * Two changes to make sure that cannot recur quietly:
 *
 *   1. Registration is an exported function that `index.js` calls, in the same
 *      shape as `startCronJobs()` and `seedRbac()`. An import with a side
 *      effect is an import someone deletes as unused; a call in the boot
 *      sequence is not.
 *   2. `isAuditListenerRegistered()` exists so a test can assert the boot
 *      sequence actually wired it up, rather than asserting that a file exists.
 */

/** Idempotence guard: requiring twice must not double-write every entry. */
let registered = false;

/**
 * Handle one emitted audit event.
 *
 * `createAuditLog` already refuses to throw, so this catch is belt-and-braces
 * for a payload malformed enough to break before it gets there. It matters more
 * than it looks: this runs detached from the request, so an exception escaping
 * here is an unhandled rejection, and #421 is still open.
 *
 * @param {object} payload
 * @returns {Promise<void>}
 */
async function handleAuditEvent(payload) {
  try {
    await createAuditLog(payload);
  } catch (error) {
    logger.error("Failed to process an audit event", {
      action: payload?.action,
      resourceType: payload?.resourceType,
      error: error.message,
    });
  }
}

/**
 * Subscribe to `AUDIT_LOG`. Safe to call more than once.
 *
 * @returns {boolean} true if this call performed the registration
 */
function registerAuditListener() {
  if (registered) return false;

  eventBus.on(AUDIT_LOG_EVENT, handleAuditEvent);
  registered = true;

  logger.info("Audit listener registered", { event: AUDIT_LOG_EVENT });
  return true;
}
    const auditIntegrity = require('../services/auditIntegrity.service');
    const recordWithIntegrity = await auditIntegrity.addIntegrityMetadata({
      tenantId: auditContext.tenantId,
      userId: auditContext.userId,
      event: auditContext.event,
      action: auditContext.action,
      resourceType: auditContext.resourceType,
      resourceId: auditContext.resourceId,
      details: auditContext.details,
      timestamp: new Date().toISOString()
    });

    await AuditLog.create(recordWithIntegrity);
/**
 * Is something listening for audit events?
 *
 * Asks the emitter rather than reading the flag, so it stays honest if a
 * listener is removed out from under us.
 *
 * @returns {boolean}
 */
function isAuditListenerRegistered() {
  return eventBus.listenerCount(AUDIT_LOG_EVENT) > 0;
}

/** Test seam: drop the subscription and reset the guard. */
function unregisterAuditListener() {
  eventBus.off(AUDIT_LOG_EVENT, handleAuditEvent);
  registered = false;
}

module.exports = {
  registerAuditListener,
  isAuditListenerRegistered,
  unregisterAuditListener,
  handleAuditEvent,
};
