const mongoose = require('mongoose');
const Settlement = require('../models/settlement.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const { sanitizeText } = require('../utils/validators');
const {
  buildSettlement,
  validateSettlement,
  parseDate,
} = require('../utils/settlement');
const {
  EMPLOYMENT_STATUS,
  EXIT_TYPE,
  SETTLEMENT_STATUS,
  canTransitionSettlement,
  describeSettlementTransition,
  DEFAULT_SETTLEMENT_POLICY,
  isActiveStatus,
} = require('../config/employment');

/**
 * Load an employee, asserting it belongs to the caller's company.
 *
 * Scoped by tenant, not by creator. #585 moved the writes to `tenantId` but left
 * this lookup on `createdBy`, so a row written after it could never be found
 * again — it had no `createdBy` to match (#613).
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
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  return { ok: true, employee };
}

/**
 * Load a settlement, asserting it belongs to the caller's company.
 *
 * @param {string} settlementId
 * @param {string} tenantId
 * @returns {Promise<{ok: true, settlement: object} | {ok: false, status: number, message: string}>}
 */
async function loadOwnedSettlement(settlementId, tenantId) {
  if (!mongoose.Types.ObjectId.isValid(settlementId)) {
    return { ok: false, status: 400, message: 'Invalid settlement id format' };
  }

  const settlement = await Settlement.findOne({
    _id: settlementId,
    tenantId,
  });

  if (!settlement) {
    return { ok: false, status: 404, message: 'Settlement not found' };
  }

  return { ok: true, settlement };
}

/**
 * The company's settlement policy, merged over the defaults.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function loadPolicy(userId) {
  const user = await User.findById(userId).select('settings');
  return {
    ...DEFAULT_SETTLEMENT_POLICY,
    ...(user?.settings?.settlementPolicy || {}),
  };
}

/**
 * Compute a settlement for an employee without persisting anything.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
async function computeFor({ employee, policy, body }) {
  const { calculateSettlement } = require('../services/settlementEngine');
  return calculateSettlement({ employee, policy, body });
}

/**
 * GET /api/settlements/preview?employeeId=&lastWorkingDay=…
 *
 * Model the number before committing. Writes nothing.
 */
exports.previewSettlement = async (req, res, next) => {
  try {
    const owned = await loadOwnedEmployee(req.query.employeeId, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const lastWorkingDay = parseDate(req.query.lastWorkingDay);
    if (!lastWorkingDay) {
      return res
        .status(400)
        .json({ message: 'A valid lastWorkingDay is required' });
    }

    const policy = await loadPolicy(req.userId);
    const settlement = await computeFor({
      employee: owned.employee,
      policy,
      body: { ...req.query, lastWorkingDay },
    });

    res.status(200).json({
      employeeId: String(owned.employee._id),
      employeeName: owned.employee.fullName,
      lastWorkingDay,
      settlement,
      // Surfaced, not enforced: preview never blocks.
      validation: validateSettlement(settlement),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/settlements/initiate
 *
 * Start an exit: record the last working day and move the employee onto notice.
 *
 * Deliberately does *not* deactivate them — an employee on notice is still
 * working and still payable up to their last day. Excluding them the moment
 * they resign is exactly the bug that made the final month unpayable.
 */
exports.initiateExit = async (req, res, next) => {
  try {
    const body = req.body || {};

    const owned = await loadOwnedEmployee(body.employeeId, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;

    const lastWorkingDay = parseDate(body.lastWorkingDay);
    if (!lastWorkingDay) {
      return res
        .status(400)
        .json({ message: 'A valid lastWorkingDay is required' });
    }

    if (employee.joiningDate && lastWorkingDay < employee.joiningDate) {
      return res.status(400).json({
        message: 'The last working day cannot be before the joining date',
      });
    }

    if (employee.employmentStatus === EMPLOYMENT_STATUS.EXITED) {
      return res
        .status(409)
        .json({ message: 'This employee has already exited' });
    }

    const exitType = Object.values(EXIT_TYPE).includes(body.exitType)
      ? body.exitType
      : EXIT_TYPE.RESIGNATION;

    const nextStatus = EMPLOYMENT_STATUS.NOTICE_PERIOD;

    await Employee.updateOne(
      { _id: employee._id, tenantId: req.tenantId },
      {
        $set: {
          employmentStatus: nextStatus,
          // Kept as the derived mirror so every existing query that filters on
          // it keeps working untouched.
          isActive: isActiveStatus(nextStatus),
          exitDetails: {
            lastWorkingDay,
            resignationDate: parseDate(body.resignationDate) || new Date(),
            exitType,
            reason: sanitizeText(body.reason || ''),
            noticePeriodDays:
              Number(body.noticePeriodDays) ||
              DEFAULT_SETTLEMENT_POLICY.defaultNoticePeriodDays,
            noticeServedDays: Number(body.noticeServedDays) || 0,
            exitInterviewDone: Boolean(body.exitInterviewDone),
          },
        },
      },
    );

    const ExitClearance = require('../models/exitClearance.model');
    await ExitClearance.findOneAndUpdate(
      { employeeId: employee._id, tenantId: req.tenantId },
      {
        $setOnInsert: {
          employeeId: employee._id,
          tenantId: req.tenantId,
          status: 'Pending',
          itClearance: { status: 'Pending', notes: '' },
          hrClearance: { status: 'Pending', notes: '' },
          adminClearance: { status: 'Pending', notes: '' },
          hasTrainingAgreement: Boolean(body.hasTrainingAgreement),
          trainingClawbackAmount: Number(body.trainingClawbackAmount) || 0,
        },
      },
      { upsert: true, new: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EMPLOYEE_EXIT_INITIATED',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        employeeName: employee.fullName,
        lastWorkingDay,
        exitType,
      },
      req,
    });

    logger.info('Employee exit initiated', {
      userId: req.userId,
      employeeId: String(employee._id),
      lastWorkingDay,
    });

    res.status(200).json({
      message:
        'Exit initiated. The employee remains payable until their last working day.',
      employeeId: String(employee._id),
      employmentStatus: nextStatus,
      lastWorkingDay,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/settlements — persist a draft.
 */
exports.createSettlement = async (req, res, next) => {
  try {
    const body = req.body || {};

    const owned = await loadOwnedEmployee(body.employeeId, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;

    const lastWorkingDay =
      parseDate(body.lastWorkingDay) || employee.exitDetails?.lastWorkingDay;

    if (!lastWorkingDay) {
      return res.status(400).json({
        message:
          'A last working day is required. Initiate the exit first, or supply one.',
      });
    }

    const policy = await loadPolicy(req.userId);
    const computed = await computeFor({
      employee,
      policy,
      body: {
        ...body,
        lastWorkingDay,
        noticePeriodDays:
          body.noticePeriodDays ?? employee.exitDetails?.noticePeriodDays,
        noticeServedDays:
          body.noticeServedDays ?? employee.exitDetails?.noticeServedDays,
      },
    });

    const validation = validateSettlement(computed, {
      allowNegative: Boolean(body.allowNegative),
    });

    if (!validation.ok) {
      return res.status(400).json({
        message: 'Settlement could not be committed',
        errors: validation.errors,
        settlement: computed,
      });
    }

    const lwd = new Date(lastWorkingDay);

    let created;
    try {
      created = await Settlement.create({
        employeeId: employee._id,
        employeeName: employee.fullName,
        // Both: `createdBy` records who opened the settlement, `tenantId`
        // decides who can see it. #585 dropped the first while the schema still
        // required it, so this create() threw on every call (#613).
        createdBy: req.userId,
        tenantId: req.tenantId,
        lastWorkingDay: lwd,
        joiningDate: employee.joiningDate,
        exitType: employee.exitDetails?.exitType || EXIT_TYPE.RESIGNATION,
        settlementMonth: lwd.getMonth() + 1,
        settlementYear: lwd.getFullYear(),
        earnings: computed.earnings,
        deductions: computed.deductions,
        grossEarnings: computed.grossEarnings,
        totalDeductions: computed.totalDeductions,
        netSettlement: computed.netSettlement,
        explanations: computed.explanations,
        policySnapshot: computed.policy,
        status: SETTLEMENT_STATUS.DRAFT,
        negativeOverride:
          Boolean(body.allowNegative) && computed.netSettlement < 0,
        notes: sanitizeText(body.notes || ''),
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({
          message:
            'A settlement already exists for this employee. Cancel it before creating another.',
        });
      }
      throw error;
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SETTLEMENT_CREATE',
      resourceType: 'Settlement',
      resourceIds: [created._id],
      details: {
        employeeName: employee.fullName,
        lastWorkingDay: lwd,
        netSettlement: created.netSettlement,
      },
      req,
    });

    logger.info('Settlement drafted', {
      userId: req.userId,
      settlementId: created._id,
      employeeId: String(employee._id),
      netSettlement: created.netSettlement,
    });

    res
      .status(201)
      .json({ message: 'Settlement drafted', settlement: created });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/settlements/:id — adjust the manual lines and recompute.
 */
exports.updateSettlement = async (req, res, next) => {
  try {
    const owned = await loadOwnedSettlement(req.params.id, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { settlement } = owned;
    const body = req.body || {};

    // Only a draft is editable. Once it is with a checker, changing the figures
    // underneath them is the abuse the approval ladder exists to prevent.
    if (settlement.status !== SETTLEMENT_STATUS.DRAFT) {
      return res.status(409).json({
        message: `Only a draft settlement can be edited. This one is "${settlement.status}".`,
      });
    }

    const employeeResult = await loadOwnedEmployee(
      String(settlement.employeeId),
      req.tenantId,
    );
    if (!employeeResult.ok) {
      return res
        .status(employeeResult.status)
        .json({ message: employeeResult.message });
    }

    const policy = await loadPolicy(req.userId);
    const computed = await computeFor({
      employee: employeeResult.employee,
      policy,
      body: {
        lastWorkingDay: body.lastWorkingDay || settlement.lastWorkingDay,
        unusedLeaveDays:
          body.unusedLeaveDays ?? settlement.earnings.encashableDays,
        noticePeriodDays: body.noticePeriodDays,
        noticeServedDays: body.noticeServedDays,
        bonus: body.bonus ?? settlement.earnings.bonus,
        otherEarnings: body.otherEarnings ?? settlement.earnings.other,
        advanceRecovery:
          body.advanceRecovery ?? settlement.deductions.advanceRecovery,
        assetRecovery:
          body.assetRecovery ?? settlement.deductions.assetRecovery,
        otherDeductions: body.otherDeductions ?? settlement.deductions.other,
      },
    });

    const validation = validateSettlement(computed, {
      allowNegative: Boolean(body.allowNegative) || settlement.negativeOverride,
    });

    if (!validation.ok) {
      return res.status(400).json({
        message: 'Settlement could not be updated',
        errors: validation.errors,
        settlement: computed,
      });
    }

    settlement.earnings = computed.earnings;
    settlement.deductions = computed.deductions;
    settlement.grossEarnings = computed.grossEarnings;
    settlement.totalDeductions = computed.totalDeductions;
    settlement.netSettlement = computed.netSettlement;
    settlement.explanations = computed.explanations;
    settlement.policySnapshot = computed.policy;
    if (body.notes !== undefined) settlement.notes = sanitizeText(body.notes);
    if (body.allowNegative !== undefined) {
      settlement.negativeOverride =
        Boolean(body.allowNegative) && computed.netSettlement < 0;
    }

    await settlement.save();

    res.status(200).json({ message: 'Settlement updated', settlement });
  } catch (error) {
    next(error);
  }
};

/**
 * Move a settlement along the status ladder.
 *
 * @param {string} target
 * @param {(settlement: object, req: object) => object} decorate
 * @returns {Function} an express handler
 */
function makeTransitionHandler(target, decorate = () => ({})) {
  return async (req, res, next) => {
    try {
      const owned = await loadOwnedSettlement(req.params.id, req.tenantId);
      if (!owned.ok) {
        return res.status(owned.status).json({ message: owned.message });
      }

      const { settlement } = owned;

      if (!canTransitionSettlement(settlement.status, target)) {
        return res.status(409).json({
          message: describeSettlementTransition(settlement.status, target),
          currentStatus: settlement.status,
        });
      }

      const extra = decorate(settlement, req);
      if (extra.error) {
        return res.status(extra.status || 400).json({ message: extra.error });
      }

      const previous = settlement.status;
      settlement.status = target;
      Object.assign(settlement, extra.fields || {});

      await settlement.save();

      // Marking an F&F paid is the moment the employee actually leaves.
      if (target === SETTLEMENT_STATUS.PAID) {
        await Employee.updateOne(
          { _id: settlement.employeeId, tenantId: req.tenantId },
          {
            $set: {
              employmentStatus: EMPLOYMENT_STATUS.EXITED,
              isActive: isActiveStatus(EMPLOYMENT_STATUS.EXITED),
            },
          },
        );

        const Position = require('../models/position.model');
        await Position.updateOne(
          { employeeId: settlement.employeeId, tenantId: req.tenantId },
          {
            $set: {
              status: 'Vacant',
              employeeId: null,
            },
          },
        );

        // An exited employee leaves the active headcount, so the aggregates
        // move — same invalidation contract the payroll paths follow (#415).
        await cacheService.invalidateAnalytics(req.userId);
      }

      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'SETTLEMENT_STATUS_CHANGE',
        resourceType: 'Settlement',
        resourceIds: [settlement._id],
        details: {
          employeeName: settlement.employeeName,
          from: previous,
          to: target,
          netSettlement: settlement.netSettlement,
        },
        req,
      });

      logger.info('Settlement status changed', {
        userId: req.userId,
        settlementId: settlement._id,
        from: previous,
        to: target,
      });

      res.status(200).json({ message: `Settlement ${target}`, settlement });
    } catch (error) {
      next(error);
    }
  };
}

exports.submitSettlement = makeTransitionHandler(
  SETTLEMENT_STATUS.PENDING_APPROVAL,
);

exports.approveSettlement = makeTransitionHandler(
  SETTLEMENT_STATUS.APPROVED,
  (settlement, req) => ({
    fields: {
      approvedBy: req.userId,
      approvedAt: new Date(),
      rejectionReason: undefined,
    },
  }),
);

exports.rejectSettlement = makeTransitionHandler(
  SETTLEMENT_STATUS.DRAFT,
  (settlement, req) => {
    const reason = req.body?.reason;
    if (typeof reason !== 'string' || reason.trim() === '') {
      return { error: 'A rejection reason is required' };
    }
    return { fields: { rejectionReason: reason.trim().slice(0, 500) } };
  },
);

exports.markSettlementPaid = makeTransitionHandler(
  SETTLEMENT_STATUS.PAID,
  () => ({ fields: { paidAt: new Date() } }),
);

exports.cancelSettlement = makeTransitionHandler(
  SETTLEMENT_STATUS.CANCELLED,
  () => ({ fields: { cancelledAt: new Date() } }),
);

/**
 * GET /api/settlements — list with filters and pagination.
 */
exports.getSettlements = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    const query = { tenantId: req.tenantId };

    if (req.query.status) {
      if (!Object.values(SETTLEMENT_STATUS).includes(req.query.status)) {
        return res.status(400).json({ message: 'Invalid status filter' });
      }
      query.status = req.query.status;
    }

    if (req.query.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.employeeId)) {
        return res.status(400).json({ message: 'Invalid employee id format' });
      }
      query.employeeId = req.query.employeeId;
    }

    const [settlements, totalCount] = await Promise.all([
      Settlement.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Settlement.countDocuments(query),
    ]);

    res.status(200).json({
      settlements,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 0,
      totalCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settlements/:id
 */
exports.getSettlementById = async (req, res, next) => {
  try {
    const owned = await loadOwnedSettlement(req.params.id, req.tenantId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    // The payroll history the exit deliberately preserves — the thing
    // `deleteEmployee` would have destroyed.
    const payrollHistoryCount = await PayrollUpdate.countDocuments({
      employeeId: owned.settlement.employeeId,
      tenantId: req.tenantId,
    });

    res.status(200).json({
      settlement: owned.settlement,
      payrollHistoryCount,
    });
  } catch (error) {
    next(error);
  }
};

exports.getClearanceStatus = async (req, res, next) => {
  try {
    const ExitClearance = require('../models/exitClearance.model');
    const clearance = await ExitClearance.findOne({
      employeeId: req.params.employeeId,
      tenantId: req.tenantId,
    }).populate('employeeId', 'fullName email department');

    if (!clearance) {
      return res
        .status(404)
        .json({ message: 'Exit clearance record not found' });
    }

    res.status(200).json({ success: true, clearance });
  } catch (error) {
    next(error);
  }
};

exports.submitClearanceSignoff = async (req, res, next) => {
  try {
    const { employeeId, department, status, notes } = req.body;
    if (!['it', 'hr', 'admin'].includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }
    if (!['Cleared', 'Rejected', 'Pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const ExitClearance = require('../models/exitClearance.model');
    const clearance = await ExitClearance.findOne({
      employeeId,
      tenantId: req.tenantId,
    });
    if (!clearance) {
      return res
        .status(404)
        .json({ message: 'Exit clearance record not found' });
    }

    const stepKey = `${department}Clearance`;
    clearance[stepKey] = {
      status,
      clearedBy: req.userId,
      clearedAt: new Date(),
      notes: notes || '',
    };

    const steps = [
      clearance.itClearance.status,
      clearance.hrClearance.status,
      clearance.adminClearance.status,
    ];
    if (steps.every((s) => s === 'Cleared')) {
      clearance.status = 'Completed';
    } else if (steps.some((s) => s === 'Rejected')) {
      clearance.status = 'Rejected';
    } else {
      clearance.status = 'Pending';
    }

    await clearance.save();

    res.status(200).json({
      success: true,
      message: `${department.toUpperCase()} clearance updated successfully.`,
      clearance,
    });
  } catch (error) {
    next(error);
  }
};

exports._internals = {
  loadOwnedEmployee,
  loadOwnedSettlement,
  loadPolicy,
  makeTransitionHandler,
};
