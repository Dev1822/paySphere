/**
 * @fileoverview Shift Preference Controller
 * @description Manages availability templates, employee shift preferences,
 * shift swap requests, auto-assignment, and schedule analytics.
 */

const mongoose = require('mongoose');
const {
  AvailabilityTemplate,
  ShiftPreference,
  ShiftSwapRequest,
  ShiftAssignment,
} = require('../models/shiftPreference.model');
const Employee = require('../models/employee.model');
const {
  validateTimeSlot,
  autoAssignShifts,
  findSwapMatches,
  computeScheduleMetrics,
} = require('../utils/shiftPreferenceEngine');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');

// ============================================================================
// Availability Templates
// ============================================================================

exports.createTemplate = async (req, res, next) => {
  try {
    const { name, description, slots } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    if (!Array.isArray(slots) || slots.length === 0) {
      return res
        .status(400)
        .json({ message: 'At least one time slot is required' });
    }

    for (const slot of slots) {
      const { valid, error } = validateTimeSlot(slot);
      if (!valid)
        return res.status(400).json({ message: `Invalid slot: ${error}` });
    }

    const template = await AvailabilityTemplate.create({
      tenantId: req.tenantId,
      name,
      description,
      slots,
      createdBy: req.userId,
    });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SHIFT_TEMPLATE_CREATED',
      resourceType: 'AvailabilityTemplate',
      resourceIds: [template._id],
      details: { name, slotCount: slots.length },
      req,
    });

    return res.status(201).json({ message: 'Template created', template });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A template with that name already exists' });
    }
    return next(error);
  }
};

exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await AvailabilityTemplate.find({
      tenantId: req.tenantId,
    })
      .populate('createdBy', 'fullName')
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({ templates });
  } catch (error) {
    return next(error);
  }
};

exports.updateTemplate = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid template ID' });
    }

    const template = await AvailabilityTemplate.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!template)
      return res.status(404).json({ message: 'Template not found' });

    const { name, description, slots, isActive } = req.body;
    if (slots) {
      for (const slot of slots) {
        const { valid, error } = validateTimeSlot(slot);
        if (!valid)
          return res.status(400).json({ message: `Invalid slot: ${error}` });
      }
      template.slots = slots;
    }
    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (isActive !== undefined) template.isActive = isActive;

    await template.save();
    return res.status(200).json({ message: 'Template updated', template });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A template with that name already exists' });
    }
    return next(error);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid template ID' });
    }
    const template = await AvailabilityTemplate.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!template)
      return res.status(404).json({ message: 'Template not found' });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SHIFT_TEMPLATE_DELETED',
      resourceType: 'AvailabilityTemplate',
      resourceIds: [template._id],
      details: { name: template.name },
      req,
    });

    return res.status(200).json({ message: 'Template deleted' });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Employee Preferences
// ============================================================================

exports.submitPreference = async (req, res, next) => {
  try {
    const { weekStartDate, preferences, blackoutDates, minHours, maxHours } =
      req.body;

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id fullName');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    if (!weekStartDate) {
      return res.status(400).json({ message: 'weekStartDate is required' });
    }

    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);

    // Check for existing preference this week
    const existing = await ShiftPreference.findOne({
      tenantId: req.tenantId,
      employeeId: employee._id,
      weekStartDate: weekStart,
    });

    let preference;
    if (existing) {
      if (existing.status === 'Approved') {
        return res
          .status(409)
          .json({ message: 'Cannot modify an approved preference' });
      }
      existing.preferences = preferences || existing.preferences;
      existing.blackoutDates = blackoutDates || existing.blackoutDates;
      existing.minHours = minHours !== undefined ? minHours : existing.minHours;
      existing.maxHours = maxHours !== undefined ? maxHours : existing.maxHours;
      existing.status = 'Submitted';
      existing.submittedAt = new Date();
      preference = await existing.save();
    } else {
      preference = await ShiftPreference.create({
        tenantId: req.tenantId,
        employeeId: employee._id,
        weekStartDate: weekStart,
        preferences: preferences || [],
        blackoutDates: blackoutDates || [],
        minHours: minHours || 0,
        maxHours: maxHours || 40,
        status: 'Submitted',
        submittedAt: new Date(),
      });
    }

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SHIFT_PREFERENCE_SUBMITTED',
      resourceType: 'ShiftPreference',
      resourceIds: [preference._id],
      details: {
        weekStart: weekStart.toISOString(),
        prefCount: preference.preferences.length,
      },
      req,
    });

    return res
      .status(201)
      .json({ message: 'Preference submitted', preference });
  } catch (error) {
    return next(error);
  }
};

exports.getMyPreferences = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const filter = { tenantId: req.tenantId, employeeId: employee._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.week) filter.weekStartDate = new Date(req.query.week);

    const preferences = await ShiftPreference.find(filter)
      .sort({ weekStartDate: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({ preferences });
  } catch (error) {
    return next(error);
  }
};

exports.getAllPreferences = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (
      req.query.employeeId &&
      mongoose.isValidObjectId(req.query.employeeId)
    ) {
      filter.employeeId = req.query.employeeId;
    }
    if (req.query.week) filter.weekStartDate = new Date(req.query.week);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [preferences, total] = await Promise.all([
      ShiftPreference.find(filter)
        .populate('employeeId', 'fullName department role')
        .sort({ weekStartDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShiftPreference.countDocuments(filter),
    ]);

    return res.status(200).json({
      preferences,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

exports.reviewPreference = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid preference ID' });
    }

    const { action, reviewNotes } = req.body;
    if (!['Approved', 'Rejected'].includes(action)) {
      return res
        .status(400)
        .json({ message: 'action must be "Approved" or "Rejected"' });
    }

    const preference = await ShiftPreference.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!preference)
      return res.status(404).json({ message: 'Preference not found' });
    if (preference.status !== 'Submitted' && preference.status !== 'Reviewed') {
      return res
        .status(409)
        .json({
          message: `Cannot review a preference in "${preference.status}" status`,
        });
    }

    preference.status = action;
    preference.reviewedBy = req.userId;
    preference.reviewedAt = new Date();
    preference.reviewNotes = reviewNotes || '';
    await preference.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: `SHIFT_PREFERENCE_${action.toUpperCase()}`,
      resourceType: 'ShiftPreference',
      resourceIds: [preference._id],
      details: {
        employeeId: preference.employeeId,
        weekStart: preference.weekStartDate,
      },
      req,
    });

    return res
      .status(200)
      .json({ message: `Preference ${action.toLowerCase()}`, preference });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Shift Swap Requests
// ============================================================================

exports.createSwapRequest = async (req, res, next) => {
  try {
    const { originalShift, desiredShift, effectiveDate, reason } = req.body;

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    if (!originalShift?.shiftType || !originalShift?.shiftDate) {
      return res
        .status(400)
        .json({
          message: 'originalShift with shiftType and shiftDate is required',
        });
    }
    if (!effectiveDate) {
      return res.status(400).json({ message: 'effectiveDate is required' });
    }

    const swap = await ShiftSwapRequest.create({
      tenantId: req.tenantId,
      requesterId: employee._id,
      originalShift,
      desiredShift: desiredShift || null,
      effectiveDate: new Date(effectiveDate),
      reason: reason || '',
      status: 'Open',
    });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SHIFT_SWAP_CREATED',
      resourceType: 'ShiftSwapRequest',
      resourceIds: [swap._id],
      details: {
        originalShift: originalShift.shiftType,
        shiftDate: originalShift.shiftDate,
      },
      req,
    });

    return res.status(201).json({ message: 'Swap request created', swap });
  } catch (error) {
    return next(error);
  }
};

exports.getSwapRequests = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.my === 'true') {
      const employee = await Employee.findOne({
        userId: req.userId,
        tenantId: req.tenantId,
      }).select('_id');
      if (employee) filter.requesterId = employee._id;
    }

    const swaps = await ShiftSwapRequest.find(filter)
      .populate('requesterId', 'fullName department')
      .populate('acceptorId', 'fullName department')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ swaps });
  } catch (error) {
    return next(error);
  }
};

exports.acceptSwap = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid swap ID' });
    }

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const swap = await ShiftSwapRequest.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!swap)
      return res.status(404).json({ message: 'Swap request not found' });
    if (swap.status !== 'Open') {
      return res
        .status(409)
        .json({ message: `Cannot accept a swap in "${swap.status}" status` });
    }
    if (String(swap.requesterId) === String(employee._id)) {
      return res
        .status(400)
        .json({ message: 'You cannot accept your own swap request' });
    }

    swap.acceptorId = employee._id;
    swap.status = 'Matched';
    await swap.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SHIFT_SWAP_ACCEPTED',
      resourceType: 'ShiftSwapRequest',
      resourceIds: [swap._id],
      details: { acceptorId: employee._id },
      req,
    });

    return res
      .status(200)
      .json({ message: 'Swap accepted — pending manager approval', swap });
  } catch (error) {
    return next(error);
  }
};

exports.approveSwap = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid swap ID' });
    }

    const { action, rejectionReason } = req.body;
    if (!['Approved', 'Rejected'].includes(action)) {
      return res
        .status(400)
        .json({ message: 'action must be "Approved" or "Rejected"' });
    }

    const swap = await ShiftSwapRequest.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!swap)
      return res.status(404).json({ message: 'Swap request not found' });
    if (swap.status !== 'Matched') {
      return res
        .status(409)
        .json({
          message: `Cannot ${action.toLowerCase()} a swap in "${swap.status}" status`,
        });
    }

    swap.status = action;
    swap.approvedBy = req.userId;
    swap.approvedAt = new Date();
    if (action === 'Rejected' && rejectionReason) {
      swap.rejectionReason = rejectionReason;
    }
    await swap.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: `SHIFT_SWAP_${action.toUpperCase()}`,
      resourceType: 'ShiftSwapRequest',
      resourceIds: [swap._id],
      details: { requesterId: swap.requesterId, acceptorId: swap.acceptorId },
      req,
    });

    return res
      .status(200)
      .json({ message: `Swap ${action.toLowerCase()}`, swap });
  } catch (error) {
    return next(error);
  }
};

exports.cancelSwap = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid swap ID' });
    }

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const swap = await ShiftSwapRequest.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!swap)
      return res.status(404).json({ message: 'Swap request not found' });
    if (String(swap.requesterId) !== String(employee._id)) {
      return res.status(403).json({ message: 'Only the requester can cancel' });
    }
    if (!['Open', 'Matched'].includes(swap.status)) {
      return res
        .status(409)
        .json({ message: `Cannot cancel a swap in "${swap.status}" status` });
    }

    swap.status = 'Cancelled';
    await swap.save();

    return res.status(200).json({ message: 'Swap cancelled', swap });
  } catch (error) {
    return next(error);
  }
};

exports.findSwapMatches = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid swap ID' });
    }

    const swap = await ShiftSwapRequest.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!swap)
      return res.status(404).json({ message: 'Swap request not found' });

    // Get all other employees
    const otherEmployees = await Employee.find({
      tenantId: req.tenantId,
      isActive: true,
      _id: { $ne: swap.requesterId },
    })
      .select('_id fullName department')
      .lean();

    const matches = findSwapMatches(swap, otherEmployees, []);

    return res.status(200).json({ matches });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Auto-Assignment
// ============================================================================

exports.runAutoAssignment = async (req, res, next) => {
  try {
    const { weekStartDate, shiftSlots } = req.body;

    if (!weekStartDate) {
      return res.status(400).json({ message: 'weekStartDate is required' });
    }
    if (!Array.isArray(shiftSlots) || shiftSlots.length === 0) {
      return res.status(400).json({ message: 'shiftSlots array is required' });
    }

    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);

    // Get all approved preferences for this week
    const approvedPrefs = await ShiftPreference.find({
      tenantId: req.tenantId,
      weekStartDate: weekStart,
      status: 'Approved',
    }).lean();

    if (approvedPrefs.length === 0) {
      return res
        .status(400)
        .json({ message: 'No approved preferences found for this week' });
    }

    // Get employee data
    const empIds = approvedPrefs.map((p) => p.employeeId);
    const employees = await Employee.find({
      _id: { $in: empIds },
      tenantId: req.tenantId,
      isActive: true,
    })
      .select('_id fullName blackoutDates')
      .lean();

    // Build preference map
    const prefMap = new Map();
    for (const p of approvedPrefs) {
      prefMap.set(String(p.employeeId), p.preferences || []);
    }

    // Run auto-assignment
    const result = autoAssignShifts(employees, shiftSlots, prefMap);

    // Persist assignments
    const created = [];
    for (const a of result.assignments) {
      try {
        const assignment = await ShiftAssignment.create({
          tenantId: req.tenantId,
          employeeId: a.employeeId,
          shiftType: a.shiftType,
          shiftDate: a.shiftDate,
          startTime: a.startTime,
          endTime: a.endTime,
          autoAssigned: true,
          preferenceMatch: a.preferenceMatch,
          status: 'Assigned',
        });
        created.push(assignment);
      } catch (err) {
        if (err.code !== 11000) {
          logger.error('Auto-assign creation failed', { error: err.message });
        }
      }
    }

    const metrics = computeScheduleMetrics(
      created,
      Array.from(prefMap.values()).flat(),
    );

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SHIFT_AUTO_ASSIGNMENT_RUN',
      resourceType: 'ShiftAssignment',
      resourceIds: created.map((a) => a._id),
      details: {
        weekStart: weekStart.toISOString(),
        assigned: created.length,
        unassigned: result.unassigned.length,
        conflicts: result.conflicts.length,
      },
      req,
    });

    return res.status(200).json({
      message: 'Auto-assignment complete',
      assigned: created.length,
      unassigned: result.unassigned.length,
      conflictsCount: result.conflicts.length,
      assignments: created,
      unassignedEmployees: result.unassigned,
      conflicts: result.conflicts,
      metrics,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Assignments & Analytics
// ============================================================================

exports.getAssignments = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.date) filter.shiftDate = new Date(req.query.date);
    if (req.query.shiftType) filter.shiftType = req.query.shiftType;
    if (
      req.query.employeeId &&
      mongoose.isValidObjectId(req.query.employeeId)
    ) {
      filter.employeeId = req.query.employeeId;
    }
    if (req.query.status) filter.status = req.query.status;

    const assignments = await ShiftAssignment.find(filter)
      .populate('employeeId', 'fullName department role')
      .sort({ shiftDate: -1, shiftType: 1 })
      .limit(200)
      .lean();

    return res.status(200).json({ assignments });
  } catch (error) {
    return next(error);
  }
};

exports.getScheduleMetrics = async (req, res, next) => {
  try {
    const { weekStartDate } = req.query;
    const weekStart = weekStartDate ? new Date(weekStartDate) : new Date();
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const assignments = await ShiftAssignment.find({
      tenantId: req.tenantId,
      shiftDate: { $gte: weekStart, $lt: weekEnd },
    }).lean();

    const prefs = await ShiftPreference.find({
      tenantId: req.tenantId,
      weekStartDate: weekStart,
    }).lean();

    const metrics = computeScheduleMetrics(
      assignments,
      prefs.flatMap((p) => p.preferences || []),
    );

    return res.status(200).json({ weekStart, metrics });
  } catch (error) {
    return next(error);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [pendingPreferences, openSwaps, totalAssignments, templateCount] =
      await Promise.all([
        ShiftPreference.countDocuments({
          tenantId: req.tenantId,
          status: 'Submitted',
        }),
        ShiftSwapRequest.countDocuments({
          tenantId: req.tenantId,
          status: { $in: ['Open', 'Matched'] },
        }),
        ShiftAssignment.countDocuments({
          tenantId: req.tenantId,
          shiftDate: { $gte: weekStart, $lt: weekEnd },
        }),
        AvailabilityTemplate.countDocuments({
          tenantId: req.tenantId,
          isActive: true,
        }),
      ]);

    // Preference submission rate
    const totalEmployees = await Employee.countDocuments({
      tenantId: req.tenantId,
      isActive: true,
    });
    const submittedThisWeek = await ShiftPreference.countDocuments({
      tenantId: req.tenantId,
      weekStartDate: weekStart,
    });

    return res.status(200).json({
      stats: {
        pendingPreferences,
        openSwaps,
        totalAssignmentsThisWeek: totalAssignments,
        activeTemplates: templateCount,
        preferenceSubmissionRate:
          totalEmployees > 0
            ? Math.round((submittedThisWeek / totalEmployees) * 100)
            : 0,
        totalActiveEmployees: totalEmployees,
      },
      weekStart,
      weekEnd,
    });
  } catch (error) {
    return next(error);
  }
};
