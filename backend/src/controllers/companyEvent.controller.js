/**
 * @fileoverview Company Event & Social Calendar Controller
 * @description Manages company events with RSVP, check-in tracking, and
 * attendance analytics.  Admins create events; employees RSVP and check in.
 */

const CompanyEvent = require('../models/companyEvent.model');
const EventRSVP = require('../models/eventRSVP.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { sanitizeText } = require('../utils/validators');

// ─── Admin: Create Event ──────────────────────────────────────────────────

exports.createEvent = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      location,
      isVirtual,
      meetingLink,
      startDateTime,
      endDateTime,
      allDay,
      maxAttendees,
      requiresApproval,
      isPublic,
      tags,
      recurrence,
    } = req.body;

    if (!title || !title.trim())
      return res.status(400).json({ message: 'Event title is required' });
    if (!startDateTime)
      return res.status(400).json({ message: 'startDateTime is required' });
    if (!endDateTime)
      return res.status(400).json({ message: 'endDateTime is required' });

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (end <= start) {
      return res
        .status(400)
        .json({ message: 'endDateTime must be after startDateTime' });
    }

    const event = await CompanyEvent.create({
      title: sanitizeText(title),
      description: description ? sanitizeText(description) : '',
      category: category || 'social',
      location: location ? sanitizeText(location) : '',
      isVirtual: isVirtual === true,
      meetingLink: meetingLink || '',
      startDateTime: start,
      endDateTime: end,
      allDay: allDay === true,
      maxAttendees: maxAttendees || undefined,
      requiresApproval: requiresApproval === true,
      isPublic: isPublic !== false,
      tags: tags || [],
      recurrence: recurrence || { frequency: 'none', interval: 1 },
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EVENT_CREATE',
      resourceType: 'CompanyEvent',
      resourceIds: [event._id],
      details: {
        title: event.title,
        category: event.category,
        startDateTime: event.startDateTime,
      },
      req,
    });

    logger.info('Company event created', {
      userId: req.userId,
      eventId: event._id,
    });
    return res.status(201).json({ message: 'Event created', event });
  } catch (error) {
    logger.error('Failed to create event', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin/Employee: List Events ──────────────────────────────────────────

exports.getEvents = async (req, res, next) => {
  try {
    const { category, upcoming, search, month, year } = req.query;
    const filter = {};

    if (category) filter.category = category;

    if (upcoming === 'true') {
      filter.startDateTime = { $gte: new Date() };
    }

    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (m >= 1 && m <= 12 && y >= 2020) {
        const startOfMonth = new Date(y, m - 1, 1);
        const endOfMonth = new Date(y, m, 0, 23, 59, 59);
        filter.startDateTime = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      filter.$or = [
        { title: new RegExp(search.trim(), 'i') },
        { description: new RegExp(search.trim(), 'i') },
      ];
    }

    const events = await CompanyEvent.find(filter)
      .populate('createdBy', 'fullName email')
      .sort({ startDateTime: 1 });

    return res.status(200).json({ events });
  } catch (error) {
    logger.error('Failed to fetch events', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Get Event by ID ──────────────────────────────────────────────────────

exports.getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await CompanyEvent.findOne({
      _id: id
    }).populate('createdBy', 'fullName email');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Get RSVP stats
    const going = await EventRSVP.countDocuments({
      eventId: id,
      status: 'going'
    });
    const maybe = await EventRSVP.countDocuments({
      eventId: id,
      status: 'maybe'
    });
    const notGoing = await EventRSVP.countDocuments({
      eventId: id,
      status: 'not-going'
    });
    const checkedIn = await EventRSVP.countDocuments({
      eventId: id,
      checkedIn: true
    });

    return res.status(200).json({
      event,
      rsvpStats: {
        going,
        maybe,
        notGoing,
        checkedIn,
        totalResponses: going + maybe + notGoing,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch event', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Update Event ──────────────────────────────────────────────────

exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      location,
      isVirtual,
      meetingLink,
      startDateTime,
      endDateTime,
      allDay,
      maxAttendees,
      requiresApproval,
      isPublic,
      tags,
      recurrence,
    } = req.body;

    const event = await CompanyEvent.findOne({
      _id: id
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (title !== undefined) event.title = sanitizeText(title);
    if (description !== undefined)
      event.description = sanitizeText(description);
    if (category !== undefined) event.category = category;
    if (location !== undefined) event.location = sanitizeText(location);
    if (isVirtual !== undefined) event.isVirtual = isVirtual;
    if (meetingLink !== undefined) event.meetingLink = meetingLink;
    if (startDateTime !== undefined)
      event.startDateTime = new Date(startDateTime);
    if (endDateTime !== undefined) event.endDateTime = new Date(endDateTime);
    if (allDay !== undefined) event.allDay = allDay;
    if (maxAttendees !== undefined)
      event.maxAttendees = maxAttendees || undefined;
    if (requiresApproval !== undefined)
      event.requiresApproval = requiresApproval;
    if (isPublic !== undefined) event.isPublic = isPublic;
    if (tags !== undefined) event.tags = tags;
    if (recurrence !== undefined) event.recurrence = recurrence;

    await event.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EVENT_UPDATE',
      resourceType: 'CompanyEvent',
      resourceIds: [event._id],
      details: { title: event.title, changes: Object.keys(req.body) },
      req,
    });

    logger.info('Event updated', { userId: req.userId, eventId: event._id });
    return res.status(200).json({ message: 'Event updated', event });
  } catch (error) {
    logger.error('Failed to update event', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Delete Event ──────────────────────────────────────────────────

exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await CompanyEvent.findOneAndDelete({
      _id: id
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Clean up RSVPs
    await EventRSVP.deleteMany({
      eventId: id
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EVENT_DELETE',
      resourceType: 'CompanyEvent',
      resourceIds: [event._id],
      details: { title: event.title },
      req,
    });

    logger.info('Event deleted', { userId: req.userId, eventId: event._id });
    return res.status(200).json({ message: 'Event deleted' });
  } catch (error) {
    logger.error('Failed to delete event', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: RSVP to Event ──────────────────────────────────────────────

exports.rsvp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const validStatuses = ['going', 'maybe', 'not-going'];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
    }

    const event = await CompanyEvent.findOne({
      _id: id
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check max capacity
    if (status === 'going' && event.maxAttendees) {
      const currentGoing = await EventRSVP.countDocuments({
        eventId: id,
        status: 'going'
      });
      const alreadyGoing = await EventRSVP.findOne({
        eventId: id,
        employeeId: req.userId,
        status: 'going'
      });
      if (!alreadyGoing && currentGoing >= event.maxAttendees) {
        return res
          .status(409)
          .json({ message: 'Event has reached maximum capacity' });
      }
    }

    // Find employee
    const employee = await Employee.findOne({
      createdBy: req.userId
    });
    if (!employee)
      return res.status(404).json({ message: 'No employee record found' });

    const rsvp = await EventRSVP.findOneAndUpdate(
      {
        eventId: id,
        employeeId: employee._id
      },
      { status, note: note ? sanitizeText(note) : '', respondedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EVENT_RSVP',
      resourceType: 'EventRSVP',
      resourceIds: [rsvp._id],
      details: { eventId: id, eventTitle: event.title, status },
      req,
    });

    logger.info('Event RSVP', { userId: req.userId, eventId: id, status });
    return res.status(200).json({ message: `RSVP recorded: ${status}`, rsvp });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Already RSVPed' });
    }
    logger.error('Failed to RSVP', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: Check In to Event ──────────────────────────────────────────

exports.checkIn = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await CompanyEvent.findOne({
      _id: id
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const employee = await Employee.findOne({
      createdBy: req.userId
    });
    if (!employee)
      return res.status(404).json({ message: 'No employee record found' });

    const rsvp = await EventRSVP.findOne({
      eventId: id,
      employeeId: employee._id
    });

    if (!rsvp || rsvp.status === 'not-going') {
      return res
        .status(400)
        .json({ message: 'You must RSVP as going before checking in' });
    }

    if (rsvp.checkedIn) {
      return res.status(409).json({ message: 'Already checked in' });
    }

    rsvp.checkedIn = true;
    rsvp.checkedInAt = new Date();
    await rsvp.save();

    logger.info('Event check-in', { userId: req.userId, eventId: id });
    return res.status(200).json({ message: 'Checked in successfully', rsvp });
  } catch (error) {
    logger.error('Failed to check in', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: My RSVPs ───────────────────────────────────────────────────

exports.getMyRSVPs = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      createdBy: req.userId
    });
    if (!employee) return res.status(200).json({ rsvps: [] });

    const rsvps = await EventRSVP.find({
      employeeId: employee._id
    })
      .populate({
        path: 'eventId',
        select: 'title category startDateTime endDateTime location isVirtual',
      })
      .sort({ respondedAt: -1 });

    return res.status(200).json({ rsvps });
  } catch (error) {
    logger.error('Failed to fetch my RSVPs', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Event Attendance List ─────────────────────────────────────────

exports.getEventAttendees = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const filter = {
      eventId: id
    };
    if (status) filter.status = status;

    const rsvps = await EventRSVP.find(filter)
      .populate('employeeId', 'fullName department role email')
      .sort({ respondedAt: 1 });

    return res.status(200).json({ attendees: rsvps });
  } catch (error) {
    logger.error('Failed to fetch attendees', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Event Analytics ───────────────────────────────────────────────

exports.getEventAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await CompanyEvent.findOne({
      _id: id
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const rsvps = await EventRSVP.find({
      eventId: id
    });
    const going = rsvps.filter((r) => r.status === 'going').length;
    const maybe = rsvps.filter((r) => r.status === 'maybe').length;
    const notGoing = rsvps.filter((r) => r.status === 'not-going').length;
    const checkedIn = rsvps.filter((r) => r.checkedIn).length;
    const noShow = going - checkedIn;

    // Department breakdown
    const deptMap = {};
    for (const r of rsvps) {
      const dept = r.employeeId?.department || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { going: 0, maybe: 0, notGoing: 0 };
      deptMap[dept][r.status]++;
    }

    return res.status(200).json({
      eventId: id,
      title: event.title,
      stats: {
        going,
        maybe,
        notGoing,
        checkedIn,
        noShow,
        totalResponses: going + maybe + notGoing,
      },
      byDepartment: deptMap,
    });
  } catch (error) {
    logger.error('Failed to fetch event analytics', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};
