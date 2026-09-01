/**
 * @fileoverview Holiday Calendar Controller
 * @description Manages company holiday calendars and individual holidays.
 * Supports global, department-level, and location-level calendars.
 * Employees can view calendars assigned to them; admins manage everything.
 */

const HolidayCalendar = require('../models/holidayCalendar.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { sanitizeText } = require('../utils/validators');

// ─── Admin: Create Calendar ───────────────────────────────────────────────

exports.createCalendar = async (req, res, next) => {
  try {
    const { name, assignmentType, assignedTo } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Calendar name is required' });
    }

    const validTypes = ['global', 'department', 'location'];
    const type = assignmentType || 'global';
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: `Invalid assignment type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (
      type !== 'global' &&
      (!assignedTo || !Array.isArray(assignedTo) || assignedTo.length === 0)
    ) {
      return res.status(400).json({
        message: `assignedTo is required for ${type} calendars`,
      });
    }

    const calendar = await HolidayCalendar.create({
      name: sanitizeText(name),
      assignmentType: type,
      assignedTo: type === 'global' ? [] : assignedTo,
      holidays: [],
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CALENDAR_CREATE',
      resourceType: 'HolidayCalendar',
      resourceIds: [calendar._id],
      details: { name: calendar.name, assignmentType: calendar.assignmentType },
      req,
    });

    logger.info('Holiday calendar created', {
      userId: req.userId,
      calendarId: calendar._id,
    });
    return res.status(201).json({ message: 'Calendar created', calendar });
  } catch (error) {
    logger.error('Failed to create calendar', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: List Calendars ────────────────────────────────────────────────

exports.getCalendars = async (req, res, next) => {
  try {
    const { assignmentType, search } = req.query;
    const filter = {};

    if (assignmentType) filter.assignmentType = assignmentType;
    if (search && typeof search === 'string' && search.trim()) {
      filter.name = new RegExp(search.trim(), 'i');
    }

    const calendars = await HolidayCalendar.find(filter)
      .populate('createdBy', 'fullName email')
      .sort({ name: 1 });

    return res.status(200).json({ calendars });
  } catch (error) {
    logger.error('Failed to fetch calendars', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin/Employee: Get Calendar by ID ───────────────────────────────────

exports.getCalendarById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const calendar = await HolidayCalendar.findOne({
      _id: id
    }).populate('createdBy', 'fullName email');

    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found' });
    }

    return res.status(200).json({ calendar });
  } catch (error) {
    logger.error('Failed to fetch calendar', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Update Calendar Metadata ──────────────────────────────────────

exports.updateCalendar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, assignmentType, assignedTo } = req.body;

    const calendar = await HolidayCalendar.findOne({
      _id: id
    });
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found' });
    }

    if (name !== undefined) calendar.name = sanitizeText(name);
    if (assignmentType !== undefined) {
      const validTypes = ['global', 'department', 'location'];
      if (!validTypes.includes(assignmentType)) {
        return res.status(400).json({ message: 'Invalid assignment type' });
      }
      calendar.assignmentType = assignmentType;
    }
    if (assignedTo !== undefined) {
      calendar.assignedTo = Array.isArray(assignedTo) ? assignedTo : [];
    }

    await calendar.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CALENDAR_UPDATE',
      resourceType: 'HolidayCalendar',
      resourceIds: [calendar._id],
      details: { name: calendar.name, changes: Object.keys(req.body) },
      req,
    });

    logger.info('Calendar updated', {
      userId: req.userId,
      calendarId: calendar._id,
    });
    return res.status(200).json({ message: 'Calendar updated', calendar });
  } catch (error) {
    logger.error('Failed to update calendar', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Delete Calendar ───────────────────────────────────────────────

exports.deleteCalendar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const calendar = await HolidayCalendar.findOneAndDelete({
      _id: id
    });

    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CALENDAR_DELETE',
      resourceType: 'HolidayCalendar',
      resourceIds: [calendar._id],
      details: { name: calendar.name },
      req,
    });

    logger.info('Calendar deleted', {
      userId: req.userId,
      calendarId: calendar._id,
    });
    return res.status(200).json({ message: 'Calendar deleted' });
  } catch (error) {
    logger.error('Failed to delete calendar', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Add Holiday to Calendar ───────────────────────────────────────

exports.addHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, name, type } = req.body;

    if (!date)
      return res.status(400).json({ message: 'Holiday date is required' });
    if (!name || !name.trim())
      return res.status(400).json({ message: 'Holiday name is required' });

    const validTypes = ['gazetted', 'restricted', 'half-day'];
    if (type && !validTypes.includes(type)) {
      return res
        .status(400)
        .json({
          message: `Invalid holiday type. Must be one of: ${validTypes.join(', ')}`,
        });
    }

    const calendar = await HolidayCalendar.findOne({
      _id: id
    });
    if (!calendar)
      return res.status(404).json({ message: 'Calendar not found' });

    // Check for duplicate holiday on the same date
    const holidayDate = new Date(date);
    const duplicate = calendar.holidays.find(
      (h) =>
        h.date.toISOString().split('T')[0] ===
        holidayDate.toISOString().split('T')[0],
    );
    if (duplicate) {
      return res
        .status(409)
        .json({
          message: `A holiday already exists on ${holidayDate.toISOString().split('T')[0]}`,
        });
    }

    calendar.holidays.push({
      date: holidayDate,
      name: sanitizeText(name),
      type: type || 'gazetted',
    });
    await calendar.save();

    const addedHoliday = calendar.holidays[calendar.holidays.length - 1];

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'HOLIDAY_ADD',
      resourceType: 'HolidayCalendar',
      resourceIds: [calendar._id],
      details: { calendarName: calendar.name, holidayName: name, date },
      req,
    });

    logger.info('Holiday added', {
      userId: req.userId,
      calendarId: calendar._id,
      holidayName: name,
    });
    return res
      .status(201)
      .json({ message: 'Holiday added', holiday: addedHoliday });
  } catch (error) {
    logger.error('Failed to add holiday', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Remove Holiday from Calendar ──────────────────────────────────

exports.removeHoliday = async (req, res, next) => {
  try {
    const { id, holidayId } = req.params;

    const calendar = await HolidayCalendar.findOne({
      _id: id
    });
    if (!calendar)
      return res.status(404).json({ message: 'Calendar not found' });

    const holidayIndex = calendar.holidays.findIndex(
      (h) => h._id.toString() === holidayId,
    );
    if (holidayIndex === -1) {
      return res
        .status(404)
        .json({ message: 'Holiday not found in this calendar' });
    }

    const removed = calendar.holidays.splice(holidayIndex, 1)[0];
    await calendar.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'HOLIDAY_REMOVE',
      resourceType: 'HolidayCalendar',
      resourceIds: [calendar._id],
      details: {
        calendarName: calendar.name,
        holidayName: removed.name,
        date: removed.date,
      },
      req,
    });

    logger.info('Holiday removed', {
      userId: req.userId,
      calendarId: calendar._id,
      holidayName: removed.name,
    });
    return res.status(200).json({ message: 'Holiday removed' });
  } catch (error) {
    logger.error('Failed to remove holiday', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: Get Upcoming Holidays ──────────────────────────────────────

exports.getUpcomingHolidays = async (req, res, next) => {
  try {
    const now = new Date();

    // Find global calendars and calendars assigned to this employee's department
    const employee = await Employee.findOne({
      createdBy: req.userId
    });

    const calendars = await HolidayCalendar.find({
      $or: [
        { assignmentType: 'global' },
        ...(employee?.department
          ? [
              {
                assignmentType: 'department',
                assignedTo: { $in: [employee.department] },
              },
            ]
          : []),
      ]
    }).sort({ name: 1 });

    // Flatten and filter upcoming holidays
    const upcoming = [];
    for (const cal of calendars) {
      for (const h of cal.holidays) {
        if (new Date(h.date) >= now) {
          upcoming.push({
            calendarId: cal._id,
            calendarName: cal.name,
            _id: h._id,
            date: h.date,
            name: h.name,
            type: h.type,
          });
        }
      }
    }

    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({ holidays: upcoming.slice(0, 20) });
  } catch (error) {
    logger.error('Failed to fetch upcoming holidays', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: Holidays in a Date Range ───────────────────────────────────

exports.getHolidaysInRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: 'startDate and endDate query params are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const calendars = await HolidayCalendar.find({
      assignmentType: 'global'
    });

    const holidays = [];
    for (const cal of calendars) {
      for (const h of cal.holidays) {
        const hDate = new Date(h.date);
        if (hDate >= start && hDate <= end) {
          holidays.push({
            calendarName: cal.name,
            _id: h._id,
            date: h.date,
            name: h.name,
            type: h.type,
          });
        }
      }
    }

    holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    return res.status(200).json({ holidays });
  } catch (error) {
    logger.error('Failed to fetch holidays in range', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Holiday Summary Stats ─────────────────────────────────────────

exports.getHolidayStats = async (req, res, next) => {
  try {
    const calendars = await HolidayCalendar.find({});

    let totalHolidays = 0;
    let gazetted = 0;
    let restricted = 0;
    let halfDay = 0;

    for (const cal of calendars) {
      for (const h of cal.holidays) {
        totalHolidays++;
        if (h.type === 'gazetted') gazetted++;
        else if (h.type === 'restricted') restricted++;
        else if (h.type === 'half-day') halfDay++;
      }
    }

    return res.status(200).json({
      totalCalendars: calendars.length,
      totalHolidays,
      byType: { gazetted, restricted, 'half-day': halfDay },
    });
  } catch (error) {
    logger.error('Failed to fetch holiday stats', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};
