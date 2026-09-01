const logger = require('../utils/logger');
const TenantContextService = require('./tenantContext.service');

/**
 * Validates that database queries include proper tenant scoping
 * Prevents accidental or malicious unscoped queries
 */
class QueryValidatorService {
  /**
   * Validate employee query includes tenant filter
   */
  static validateEmployeeQuery(filter = {}) {
    const tenantId = TenantContextService.getTenantId();
    
    if (!tenantId) {
      throw new Error('Tenant context required for employee queries');
    }
    
    if (!filter.hasOwnProperty('tenantId')) {
      logger.warn('Unscoped employee query attempt', { tenantId });
      throw new Error('Employee queries must include tenantId filter');
    }
    
    this._validateTenantMatch(filter.tenantId, tenantId, 'employee query');
    return true;
  }

  /**
   * Validate payroll query includes tenant filter
   */
  static validatePayrollQuery(filter = {}) {
    const tenantId = TenantContextService.getTenantId();
    
    if (!tenantId) {
      throw new Error('Tenant context required for payroll queries');
    }
    
    if (!filter.hasOwnProperty('tenantId')) {
      logger.warn('Unscoped payroll query attempt', { tenantId });
      throw new Error('Payroll queries must include tenantId filter');
    }
    
    this._validateTenantMatch(filter.tenantId, tenantId, 'payroll query');
    return true;
  }

  /**
   * Validate report query doesn't aggregate across tenants
   */
  static validateReportQuery(filter = {}, aggregationPipeline = []) {
    const tenantId = TenantContextService.getTenantId();
    
    if (!tenantId) {
      throw new Error('Tenant context required for report queries');
    }
    
    // Check filter
    if (filter && !filter.hasOwnProperty('tenantId')) {
      logger.warn('Unscoped report query attempt', { tenantId });
      throw new Error('Report queries must include tenantId filter');
    }
    
    // Check aggregation pipeline
    if (aggregationPipeline && aggregationPipeline.length > 0) {
      const matchStages = aggregationPipeline.filter(stage => stage.$match);
      const hasTenantFilter = matchStages.some(stage => 
        stage.$match.tenantId !== undefined
      );
      
      if (!hasTenantFilter && matchStages.length > 0) {
        logger.warn('Aggregation pipeline missing tenant filter', { tenantId });
        throw new Error('Report aggregations must filter by tenantId');
      }
    }
    
    return true;
  }

  /**
   * Validate background job includes tenant context
   */
  static validateBackgroundJobContext(jobData) {
    if (!jobData.tenantId) {
      throw new Error('Background job must include tenantId');
    }
    
    const context = TenantContextService.getTenantContext();
    if (context && context.tenantId !== jobData.tenantId) {
      logger.warn('Background job tenant mismatch', {
        contextTenantId: context.tenantId,
        jobTenantId: jobData.tenantId,
      });
      throw new Error('Background job tenantId does not match context');
    }
    
    return true;
  }

  /**
   * Validate export operation includes tenant scope
   */
  static validateExportOperation(exportConfig) {
    const tenantId = TenantContextService.getTenantId();
    
    if (!tenantId) {
      throw new Error('Tenant context required for export operations');
    }
    
    if (!exportConfig.tenantId) {
      throw new Error('Export configuration must specify tenantId');
    }
    
    this._validateTenantMatch(
      exportConfig.tenantId,
      tenantId,
      'export operation'
    );
    
    return true;
  }

  /**
   * Internal helper to validate tenant match
   */
  static _validateTenantMatch(resourceTenant, contextTenant, operation) {
    if (String(resourceTenant) !== String(contextTenant)) {
      logger.error('Tenant mismatch in query validation', {
        operation,
        resourceTenant,
        contextTenant,
      });
      throw new Error(`Tenant mismatch in ${operation}`);
    }
  }
}

module.exports = QueryValidatorService;