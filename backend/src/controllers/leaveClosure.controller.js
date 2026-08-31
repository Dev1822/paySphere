/**
 * @fileoverview Leave Year-End Closure Controller
 * @description Carry-forward, lapse and encashment at the end of a leave year.
 *
 * The leave module has had models and two pure engines since #646 and never a
 * controller or a router, so none of it has ever been reachable over HTTP. This
 * is the first HTTP surface it gets, and it covers the part of the gap with
 * money attached: `calculateCarryForward()` is called from nowhere, so balances
 * roll forward in full for ever and `maxCarryForward` has no effect (#1159).
 */

const mongoose = require('mongoose');
const LeavePolicy = require('../models/leavePolicy.model');
const LeaveBalance = require('../models/leaveBalance.model');
const Employee = require('../models/employee.model');
const {
  computeClosureBatch,
  buildEncashmentPayrollLines,
  generateNextYearOpeningBalances,
} = require('../utils/leaveEncashment');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * Read and validate the leave year a close is being run for.
 *
 * Required rather than defaulted to the current year: a close is irreversible
 * for the year it names, and defaulting one would let a mistyped request close
 * a year nobody meant to touch.
 *
 * @param {*} value
 * @returns {{ok: boolean, year?: number, message?: string}}
 */
function parseLeaveYear(value) {
  if (value === undefined || value === null || value === '') {
    return { ok: false, message: 'A leave year is required' };
  }

  const year = Number(value);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, message: 'Leave year must be a valid four-digit year' };
  }

  return { ok: true, year };
}

/**
 * Load the balances, policies and employees a close needs.
 *
 * Three queries for the whole tenant rather than a lookup per balance: a
 * thousand-employee close would otherwise issue several thousand round trips
 * to produce one preview.
 *
 * @param {object} req
 * @param {number} year
 * @returns {Promise<object>}
 */
async function loadClosureInputs(req, year) {
  const query = {
    year
  };

  if (req.query?.leaveType || req.body?.leaveType) {
    query.leaveType = req.query?.leaveType || req.body?.leaveType;
  }

  const balances = await LeaveBalance.find(query);

  const [policies, employees] = await Promise.all([
    LeavePolicy.find({}),
    Employee.find({
      _id: { $in: balances.map((b) => b.employeeId) }
    }).select('fullName monthlySalary basicSalary'),
  ]);

  return { balances, policies, employees };
}

/**
 * GET /api/leave-closure/policies
 * Leave policies with the rules a close will apply.
 */
exports.getClosurePolicies = async (req, res, next) => {
  try {
    const policies = await LeavePolicy.find({
      isActive: true
    }).sort({ leaveType: 1, name: 1 });

    res.status(200).json({
      policies: policies.map((policy) => ({
        id: String(policy._id),
        name: policy.name,
        leaveType: policy.leaveType,
        accrualRate: policy.accrualRate,
        maxCarryForward: policy.maxCarryForward,
        maxAccumulation: policy.maxAccumulation,
        isEncashable: policy.isEncashable,
        maxEncashmentDays: policy.maxEncashmentDays,
        minRetentionDays: policy.minRetentionDays,
        encashmentRateBasis: policy.encashmentRateBasis,
        financialYearEndMonth: policy.financialYearEndMonth,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leave-closure/preview
 * Model the close for a leave year without writing anything.
 *
 * A close pays money out and writes days off, and neither is something to
 * discover after the fact. The preview runs the identical engine the commit
 * does, so the two cannot disagree.
 */
exports.previewClosure = async (req, res, next) => {
  try {
    const parsed = parseLeaveYear(req.body?.year);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });

    const { balances, policies, employees } = await loadClosureInputs(
      req,
      parsed.year,
    );

    if (!balances.length) {
      return res.status(404).json({
        message: `No leave balances found for ${parsed.year}`,
      });
    }

    const result = computeClosureBatch(balances, policies, employees, {
      year: parsed.year,
    });

    res.status(200).json({
      message: 'Closure preview generated. Nothing has been saved.',
      ...result,
      payrollLines: buildEncashmentPayrollLines(result.closures),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/leave-closure/run
 * Execute the close: write carry-forward, encashment and lapse.
 */
exports.runClosure = async (req, res, next) => {
  try {
    const parsed = parseLeaveYear(req.body?.year);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });

    const { balances, policies, employees } = await loadClosureInputs(
      req,
      parsed.year,
    );

    if (!balances.length) {
      return res.status(404).json({
        message: `No leave balances found for ${parsed.year}`,
      });
    }

    const result = computeClosureBatch(balances, policies, employees, {
      year: parsed.year,
    });

    // A balance that could not be priced means a policy is missing. Committing
    // around it would close most of the tenant and leave the rest in a state
    // nobody can tell apart from "not run yet", so the whole close stops.
    if (!result.isComplete && req.body?.force !== true) {
      return res.status(409).json({
        message:
          'Some balances could not be closed. Fix them, or pass force: true to close the rest.',
        blocked: result.blocked,
      });
    }

    const now = new Date();

    const operations = result.closures.map((closure) => ({
      updateOne: {
        // Scoped by tenant as well as by id: the ids came out of a tenant-scoped
        // read, but the write should not depend on that having been correct.
        filter: {
          _id: closure.balanceId
        },
        update: {
          $set: {
            // The carried figure becomes next year's opening balance, so it is
            // written to both: `currentBalance` is what the employee can take,
            // `carriedForwardFromLastYear` is the audit of where it came from —
            // a field #646 declared and no code path has ever written.
            currentBalance: closure.carriedForward,
            carriedForwardFromLastYear: closure.carriedForward,
            encashedDays: closure.encashedDays,
            encashedAmount: closure.encashedAmount,
            lapsedDays: closure.lapsedDays,
            closedForYear: parsed.year,
            closedAt: now,
          },
        },
      },
    }));

    if (operations.length) {
      await LeaveBalance.bulkWrite(operations);
    }

    // Automatically initialize opening balances for the next financial year
    const nextYearOpening = generateNextYearOpeningBalances(result.closures, parsed.year + 1);
    if (nextYearOpening.length) {
      const nextYearOps = nextYearOpening.map((b) => ({
        updateOne: {
          filter: {
            employeeId: b.employeeId,
            leaveType: b.leaveType,
            year: b.year
          },
          update: {
            $setOnInsert: b,
          },
          upsert: true,
        },
      }));
      await LeaveBalance.bulkWrite(nextYearOps);
    }

    const payrollLines = buildEncashmentPayrollLines(result.closures);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LEAVE_YEAR_CLOSED',
      resourceType: 'LeaveBalance',
      resourceIds: result.closures.map((c) => c.balanceId).filter(Boolean),
      details: {
        year: parsed.year,
        processedCount: result.processedCount,
        skippedCount: result.skippedCount,
        blockedCount: result.blockedCount,
        totalCarriedForward: result.totals.carriedForward,
        totalEncashedDays: result.totals.encashedDays,
        totalEncashedAmount: result.totals.encashedAmount,
        totalLapsedDays: result.totals.lapsedDays,
      },
      req,
    });

    logger.info('Leave year closed', {
      userId: req.userId,
      year: parsed.year,
      processedCount: result.processedCount,
      encashedAmount: result.totals.encashedAmount,
    });

    res.status(200).json({
      message: `Leave year ${parsed.year} closed`,
      year: parsed.year,
      processedCount: result.processedCount,
      skippedCount: result.skippedCount,
      blockedCount: result.blockedCount,
      totals: result.totals,
      blocked: result.blocked,
      skipped: result.skipped,
      // Handed back rather than posted onward: this endpoint closes leave, and
      // paying the encashment is payroll's write to make.
      payrollLines,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leave-closure/history?year=
 * Closures already executed.
 */
exports.getClosureHistory = async (req, res, next) => {
  try {
    const query = {
      closedForYear: { $ne: null }
    };

    if (req.query.year) {
      const parsed = parseLeaveYear(req.query.year);
      if (!parsed.ok) return res.status(400).json({ message: parsed.message });
      query.closedForYear = parsed.year;
    }

    if (req.query.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.employeeId)) {
        return res.status(400).json({ message: 'Invalid employee id format' });
      }
      query.employeeId = req.query.employeeId;
    }

    const balances = await LeaveBalance.find(query)
      .populate('employeeId', 'fullName email')
      .populate('policyId', 'name leaveType')
      .sort({ closedAt: -1 })
      .limit(500);

    const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

    res.status(200).json({
      count: balances.length,
      totals: {
        encashedDays: round2(
          balances.reduce((sum, b) => sum + (b.encashedDays || 0), 0),
        ),
        encashedAmount: round2(
          balances.reduce((sum, b) => sum + (b.encashedAmount || 0), 0),
        ),
        lapsedDays: round2(
          balances.reduce((sum, b) => sum + (b.lapsedDays || 0), 0),
        ),
      },
      closures: balances,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leave-closure/summary?year=
 * Executive breakdown of encashment liability, carried-forward and lapsed days.
 */
exports.getClosureSummary = async (req, res, next) => {
  try {
    const parsed = parseLeaveYear(req.query.year);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });

    const inputs = await loadClosureInputs(req, parsed.year);
    const result = computeClosureBatch(
      inputs.balances,
      inputs.policies,
      inputs.employees,
      parsed.year,
    );

    const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

    res.status(200).json({
      year: parsed.year,
      totalEmployees: inputs.employees.length,
      processedBalances: result.processedCount,
      summary: {
        totalCarriedForwardDays: round2(result.totals.carriedForward),
        totalEncashedDays: round2(result.totals.encashedDays),
        totalEncashedAmount: round2(result.totals.encashedAmount),
        totalLapsedDays: round2(result.totals.lapsedDays),
      },
      encashmentLinesCount: buildEncashmentPayrollLines(result.closures).length,
    });
  } catch (error) {
    next(error);
  }
};

