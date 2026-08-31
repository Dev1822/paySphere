const mongoose = require('mongoose');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const User = require('../models/user.model');
const PayrollUpdate = require('../models/payroll.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const {
  validateGrid,
  computeTotals,
  buildDefaultGrid,
  derivePayrollInputs,
  daysInMonth,
  isValidMonth,
  isValidYear,
} = require('../utils/attendanceGrid');
const {
  computeLeaveBalance,
  canTakePaidLeave,
} = require('../utils/leaveBalance');
const {
  normalizeAttendanceStatus,
  ATTENDANCE_STATUS,
} = require('../config/attendance');

const MAX_BULK_EMPLOYEES = 200;

/**
 * Parse and validate a period from query params or route params.
 *
 * @param {*} rawYear
 * @param {*} rawMonth
 * @returns {{ok: true, year: number, month: number} | {ok: false, message: string}}
 */
function parsePeriod(rawYear, rawMonth) {
  const now = new Date();

  const year = rawYear === undefined ? now.getFullYear() : Number(rawYear);
  const month = rawMonth === undefined ? now.getMonth() + 1 : Number(rawMonth);

  if (!isValidYear(year)) {
    return { ok: false, message: 'Invalid year. Must be an integer between 2000 and 2100' };
  }

  if (!isValidMonth(month)) {
    return { ok: false, message: 'Invalid month. Must be an integer between 1 and 12' };
  }

  return { ok: true, year, month };
}

/**
 * Load an employee, asserting the caller owns it.
 *
 * Every controller in this codebase scopes by `tenantId`; attendance carries
 * the same salary-adjacent data as payroll and gets the same treatment. This
 * lookup was left on `createdBy` when #585 moved the writes over, so an
 * employee added after it could never be found again (#613).
 *
 * @param {string} employeeId
 * @param {string} tenantId
 * @returns {Promise<{ok: true, employee: object} | {ok: false, status: number, message: string}>}
 */
async function loadOwnedEmployee(employeeId, tenantId) {
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return { ok: false, status: 400, message: 'Invalid employee id format' };
  }

  const employee = await Employee.findOne({ _id: employeeId, tenantId });

  if (!employee) {
    // Deliberately indistinguishable from "does not exist": the caller must not
    // be able to probe for the existence of another company's employees.
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  return { ok: true, employee };
}

/**
 * Whether the month has already been paid out for this employee.
 *
 * Locking is derived from the payroll record rather than mirrored onto the
 * attendance document at disbursement time, so it cannot drift: there is
 * exactly one fact ("was this month paid?") and one place that answers it.
 * Rewriting a paid month would make the payslip already sitting in the
 * employee's inbox unreproducible.
 *
 * @param {string} employeeId
 * @param {string} tenantId
 * @param {number} year
 * @param {number} month
 * @returns {Promise<object|null>} the paid payroll row, or null
 */
async function findPaidPayroll(employeeId, tenantId, year, month) {
  return PayrollUpdate.findOne({
    employeeId,
    tenantId,
    year,
    month,
    status: 'paid',
  }).select('_id status');
}

/**
 * The company's leave policy, falling back to the engine's defaults.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function loadLeavePolicy(userId) {
  const user = await User.findById(userId).select('settings');
  return user?.settings?.leavePolicy || {};
}

/**
 * Build the balance snapshot for one employee.
 *
 * @param {object} employee
 * @param {object} policy
 * @param {number} year
 * @param {number} month
 * @returns {Promise<object>}
 */
async function buildBalance(employee, policy, year, month) {
  const history = await Attendance.find({
    employeeId: employee._id,
    tenantId: employee.tenantId,
  }).select('year month totals');

  return computeLeaveBalance({
    policy,
    joiningDate: employee.joiningDate,
    year,
    month,
    monthlyTotals: history,
  });
}

/**
 * GET /api/attendance?employeeId=&year=&month=
 *
 * Returns the stored grid, or a generated default for a month that has never
 * been recorded — so the client always has a full month to render and never has
 * to invent one itself (which is how Sundays ended up defaulting to PAID_LEAVE
 * and silently consuming 52 days of entitlement a year).
 */
exports.getAttendance = async (req, res, next) => {
  try {
    const period = parsePeriod(req.query.year, req.query.month);
    if (!period.ok) return res.status(400).json({ message: period.message });

    const owned = await loadOwnedEmployee(req.query.employeeId, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { year, month } = period;
    const { employee } = owned;

    const existing = await Attendance.findOne({
      employeeId: employee._id,
      tenantId: req.tenantId,
      year,
      month,
    });

    const policy = await loadLeavePolicy(req.userId);
    const balance = await buildBalance(employee, policy, year, month);
    const paidPayroll = await findPaidPayroll(employee._id, req.tenantId, year, month);

    const days = existing ? existing.days : buildDefaultGrid(year, month);
    const totals = existing ? existing.totals : computeTotals(days);

    res.status(200).json({
      employeeId: String(employee._id),
      employeeName: employee.fullName,
      year,
      month,
      daysInMonth: daysInMonth(year, month),
      days,
      totals,
      payrollInputs: derivePayrollInputs(totals),
      balance,
      isRecorded: Boolean(existing),
      isLocked: Boolean(existing?.lockedAt) || Boolean(paidPayroll),
      lockedAt: existing?.lockedAt || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/attendance/:employeeId/:year/:month
 *
 * Upsert the month's grid. Totals are recomputed here and only here.
 */
exports.upsertAttendance = async (req, res, next) => {
  try {
    const period = parsePeriod(req.params.year, req.params.month);
    if (!period.ok) return res.status(400).json({ message: period.message });

    const owned = await loadOwnedEmployee(req.params.employeeId, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { year, month } = period;
    const { employee } = owned;

    const existing = await Attendance.findOne({
      employeeId: employee._id,
      tenantId: req.tenantId,
      year,
      month,
    });

    // A month whose payroll has been paid is settled.
    const paidPayroll = await findPaidPayroll(employee._id, req.tenantId, year, month);

    if (paidPayroll || (existing && existing.lockedAt)) {
      // Stamp the lock so subsequent reads can show the state without
      // re-querying payroll.
      if (paidPayroll && existing && !existing.lockedAt) {
        await Attendance.updateOne(
          { _id: existing._id },
          { $set: { lockedAt: new Date(), lockedByPayrollId: paidPayroll._id } },
        );
      }

      return res.status(409).json({
        message:
          'Attendance for this month is locked because its payroll has been paid and can no longer be edited.',
        lockedAt: existing?.lockedAt || new Date(),
      });
    }

    const validation = validateGrid(req.body?.days, year, month);

    if (!validation.ok) {
      return res.status(400).json({
        message: 'Attendance grid contains invalid entries',
        errors: validation.errors,
      });
    }

    const totals = computeTotals(validation.days);

    // Warn — but do not block — when the month pushes the employee past their
    // entitlement. Whether to grant leave in advance is the employer's call,
    // and refusing the whole write would leave the rest of the month unsaved.
    const policy = await loadLeavePolicy(req.userId);
    const priorBalance = await buildBalance(employee, policy, year, month);
    const leaveCheck = canTakePaidLeave(priorBalance, totals.paidLeave);

    const saved = await Attendance.findOneAndUpdate(
      { employeeId: employee._id, tenantId: req.tenantId, year, month, lockedAt: null },
      {
        $set: {
          employeeName: employee.fullName,
          days: validation.days,
          totals,
          lastEditedBy: req.userId,
        },
        $setOnInsert: {
          employeeId: employee._id,
          // `createdBy` is required by the schema and is only written on
          // insert, so it belongs in $setOnInsert alongside the tenant. #585
          // dropped it, which made every upsert that had to insert throw (#613).
          createdBy: req.userId,
          tenantId: req.tenantId,
          year,
          month,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ATTENDANCE_UPDATE',
      resourceType: 'Attendance',
      resourceIds: [saved._id],
      details: {
        employeeName: employee.fullName,
        year,
        month,
        totals,
      },
      req,
    });

    logger.info('Attendance recorded', {
      userId: req.userId,
      employeeId: String(employee._id),
      year,
      month,
      unpaidLeave: totals.unpaidLeave,
      overtimeHours: totals.overtimeHours,
    });

    res.status(200).json({
      message: 'Attendance saved',
      attendance: saved,
      payrollInputs: derivePayrollInputs(totals),
      leaveWarning: leaveCheck.allowed
        ? null
        : { message: leaveCheck.reason, shortfall: leaveCheck.shortfall },
    });
  } catch (error) {
    // Two concurrent saves of the same month race on the unique index; the
    // second is a duplicate, not a server error.
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: 'Attendance for this month was updated concurrently. Reload and retry.',
      });
    }
    next(error);
  }
};

/**
 * POST /api/attendance/bulk
 *
 * Apply one status across a day range for many employees — "the whole team was
 * off for Diwali" should not be thirty individual grid edits.
 */
exports.bulkMarkAttendance = async (req, res, next) => {
  try {
    const period = parsePeriod(req.body?.year, req.body?.month);
    if (!period.ok) return res.status(400).json({ message: period.message });

    const { year, month } = period;

    const status = normalizeAttendanceStatus(req.body?.status);
    if (!status) {
      return res.status(400).json({ message: `Unknown attendance status: "${req.body?.status}"` });
    }

    const total = daysInMonth(year, month);
    const fromDay = Number(req.body?.fromDay ?? 1);
    const toDay = Number(req.body?.toDay ?? total);

    if (
      !Number.isInteger(fromDay) ||
      !Number.isInteger(toDay) ||
      fromDay < 1 ||
      toDay > total ||
      fromDay > toDay
    ) {
      return res.status(400).json({
        message: `Invalid day range. Must be within 1..${total} for ${month}/${year}`,
      });
    }

    const rawIds = req.body?.employeeIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ message: 'employeeIds must be a non-empty array' });
    }

    if (rawIds.length > MAX_BULK_EMPLOYEES) {
      return res.status(400).json({
        message: `Cannot update more than ${MAX_BULK_EMPLOYEES} employees in a single request`,
      });
    }

    const ids = [...new Set(rawIds.map(String))].filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    // Scoped: ids belonging to another account simply do not come back.
    const employees = await Employee.find({
      _id: { $in: ids },
      createdBy: req.userId, tenantId: req.tenantId,
    });

    if (employees.length === 0) {
      return res.status(404).json({ message: 'No matching employees found' });
    }

    const existingDocs = await Attendance.find({
      employeeId: { $in: employees.map((e) => e._id) },
      createdBy: req.userId, tenantId: req.tenantId,
      year,
      month,
    });
    const byEmployee = new Map(existingDocs.map((d) => [String(d.employeeId), d]));

    const overtimeHours =
      status === ATTENDANCE_STATUS.OVERTIME || status === ATTENDANCE_STATUS.HOLIDAY
        ? Number(req.body?.overtimeHours) || 0
        : 0;

    const updated = [];
    const skipped = [];

    for (const employee of employees) {
      const existing = byEmployee.get(String(employee._id));

      const locked =
        (existing && existing.lockedAt) ||
        (await findPaidPayroll(employee._id, req.tenantId, year, month));

      if (locked) {
        skipped.push({
          employeeId: String(employee._id),
          employeeName: employee.fullName,
          reason: 'Month is locked — its payroll has been paid',
        });
        continue;
      }

      const base = existing ? existing.days.map((d) => ({ ...d.toObject?.() ?? d })) : buildDefaultGrid(year, month);
      const byDay = new Map(base.map((d) => [d.day, d]));

      for (let day = fromDay; day <= toDay; day += 1) {
        byDay.set(day, { day, status, overtimeHours, note: byDay.get(day)?.note || '' });
      }

      const merged = [...byDay.values()].sort((a, b) => a.day - b.day);
      const validation = validateGrid(merged, year, month);

      if (!validation.ok) {
        skipped.push({
          employeeId: String(employee._id),
          employeeName: employee.fullName,
          reason: validation.errors[0]?.reason || 'Invalid grid',
        });
        continue;
      }

      const totals = computeTotals(validation.days);

      await Attendance.findOneAndUpdate(
        { employeeId: employee._id, tenantId: req.tenantId, year, month, lockedAt: null },
        {
          $set: {
            employeeName: employee.fullName,
            days: validation.days,
            totals,
            lastEditedBy: req.userId,
          },
          $setOnInsert: {
            employeeId: employee._id,
            createdBy: req.userId,
            tenantId: req.tenantId,
            year,
            month,
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );

      updated.push({
        employeeId: String(employee._id),
        employeeName: employee.fullName,
        totals,
      });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ATTENDANCE_BULK_UPDATE',
      resourceType: 'Attendance',
      details: {
        year,
        month,
        status,
        fromDay,
        toDay,
        updatedCount: updated.length,
        skippedCount: skipped.length,
      },
      result: skipped.length > 0 ? 'partial' : 'success',
      req,
    });

    res.status(200).json({
      message: `Updated ${updated.length} employee${updated.length !== 1 ? 's' : ''}`,
      updated,
      skipped,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/summary?year=&month=
 *
 * Per-employee totals for the payroll review screen, so the maker can see the
 * ledger the figures were derived from before submitting the run.
 */
exports.getMonthSummary = async (req, res, next) => {
  try {
    const period = parsePeriod(req.query.year, req.query.month);
    if (!period.ok) return res.status(400).json({ message: period.message });

    const { year, month } = period;

    const records = await Attendance.find({
      tenantId: req.tenantId,
      year,
      month,
    }).sort({ employeeName: 1 });

    const summary = records.map((record) => ({
      employeeId: String(record.employeeId),
      employeeName: record.employeeName,
      totals: record.totals,
      payrollInputs: derivePayrollInputs(record.totals),
      isLocked: Boolean(record.lockedAt),
    }));

    const aggregate = summary.reduce(
      (acc, row) => ({
        unpaidLeave: acc.unpaidLeave + (row.totals?.unpaidLeave || 0),
        paidLeave: acc.paidLeave + (row.totals?.paidLeave || 0),
        overtimeHours: acc.overtimeHours + (row.totals?.overtimeHours || 0),
      }),
      { unpaidLeave: 0, paidLeave: 0, overtimeHours: 0 },
    );

    res.status(200).json({
      year,
      month,
      employeeCount: summary.length,
      summary,
      totals: {
        unpaidLeave: Math.round(aggregate.unpaidLeave * 100) / 100,
        paidLeave: Math.round(aggregate.paidLeave * 100) / 100,
        overtimeHours: Math.round(aggregate.overtimeHours * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/balances?employeeId=&year=&month=
 */
exports.getLeaveBalance = async (req, res, next) => {
  try {
    const period = parsePeriod(req.query.year, req.query.month);
    if (!period.ok) return res.status(400).json({ message: period.message });

    const owned = await loadOwnedEmployee(req.query.employeeId, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const policy = await loadLeavePolicy(req.userId);
    const balance = await buildBalance(
      owned.employee,
      policy,
      period.year,
      period.month,
    );

    res.status(200).json({
      employeeId: String(owned.employee._id),
      employeeName: owned.employee.fullName,
      joiningDate: owned.employee.joiningDate || null,
      year: period.year,
      month: period.month,
      balance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/biometric-sync
 * Synchronize raw biometric clock-in/out logs and update attendance grid with shift overtime multipliers.
 */
exports.syncBiometricAttendance = async (req, res, next) => {
  try {
    const { employeeId, year, month, logs } = req.body || {};

    const period = parsePeriod(year, month);
    if (!period.ok) {
      return res.status(400).json({ message: period.message });
    }

    const owned = await loadOwnedEmployee(employeeId, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { parseBiometricLogs, validateGrid, computeTotals } = require('../utils/attendanceGrid');
    const parsedDays = parseBiometricLogs(logs, period.year, period.month);
    const validated = validateGrid(parsedDays, period.year, period.month);

    if (!validated.ok) {
      return res.status(400).json({ message: 'Invalid biometric attendance data', errors: validated.errors });
    }

    const totals = computeTotals(validated.days);

    let attendanceRecord = await Attendance.findOne({
      employeeId: owned.employee._id,
      tenantId: req.tenantId,
      year: period.year,
      month: period.month,
    });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({
        employeeId: owned.employee._id,
        tenantId: req.tenantId,
        year: period.year,
        month: period.month,
        days: validated.days,
        summary: totals,
      });
    } else {
      attendanceRecord.days = validated.days;
      attendanceRecord.summary = totals;
    }

    await attendanceRecord.save();

    return res.status(200).json({
      message: 'Biometric attendance synced successfully',
      employeeId: String(owned.employee._id),
      year: period.year,
      month: period.month,
      totals,
      record: attendanceRecord,
    });
  } catch (error) {
    next(error);
  }
};

// Exported for the payroll integration and the tests.
exports._internals = {
  parsePeriod,
  loadOwnedEmployee,
  loadLeavePolicy,
  buildBalance,
  findPaidPayroll,
};
