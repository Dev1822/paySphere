// @ts-nocheck
export interface EmployeeCreateInput {
  fullName: string;
  role?: string;
  monthlySalary: number;
  overtimeRate?: number;
  companyName: string;
  createdBy: string;
}

export class EmployeeService {
  /**
   * Constructs the employee document object.
   * Business logic can be expanded here (e.g., auto-generating employee IDs).
   */
  public static createEmployeePayload(input: EmployeeCreateInput) {
    return {
      fullName: input.fullName,
      role: input.role || '',
      monthlySalary: input.monthlySalary,
      overtimeRate: input.overtimeRate || 0,
      companyName: input.companyName,
      createdBy: input.createdBy,
    };
  }
async getEmployeesByTenant(tenantId, filter = {}) {
  QueryValidatorService.validateEmployeeQuery({ tenantId, ...filter });
  TenantContextService.validateTenantOwnership(tenantId);
  
  return Employee.find({ tenantId, ...filter });
}

async getEmployeeById(employeeId, tenantId) {
  TenantContextService.validateTenantOwnership(tenantId);
  
  const employee = await Employee.findOne({
    _id: employeeId,
    tenantId,
  });
  
  if (!employee) {
    throw new Error('Employee not found or does not belong to your organization');
  }
  
  return employee;
}
  /**
   * Hook to evict caches when updating employees or org structures
   */
  public static async evictCache(userId?: string) {
    const cacheService = require('./cache.service');
    await cacheService.invalidateTags([
      'dept:analytics',
      'dashboard',
      'reports',
      'analytics',
      'stats:overview',
    ]);
    if (userId) {
      await cacheService.invalidateAnalytics(userId);
      await cacheService.invalidateAllDashboardCaches(userId);
    }
  }
}
