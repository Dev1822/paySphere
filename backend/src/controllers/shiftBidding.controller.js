/**
 * @fileoverview Shift Bidding Controller
 * @description Manages open shift posting, employee bidding, compliance pre-checks,
 * and automated award assignment utilizing labor fatigue rules & seniority tie-breaking.
 */
const mongoose = require('mongoose');
const { OpenShift, ShiftBid } = require('../models/shiftMarketplace.model');
const Employee = require('../models/employee.model');
const { ShiftRoster } = require('../models/shiftRoster.model');
const {
  checkShiftConflicts,
  calculatePriorityScore,
  evaluateShiftFatigueRules,
  rankBiddersBySeniorityAndScore,
} = require('../utils/shiftConflict.utils');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const redisClient = require('../config/redis');

/**
 * POST /api/shifts/marketplace/open
 * Manager posts an uncovered shift to the marketplace.
 */
exports.postOpenShift = async (req, res, next) => {
  try {
    const {
      shiftTemplateId,
      date,
      startTime,
      endTime,
      requiredRole,
      requiredDepartment,
      premiumMultiplier,
      reason,
    } = req.body;

    const shiftStart = new Date(date);
    const [h, m] = startTime.split(':').map(Number);
    shiftStart.setHours(h, m, 0, 0);
    const expiresAt = new Date(shiftStart.getTime() - 2 * 60 * 60 * 1000);

    const openShift = await OpenShift.create({
      tenantId: req.tenantId,
      shiftTemplateId,
      date: new Date(date),
      startTime,
      endTime,
      requiredRole,
      requiredDepartment,
      premiumMultiplier: premiumMultiplier || 1.0,
      reason,
      postedBy: req.userId,
      expiresAt,
    });

    res.status(201).json({ message: 'Shift posted to marketplace', openShift });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/shifts/marketplace/:id/bid
 * Employee instantly claims an open dynamically priced shift.
 * Uses Redis locks to prevent race conditions.
 */
exports.placeBid = async (req, res, next) => {
  const lockKey = `shift_lock:${req.params.id}`;
  let lockAcquired = false;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Attempt to acquire Redis lock
    if (redisClient.status === 'ready') {
      const lock = await redisClient.setnx(lockKey, req.userId);
      if (lock === 1) {
        lockAcquired = true;
        // Expire lock after 10 seconds to prevent deadlocks
        await redisClient.expire(lockKey, 10);
      } else {
        await session.abortTransaction();
        return res.status(409).json({ message: 'Already Claimed' });
      }
    }

    const openShift = await OpenShift.findById(req.params.id).session(session);
    if (!openShift || openShift.status !== 'Open') {
      await session.abortTransaction();
      return res.status(409).json({ message: 'Already Claimed' });
    }

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).session(session);
    if (!employee) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Employee profile not found.' });
    }

    const conflictCheck = await checkShiftConflicts(
      req.tenantId,
      employee._id,
      openShift.date,
      openShift.startTime,
      openShift.endTime,
    );

    if (conflictCheck.hasConflict) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Cannot bid: Labor rest or schedule conflict detected.',
        conflicts: conflictCheck.reasons,
      });
    }

    const priorityScore = calculatePriorityScore(employee, openShift);

    // Instant award for dynamically priced shifts
    const bid = await ShiftBid.create(
      [
        {
          tenantId: req.tenantId,
          openShiftId: openShift._id,
          employeeId: employee._id,
          status: 'Accepted',
          priorityScore,
          bidMessage: req.body.message || '',
        },
      ],
      { session },
    );

    await ShiftRoster.create(
      [
        {
          tenantId: req.tenantId,
          employeeId: employee._id,
          shiftTemplateId: openShift.shiftTemplateId,
          date: openShift.date,
          status: 'Scheduled',
        },
      ],
      { session },
    );

    openShift.status = 'Assigned';
    openShift.assignedTo = employee._id;
    await openShift.save({ session });

    await session.commitTransaction();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SHIFT_MARKETPLACE_CLAIMED',
      resourceType: 'OpenShift',
      resourceIds: [openShift._id],
      details: {
        assignedTo: employee._id,
        premiumMultiplier: openShift.premiumMultiplier,
      },
      req,
    });

    res
      .status(201)
      .json({ message: 'Shift claimed successfully!', bid: bid[0] });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: 'You have already claimed this shift.' });
    next(error);
  } finally {
    session.endSession();
    if (lockAcquired) {
      await redisClient.del(lockKey);
    }
  }
};

/**
 * GET /api/shifts/marketplace
 * Fetches open shifts available for bidding.
 */
exports.getMarketplace = async (req, res, next) => {
  try {
    const shifts = await OpenShift.find({
      tenantId: req.tenantId,
      status: 'Open',
      expiresAt: { $gt: new Date() },
    })
      .populate('shiftTemplateId', 'name colorCode')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({ shifts });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/shifts/marketplace/compliance-check
 * Pre-validates shift assignment against labor rest and fatigue rules.
 */
exports.checkShiftCompliance = async (req, res, next) => {
  try {
    const { employeeId, date, startTime, endTime } = req.query;
    if (!employeeId || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: 'employeeId, date, startTime, and endTime are required',
      });
    }

    const conflictCheck = await checkShiftConflicts(
      req.tenantId,
      employeeId,
      new Date(date),
      startTime,
      endTime,
    );

    res.status(200).json({
      success: true,
      isCompliant: !conflictCheck.hasConflict,
      violations: conflictCheck.reasons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/shifts/marketplace/:id/assign
 * Manager assigns open shift using seniority and priority tie-breaking.
 */
exports.assignShift = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const openShift = await OpenShift.findById(req.params.id).session(session);
    if (!openShift || openShift.status !== 'Open') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Shift is not open.' });
    }

    const bids = await ShiftBid.find({
      openShiftId: openShift._id,
      status: 'Pending',
    }).session(session);

    if (!bids.length) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No valid bids available.' });
    }

    const employeeIds = bids.map((b) => b.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();
    const empMap = new Map(employees.map((e) => [String(e._id), e]));

    const rankedBids = rankBiddersBySeniorityAndScore(bids, empMap);
    const winningBid = rankedBids[0];

    await ShiftRoster.create(
      [
        {
          tenantId: req.tenantId,
          employeeId: winningBid.employeeId,
          shiftTemplateId: openShift.shiftTemplateId,
          date: openShift.date,
          status: 'Scheduled',
        },
      ],
      { session },
    );

    openShift.status = 'Assigned';
    openShift.assignedTo = winningBid.employeeId;
    await openShift.save({ session });

    winningBid.status = 'Accepted';
    await winningBid.save({ session });

    await ShiftBid.updateMany(
      {
        openShiftId: openShift._id,
        _id: { $ne: winningBid._id },
        status: 'Pending',
      },
      { $set: { status: 'Rejected' } },
      { session },
    );

    await session.commitTransaction();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SHIFT_MARKETPLACE_ASSIGNED',
      resourceType: 'OpenShift',
      resourceIds: [openShift._id],
      details: {
        assignedTo: winningBid.employeeId,
        priorityScore: winningBid.priorityScore,
      },
      req,
    });

    res.status(200).json({
      message: 'Shift assigned successfully using seniority-weighted priority',
      openShift,
      winningBid,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
