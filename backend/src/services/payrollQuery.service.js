const mongoose = require('mongoose');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const {
  PAYROLL_STATUS,
  excludeRejectedFilter,
} = require('../config/payrollStatus');
const {
  parseDepartments,
  resolveDepartmentEmployeeIds,
  applyEmployeeFilter,
} = require('../utils/departmentFilter');

class PayrollQueryService {
  static async getSummary({
    tenantId,
    month,
    year,
    departments,
    page = 1,
    limit = 20,
  }) {
    const deps = parseDepartments(departments);
    const employeeIds = await resolveDepartmentEmployeeIds(
      Employee,
      tenantId,
      deps,
    );

    const skip = limit > 0 ? (page - 1) * limit : 0;

    const baseQuery = {
      tenantId,
      month,
      year,
      ...excludeRejectedFilter(),
    };

    applyEmployeeFilter(baseQuery, employeeIds);

    const [totalCount, payrolls] = await Promise.all([
      PayrollUpdate.countDocuments(baseQuery),
      limit > 0
        ? PayrollUpdate.find(baseQuery)
            .sort({ employeeName: 1 })
            .skip(skip)
            .limit(limit)
        : PayrollUpdate.find(baseQuery).sort({ employeeName: 1 }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;

    const [aggResult] = await PayrollUpdate.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalPayout: {
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
          payableCount: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID],
                  ],
                },
                1,
                0,
              ],
            },
          },
          pendingApprovalTotal: {
            $sum: {
              $cond: [
                { $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] },
                '$netSalary',
                0,
              ],
            },
          },
          pendingApprovalCount: {
            $sum: {
              $cond: [
                { $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const round2 = (n) => Math.round(n * 100) / 100;

    return {
      month,
      year,
      totalPayout: round2(aggResult ? aggResult.totalPayout : 0),
      employeeCount: aggResult ? aggResult.payableCount : 0,
      pendingApprovalTotal: round2(
        aggResult ? aggResult.pendingApprovalTotal : 0,
      ),
      pendingApprovalCount: aggResult ? aggResult.pendingApprovalCount : 0,
      payrolls,
      currentPage: page,
      totalPages,
      totalCount,
      departments: deps,
    };
  }
}

module.exports = PayrollQueryService;
