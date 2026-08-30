/**
 * @fileoverview Typed Dashboard Controller
 * @description Dashboard aggregation and Redis-cache management.
 * Issue: #1338
 */

import type { NextFunction, Request, Response } from 'express';

const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const Attendance = require('../models/attendance.model');
const Loan = require('../models/loan.model');
const logger = require('../utils/logger');
const cacheService = require('../services/cache.service');
const { PAYROLL_STATUS } = require('../config/payrollStatus');

const DASHBOARD_CACHE_TTL = 900;

type DashboardRequest = Request & {
  userId?: string;
  tenantId?: string;
};

type DashboardStats = {
  totalEmployees?: number;
  activeEmployees?: number;
  totalMonthlySalary?: number;
  departments?: Array<string | null | undefined>;
  totalPayroll?: number;
  pendingCount?: number;
  pendingAmount?: number;
  approvedCount?: number;
  paidCount?: number;
  totalOutstanding?: number;
  activeLoans?: number;
  totalDisbursed?: number;
  totalRecords?: number;
  averagePresentDays?: number;
  averageLeaveDays?: number;
};

type RecentPayroll = {
  _id: unknown;
  employeeName?: string;
  status?: string;
  month?: number;
  year?: number;
  netSalary?: number;
  updatedAt?: Date | string;
};

type DashboardSummary = {
  employees: {
    total: number;
    active: number;
    totalMonthlySalary: number;
    uniqueDepartments: number;
  };
  payroll: {
    currentMonth: number;
    currentYear: number;
    totalPayout: number;
    pendingApprovals: {
      count: number;
      amount: number;
    };
    approved: number;
    paid: number;
  };
  loans: {
    activeCount: number;
    totalOutstanding: number;
    totalDisbursed: number;
  };
  attendance: {
    recordsLogged: number;
    avgPresentDays: number;
    avgLeaveDays: number;
  };
  recentActivity: Array<{
    id: unknown;
    employeeName?: string;
    action: string;
    amount?: number;
    date?: Date | string;
  }>;
  generatedAt: string;
};

type CachedDashboard = DashboardSummary & {
  _cached?: boolean;
  _cacheTTL?: number;
};

type Logger = {
  debug: (message: string, metadata?: Record<string, unknown>) => void;
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
};

type CacheService = {
  get: (key: string) => Promise<CachedDashboard | null>;
  setEx: (
    key: string,
    ttl: number,
    value: DashboardSummary,
  ) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

const typedLogger = logger as Logger;
const typedCacheService = cacheService as CacheService;

function getDashboardCacheKey(userId: string): string {
  return `dashboard:summary:${userId}`;
}

function requireRequestContext(req: DashboardRequest): {
  userId: string;
  tenantId: string;
} {
  if (!req.userId || !req.tenantId) {
    const error = new Error(
      'Authenticated user and tenant context are required',
    ) as Error & {
      statusCode?: number;
    };
    error.statusCode = 401;
    throw error;
  }

  return {
    userId: req.userId,
    tenantId: req.tenantId,
  };
}

function asStats(value: unknown): DashboardStats {
  if (!value || typeof value !== 'object') return {};
  return value as DashboardStats;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundOneDecimal(value: unknown): number {
  return Math.round(numberOrZero(value) * 10) / 10;
}

function departmentCount(departments: DashboardStats['departments']): number {
  if (!Array.isArray(departments)) return 0;

  return departments.filter(
    (department): department is string =>
      typeof department === 'string' && department.trim().length > 0,
  ).length;
}

/**
 * GET /api/dashboard/summary
 */
export async function getDashboardSummary(
  req: DashboardRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  let context: { userId: string; tenantId: string };

  try {
    context = requireRequestContext(req);

    const { userId, tenantId } = context;
    const cacheKey = getDashboardCacheKey(userId);

    const cachedData = await typedCacheService.get(cacheKey);

    if (cachedData) {
      typedLogger.debug('Dashboard summary served from cache', { userId });

      return res.status(200).json({
        ...cachedData,
        _cached: true,
        _cacheTTL: DASHBOARD_CACHE_TTL,
      });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [
      employeeStats,
      payrollStats,
      pendingApprovals,
      loanStats,
      attendanceStats,
    ] = await Promise.all([
      Employee.aggregate([
        {
          $match: {
            tenantId,
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalEmployees: { $sum: 1 },
            activeEmployees: {
              $sum: {
                $cond: ['$isActive', 1, 0],
              },
            },
            totalMonthlySalary: { $sum: '$monthlySalary' },
            departments: { $addToSet: '$department' },
          },
        },
      ]),

      PayrollUpdate.aggregate([
        {
          $match: {
            tenantId,
            month: currentMonth,
            year: currentYear,
          },
        },
        {
          $group: {
            _id: null,
            totalPayroll: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID],
                    ],
                  },
                  '$netSalary',
                  0,
                ],
              },
            },
            pendingCount: {
              $sum: {
                $cond: [
                  { $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] },
                  1,
                  0,
                ],
              },
            },
            pendingAmount: {
              $sum: {
                $cond: [
                  { $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] },
                  '$netSalary',
                  0,
                ],
              },
            },
            approvedCount: {
              $sum: {
                $cond: [{ $eq: ['$status', PAYROLL_STATUS.APPROVED] }, 1, 0],
              },
            },
            paidCount: {
              $sum: {
                $cond: [{ $eq: ['$status', PAYROLL_STATUS.PAID] }, 1, 0],
              },
            },
          },
        },
      ]),

      PayrollUpdate.countDocuments({
        tenantId,
        status: PAYROLL_STATUS.PENDING_APPROVAL,
      }),

      Loan.aggregate([
        {
          $match: {
            tenantId,
            status: 'active',
          },
        },
        {
          $group: {
            _id: null,
            totalOutstanding: { $sum: '$outstanding' },
            activeLoans: { $sum: 1 },
            totalDisbursed: { $sum: '$principalAmount' },
          },
        },
      ]),

      Attendance.aggregate([
        {
          $match: {
            tenantId,
            month: currentMonth,
            year: currentYear,
          },
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            averagePresentDays: { $avg: '$totals.presentDays' },
            averageLeaveDays: { $avg: '$totals.leaveDays' },
          },
        },
      ]),
    ]);

    const recentPayrolls = (await PayrollUpdate.find({ tenantId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('employeeName status month year netSalary updatedAt')
      .lean()) as RecentPayroll[];

    const empStats = asStats(employeeStats[0]);
    const payStats = asStats(payrollStats[0]);
    const lnStats = asStats(loanStats[0]);
    const attStats = asStats(attendanceStats[0]);

    const summaryData: DashboardSummary = {
      employees: {
        total: numberOrZero(empStats.totalEmployees),
        active: numberOrZero(empStats.activeEmployees),
        totalMonthlySalary: numberOrZero(empStats.totalMonthlySalary),
        uniqueDepartments: departmentCount(empStats.departments),
      },

      payroll: {
        currentMonth,
        currentYear,
        totalPayout: numberOrZero(payStats.totalPayroll),
        pendingApprovals: {
          count: numberOrZero(payStats.pendingCount),
          amount: numberOrZero(payStats.pendingAmount),
        },
        approved: numberOrZero(payStats.approvedCount),
        paid: numberOrZero(payStats.paidCount),
      },

      loans: {
        activeCount: numberOrZero(lnStats.activeLoans),
        totalOutstanding: numberOrZero(lnStats.totalOutstanding),
        totalDisbursed: numberOrZero(lnStats.totalDisbursed),
      },

      attendance: {
        recordsLogged: numberOrZero(attStats.totalRecords),
        avgPresentDays: roundOneDecimal(attStats.averagePresentDays),
        avgLeaveDays: roundOneDecimal(attStats.averageLeaveDays),
      },

      recentActivity: recentPayrolls.map((payroll) => ({
        id: payroll._id,
        employeeName: payroll.employeeName,
        action: `Payroll ${payroll.status ?? 'Updated'}`,
        amount: payroll.netSalary,
        date: payroll.updatedAt,
      })),

      generatedAt: new Date().toISOString(),
    };

    await typedCacheService.setEx(cacheKey, DASHBOARD_CACHE_TTL, summaryData);

    typedLogger.info('Dashboard summary generated and cached', {
      userId,
      ttl: DASHBOARD_CACHE_TTL,
    });

    return res.status(200).json({
      ...summaryData,
      _cached: false,
      _cacheTTL: DASHBOARD_CACHE_TTL,
    });
  } catch (error) {
    const typedError = error as Error;

    typedLogger.error('Failed to generate dashboard summary', {
      userId: req.userId,
      error: typedError.message,
      stack: typedError.stack,
    });

    return next(error);
  }
}

/**
 * Invalidates the dashboard cache for a specific authenticated user.
 */
export async function invalidateDashboardCache(userId: string): Promise<void> {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('userId must be a non-empty string');
  }

  try {
    const cacheKey = getDashboardCacheKey(userId);

    await typedCacheService.del(cacheKey);

    typedLogger.debug('Dashboard cache manually invalidated', {
      userId,
    });
  } catch (error) {
    const typedError = error as Error;

    // Cache invalidation failures should not break the main operation.
    typedLogger.warn('Failed to invalidate dashboard cache', {
      userId,
      error: typedError.message,
    });
  }
}

export { DASHBOARD_CACHE_TTL, getDashboardCacheKey };
