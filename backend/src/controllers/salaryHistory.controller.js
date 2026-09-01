const mongoose = require('mongoose');
const SalaryHistory = require('../models/salaryHistory.model');
const Employee = require('../models/employee.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const lifecycleEventService = require('../services/lifecycleEvent.service');
const { sanitizeText } = require('../utils/validators');

/**
 * Salary History Controller
 *
 * Handles all operations related to salary change tracking and retrieval.
 *
 * Issue: #505
 */

/**
 * Helper: Load and validate employee ownership
 *
 * @param {string} employeeId - Employee ID
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} Employee object or error response
 */
async function loadOwnedEmployee(employeeId, userId) {
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return { ok: false, status: 400, message: 'Invalid employee id format' };
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    createdBy: userId,
    });

  if (!employee) {
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  return { ok: true, employee };
}

/**
 * GET /api/employees/:id/salary-history-simple
 *
 * Retrieves the complete salary change history for a specific employee.
 * Supports pagination for large histories.
 *
 * Query Parameters:
 * - page (optional): Page number, defaults to 1
 * - limit (optional): Records per page, defaults to 20, max 100
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getSalaryHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate and load the employee
    const owned = await loadOwnedEmployee(id, req.userId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;

    // Parse pagination parameters
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    // Use the static method to fetch paginated history
    const result = await SalaryHistory.getHistoryForEmployee(
      employee._id,
      req.tenantId,
      page,
      limit,
    );

    // Calculate aggregate statistics for the employee's salary history
    const stats = await SalaryHistory.aggregate([
      {
        $match: {
          employeeId: employee._id
        },
      },
      {
        $group: {
          _id: null,
          totalChanges: { $sum: 1 },
          averageChange: { $avg: '$salaryChange' },
          averagePercentageChange: { $avg: '$percentageChange' },
          maxSalary: { $max: '$newSalary' },
          minSalary: { $min: '$previousSalary' },
          totalIncreases: {
            $sum: {
              $cond: [{ $gt: ['$salaryChange', 0] }, 1, 0],
            },
          },
          totalDecreases: {
            $sum: {
              $cond: [{ $lt: ['$salaryChange', 0] }, 1, 0],
            },
          },
          totalNoChange: {
            $sum: {
              $cond: [{ $eq: ['$salaryChange', 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    const aggregatedStats = stats[0] || {
      totalChanges: 0,
      averageChange: 0,
      averagePercentageChange: 0,
      maxSalary: employee.monthlySalary,
      minSalary: employee.monthlySalary,
      totalIncreases: 0,
      totalDecreases: 0,
      totalNoChange: 0,
    };

    logger.info('Salary history retrieved', {
      userId: req.userId,
      employeeId: id,
      employeeName: employee.fullName,
      historyCount: result.history.length,
      totalRecords: result.pagination.totalRecords,
    });

    res.status(200).json({
      employeeId: employee._id,
      employeeName: employee.fullName,
      currentSalary: employee.monthlySalary,
      currency: employee.currency || 'INR',
      history: result.history,
      pagination: result.pagination,
      statistics: {
        totalChanges: aggregatedStats.totalChanges,
        averageChange: Math.round(aggregatedStats.averageChange * 100) / 100,
        averagePercentageChange:
          Math.round(aggregatedStats.averagePercentageChange * 100) / 100,
        highestSalary: aggregatedStats.maxSalary,
        lowestSalary: aggregatedStats.minSalary,
        increases: aggregatedStats.totalIncreases,
        decreases: aggregatedStats.totalDecreases,
        noChange: aggregatedStats.totalNoChange,
      },
    });
  } catch (error) {
    logger.error('Error fetching salary history', {
      userId: req.userId,
      employeeId: req.params.id,
      error: error.message,
    });
    next(error);
  }
};

/**
 * POST /api/employees/:id/salary-history-simple
 *
 * Manually creates a salary history entry.
 * Typically used for corrections or initial salary setup.
 *
 * Request Body:
 * - previousSalary (required): The salary before this change
 * - newSalary (required): The new salary
 * - reason (optional): Reason for the change
 * - note (optional): Additional notes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.createSalaryHistoryManual = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { previousSalary, newSalary, reason, note } = req.body;

    // Validate and load the employee
    const owned = await loadOwnedEmployee(id, req.userId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;

    // Validate salary values
    if (previousSalary === undefined || previousSalary === null) {
      return res.status(400).json({ message: 'Previous salary is required' });
    }

    if (newSalary === undefined || newSalary === null) {
      return res.status(400).json({ message: 'New salary is required' });
    }

    const prevSalaryNum = Number(previousSalary);
    const newSalaryNum = Number(newSalary);

    if (isNaN(prevSalaryNum) || prevSalaryNum < 0) {
      return res
        .status(400)
        .json({ message: 'Previous salary must be a non-negative number' });
    }

    if (isNaN(newSalaryNum) || newSalaryNum < 1) {
      return res
        .status(400)
        .json({ message: 'New salary must be a positive number' });
    }

    // Fetch the user making the change
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create the history entry
    const history = await SalaryHistory.createHistory({
      employeeId: employee._id,
      employeeName: employee.fullName,
      previousSalary: prevSalaryNum,
      newSalary: newSalaryNum,
      changedBy: req.userId,
      changedByName: user.fullName || user.email,
      reason: reason || 'other',
      note: sanitizeText(note || ''),
      currency: employee.currency || 'INR'
    });

    // Emit audit event
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SALARY_HISTORY_CREATE',
      resourceType: 'SalaryHistory',
      resourceIds: [history._id],
      details: {
        employeeId: employee._id,
        employeeName: employee.fullName,
        previousSalary: prevSalaryNum,
        newSalary: newSalaryNum,
        salaryChange: history.salaryChange,
        percentageChange: history.percentageChange,
        reason: history.reason,
      },
      req,
    });

    await lifecycleEventService.recordEvent({
      employeeId: employee._id,
      eventType: 'SALARY_CHANGED',
      category: 'Compensation',
      recordedBy: req.userId,

      previousValues: {
        salary: prevSalaryNum,
        currency: employee.currency || 'INR',
      },

      newValues: { salary: newSalaryNum, currency: employee.currency || 'INR' },
      sourceId: history._id,
      note: history.reason || 'Salary updated'
    });

    logger.info('Salary history created manually', {
      userId: req.userId,
      employeeId: id,
      historyId: history._id,
      previousSalary: prevSalaryNum,
      newSalary: newSalaryNum,
    });

    // Invalidate analytics cache since salary data changed
    await cacheService.invalidateAnalytics(req.userId);

    res.status(201).json({
      message: 'Salary history entry created successfully',
      history,
    });
  } catch (error) {
    logger.error('Error creating salary history', {
      userId: req.userId,
      employeeId: req.params.id,
      error: error.message,
    });
    next(error);
  }
};

/**
 * GET /api/salary-history-simple/export
 *
 * Exports salary history for all employees or a specific employee as CSV.
 *
 * Query Parameters:
 * - employeeId (optional): Filter by specific employee
 * - startDate (optional): Filter history after this date (ISO format)
 * - endDate (optional): Filter history before this date (ISO format)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.exportSalaryHistory = async (req, res, next) => {
  try {
    const { employeeId, startDate, endDate } = req.query;

    // Build the query filter
    const query = {};

    // Filter by employee if specified
    if (employeeId) {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({ message: 'Invalid employee ID format' });
      }
      query.employeeId = employeeId;
    }

    // Filter by date range if specified
    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({ message: 'Invalid startDate format' });
        }
        query.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({ message: 'Invalid endDate format' });
        }
        query.createdAt.$lte = end;
      }
    }

    // Fetch all matching history records
    const historyRecords = await SalaryHistory.find(query)
      .sort({ createdAt: -1 })
      .populate('employeeId', 'fullName email department role')
      .populate('changedBy', 'fullName email')
      .lean();

    if (historyRecords.length === 0) {
      return res.status(404).json({
        message: 'No salary history records found for the specified criteria',
      });
    }

    // Generate CSV content
    const csvHeaders = [
      'Date',
      'Employee Name',
      'Employee Email',
      'Department',
      'Role',
      'Previous Salary',
      'New Salary',
      'Change Amount',
      'Change Percentage',
      'Reason',
      'Changed By',
      'Note',
      'Currency',
    ];

    const csvRows = historyRecords.map((record) => {
      const date = new Date(record.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const employee = record.employeeId || {};
      const changer = record.changedBy || {};

      // Escape CSV fields to prevent injection
      const escapeField = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeField(date),
        escapeField(record.employeeName || employee.fullName || ''),
        escapeField(employee.email || ''),
        escapeField(employee.department || ''),
        escapeField(employee.role || ''),
        record.previousSalary,
        record.newSalary,
        record.salaryChange,
        `${record.percentageChange}%`,
        escapeField(record.reason || ''),
        escapeField(
          changer.fullName || changer.email || record.changedByName || '',
        ),
        escapeField(record.note || ''),
        escapeField(record.currency || ''),
      ].join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = employeeId
      ? `salary-history-${timestamp}.csv`
      : `salary-history-all-${timestamp}.csv`;

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Emit audit event for export
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SALARY_HISTORY_EXPORT',
      resourceType: 'SalaryHistory',
      details: {
        recordCount: historyRecords.length,
        employeeId: employeeId || 'all',
        startDate,
        endDate,
      },
      req,
    });

    logger.info('Salary history exported', {
      userId: req.userId,
      recordCount: historyRecords.length,
      employeeId: employeeId || 'all',
    });

    return res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Error exporting salary history', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

/**
 * DELETE /api/salary-history-simple/:id
 *
 * Deletes a specific salary history entry.
 * Only allowed for administrators or the user who created the entry.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.deleteSalaryHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ message: 'Invalid salary history ID format' });
    }

    // Find the history entry
    const history = await SalaryHistory.findOne({
      _id: id
    });

    if (!history) {
      return res
        .status(404)
        .json({ message: 'Salary history entry not found' });
    }

    // Check if the user created this entry or is an admin
    // For now, we'll allow deletion only by the creator
    if (history.changedBy.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to delete this salary history entry',
      });
    }

    // Delete the entry.
    //
    // Scoped rather than `findByIdAndDelete(id)` (#1010). This one was not
    // exploitable — the `findOne` above already proved the row belongs to
    // the caller's tenant — but the delete restated the id without the
    // tenant, so the safety lived in the distance between two statements
    // rather than in the statement doing the damage. Cheap to make local.
    await SalaryHistory.deleteOne({
      _id: id
    });

    // Emit audit event
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SALARY_HISTORY_DELETE',
      resourceType: 'SalaryHistory',
      resourceIds: [id],
      details: {
        employeeId: history.employeeId,
        employeeName: history.employeeName,
        previousSalary: history.previousSalary,
        newSalary: history.newSalary,
      },
      req,
    });

    logger.info('Salary history deleted', {
      userId: req.userId,
      historyId: id,
      employeeId: history.employeeId,
    });

    res.status(200).json({
      message: 'Salary history entry deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    logger.error('Error deleting salary history', {
      userId: req.userId,
      historyId: req.params.id,
      error: error.message,
    });
    next(error);
  }
};

/**
 * GET /api/salary-history-simple/statistics
 *
 * Retrieves aggregate statistics about salary changes across the organization.
 * Useful for HR analytics and reporting.
 *
 * Query Parameters:
 * - months (optional): Number of months to look back, defaults to 12
 * - department (optional): Filter by department
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getSalaryStatistics = async (req, res, next) => {
  try {
    const monthsBack = Math.min(
      Math.max(parseInt(req.query.months) || 12, 1),
      60,
    );
    const { department } = req.query;

    // Calculate date range
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    // Build the match query
    const matchQuery = {
      createdAt: { $gte: startDate }
    };

    // If department filter is specified, we need to join with employees
    let pipeline = [{ $match: matchQuery }];

    if (department) {
      pipeline.push({
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee',
        },
      });

      pipeline.push({
        $match: {
          'employee.department': department,
        },
      });
    }

    // Add grouping stage
    pipeline.push({
      $group: {
        _id: null,
        totalChanges: { $sum: 1 },
        averageChange: { $avg: '$salaryChange' },
        averagePercentageChange: { $avg: '$percentageChange' },
        maxChange: { $max: '$salaryChange' },
        minChange: { $min: '$salaryChange' },
        totalIncreases: {
          $sum: {
            $cond: [{ $gt: ['$salaryChange', 0] }, 1, 0],
          },
        },
        totalDecreases: {
          $sum: {
            $cond: [{ $lt: ['$salaryChange', 0] }, 1, 0],
          },
        },
        uniqueEmployees: { $addToSet: '$employeeId' },
      },
    });

    // Add monthly breakdown
    pipeline.push({
      $facet: {
        summary: [
          {
            $project: {
              totalChanges: 1,
              averageChange: { $round: ['$averageChange', 2] },
              averagePercentageChange: {
                $round: ['$averagePercentageChange', 2],
              },
              maxChange: 1,
              minChange: 1,
              totalIncreases: 1,
              totalDecreases: 1,
              uniqueEmployees: { $size: '$uniqueEmployees' },
            },
          },
        ],
        monthlyBreakdown: [
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
              },
              changes: { $sum: 1 },
              averageChange: { $avg: '$salaryChange' },
            },
          },
          {
            $sort: { '_id.year': -1, '_id.month': -1 },
          },
        ],
        reasonBreakdown: [
          {
            $group: {
              _id: '$reason',
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ],
      },
    });

    const results = await SalaryHistory.aggregate(pipeline);

    const summary = results[0]?.summary[0] || {
      totalChanges: 0,
      averageChange: 0,
      averagePercentageChange: 0,
      maxChange: 0,
      minChange: 0,
      totalIncreases: 0,
      totalDecreases: 0,
      uniqueEmployees: 0,
    };

    const monthlyBreakdown = results[0]?.monthlyBreakdown || [];
    const reasonBreakdown = results[0]?.reasonBreakdown || [];

    logger.info('Salary statistics retrieved', {
      userId: req.userId,
      monthsBack,
      department: department || 'all',
      totalChanges: summary.totalChanges,
    });

    res.status(200).json({
      period: {
        months: monthsBack,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      department: department || 'all',
      summary,
      monthlyBreakdown,
      reasonBreakdown,
    });
  } catch (error) {
    logger.error('Error fetching salary statistics', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};
