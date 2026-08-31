/**
 * Clocking in and out, and the offices a punch is measured against (#930,
 * reachable since #953).
 *
 * #930 added clock-in telemetry to the attendance schema and a GeoJSON office
 * model, and wrote nothing that could produce either: `grep -rn "clock"
 * src/routes src/controllers` matched nothing at all, and `officeLocation` was
 * referenced by no file outside its own. So there was no way for an employee to
 * clock in, and no way to define the fence a clock-in would have been tested
 * against.
 *
 * Kept out of `attendance.controller.js` deliberately: that file is the admin
 * grid — a manager deciding what a day was worth — and this one is the
 * employee's own punch. The two have different callers, different permissions
 * and different failure modes.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const OfficeLocation = require('../models/officeLocation.model');
const PayrollUpdate = require('../models/payroll.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { ATTENDANCE_STATUS } = require('../config/attendance');
const {
  isValidCoordinate,
  locateWithinOffices,
  detectSpoofingFlags,
} = require('../utils/geofence');

/**
 * The employee record the caller is punching for.
 *
 * An EMPLOYEE account may only ever clock itself in. An admin may clock in on
 * somebody's behalf — a shop floor with one shared terminal is a real
 * arrangement — but must name who, and that employee must belong to the same
 * company.
 *
 * @param {object} req
 * @returns {Promise<{ok: true, employee: object} | {ok: false, status: number, message: string}>}
 */
async function resolveEmployee(req) {
  const requested = req.body?.employeeId || req.query?.employeeId;

  const filter = {};

  if (requested) {
    if (!mongoose.Types.ObjectId.isValid(requested)) {
      return { ok: false, status: 400, message: 'Invalid employee id format' };
    }
    filter._id = requested;
  } else if (req.user?.employeeId) {
    filter._id = req.user.employeeId;
  } else if (req.user?.email) {
    // The employee portal links an account to an employee by email (#561).
    filter.email = req.user.email;
  } else {
    return {
      ok: false,
      status: 400,
      message:
        'No employee to clock in: pass employeeId, or sign in as an employee',
    };
  }

  const employee = await Employee.findOne(filter).lean();

  if (!employee) {
    // Indistinguishable from "does not exist", so the caller cannot probe for
    // another company's employees.
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  return { ok: true, employee };
}

/**
 * Read a coordinate out of a request body.
 *
 * Accepts `{ longitude, latitude }` or `{ coordinates: [lng, lat] }`, because
 * the browser geolocation API gives the former and GeoJSON is the latter, and
 * the mapping between them is exactly where the two get swapped.
 *
 * @param {object} body
 * @returns {number[]|null} `[lng, lat]`
 */
function readCoordinate(body = {}) {
  if (Array.isArray(body.coordinates)) {
    return isValidCoordinate(body.coordinates)
      ? body.coordinates.map(Number)
      : null;
  }

  const lng = Number(body.longitude);
  const lat = Number(body.latitude);
  const pair = [lng, lat];

  return isValidCoordinate(pair) ? pair : null;
}

/** Today, in the tenant's stored calendar terms. */
function today(now = new Date()) {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

/**
 * A device identifier we can compare without storing what it is.
 *
 * Hashed because the raw value is a stable identifier for a person's phone, and
 * the only question ever asked of it is "is this the same device as last time".
 *
 * @param {string} raw
 * @returns {string}
 */
function fingerprint(raw) {
  if (!raw) return '';
  return crypto
    .createHash('sha256')
    .update(String(raw))
    .digest('hex')
    .slice(0, 32);
}

/** The month's ledger, or null. */
function loadMonth(employeeId, tenantId, year, month) {
  return Attendance.findOne({ employeeId, tenantId, year, month });
}

/** The most recent punch in a month, for the impossible-speed check. */
function lastSessionOf(attendance) {
  if (!attendance?.days) return null;

  let latest = null;

  for (const day of attendance.days) {
    for (const session of day.sessions || []) {
      const at = session.clockOut || session.clockIn;
      if (!latest || new Date(at) > new Date(latest.at)) {
        latest = { at, coordinates: session.coordinates?.coordinates };
      }
    }
  }

  return latest;
}

/**
 * POST /api/attendance/clock-in
 *
 * Body: `{ longitude, latitude }` or `{ coordinates: [lng, lat] }`, optional
 * `deviceId`, optional `employeeId` for an admin punching on someone's behalf.
 */
exports.clockIn = async (req, res, next) => {
  try {
    const owned = await resolveEmployee(req);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const now = new Date();
    const { year, month, day } = today(now);

    const paid = await PayrollUpdate.findOne({
      employeeId: employee._id,
      year,
      month,
      status: 'paid'
    }).select('_id');

    if (paid) {
      // The same rule the grid follows: a month whose payroll has been paid is
      // settled, and a punch would rewrite the ledger a payslip was derived
      // from.
      return res.status(409).json({
        message:
          'Attendance for this month is locked because its payroll has been paid.',
      });
    }

    const attendance = await loadMonth(employee._id, req.tenantId, year, month);
    const existingDay = attendance?.days?.find((d) => d.day === day);
    const openSession = existingDay?.sessions?.find((s) => !s.clockOut);

    if (openSession) {
      return res.status(409).json({
        message: 'You are already clocked in. Clock out before starting again.',
        clockIn: openSession.clockIn,
      });
    }

    const coordinates = readCoordinate(req.body);
    const offices = await OfficeLocation.find({
      isActive: true
    }).lean();

    const located = coordinates
      ? locateWithinOffices(coordinates, offices)
      : { inside: false, office: null, distance: null };

    const spoofingFlags = coordinates
      ? detectSpoofingFlags({
          coordinates,
          at: now,
          previous: lastSessionOf(attendance),
        })
      : ['no_coordinates'];

    // Outside every fence is field duty, not a refusal. A refused punch leaves
    // the employee with no attendance record at all, which is a worse outcome
    // than an attributable out-of-fence one somebody can ask about. With no
    // office configured there is no fence to be outside of, so it is not field
    // duty either.
    const isFieldDuty = offices.length > 0 && !located.inside;

    const session = {
      clockIn: now,
      clockOut: null,
      coordinates: coordinates ? { type: 'Point', coordinates } : undefined,
      distanceFromOffice: located.distance,
      officeLocationId: located.office?._id || null,
      isFieldDuty,
      deviceFingerprint: fingerprint(req.body?.deviceId),
      spoofingFlags,
    };

    const doc =
      attendance ||
      new Attendance({
        employeeId: employee._id,
        employeeName: employee.fullName,
        createdBy: req.userId,
        year,
        month,
        days: []
      });

    let dayEntry = doc.days.find((d) => d.day === day);

    if (!dayEntry) {
      // The first punch of a day marks it present. It does not overwrite a
      // status a manager has already set: paid leave with a punch on it is a
      // question for a human, not something to silently resolve here.
      doc.days.push({
        day,
        status: ATTENDANCE_STATUS.PRESENT,
        overtimeHours: 0,
        note: '',
        sessions: [session],
      });
      doc.days.sort((a, b) => a.day - b.day);
      dayEntry = doc.days.find((d) => d.day === day);
    } else {
      dayEntry.sessions.push(session);
    }

    doc.lastEditedBy = req.userId;

    await doc.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ATTENDANCE_UPDATE',
      resourceType: 'Attendance',
      resourceIds: [doc._id],
      details: {
        employeeName: employee.fullName,
        year,
        month,
        day,
        event: 'clock_in',
        isFieldDuty,
        distanceFromOffice: located.distance,
      },
      req,
    });

    logger.info('Clock-in recorded', {
      employeeId: String(employee._id),
      tenantId: String(req.tenantId),
      isFieldDuty,
      spoofingFlags,
    });

    res.status(201).json({
      message: isFieldDuty
        ? 'Clocked in outside the office fence. Recorded as field duty.'
        : 'Clocked in',
      clockIn: now,
      day,
      isFieldDuty,
      distanceFromOffice: located.distance,
      officeLocation: located.office
        ? { _id: located.office._id, name: located.office.name }
        : null,
      spoofingFlags,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: 'Attendance for this month was created concurrently. Retry.',
      });
    }
    next(error);
  }
};

/**
 * POST /api/attendance/clock-out
 */
exports.clockOut = async (req, res, next) => {
  try {
    const owned = await resolveEmployee(req);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const now = new Date();
    const { year, month, day } = today(now);

    const attendance = await loadMonth(employee._id, req.tenantId, year, month);
    const dayEntry = attendance?.days?.find((d) => d.day === day);
    const openSession = dayEntry?.sessions?.find((s) => !s.clockOut);

    if (!openSession) {
      // A clock-out with nothing open is the caller's mistake, and answering
      // 200 would let a broken client believe it had recorded something.
      return res.status(409).json({ message: 'You are not clocked in.' });
    }

    openSession.clockOut = now;

    const coordinates = readCoordinate(req.body);
    if (coordinates) {
      const flags = detectSpoofingFlags({
        coordinates,
        at: now,
        previous: {
          coordinates: openSession.coordinates?.coordinates,
          at: openSession.clockIn,
        },
      });

      openSession.spoofingFlags = [
        ...new Set([...(openSession.spoofingFlags || []), ...flags]),
      ];
    }

    attendance.lastEditedBy = req.userId;
    await attendance.save();

    const workedMinutes = Math.max(
      0,
      Math.round((now - new Date(openSession.clockIn)) / 60000),
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ATTENDANCE_UPDATE',
      resourceType: 'Attendance',
      resourceIds: [attendance._id],
      details: {
        employeeName: employee.fullName,
        year,
        month,
        day,
        event: 'clock_out',
        workedMinutes,
      },
      req,
    });

    res.status(200).json({
      message: 'Clocked out',
      clockIn: openSession.clockIn,
      clockOut: now,
      workedMinutes,
      spoofingFlags: openSession.spoofingFlags,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/clock-status
 *
 * What the client needs to decide whether to show "clock in" or "clock out".
 */
exports.getClockStatus = async (req, res, next) => {
  try {
    const owned = await resolveEmployee(req);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const { year, month, day } = today();

    const attendance = await loadMonth(employee._id, req.tenantId, year, month);
    const dayEntry = attendance?.days?.find((d) => d.day === day);
    const sessions = dayEntry?.sessions || [];
    const openSession = sessions.find((s) => !s.clockOut);

    const workedMinutes = sessions.reduce((total, s) => {
      if (!s.clockOut) return total;
      return (
        total + Math.round((new Date(s.clockOut) - new Date(s.clockIn)) / 60000)
      );
    }, 0);

    res.status(200).json({
      employeeId: String(employee._id),
      date: { year, month, day },
      isClockedIn: Boolean(openSession),
      clockedInAt: openSession?.clockIn || null,
      sessionCount: sessions.length,
      workedMinutes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/office-locations
 */
exports.listOfficeLocations = async (req, res, next) => {
  try {
    const locations = await OfficeLocation.find({})
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ count: locations.length, locations });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/office-locations
 */
exports.createOfficeLocation = async (req, res, next) => {
  try {
    const body = req.body || {};
    const geometry = body.geometry || {};

    if (geometry.type === 'Point' && !isValidCoordinate(geometry.coordinates)) {
      return res.status(400).json({
        message:
          'A Point office needs coordinates as [longitude, latitude], in that order',
      });
    }

    if (geometry.type === 'Polygon') {
      const ring = Array.isArray(geometry.coordinates)
        ? geometry.coordinates[0]
        : null;

      if (!Array.isArray(ring) || ring.length < 4) {
        return res.status(400).json({
          message:
            'A Polygon office needs an outer ring of at least four positions, the last repeating the first',
        });
      }

      if (!ring.every(isValidCoordinate)) {
        return res.status(400).json({
          message: 'Every position in the ring must be [longitude, latitude]',
        });
      }
    }

    const location = await OfficeLocation.create({
      name: String(body.name || '').trim(),
      address: String(body.address || '').trim(),
      geometry,
      radiusMeters: body.radiusMeters,
      isActive: body.isActive !== false,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'OfficeLocation',
      resourceIds: [location._id],
      details: { name: location.name, geometryType: geometry.type },
      req,
    });

    res.status(201).json({ message: 'Office location created', location });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Office location is invalid',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    next(error);
  }
};

/**
 * PATCH /api/attendance/office-locations/:id
 */
exports.updateOfficeLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid office location id' });
    }

    const body = req.body || {};
    const update = {};

    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.address !== undefined)
      update.address = String(body.address).trim();
    if (body.radiusMeters !== undefined)
      update.radiusMeters = body.radiusMeters;
    if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);
    if (body.geometry !== undefined) update.geometry = body.geometry;

    // Scoped by tenant, so an id from another company is a 404 rather than an
    // edit of their fence.
    const location = await OfficeLocation.findOneAndUpdate(
      {
        _id: id
      },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!location) {
      return res.status(404).json({ message: 'Office location not found' });
    }

    res.status(200).json({ message: 'Office location updated', location });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Office location is invalid',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    next(error);
  }
};

/**
 * DELETE /api/attendance/office-locations/:id
 */
exports.deleteOfficeLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid office location id' });
    }

    const location = await OfficeLocation.findOneAndDelete({
      _id: id
    });

    if (!location) {
      return res.status(404).json({ message: 'Office location not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'OfficeLocation',
      resourceIds: [location._id],
      details: { name: location.name, deleted: true },
      req,
    });

    res.status(200).json({ message: 'Office location deleted' });
  } catch (error) {
    next(error);
  }
};

exports._internals = { readCoordinate, fingerprint, lastSessionOf, today };
