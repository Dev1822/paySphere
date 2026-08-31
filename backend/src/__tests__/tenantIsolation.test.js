const request = require('supertest');
const app = require('../app');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const { connectDB, disconnectDB } = require('../utils/testDatabase');
const TenantContextService = require('../services/tenantContext.service');
const QueryValidatorService = require('../services/queryValidator.service');

describe('Multi-Tenant Data Isolation', () => {
  const tenant1Id = 'tenant-001';
  const tenant2Id = 'tenant-002';
  const userId = 'user-001';
  
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Employee Query Isolation', () => {
    it('should prevent unscoped employee queries', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validateEmployeeQuery({});
      }).toThrow('Employee queries must include tenantId filter');
      
      TenantContextService.clearTenantContext();
    });

    it('should block cross-tenant employee access', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validateEmployeeQuery({ tenantId: tenant2Id });
      }).toThrow('Tenant mismatch');
      
      TenantContextService.clearTenantContext();
    });

    it('should allow same-tenant employee queries', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validateEmployeeQuery({ tenantId: tenant1Id });
      }).not.toThrow();
      
      TenantContextService.clearTenantContext();
    });
  });

  describe('Payroll Query Isolation', () => {
    it('should prevent unscoped payroll queries', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validatePayrollQuery({});
      }).toThrow('Payroll queries must include tenantId filter');
      
      TenantContextService.clearTenantContext();
    });

    it('should block cross-tenant payroll access', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validatePayrollQuery({ tenantId: tenant2Id });
      }).toThrow('Tenant mismatch');
      
      TenantContextService.clearTenantContext();
    });
  });

  describe('Report Query Isolation', () => {
    it('should prevent unscoped report queries', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validateReportQuery({});
      }).toThrow('Report queries must include tenantId filter');
      
      TenantContextService.clearTenantContext();
    });

    it('should validate aggregation pipeline includes tenant filter', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      const pipeline = [
        { $match: { status: 'completed' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ];
      
      expect(() => {
        QueryValidatorService.validateReportQuery({}, pipeline);
      }).toThrow('Report aggregations must filter by tenantId');
      
      TenantContextService.clearTenantContext();
    });

    it('should allow properly scoped aggregations', async () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      const pipeline = [
        { $match: { tenantId: tenant1Id, status: 'completed' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ];
      
      expect(() => {
        QueryValidatorService.validateReportQuery({ tenantId: tenant1Id }, pipeline);
      }).not.toThrow();
      
      TenantContextService.clearTenantContext();
    });
  });

  describe('Background Job Tenant Context', () => {
    it('should require tenantId in job data', () => {
      expect(() => {
        QueryValidatorService.validateBackgroundJobContext({});
      }).toThrow('Background job must include tenantId');
    });

    it('should validate job tenant matches context', () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validateBackgroundJobContext({ tenantId: tenant2Id });
      }).toThrow('Background job tenantId does not match context');
      
      TenantContextService.clearTenantContext();
    });
  });

  describe('Export Operation Isolation', () => {
    it('should require tenant scope on exports', () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validateExportOperation({});
      }).toThrow('Export configuration must specify tenantId');
      
      TenantContextService.clearTenantContext();
    });

    it('should block cross-tenant exports', () => {
      TenantContextService.setTenantContext(tenant1Id, userId);
      
      expect(() => {
        QueryValidatorService.validateExportOperation({ tenantId: tenant2Id });
      }).toThrow('Tenant mismatch');
      
      TenantContextService.clearTenantContext();
    });
  });
});