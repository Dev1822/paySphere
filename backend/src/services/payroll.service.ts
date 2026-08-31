// @ts-nocheck
export interface Tag {
  label: string;
}

export interface Activity {
  name: string;
  tags: Tag[];
}

export interface PayrollFinalizeInput {
  activities: Activity[];
  month?: number;
  year?: number;
  userId: string;
}

export interface EmployeeData {
  _id: string;
  fullName: string;
  monthlySalary: number;
  overtimeRate?: number;
}

export interface UserData {
  defaultDailyRate?: number;
  defaultOvertimeRate?: number;
}

export class PayrollService {
  /**
   * Helper: parse tag labels back into structured numbers
   */
  public static parseTagValue(label: string): number {
    const num = label.replace(/[^0-9.]/g, '');
    return num ? parseFloat(num) : 0;
  }

  /**
   * Calculates salary adjustments for a given employee based on activities
   */
  public static async calculatePayrollWithLocking(
    employee: EmployeeData,
    user: UserData | null,
    activity: Activity,
    payrollRunId: string,
    payrollPeriodId: string,
    userId: string,
  ) {
    const lockingService = require('./PayrollRunLockingService');

    // Acquire lock before calculating
    const lockResult = await lockingService.acquireLock(
      payrollRunId,
      payrollPeriodId,
      [employee._id],
      userId
    );

    if (!lockResult.success) {
      throw new Error(lockResult.error);
    }

    try {
      // Perform calculation (existing logic)
      const result = this.calculatePayroll(employee, user, activity);

      return {
        ...result,
        lockId: lockResult.lockId,
        inputBoundary: lockResult.inputBoundary,
      };
    } catch (error) {
      // Release lock on error
      await lockingService.forceReleaseLock(
        lockResult.lockId,
        error.message
      );
      throw error;
    }
  }

  public static calculatePayroll(
    employee: EmployeeData,
    user: UserData | null,
    activity: Activity,
  ) {
    let leaveDays = 0,
      overtimeHours = 0,
      bonus = 0,
      deductions = 0;
    for (const tag of activity.tags) {
      const lower = tag.label.toLowerCase();
      const value = this.parseTagValue(tag.label);

      if (lower.includes('leave') || lower.includes('day')) {
        leaveDays += value;
      } else if (lower.includes('overtime') || lower.includes('hr')) {
        overtimeHours += value;
      } else if (lower.includes('bonus')) {
        bonus += value;
      } else if (lower.includes('deduction')) {
        deductions += value;
      }
    }

    const baseSalary = employee.monthlySalary;

    // Use user default daily rate if available, otherwise fallback to salary/30
    const dailyRate = (user && user.defaultDailyRate) || baseSalary / 30;
    const leaveDeduction = Math.round(dailyRate * leaveDays);

    // Use employee's overtime rate if set, otherwise use user default, otherwise 0
    const overtimeRate =
      employee.overtimeRate || (user && user.defaultOvertimeRate) || 0;
    const overtimePay = Math.round(overtimeRate * overtimeHours);

    const netSalary =
      baseSalary - leaveDeduction + overtimePay + bonus - deductions;

    return {
      baseSalary,
      leaveDays,
      overtimeHours,
      bonus,
      deductions,
      leaveDeduction,
      overtimePay,
      netSalary,
      overtimeRate,
    };
  }

  /**
   * Hook to evict caches when finalizing or updating payrolls
   */
  public static async evictCache(userId?: string) {
    const cacheService = require('./cache.service');
    await cacheService.invalidateTags([
      'dashboard',
      'reports',
      'analytics',
      'stats:overview',
    ]);
    if (userId) {
      await cacheService.invalidateAnalytics(userId);
      await cacheService.invalidateDashboardSummary(userId);
    }
  }
}
