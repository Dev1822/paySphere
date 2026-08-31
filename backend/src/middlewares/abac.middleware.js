const { evaluateAccess } = require('../services/abacEngine.service');
const logger = require('../utils/logger');

/**
 * Middleware to assert ABAC policies.
 * @param {string} action - The action being performed (e.g., 'employee:write').
 * @param {string} resourceName - The name of the resource (e.g., 'Employee').
 * @param {Function} resourceFetcher - Optional async function to fetch the resource data, given `req`.
 */
const requireAbac = (action, resourceName, resourceFetcher = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user && !req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      let resourceData = {};
      if (resourceFetcher) {
        resourceData = await resourceFetcher(req);
        if (!resourceData) {
          return res.status(404).json({ message: 'Resource not found' });
        }
      }

      // Ensure user object has minimum required attributes if not fully populated
      const user = req.user || {
        _id: req.userId,
        role: req.userRole,
        tenantId: req.tenantId,
      };

      const context = {
        ip: req.ip,
        method: req.method,
        path: req.path,
      };

      const isAllowed = await evaluateAccess(
        user,
        action,
        resourceName,
        resourceData,
        context,
      );

      if (!isAllowed) {
        logger.warn('ABAC Permission denied', {
          userId: user._id,
          action,
          resourceName,
        });
        return res
          .status(403)
          .json({
            message: `Access denied for action: ${action} on resource: ${resourceName}`,
          });
      }

      if (resourceFetcher) {
        req.abacResource = resourceData;
      }

      next();
    } catch (error) {
      logger.error('ABAC middleware error', {
        error: error.message,
        action,
        resourceName,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during authorization check' });
    }
  };
};

module.exports = {
  requireAbac,
};
