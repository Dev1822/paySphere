const mongoose = require('mongoose');
const WorkplaceGeofence = require('../models/workplaceGeofence.model');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const { buildDefaultGrid, parseBiometricLogs, validateGrid, computeTotals } = require('../utils/attendanceGrid');
const redisConnection = require('../config/redis');
const eventBus = require('./event.service');
const logger = require('../utils/logger');

/**
 * Calculates the Haversine distance in meters between two coordinates.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Process a geofenced clock-in or clock-out request.
 */
async function processGeofencedPunch({ tenantId, employeeId, latitude, longitude, deviceFingerprint, userId }) {
  const employee = await Employee.findOne({ _id: employeeId, tenantId });
  if (!employee) {
    throw new Error('Employee not found');
  }

  // 1. Check geofences
  const geofences = await WorkplaceGeofence.find({ tenantId, isActive: true }).lean();
  let matchedGeofence = null;
  let minDistance = Infinity;

  for (const fence of geofences) {
    const dist = haversineDistance(latitude, longitude, fence.latitude, fence.longitude);
    if (dist < minDistance) {
      minDistance = dist;
    }
    if (dist <= fence.radius) {
      matchedGeofence = fence;
      break;
    }
  }

  if (!matchedGeofence) {
    // Log Geofence Breach Event
    eventBus.emit('AUDIT_LOG', {
      userId: userId || employeeId,
      action: 'GEOFENCE_BREACH',
      resourceType: 'Attendance',
      resourceIds: [employeeId],
      details: {
        latitude,
        longitude,
        minDistance: minDistance === Infinity ? null : minDistance,
        employeeId,
      },
    });

    const error = new Error('Punch rejected: outside allowed workplace radius');
    error.status = 400;
    throw error;
  }

  // 2. Punch clock session
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dayNum = now.getDate();

  let record = await Attendance.findOne({
    employeeId,
    tenantId,
    year,
    month,
  });

  if (!record) {
    record = new Attendance({
      employeeId,
      employeeName: employee.name || 'Unknown',
      createdBy: userId || employeeId,
      tenantId,
      year,
      month,
      days: buildDefaultGrid(year, month),
    });
  }

  // Find target day in calendar
  let targetDay = record.days.find((d) => d.day === dayNum);
  if (!targetDay) {
    targetDay = { day: dayNum, status: 'PRESENT', overtimeHours: 0, note: '', sessions: [] };
    record.days.push(targetDay);
  }

  // Check if there is an active session (clockOut is null)
  let activeSession = targetDay.sessions.find((s) => s.clockOut === null);

  if (activeSession) {
    activeSession.clockOut = now;
  } else {
    targetDay.sessions.push({
      clockIn: now,
      clockOut: null,
      coordinates: { type: 'Point', coordinates: [longitude, latitude] },
      distanceFromOffice: minDistance,
      officeLocationId: matchedGeofence._id,
      isFieldDuty: false,
      deviceFingerprint: deviceFingerprint || '',
      spoofingFlags: [],
    });
  }

  // Recompute totals
  record.totals = computeTotals(record.days);
  await record.save();

  return record;
}

/**
 * Enqueue biometric sync payload to Redis Stream
 */
async function enqueueBiometricSync({ tenantId, employeeId, year, month, logs }) {
  if (!redisConnection || redisConnection.status !== 'ready') {
    throw new Error('Redis is not connected. Biometric streams require Redis.');
  }

  const payload = [
    'tenantId', String(tenantId),
    'employeeId', String(employeeId),
    'year', String(year),
    'month', String(month),
    'logs', JSON.stringify(logs),
  ];

  const id = await redisConnection.xadd('biometric_stream', '*', ...payload);
  return { success: true, jobId: id };
}

/**
 * Process a single popped biometric stream entry
 */
async function processBiometricSyncEntry({ tenantId, employeeId, year, month, logs }) {
  const employee = await Employee.findOne({ _id: employeeId, tenantId });
  if (!employee) {
    logger.warn(`Biometric sync target employee ${employeeId} not found`);
    return;
  }

  const parsedDays = parseBiometricLogs(logs, year, month);
  const validated = validateGrid(parsedDays, year, month);
  if (!validated.ok) {
    logger.error('Biometric log validation failed', { errors: validated.errors });
    return;
  }

  const totals = computeTotals(validated.days);

  let record = await Attendance.findOne({
    employeeId,
    tenantId,
    year,
    month,
  });

  if (!record) {
    record = new Attendance({
      employeeId,
      employeeName: employee.name || 'Unknown',
      createdBy: employeeId,
      tenantId,
      year,
      month,
      days: validated.days,
      totals,
    });
  } else {
    record.days = validated.days;
    record.totals = totals;
  }

  await record.save();
  logger.info(`Processed biometric sync for employee ${employeeId} (${year}-${month})`);
}

/**
 * Global Redis stream consumer loop
 */
let consumerRunning = false;
async function startStreamConsumer() {
  if (consumerRunning) return;
  if (!redisConnection || redisConnection.status !== 'ready') {
    logger.warn('Skipping biometric stream consumer: Redis is not connected.');
    return;
  }

  consumerRunning = true;
  logger.info('Biometric stream consumer loop started.');

  let lastId = '0-0'; // Ensure we process all historical unacknowledged logs

  // Execute asynchronously
  (async () => {
    while (consumerRunning) {
      try {
        const streams = await redisConnection.xread('BLOCK', 5000, 'STREAMS', 'biometric_stream', lastId);
        if (streams && streams.length > 0) {
          const [streamName, messages] = streams[0];
          for (const [id, fields] of messages) {
            const data = {};
            for (let i = 0; i < fields.length; i += 2) {
              data[fields[i]] = fields[i + 1];
            }

            // Unpack logs from JSON string
            if (data.logs) {
              data.logs = JSON.parse(data.logs);
            }

            await processBiometricSyncEntry({
              tenantId: data.tenantId,
              employeeId: data.employeeId,
              year: Number(data.year),
              month: Number(data.month),
              logs: data.logs,
            });

            lastId = id;
          }
        }
      } catch (err) {
        logger.error('Biometric stream consumer error:', { error: err.message });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  })();
}

function stopStreamConsumer() {
  consumerRunning = false;
}

module.exports = {
  haversineDistance,
  processGeofencedPunch,
  enqueueBiometricSync,
  processBiometricSyncEntry,
  startStreamConsumer,
  stopStreamConsumer,
};
