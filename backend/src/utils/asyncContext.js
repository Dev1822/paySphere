const { AsyncLocalStorage } = require('async_hooks');

/**
 * Singleton instance of AsyncLocalStorage to hold context 
 * (like tenantId, userId, and bypass flags) for the duration of a request.
 */
const tenantContext = new AsyncLocalStorage();

module.exports = tenantContext;
