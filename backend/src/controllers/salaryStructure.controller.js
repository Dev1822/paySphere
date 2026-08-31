const mongoose = require('mongoose');
const SalaryStructure = require('../models/salaryStructure.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const { sanitizeText } = require('../utils/validators');
const {
  validateRevision,
  computeComponentAmounts,
  buildDefaultStructure,
  resolveStructureOnDate,
  resolveStructureForPeriod,
  sortByEffectiveDate,
  diffStructures,
} = require('../utils/salaryStructure');
const { REVISION_REASON } = require('../config/salaryComponents');
// Required at the top rather than inside the handler. The lazy require this
// replaces resolved a path that does not exist, and because its call site
// catches and logs, every backdated revision since #931 merged produced a log
// line and no ledger rows — invisibly (#950).
const { processRetroactiveArrears } = require('../utils/arrearsCalculator');

/**
 * Load an employee, asserting the caller owns it.
 *
 * @param {string} employeeId
 * @param {string} userId
 * @returns {Promise<{ok: true, employee: object} | {ok: false, status: number, message: string}>}
 */
async function loadOwnedEmployee(employeeId, tenantId) {
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return { ok: false, status: 400, message: 'Invalid employee id format' };
  }

  // Scoped by tenant, not by creator. #585 moved the writes to `tenantId` but
  // left this lookup on `createdBy`, so an employee added after it could never
  // be found again (#613).
  const employee = await Employee.findOne({ _id: employeeId, tenantId });

  if (!employee) {
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  return { ok: true, employee };
}

/**
 * Every revision for an employee, oldest first.
 *
 * @param {string} employeeId
 * @param {string} tenantId
 * @returns {Promise<object[]>}
 */
async function loadRevisions(employeeId, tenantId) {
  const revisions = await SalaryStructure.find({
    employeeId,
    tenantId,
  }).sort({ effectiveFrom: 1 });

  return revisions;
}

/**
 * The structure in force, synthesising one from `monthlySalary` if the employee
 * predates the migration.
 *
 * Never returns null for an employee who has a salary: an employee record that
 * has not been backfilled yet must still resolve to something payroll can use.
 *
 * @param {object} employee
 * @param {object[]} revisions
 * @param {Date} onDate
 * @returns {{structure: object, isSynthesised: boolean}}
 */
function resolveOrSynthesise(employee, revisions, onDate) {
  const inForce = resolveStructureOnDate(revisions, onDate);

  if (inForce) return { structure: inForce, isSynthesised: false };

  return {
    structure: {
      ...buildDefaultStructure(employee.monthlySalary),
      effectiveFrom: employee.joiningDate || employee.createdAt || new Date(0),
      reason: REVISION_REASON.INITIAL,
      isSynthesised: true,
    },
    isSynthesised: true,
  };
}

/**
 * GET /api/employees/:id/salary-structure[?month=&year=]
 *
 * The structure in force now, or for a past period.
 */
exports.getSalaryStructure = async (req, res, next) => {
  try {
    const owned = await loadOwnedEmployee(req.params.id, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const revisions = await loadRevisions(employee._id, req.tenantId);

    // A period query answers "what was this person on in March?" — the question
    // the single mutable field made unanswerable.
    if (req.query.month !== undefined || req.query.year !== undefined) {
      const month = Number(req.query.month);
      const year = Number(req.query.year);

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Invalid month parameter' });
      }
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ message: 'Invalid year parameter' });
      }

      const period = resolveStructureForPeriod(revisions, month, year);

      if (period.segments.length === 0) {
        // No revision was in force; fall back to the employee's current figure
        // so the caller still gets a usable answer.
        const synthesised = resolveOrSynthesise(
          employee,
          revisions,
          new Date(year, month - 1, 1),
        );
        const resolved = computeComponentAmounts(synthesised.structure);

        return res.status(200).json({
          employeeId: String(employee._id),
          month,
          year,
          isSynthesised: true,
          effectiveGross: resolved.grossMonthly,
          segments: [],
          breakdown: resolved,
        });
      }

      return res.status(200).json({
        employeeId: String(employee._id),
        month,
        year,
        isSynthesised: false,
        effectiveGross: period.effectiveGross,
        totalDays: period.totalDays,
        segments: period.segments.map((seg) => ({
          fromDay: seg.fromDay,
          toDay: seg.toDay,
          days: seg.days,
          weight: seg.weight,
          grossMonthly: seg.structure.grossMonthly,
          effectiveFrom: seg.structure.effectiveFrom,
          breakdown: computeComponentAmounts(seg.structure),
        })),
      });
    }

    const { structure, isSynthesised } = resolveOrSynthesise(
      employee,
      revisions,
      new Date(),
    );

    res.status(200).json({
      employeeId: String(employee._id),
      employeeName: employee.fullName,
      isSynthesised,
      structure,
      breakdown: computeComponentAmounts(structure),
      revisionCount: revisions.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/employees/:id/salary-history
 *
 * The full timeline, each entry carrying its diff against the one before.
 */
exports.getSalaryHistory = async (req, res, next) => {
  try {
    const owned = await loadOwnedEmployee(req.params.id, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const revisions = sortByEffectiveDate(
      await loadRevisions(employee._id, req.tenantId),
    );

    const timeline = revisions.map((revision, index) => {
      const previous = index > 0 ? revisions[index - 1] : null;

      return {
        _id: String(revision._id),
        effectiveFrom: revision.effectiveFrom,
        grossMonthly: revision.grossMonthly,
        ctcAnnual: revision.ctcAnnual,
        reason: revision.reason,
        note: revision.note,
        createdAt: revision.createdAt,
        breakdown: computeComponentAmounts(revision),
        diff: previous ? diffStructures(previous, revision) : null,
      };
    });

    res.status(200).json({
      employeeId: String(employee._id),
      employeeName: employee.fullName,
      currentGross: employee.monthlySalary,
      revisionCount: timeline.length,
      timeline,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/employees/:id/salary-revision
 *
 * Append a revision. Never edits an existing one.
 */
exports.createSalaryRevision = async (req, res, next) => {
  try {
    const owned = await loadOwnedEmployee(req.params.id, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const body = req.body || {};

    const validation = validateRevision({
      grossMonthly: body.grossMonthly,
      components:
        Array.isArray(body.components) && body.components.length > 0
          ? body.components
          : buildDefaultStructure(body.grossMonthly).components,
      effectiveFrom: body.effectiveFrom || new Date(),
      reason: body.reason,
    });

    if (!validation.ok) {
      return res.status(400).json({
        message: 'Invalid salary revision',
        errors: validation.errors,
      });
    }

    const { effectiveFrom } = validation.value;

    // A revision cannot be back-dated into a period that has already been paid:
    // the payslip is out, and changing its basis after the fact would make the
    // stored payroll row unreproducible.
    const paidInPeriod = await PayrollUpdate.findOne({
      employeeId: employee._id,
      status: 'paid',

      $or: [
        { year: { $gt: effectiveFrom.getFullYear() } },
        {
          year: effectiveFrom.getFullYear(),
          month: { $gte: effectiveFrom.getMonth() + 1 },
        },
      ]
    }).select('month year');

    if (paidInPeriod) {
      return res.status(409).json({
        message: `Cannot back-date a revision into ${paidInPeriod.month}/${paidInPeriod.year} — payroll for that period has already been paid.`,
        conflictingPeriod: {
          month: paidInPeriod.month,
          year: paidInPeriod.year,
        },
      });
    }

    const revisions = await loadRevisions(employee._id, req.tenantId);
    const previous = resolveStructureOnDate(revisions, effectiveFrom);

    let created;
    try {
      created = await SalaryStructure.create({
        // Both: `createdBy` records who filed the revision, `tenantId` decides
        // who can see it. #585 dropped the first while the schema still
        // required it, so this create() threw on every call (#613).
        createdBy: req.userId,

        employeeId: employee._id,
        effectiveFrom,
        components: validation.value.components,
        grossMonthly: validation.value.grossMonthly,
        ctcAnnual: validation.value.ctcAnnual,
        reason: validation.value.reason,
        note: sanitizeText(body.note || ''),
        revisedBy: req.userId
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({
          message:
            'A revision already exists with this effective date. Use a different date, or add a correction.',
        });
      }
      throw error;
    }

    // A revision effective in the past means the months since then were paid at
    // the old rate, and the difference is owed (#931).
    //
    // Still deliberately non-fatal: the revision itself is saved and correct,
    // and refusing to record a raise because the arrears arithmetic failed
    // would be the worse outcome. But it now logs enough to act on — the
    // message before this carried no revision or employee id, so nobody reading
    // the log could tell who had been missed.
    try {
      await processRetroactiveArrears(created, previous, req.tenantId);
    } catch (arrearsError) {
      logger.error('Failed to process retroactive arrears', {
        error: arrearsError.message,
        revisionId: String(created._id),
        employeeId: String(employee._id),
      });
    }

    // Keep the denormalised figure in step, but only when this revision is the
    // one actually in force — a future-dated raise must not change today's pay.
    const isCurrent = effectiveFrom <= new Date();

    if (isCurrent) {
      await Employee.updateOne(
        {
          _id: employee._id
        },
        { $set: { monthlySalary: validation.value.grossMonthly } },
      );

      if (previous) {
        await SalaryStructure.updateOne(
          { _id: previous._id },
          { $set: { supersededAt: effectiveFrom } },
        );
      }

      await cacheService.invalidateAnalytics(req.userId);
    }

    const diff = diffStructures(previous, created);

    // The before/after that EMPLOYEE_UPDATE never recorded: it logs only the
    // *names* of the fields that changed, not their values.
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SALARY_REVISION',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        employeeName: employee.fullName,
        effectiveFrom,
        reason: created.reason,
        grossFrom: diff.grossFrom,
        grossTo: diff.grossTo,
        grossDelta: diff.grossDelta,
        percentChange: diff.percentChange,
        appliedImmediately: isCurrent,
      },
      req,
    });

    logger.info('Salary revision created', {
      userId: req.userId,
      employeeId: String(employee._id),
      grossFrom: diff.grossFrom,
      grossTo: diff.grossTo,
      effectiveFrom,
    });

    res.status(201).json({
      message: 'Salary revision recorded',
      revision: created,
      breakdown: computeComponentAmounts(created),
      diff,
      appliedImmediately: isCurrent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/employees/:id/salary-structure/preview
 *
 * Resolve a proposed structure without writing anything, so the admin can see
 * the split and the delta before committing.
 */
exports.previewSalaryStructure = async (req, res, next) => {
  try {
    const owned = await loadOwnedEmployee(req.params.id, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const body = req.body || {};

    const validation = validateRevision({
      grossMonthly: body.grossMonthly,
      components:
        Array.isArray(body.components) && body.components.length > 0
          ? body.components
          : buildDefaultStructure(body.grossMonthly).components,
      effectiveFrom: body.effectiveFrom || new Date(),
      reason: body.reason,
    });

    if (!validation.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid salary structure', errors: validation.errors });
    }

    const revisions = await loadRevisions(employee._id, req.tenantId);
    const current = resolveOrSynthesise(employee, revisions, new Date()).structure;

    res.status(200).json({
      breakdown: computeComponentAmounts(validation.value),
      diff: diffStructures(current, validation.value),
    });
  } catch (error) {
    next(error);
  }
};

exports._internals = { loadOwnedEmployee, loadRevisions, resolveOrSynthesise };
