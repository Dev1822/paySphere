const AsyncLocalStorage = require('async_hooks').AsyncLocalStorage;
const logger = require('../utils/logger');

const tenantContextStorage = new AsyncLocalStorage();

/**
 * Manages tenant context across the request lifecycle
 * Ensures tenant context is consistently available and validated
 */
class TenantContextService {
  /**
   * Initialize tenant context for a request
   */
  static setTenantContext(tenantId, userId, metadata = {}) {
    if (!tenantId) {
      throw new Error('tenantId is required for tenant context');
    }
    
    const context = {
      tenantId: String(tenantId),
      userId,
      metadata,
      timestamp: new Date(),
      requestId: metadata.requestId,
    };
    
    tenantContextStorage.enterWith(context);
    return context;
  }

  /**
   * Get current tenant context
   */
  static getTenantContext() {
    return tenantContextStorage.getStore();
  }

  /**
   * Get tenant ID from context
   */
  static getTenantId() {
    const context = tenantContextStorage.getStore();
    return context?.tenantId;
  }

  /**
   * Verify tenant context exists
   */
  static requireTenantContext() {
    const context = this.getTenantContext();
    if (!context || !context.tenantId) {
      throw new Error('Tenant context is required but not set');
    }
    return context;
  }

  /**
   * Verify tenant ownership of resource
   */
  static validateTenantOwnership(resourceTenantId, operation = 'access') {
    const context = this.getTenantContext();
    const ctxTenantId = context?.tenantId;
    
    if (!ctxTenantId) {
      throw new Error(`Cannot ${operation} resource: tenant context not available`);
    }
    
    if (String(resourceTenantId) !== String(ctxTenantId)) {
      logger.warn('Cross-tenant access attempt blocked', {
        operation,
        requestTenantId: ctxTenantId,
        resourceTenantId,
        userId: context.userId,
      });
      throw new Error(`Cannot ${operation} resource: belongs to different tenant`);
    }
  }

  /**
   * Clear tenant context
   */
  static clearTenantContext() {
    tenantContextStorage.enterWith(null);
  }
}

module.exports = TenantContextService;