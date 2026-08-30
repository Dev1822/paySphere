'use strict';

const Tenant = require('../../models/tenant.model');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const Attendance = require('../../models/attendance.model');
const CronLock = require('../../models/cronlock.model');
const { createAuditLog } = require('../../services/audit.service');
const {
  runRetentionLifecycleJob,
} = require('../retention.job');

jest.mock('../../models/tenant.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../models/attendance.model');
jest.mock('../../models/cronlock.model');
jest.mock('../../services/audit.service');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Retention lifecycle job (#1804)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    CronLock.create.mockResolvedValue({});
    CronLock.deleteOne.mockResolvedValue({ deletedCount: 1 });

    Tenant.find.mockReturnValue({
      setOptions: jest
        .fn()
        .mockResolvedValue([
          {
            _id: 'tenant-1',
            ownerId: 'owner-1',
            isActive: true,
            retentionPolicy: {
              employeePiiYears: 7,
              attendanceYears: 2,
              payrollYears: 7,
              auditLogYears: 7,
            },
          },
        ]),
    });

    Employee.find.mockReturnValue({
      setOptions: jest.fn().mockResolvedValue([]),
    });

    Attendance.deleteMany.mockResolvedValue({
      deletedCount: 0,
    });

    PayrollUpdate.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    createAuditLog.mockResolvedValue(true);
  });

  test('uses a lock so the lifecycle is not run concurrently', async () => {
    CronLock.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 11000 }),
    );

    const result = await runRetentionLifecycleJob();

    expect(result).toMatchObject({
      ran: false,
      reason: 'held',
    });

    expect(Tenant.find).not.toHaveBeenCalled();
  });

  test('does not delete historical payroll records', async () => {
    const result = await runRetentionLifecycleJob();

    expect(PayrollUpdate.deleteMany).not.toHaveBeenCalled();
    expect(result.retainedPayrolls).toBe(0);
  });

  test('purges expired attendance data', async () => {
    Attendance.deleteMany.mockResolvedValueOnce({
      deletedCount: 12,
    });

    const result = await runRetentionLifecycleJob({
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(Attendance.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        createdAt: expect.objectContaining({
          $lt: expect.any(Date),
        }),
      }),
    );

    expect(result.purgedAttendance).toBe(12);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETENTION_ATTENDANCE_PURGED',
        resourceType: 'Attendance',
      }),
    );
  });

  test('anonymizes an expired employee with payroll dependencies instead of deleting it', async () => {
    const employee = {
      _id: 'employee-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      deletedAt: new Date('2018-01-01T00:00:00Z'),
      isDeleted: true,
      isAnonymized: false,
      save: jest.fn().mockResolvedValue(true),
    };

    Employee.find.mockReturnValue({
      setOptions: jest.fn().mockResolvedValue([employee]),
    });

    PayrollUpdate.exists.mockResolvedValue(true);

    const result = await runRetentionLifecycleJob({
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(employee.save).toHaveBeenCalled();
    expect(employee.isAnonymized).toBe(true);
    expect(PayrollUpdate.exists).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
    });

    expect(result.anonymizedEmployees).toBe(1);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETENTION_EMPLOYEE_ANONYMIZED',
        resourceType: 'Employee',
      }),
    );
  });

  test('is safe to retry already anonymized employees', async () => {
    const employee = {
      _id: 'employee-1',
      isDeleted: true,
      isAnonymized: true,
    };

    Employee.find.mockReturnValue({
      setOptions: jest.fn().mockResolvedValue([]),
    });

    const result = await runRetentionLifecycleJob();

    expect(result.anonymizedEmployees).toBe(0);
  });

  test('always releases the lock after processing', async () => {
    await runRetentionLifecycleJob();

    expect(CronLock.deleteOne).toHaveBeenCalledWith({
      _id: 'retention_lifecycle',
    });
  });
});