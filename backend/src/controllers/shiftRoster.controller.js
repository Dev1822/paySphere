/**
 * @fileoverview Shift Roster Controller
 * @description Manages shift scheduling, conflict detection, and swap approvals.
 * Issue: #956
 */
const mongoose = require('mongoose');
const {
  ShiftTemplate,
  ShiftRoster,
  ShiftSwapRequest,
} = require('../models/shiftRoster.model');
const { BurnoutTelemetry } = require('../models/BurnoutRiskModels');
const { validateShiftAssignment } = require('../utils/shiftConflictDetector');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const {
  acquireLock,
  releaseLock,
} = require('../services/predictiveOvertime.service');

/**
 * POST /api/shifts/templates
 * Create a new shift template (e.g., Morning, Night).
 */
exports.createTemplate = async (req, res, next) => {
  try {
    const { name, startTime, endTime, colorCode, breakDurationMins } = req.body;
    const template = await ShiftTemplate.create({
      name,
      startTime,
      endTime,
      colorCode,
      breakDurationMins
    });
    res.status(201).json({ message: 'Shift template created', template });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ message: 'Template name already exists' });
    next(error);
  }
};

/**
 * GET /api/shifts/roster?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Fetch roster for a specific date range.
 */
exports.getRoster = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const query = {};

    if (start && end) {
      query.date = { $gte: new Date(start), $lte: new Date(end) };
    }

    const roster = await ShiftRoster.find(query)
      .populate('employeeId', 'fullName role')
      .populate('shiftTemplateId', 'name startTime endTime colorCode')
      .sort({ date: 1 });

    res.status(200).json({ roster });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/shifts/roster
 * Assign a shift to an employee with automated conflict detection.
 */
exports.assignShift = async (req, res, next) => {
  const { employeeId, shiftTemplateId, date } = req.body;
  const lockKey = `shift_assign_lock_${employeeId}`;
  let lockAcquired = false;

  try {
    lockAcquired = await acquireLock(lockKey, 15); // 15s lock
    if (!lockAcquired) {
      return res
        .status(409)
        .json({ message: 'Assignment in progress, please try again.' });
    }

    const template = await ShiftTemplate.findOne({
      _id: shiftTemplateId
    });
    if (!template)
      return res.status(404).json({ message: 'Shift template not found' });

    // Burnout Check
    const telemetry = await BurnoutTelemetry.findOne({ employeeId }).lean();
    if (telemetry && telemetry.riskCategory === 'CRITICAL') {
      return res.status(403).json({
        message:
          'Shift assignment blocked: Employee is at CRITICAL burnout risk.',
      });
    }

    // Fetch surrounding 7 days of shifts for conflict checking
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 6);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 6);

    const existingShifts = await ShiftRoster.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    const allTemplates = await ShiftTemplate.find({}).lean();
    const templateMap = allTemplates.reduce((acc, t) => {
      acc[t._id.toString()] = t;
      return acc;
    }, {});

    // Tenant config (could be fetched from a Settings model, hardcoded for now)
    const tenantConfig = { minRestHours: 12, maxWeeklyHours: 48 };

    const validation = validateShiftAssignment(
      { employeeId, date, shiftTemplateId },
      existingShifts,
      template,
      templateMap,
      tenantConfig,
    );

    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Shift conflict detected',
        errors: validation.errors,
      });
    }

    // If valid, create the roster entry
    const rosterEntry = await ShiftRoster.create({
      employeeId,
      shiftTemplateId,
      date: targetDate
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SHIFT_ASSIGNED',
      resourceType: 'ShiftRoster',
      resourceIds: [rosterEntry._id],
      details: { employeeId, date: targetDate, shift: template.name },
      req,
    });

    res
      .status(201)
      .json({ message: 'Shift assigned successfully', roster: rosterEntry });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({
        message: 'Employee already has a shift scheduled on this date.',
      });
    next(error);
  } finally {
    if (lockAcquired) {
      await releaseLock(lockKey);
    }
  }
};

/**
 * POST /api/shifts/swap/request
 * Employee requests to swap their shift with a colleague.
 */
exports.requestSwap = async (req, res, next) => {
  try {
    const { originalRosterId, replacementId } = req.body;

    const originalRoster = await ShiftRoster.findOne({
      _id: originalRosterId
    });
    if (!originalRoster)
      return res.status(404).json({ message: 'Original shift not found' });

    // Create swap request
    const request = await ShiftSwapRequest.create({
      originalRosterId,
      requesterId: originalRoster.employeeId,
      replacementId
    });

    // In a real app, emit a notification/socket event to the replacement employee here
    logger.info(
      `Shift swap requested by ${originalRoster.employeeId} to ${replacementId}`,
    );

    res
      .status(201)
      .json({ message: 'Swap request sent to colleague', request });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/shifts/swap/:id/approve
 * Manager approves a peer-accepted swap request. Atomically swaps the roster.
 */
exports.approveSwap = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Scoped (#1010). The swap-request id comes from the URL, so unscoped
    // this let a manager at one company approve a request belonging to
    // another — and approval rewrites two roster rows, so it is a
    // cross-tenant *write*, not merely a read.
    const request = await ShiftSwapRequest.findOne(
      { _id: req.params.id },
    ).session(session);

    if (!request || request.status !== 'Pending Manager') {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Invalid swap request or not pending manager approval',
      });
    }

    const originalRoster = await ShiftRoster.findOne(
      { _id: request.originalRosterId },
    ).session(session);

    if (!originalRoster) {
      // Previously a `findById` whose result was dereferenced on the very
      // next line (`originalRoster.date`). A request pointing at a roster
      // row that has since been deleted crashed the handler with a
      // TypeError inside an open transaction instead of answering.
      await session.abortTransaction();
      return res.status(404).json({
        message: 'The shift this request refers to no longer exists',
      });
    }

    // Find the replacement's shift on the same day to swap with.
    //
    // Scoped to the caller's tenant rather than to `request.tenantId`.
    // Reading the tenant off a document that was itself fetched without a
    // tenant check is circular: it carries whatever the attacker's chosen
    // request said.
    const targetRoster = await ShiftRoster.findOne(
      {
        employeeId: request.replacementId,
        date: originalRoster.date,
      },
    ).session(session);

    if (!targetRoster) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Replacement does not have a shift on this date to swap.',
      });
    }

    // Atomic Swap
    const tempTemplateId = originalRoster.shiftTemplateId;
    originalRoster.shiftTemplateId = targetRoster.shiftTemplateId;
    targetRoster.shiftTemplateId = tempTemplateId;

    // Update employee assignments
    const tempEmpId = originalRoster.employeeId;
    originalRoster.employeeId = targetRoster.employeeId;
    targetRoster.employeeId = tempEmpId;

    await originalRoster.save({ session });
    await targetRoster.save({ session });

    request.status = 'Approved';
    request.targetRosterId = targetRoster._id;
    await request.save({ session });

    await session.commitTransaction();
    res
      .status(200)
      .json({ message: 'Shift swap approved and executed', request });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
