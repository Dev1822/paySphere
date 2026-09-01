const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-global-4.4');
const {
  haversineDistance,
  processGeofencedPunch,
  enqueueBiometricSync,
  processBiometricSyncEntry,
} = require('../attendanceGateway.service');
const WorkplaceGeofence = require('../../models/workplaceGeofence.model');
const Attendance = require('../../models/attendance.model');
const Employee = require('../../models/employee.model');
const redisConnection = require('../../config/redis');
const eventBus = require('../event.service');

let mongoServer;

jest.mock('../../config/redis', () => {
  return {
    status: 'ready',
    xadd: jest.fn().mockResolvedValue('12345-0'),
  };
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('attendanceGateway.service', () => {
  let tenantId, employeeId;

  beforeEach(async () => {
    await WorkplaceGeofence.deleteMany({});
    await Attendance.deleteMany({});
    await Employee.deleteMany({});

    tenantId = new mongoose.Types.ObjectId();
    
    // Create standard geofence (Paris, e.g. Eiffel Tower coordinates)
    await WorkplaceGeofence.create({
      tenantId,
      name: 'Eiffel Tower HQ',
      latitude: 48.8584,
      longitude: 2.2945,
      radius: 100, // 100 meters
      isActive: true,
    });

    const emp = await Employee.create({
      tenantId,
      name: 'Jane Doe',
      createdBy: new mongoose.Types.ObjectId(),
    });
    employeeId = emp._id;
  });

  describe('haversineDistance', () => {
    it('calculates the correct distance between two points', () => {
      // Distance between Eiffel Tower and Arc de Triomphe is ~2.1 km
      const distance = haversineDistance(48.8584, 2.2945, 48.8738, 2.2950);
      expect(distance).toBeGreaterThan(1600);
      expect(distance).toBeLessThan(2200);
    });
  });

  describe('processGeofencedPunch', () => {
    it('succeeds and records clock-in when inside the geofence radius', async () => {
      // 48.8584, 2.2945 is Eiffel Tower (distance is 0)
      const record = await processGeofencedPunch({
        tenantId,
        employeeId,
        latitude: 48.8584,
        longitude: 2.2945,
        deviceFingerprint: 'fingerprint-123',
      });

      expect(record).toBeDefined();
      const currentDay = record.days.find((d) => d.day === new Date().getDate());
      expect(currentDay).toBeDefined();
      expect(currentDay.sessions).toHaveLength(1);
      expect(currentDay.sessions[0].clockOut).toBeNull();
      expect(currentDay.sessions[0].deviceFingerprint).toBe('fingerprint-123');
    });

    it('rejects punch and triggers GEOFENCE_BREACH audit log when outside the geofence', async () => {
      const auditLogSpy = jest.fn();
      eventBus.on('AUDIT_LOG', auditLogSpy);

      // Punch from Arc de Triomphe (~2km away, outside 100m radius)
      await expect(
        processGeofencedPunch({
          tenantId,
          employeeId,
          latitude: 48.8738,
          longitude: 2.2950,
          deviceFingerprint: 'fingerprint-123',
        })
      ).rejects.toThrow('Punch rejected: outside allowed workplace radius');

      expect(auditLogSpy).toHaveBeenCalledTimes(1);
      expect(auditLogSpy.mock.calls[0][0]).toMatchObject({
        action: 'GEOFENCE_BREACH',
        resourceType: 'Attendance',
        resourceIds: [employeeId],
      });

      eventBus.off('AUDIT_LOG', auditLogSpy);
    });
  });

  describe('enqueueBiometricSync', () => {
    it('enqueues biometric punch logs to Redis Stream', async () => {
      const logs = [{ timestamp: '2026-08-01T09:00:00Z', type: 'IN' }];
      const result = await enqueueBiometricSync({
        tenantId,
        employeeId,
        year: 2026,
        month: 8,
        logs,
      });

      expect(result.success).toBe(true);
      expect(redisConnection.xadd).toHaveBeenCalled();
    });
  });

  describe('processBiometricSyncEntry', () => {
    it('successfully processes popped biometric logs and saves attendance', async () => {
      const logs = [
        { day: 1, clockIn: '2026-08-01T09:00:00.000Z', clockOut: '2026-08-01T17:00:00.000Z' },
      ];

      await processBiometricSyncEntry({
        tenantId,
        employeeId,
        year: 2026,
        month: 8,
        logs,
      });

      const record = await Attendance.findOne({
        employeeId,
        tenantId,
        year: 2026,
        month: 8,
      });

      expect(record).toBeDefined();
      expect(record.totals.present).toBeGreaterThan(0);
    });
  });
});
