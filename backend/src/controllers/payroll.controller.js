const PayrollEngine = require('../services/PayrollEngine.service');
const PayrollQueryService = require('../services/payrollQuery.service');
const PayrollExportService = require('../services/payrollExport.service');
const PayrollFinalizationService = require('../services/payrollFinalization.service');// `tax.service` and `anomaly.service` were required here by the #693
// scaffolding and never called. Left in place they are two more modules loaded
// on every payroll request for nothing, and `anomaly.service` in particular has
// a broken require of its own that this file was propagating to app.js at boot
// (#792). Dropped rather than wired up: neither has an implementation to call.
const crypto = require('crypto');
const {
  PAYROLL_CALCULATION_VERSION,
} = require('../config/payrollCalculationVersion');
const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const User = require('../models/user.model');
const ExchangeRate = require('../models/exchangeRate.model');
const { acquireLock, releaseLock } = require('../utils/lockManager');
const { calculateNetSalary } = require('../utils/salaryCalculator');
const { generatePayrollCSV } = require('../utils/csvExport');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const BlockchainService = require('../services/blockchain.service');
// `webhookService` was imported for the stray `triggerEvent` call #543 left in
// the middle of submitPayrollForReview. That call is gone (see below) and the
// service has never exported `triggerEvent` anyway — payroll webhooks are
// delivered by its AUDIT_LOG subscription, which needs nothing from here.
// Restored: this import was dropped when #464 was merged into main via the
// GitHub conflict editor, leaving PAYROLL_STATUS, payableStatusFilter and
// friends undefined — every summary, export, payslip email and approval call
// throws a ReferenceError without it (#458).
const {
  PAYROLL_STATUS,
  canTransition,
  describeTransition,
  isEmailable,
  normalizeStatus,
  payableStatusFilter,
  excludeRejectedFilter,
} = require('../config/payrollStatus');
const Attendance = require('../models/attendance.model');
const { derivePayrollInputs } = require('../utils/attendanceGrid');
const Loan = require('../models/loan.model');
const {
  LOAN_STATUS,
  allocateRecovery,
  applyRepayment,
} = require('../utils/loanSchedule');
const SalaryStructure = require('../models/salaryStructure.model');
const {
  resolveStructureForPeriod,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const {
  parseDepartments,
  resolveDepartmentEmployeeIds,
  applyEmployeeFilter,
} = require('../utils/departmentFilter');
// Arrears owed for months already paid at an older rate (#931). Required here
// rather than inside the per-employee loop it is used from: that require named
// a module that does not exist, and being inside the loop meant nothing found
// out until a real payroll run hit it and every submission answered 500 (#950).
const {
  bundleUnreleasedArrears,
  markArrearsReleased,
} = require('../utils/arrearsCalculator');

// Also dropped by the #464 merge alongside the payrollStatus import: both are
// referenced by parsePayrollIdBatch and rejectPayroll (#458).
const MAX_BATCH_SIZE = 200;
const MAX_REJECTION_REASON_LENGTH = 500;

// Helper: parse tag labels back into structured numbers
function parseTagValue(label) {
  if (typeof label !== 'string') return 0;
  const num = label.replace(/[^0-9.]/g, '');
  if (!num) return 0;
  const parsed = parseFloat(num);
  return isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Validate a batch of payroll ids supplied in a request body.
 *
 * The approval handlers took `payrollIds` straight from the body and fed it to
 * `updateMany`. A non-ObjectId string throws a CastError that surfaces as a
 * 500, and an unbounded array lets a single request rewrite the entire
 * collection — so both are checked here before anything touches the database.
 *
 * @param {*} value raw `payrollIds` from the body
 * @returns {{ ok: true, ids: string[] } | { ok: false, message: string }}
 */
function parsePayrollIdBatch(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      ok: false,
      message: 'payrollIds must be a non-empty array of payroll record ids',
    };
  }

  if (value.length > MAX_BATCH_SIZE) {
    return {
      ok: false,
      message: `Cannot process more than ${MAX_BATCH_SIZE} payroll records in a single request`,
    };
  }

  const invalid = value.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Invalid payroll id format: ${invalid.slice(0, 5).join(', ')}`,
    };
  }

  // De-duplicate so a repeated id in the payload cannot be counted twice in the
  // response tallies.
  return { ok: true, ids: [...new Set(value.map(String))] };
}

/**
 * Split a field map into the `$set` and `$unset` halves of an update.
 *
 * `approvePayroll` clears the rejection trail by passing `rejectionReason:
 * undefined`, and `rejectPayroll` clears the approval trail the same way. That
 * only ever worked by accident: mongoose strips `undefined` values out of a
 * `$set`, so those keys were dropped and the stale verdict stayed on the
 * document — a row approved after a rejection kept showing the old reason.
 *
 * Anything explicitly cleared belongs in `$unset` instead, which is what the
 * callers meant.
 *
 * @param {object} fields
 * @returns {{ set: object, unset: object }}
 */
function splitFieldUpdates(fields = {}) {
  const set = {};
  const unset = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      unset[key] = '';
    } else {
      set[key] = value;
    }
  }

  return { set, unset };
}

/**
 * Apply a status transition to a batch of payroll records owned by the caller.
 *
 * This is the whole fix for the cross-tenant hole in #458 concentrated in one
 * place: the query is *always* scoped by `tenantId`, and every id is
 * classified so the response can tell the client precisely which records moved,
 * which were not theirs, and which were in a state the transition table
 * forbids. The previous implementation issued a blind `updateMany` keyed only
 * on `_id`, which both leaked other companies' records and reported success for
 * ids that matched nothing.
 *
 * @param {object} params
 * @param {string} params.tenantId caller's company — the ownership scope
 * @param {string[]} params.ids payroll ids to transition
 * @param {string} params.targetStatus a PAYROLL_STATUS value
 * @param {object} params.extraFields fields to write alongside the status; a
 *   key whose value is `undefined` or `null` is removed from the document
 *   rather than written, see `splitFieldUpdates`
 * @returns {Promise<{applied: object[], notFound: string[], invalidTransition: object[]}>}
 */
async function transitionPayrollBatch({
  tenantId,
  ids,
  targetStatus,
  extraFields = {},
  expectedVersions = {},
}) {
  // Scoped read first. Anything the caller does not own simply never appears in
  // this result set, and therefore lands in `notFound` — the caller cannot tell
  // "does not exist" from "belongs to someone else", which is the correct
  // answer to give.
  const owned = await PayrollUpdate.find({
    _id: { $in: ids },
    tenantId,
  }).select('_id status employeeName month year netSalary __v');

  const ownedById = new Map(owned.map((p) => [String(p._id), p]));

  const notFound = ids.filter((id) => !ownedById.has(String(id)));
  const transitionable = [];
  const invalidTransition = [];

  for (const record of owned) {
    const current = normalizeStatus(record.status) || record.status;

    if (!canTransition(current, targetStatus)) {
      invalidTransition.push({
        payrollId: String(record._id),
        employeeName: record.employeeName,
        currentStatus: current,
        reason: describeTransition(current, targetStatus),
      });
      continue;
    }

    transitionable.push(record);
  }

  let applied = [];
  const versionConflicts = [];

  if (transitionable.length > 0) {
    const targetIds = transitionable.map((r) => r._id);

    const { set, unset } = splitFieldUpdates(extraFields);
    const update = {
      $set: { status: targetStatus, ...set },
      $inc: { __v: 1 },
    };
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const filter = {
      _id: { $in: targetIds },
      tenantId,
      $or: transitionable.map((r) => ({
        _id: r._id,
        __v:
          expectedVersions[String(r._id)] !== undefined
            ? expectedVersions[String(r._id)]
            : r.__v,
      })),
    };
    const res = await PayrollUpdate.updateMany(filter, update, {
      runValidators: true,
    });

    const matched =
      res.matchedCount !== undefined ? res.matchedCount : res.modifiedCount;

    if (matched < transitionable.length) {
      transitionable.forEach((r) => {
        versionConflicts.push({
          payrollId: String(r._id),
          employeeName: r.employeeName,
        });
      });
    } else {
      applied = transitionable.map((r) => ({
        payrollId: String(r._id),
        employeeName: r.employeeName,
        month: r.month,
        year: r.year,
        netSalary: r.netSalary,
        previousStatus: normalizeStatus(r.status) || r.status,
        status: targetStatus,
      }));
    }
  }

  return { applied, notFound, invalidTransition, versionConflicts };
}

// FINALIZE PAYROLL — process activity entries and save payroll records

/**
 * GET /api/payroll/approvals — the checker's queue.
 *
 * The original implementation ran `PayrollUpdate.find({ status:
 * "PENDING_APPROVAL" })` with the comment "Admin sees all in this demo". On a
 * shared deployment that returns every company's employee names, base salaries
 * and net salaries to any logged-in account. Scoped by `tenantId` like every
 * other read in the codebase (#458).
 */
exports.getPendingApprovals = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    const skip = (page - 1) * limit;

    const query = {
      status: PAYROLL_STATUS.PENDING_APPROVAL
    };

    // Optional period narrowing, so a checker can review one month at a time
    // rather than paging through the entire backlog.
    if (req.query.month !== undefined) {
      const month = Number(req.query.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Invalid month parameter' });
      }
      query.month = month;
    }

    if (req.query.year !== undefined) {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ message: 'Invalid year parameter' });
      }
      query.year = year;
    }

    const [pending, totalCount] = await Promise.all([
      PayrollUpdate.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('submittedBy', 'fullName email')
        .populate('employeeId', 'fullName role email'),
      PayrollUpdate.countDocuments(query),
    ]);

    // The checker needs the size of what they are signing off, not just the
    // page in front of them.
    const [totals] = await PayrollUpdate.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalNetSalary: { $sum: '$netSalary' },
          employeeCount: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      pending,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 0,
      totalCount,
      pendingTotalNetSalary: totals
        ? Math.round(totals.totalNetSalary * 100) / 100
        : 0,
      pendingEmployeeCount: totals ? totals.employeeCount : 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payroll/approve — checker signs off a batch.
 *
 * Previously an unscoped `updateMany` keyed on `_id` alone: any authenticated
 * account could approve any other company's payroll by guessing or harvesting
 * ids, and the handler reported success regardless of whether anything matched.
 */
exports.approvePayroll = async (req, res, next) => {
  let payrollRunId;
  try {
    const batch = parsePayrollIdBatch(req.body && req.body.payrollIds);
    if (!batch.ok) {
      return res.status(400).json({ message: batch.message });
    }

    const { tenantId } = req;
    const { payrollRunId: requestPayrollRunId } = req.body;
    const approvedAt = new Date();

    const { applied, notFound, invalidTransition, versionConflicts } =
      await transitionPayrollBatch({
        ids: batch.ids,
        targetStatus: PAYROLL_STATUS.APPROVED,
        expectedVersions: submittedVersions,
        extraFields: {
          approvedBy: req.userId,
          approvedAt,
          rejectionReason: undefined,
          rejectedBy: undefined,
          rejectedAt: undefined,
        },
      });

    if (versionConflicts && versionConflicts.length > 0) {
      return res.status(409).json({
        message:
          'A concurrent update was detected. Please reload and try again.',
        versionConflicts,
      });
    }

    if (applied.length === 0) {
      return res.status(409).json({
        message: 'No payroll records were approved',
        approvedCount: 0,
        notFound,
        invalidTransition,
      });
    }

    // Issue #1902: Use atomic finalization service
    if (requestPayrollRunId) {
      payrollRunId = requestPayrollRunId;
    } else {
      const PayrollRun = require('../models/payrollRun.model');
      const newRun = await PayrollRun.create({
        tenantId,
        payrollPeriod: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        payrollRunType: 'REGULAR',
        status: 'processing',
      });
      payrollRunId = newRun._id;
    }

    const finalizationResult = await PayrollFinalizationService.finalizePayroll({
      tenantId,
      payrollIds: applied.map((item) => mongoose.Types.ObjectId(item.payrollId)),
      payrollRunId,
      userId: req.userId,
    });

    await cacheService.invalidateAnalytics(req.userId);
    await cacheService.invalidateDashboardSummary(req.userId);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYROLL_APPROVE',
      resourceType: 'Payroll',
      resourceIds: finalizationResult.applied.map((a) => a.payrollId),
      details: {
        approvedCount: applied.length,
        finalizedCount: finalizationResult.applied.length,
        notFoundCount: notFound.length,
        invalidTransitionCount: invalidTransition.length,
        totalNetSalary: applied.reduce((sum, a) => sum + (a.netSalary || 0), 0),
      },
      result:
        notFound.length > 0 || invalidTransition.length > 0
          ? 'partial'
          : 'success',
      req,
    });
    logger.info('Payroll approved', {
      userId: req.userId,
      approvedCount: applied.length,
      notFoundCount: notFound.length,
      invalidTransitionCount: invalidTransition.length,
    });

    res.status(200).json({
      message: `Approved ${applied.length} payroll record${applied.length !== 1 ? 's' : ''}`,
      approvedCount: applied.length,
      approved: applied,
      notFound,
      invalidTransition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payroll/reject — checker sends a batch back to the maker.
 *
 * Same ownership fix as approve, plus the rejection reason is now actually
 * persisted: `rejectionReason` was not on the schema, so mongoose strict mode
 * discarded it and the maker was told "rejected" with no indication why (#458).
 */
exports.rejectPayroll = async (req, res, next) => {
  try {
    const batch = parsePayrollIdBatch(req.body && req.body.payrollIds);
    if (!batch.ok) {
      return res.status(400).json({ message: batch.message });
    }

    const rawReason = req.body && req.body.reason;
    if (typeof rawReason !== 'string' || rawReason.trim() === '') {
      return res
        .status(400)
        .json({ message: 'A rejection reason is required' });
    }

    const reason = rawReason.trim().slice(0, MAX_REJECTION_REASON_LENGTH);
    const rejectedAt = new Date();
    const payrollsToApprove = await PayrollUpdate.find({
      _id: { $in: batch.ids },
      status: PAYROLL_STATUS.PENDING_APPROVAL
    }).select('_id employeeId calculationSnapshot.employee.version');

    const employeeIds = payrollsToApprove.map((payroll) => payroll.employeeId);

    const employees = await Employee.find({
      _id: { $in: employeeIds }
    }).select('_id __v');

    const employeeVersions = new Map(
      employees.map((employee) => [String(employee._id), employee.__v]),
    );

    const staleEmployeeVersions = payrollsToApprove
      .filter((payroll) => {
        const snapshotVersion = payroll.calculationSnapshot?.employee?.version;

        return (
          snapshotVersion !== undefined &&
          employeeVersions.get(String(payroll.employeeId)) !== snapshotVersion
        );
      })
      .map((payroll) => ({
        payrollId: String(payroll._id),
        employeeId: String(payroll.employeeId),
      }));

    if (staleEmployeeVersions.length > 0) {
      return res.status(409).json({
        message:
          'Employee compensation data changed after this payroll was calculated. Review and recalculate the affected payroll before approving it.',
        staleEmployeeVersions,
      });
    }
    const { applied, notFound, invalidTransition, versionConflicts } =
      await transitionPayrollBatch({
        ids: batch.ids,
        targetStatus: PAYROLL_STATUS.REJECTED,

        extraFields: {
          rejectionReason: reason,
          rejectedBy: req.userId,
          rejectedAt,
          approvedBy: undefined,
          approvedAt: undefined,
        }
      });

    if (versionConflicts && versionConflicts.length > 0) {
      return res.status(409).json({
        message:
          'A concurrent update was detected. Please reload and try again.',
        versionConflicts,
      });
    }

    if (applied.length === 0) {
      return res.status(409).json({
        message: 'No payroll records were rejected',
        rejectedCount: 0,
        notFound,
        invalidTransition,
      });
    }

    // Invalidate analytics and dashboard caches since financial data changed (Issue #519)
    await cacheService.invalidateAnalytics(req.userId);
    await cacheService.invalidateDashboardSummary(req.userId);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYROLL_REJECT',
      resourceType: 'Payroll',
      resourceIds: applied.map((a) => a.payrollId),
      details: {
        rejectedCount: applied.length,
        notFoundCount: notFound.length,
        invalidTransitionCount: invalidTransition.length,
        reason,
      },
      result:
        notFound.length > 0 || invalidTransition.length > 0
          ? 'partial'
          : 'success',
      req,
    });

    logger.info('Payroll rejected', {
      userId: req.userId,
      rejectedCount: applied.length,
      notFoundCount: notFound.length,
    });

    res.status(200).json({
      message: `Rejected ${applied.length} payroll record${applied.length !== 1 ? 's' : ''}`,
      rejectedCount: applied.length,
      rejected: applied,
      notFound,
      invalidTransition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payroll/mark-paid — record disbursement.
 *
 * The lifecycle had no way to reach `paid` at all: `submitPayrollForReview`
 * writes `pending_approval`, approve writes `approved`, and nothing ever moved
 * a record on from there — yet `deleteEmployee` (#345) and the re-finalise
 * guard (#251) both key off `paid`. Without this endpoint those protections
 * could never trigger.
 */
exports.markPayrollPaid = async (req, res, next) => {
  try {
    const batch = parsePayrollIdBatch(req.body && req.body.payrollIds);
    if (!batch.ok) {
      return res.status(400).json({ message: batch.message });
    }
    const submittedVersions =
      req.body && req.body.versions && typeof req.body.versions === 'object'
        ? req.body.versions
        : {};

    const invalidVersionIds = batch.ids.filter(
      (id) => !Number.isInteger(submittedVersions[id]),
    );

    if (invalidVersionIds.length > 0) {
      return res.status(400).json({
        message: 'A valid payroll version is required for every record',
        invalidVersionIds,
      });
    }
    const paidAt = new Date();

    const { applied, notFound, invalidTransition, versionConflicts } =
      await transitionPayrollBatch({
        ids: batch.ids,
        targetStatus: PAYROLL_STATUS.PAID,
        extraFields: { paidAt }
      });

    if (versionConflicts && versionConflicts.length > 0) {
      return res.status(409).json({
        message:
          'A concurrent update was detected. Please reload and try again.',
        versionConflicts,
      });
    }

    if (applied.length === 0) {
      return res.status(409).json({
        message: 'No payroll records were marked as paid',
        paidCount: 0,
        notFound,
        invalidTransition,
      });
    }

    // Invalidate analytics and dashboard caches since financial data changed (Issue #519)
    await cacheService.invalidateAnalytics(req.userId);
    await cacheService.invalidateDashboardSummary(req.userId);

    logger.info('Payroll marked paid', {
      userId: req.userId,
      paidCount: applied.length,
    });

    res.status(200).json({
      message: `Marked ${applied.length} payroll record${applied.length !== 1 ? 's' : ''} as paid`,
      paidCount: applied.length,
      paid: applied,
      notFound,
      invalidTransition,
    });
  } catch (error) {
    next(error);
  }
};

exports.parsePayrollCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded.' });
    }

    const csvData = req.file.buffer.toString('utf8');
    const lines = csvData.split('\n');
    if (lines.length < 2) {
      return res
        .status(400)
        .json({ message: 'CSV file is empty or missing headers.' });
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const empIdIdx = headers.findIndex(
      (h) => h.includes('employee id') || h === 'id',
    );
    const nameIdx = headers.findIndex(
      (h) => h.includes('name') || h === 'employee name',
    );
    const otIdx = headers.findIndex((h) => h.includes('overtime'));
    const bonusIdx = headers.findIndex((h) => h.includes('bonus'));
    const leaveIdx = headers.findIndex((h) => h.includes('leave'));

    const employees = await Employee.find({
      // Filter soft-deleted - Issue #526
      isDeleted: { $ne: true }
    });
    const activities = [];
    // `require('uuid')` threw MODULE_NOT_FOUND — uuid is not a dependency of
    // this package — and because the throw happens while evaluating the left
    // operand, the `|| fallback` could never run. Every call to this endpoint
    // was a guaranteed 500 on a clean install. `crypto.randomUUID` is in the
    // Node standard library and needs no dependency at all (#458).
    const v4 = () => crypto.randomUUID();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Basic CSV split, ignores quotes (assuming simple format for ECSoC)
      const cols = line.split(',').map((c) => c.trim());

      const empIdStr = empIdIdx >= 0 ? cols[empIdIdx] : null;
      const nameStr = nameIdx >= 0 ? cols[nameIdx] : null;

      let matchedEmp = null;
      if (empIdStr) {
        matchedEmp = employees.find((e) => String(e._id) === empIdStr);
      }
      if (!matchedEmp && nameStr) {
        matchedEmp = employees.find(
          (e) => e.fullName.toLowerCase() === nameStr.toLowerCase(),
        );
      }

      if (!matchedEmp) continue; // Skip unmatchable employees

      const tags = [];
      if (otIdx >= 0 && cols[otIdx] && Number(cols[otIdx]) > 0) {
        tags.push({
          label: `+ ${cols[otIdx]} hr overtime`,
          bg: '#EFF6FF',
          color: '#2563EB',
        });
      }
      if (bonusIdx >= 0 && cols[bonusIdx] && Number(cols[bonusIdx]) > 0) {
        tags.push({
          label: `+ ₹${cols[bonusIdx]} bonus`,
          bg: '#F0FDF4',
          color: '#16A34A',
        });
      }
      if (leaveIdx >= 0 && cols[leaveIdx] && Number(cols[leaveIdx]) > 0) {
        const val = Number(cols[leaveIdx]);
        tags.push({
          label: `– ${val} day${val > 1 ? 's' : ''} leave`,
          bg: '#FEF2F2',
          color: '#DC2626',
        });
      }

      if (tags.length > 0) {
        activities.push({
          id: v4(),
          employeeId: matchedEmp._id,
          name: matchedEmp.fullName,
          tags,
          note: 'Imported via CSV',
          pending: true,
          rawInput: line,
        });
      }
    }

    res.status(200).json({
      message: 'CSV parsed successfully',
      activities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payroll/fx-rates
 * Fetch multi-currency FX rates and supported currencies.
 */
exports.getExchangeRates = async (req, res, next) => {
  try {
    const baseCurrency = req.query.baseCurrency || 'USD';
    const fxData = await FXService.getRatesForBase(baseCurrency);
    return res.status(200).json({
      success: true,
      ...fxData,
    });
  } catch (error) {
    next(error);
  }
};

exports.submitPayrollForReview = async (req, res, next) => {
  let lockAcquired = false;
  let lockKey = '';

  try {
    const { activities, month, year } = req.body;
    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: 'No activities to process' });
    }
    if (!month || !year || isNaN(month) || isNaN(year)) {
      return res.status(400).json({ message: 'Invalid month or year' });
    }

    const result = await PayrollEngine.executeRun(req, {
      activities,
      month,
      year,
    });
    res.status(200).json({
      message: `Payroll submitted for review for ${result.results.length} employee${result.results.length !== 1 ? 's' : ''}`,
      results: result.results,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Error in submitPayrollForReview:', error);
    console.error(error.stack);
    if (
      error.message &&
      error.message.includes('Another payroll process is currently running')
    ) {
      return res.status(409).json({ message: error.message });
    }
    if (
      error.status === 400 ||
      error.message.includes('Adolescent scheduling violations')
    ) {
      return res.status(400).json({ message: error.message });
    }
    if (error.validationErrors) {
      return res
        .status(400)
        .json({ message: error.message, errors: error.validationErrors });
    }
    if (error.status === 409) {
      return res.status(409).json({ message: error.message, ...error.details });
    }
    next(error);
  } finally {
    if (lockAcquired) {
      await releaseLock(lockKey);
    }
  }
};

exports.getPayrollSummary = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const month = req.query.month
      ? Number(req.query.month)
      : new Date().getMonth() + 1;
    const year = req.query.year
      ? Number(req.query.year)
      : new Date().getFullYear();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    if (isNaN(month) || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }
    if (isNaN(year) || !Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    const summary = await PayrollQueryService.getSummary({
      tenantId,
      month,
      year,
      departments: req.query.departments,
      page,
      limit,
    });
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

exports.exportPayrollCSV = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const month = req.query.month
      ? parseInt(req.query.month, 10)
      : new Date().getMonth() + 1;
    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();

    if (isNaN(month) || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({
        message:
          'Invalid month parameter. Must be an integer between 1 and 12.',
      });
    }
    if (isNaN(year) || !Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        message: 'Invalid year parameter. Must be a valid year integer.',
      });
    }

    const csvData = await PayrollExportService.exportCSV(req, {
      tenantId,
      month,
      year,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=payroll-${month}-${year}.csv`,
    );
    res.status(200).send(csvData);
  } catch (error) {
    if (
      error.message &&
      error.message.includes('No approved payroll data found')
    ) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

exports.sendPayslipEmailHandler = async (req, res, next) => {
  try {
    const payrollId = req.params.id;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(payrollId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    await PayrollExportService.sendPayslipEmail(req, {
      payrollId
    });
    res.status(200).json({ message: 'Payslip email sent successfully' });
  } catch (error) {
    if (
      error.message === 'Payroll record not found' ||
      error.message === 'Employee not found'
    ) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Employee does not have an email address set') {
      return res.status(400).json({ message: error.message });
    }
    if (error.statusName) {
      return res
        .status(409)
        .json({ message: error.message, status: error.statusName });
    }
    next(error);
  }
};

exports.sendAllPayslipsEmailHandler = async (req, res, next) => {
  try {
    let month =
      req.body && req.body.month
        ? Number(req.body.month)
        : req.query.month
          ? Number(req.query.month)
          : new Date().getMonth() + 1;
    let year =
      req.body && req.body.year
        ? Number(req.body.year)
        : req.query.year
          ? Number(req.query.year)
          : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    const data = await PayrollExportService.sendAllPayslipsEmail(req, {
      month,
      year
    });
    res.status(200).json({
      message: `Bulk email dispatch complete. Sent: ${data.sentCount}, Skipped: ${data.skippedCount}, Failed: ${data.failedCount}`,
      ...data,
    });
  } catch (error) {
    if (
      error.message &&
      error.message.includes('No approved payroll records')
    ) {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

exports.getMerkleProofHandler = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    const id = req.params.id;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid payroll ID format' });
    }

    const proof = await PayrollExportService.getMerkleProof({ tenantId, id });
    res.status(200).json({ success: true, ...proof });
  } catch (error) {
    if (error.message === 'Payroll record not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};
async function generatePayslips(req, res) {
  try {
    const { payrollId } = req.params;
    const { employeeIds } = req.body;

    const payroll = await Payroll.findOne({
      _id: payrollId,
      ...tenantFilter(req),
    });
    if (!payroll)
      return res.status(404).json({ message: 'Payroll not found.' });

    if (payroll.status !== 'finalized') {
      return res
        .status(400)
        .json({ message: 'Only finalized payrolls can be processed.' });
    }

    const payslipService = require('../services/payslipGeneration.service');
    const results = [];

    for (const empId of employeeIds) {
      const result = await payslipService.queuePayslipGeneration(
        payrollId,
        empId,
        req.tenantId,
      );
      results.push(result);
    }

    return res.json({ message: 'Payslips queued for generation.', results });
  } catch (err) {
    logger.error('generatePayslips error', { error: err.message });
    return res
      .status(500)
      .json({ message: 'Failed to queue payslip generation.' });
  }
}

async function getPayslipStatus(req, res) {
  try {
    const { jobHash } = req.params;
    const payslipService = require('../services/payslipGeneration.service');
    const status = await payslipService.getGenerationStatus(jobHash);

    return res.json(status);
  } catch (err) {
    logger.error('getPayslipStatus error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch payslip status.' });
  }
}
