const TenantContextService = require('../services/tenantContext.service');
const logger = require('../utils/logger');

/**
 * Middleware to initialize and maintain tenant context for each request
 * Must be applied early in the request pipeline
 */
function tenantContextMiddleware() {
  return (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;
      
      if (!tenantId) {
        logger.warn('Request without tenant context', {
          path: req.path,
          method: req.method,
          userId,
        });
        return res.status(401).json({ message: 'Tenant context required' });
      }
      
      // Initialize tenant context for this request
      TenantContextService.setTenantContext(tenantId, userId, {
        requestId: req.id,
        method: req.method,
        path: req.path,
      });
      
      // Cleanup on response
      res.on('finish', () => {
        TenantContextService.clearTenantContext();
      });
      
      next();
    } catch (error) {
      logger.error('Error in tenant context middleware', {
        error: error.message,
        path: req.path,
      });
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}

module.exports = { tenantContextMiddleware };