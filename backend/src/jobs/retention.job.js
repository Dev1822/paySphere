'use strict';

const Tenant = require('../models/tenant.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const Attendance = require('../models/attendance.model');
const CronLock = require('../models/cronlock.model');
const { anonymizeEmployeePII } = require('../utils/retentionPolicy');
const { createAuditLog } = require('../services/audit.service');
const logger = require('../utils/logger');

const LOCK_ID = 'retention_lifecycle';
const LOCK_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_POLICY = {
  employeePiiYears: 7,
  attendanceYears: 2,
  payrollYears: 7,
  auditLogYears: 7,
};

function normalizePolicy(policy = {}) {
  return {
    employeePiiYears:
      Number(policy.employeePiiYears) || DEFAULT_POLICY.employeePiiYears,
    attendanceYears:
      Number(policy.attendanceYears) || DEFAULT_POLICY.attendanceYears,
    payrollYears:
      Number(policy.payrollYears) || DEFAULT_POLICY.payrollYears,
    auditLogYears:
      Number(policy.auditLogYears) || DEFAULT_POLICY.auditLogYears,
  };
}

function cutoffForYears(years, now) {
  return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);
}

async function acquireRetentionLock() {
  try {
    await CronLock.create({
      _id: LOCK_ID,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS),
    });

    return true;
  } catch (error) {
    if (error.code === 11000) return false;

    logger.error('Failed to acquire retention lifecycle lock', {
      error: error.message,
    });

    return false;
  }
}

async function releaseRetentionLock() {
  try {
    await CronLock.deleteOne({ _id: LOCK_ID });
  } catch (error) {
    logger.warn('Failed to release retention lifecycle lock', {
      error: error.message,
    });
  }
}

async function auditRetentionAction({
  tenantId,
  userId,
  action,
  resourceType,
  resourceIds,
  details,
}) {
  await createAuditLog({
    tenantId,
    userId,
    action,
    resourceType,
    resourceIds,
    details: {
      ...details,
      retentionJob: true,
    },
  });
}

async function processTenantRetention(tenant, now) {
  const policy = normalizePolicy(tenant.retentionPolicy);
  const employeeCutoff = cutoffForYears(policy.employeePiiYears, now);
  const attendanceCutoff = cutoffForYears(policy.attendanceYears, now);

  let anonymizedEmployees = 0;
  let purgedAttendance = 0;
  let retainedPayrolls = 0;

  const archivedEmployees = await Employee.find({
    tenantId: tenant._id,
    isDeleted: true,
    deletedAt: { $lte: employeeCutoff },
    isAnonymized: { $ne: true },
  }).setOptions({ includeDeleted: true });

  for (const employee of archivedEmployees) {
    const payrollExists = await PayrollUpdate.exists({
      tenantId: tenant._id,
      employeeId: employee._id,
    });

    const anonymizedFields = anonymizeEmployeePII(employee);

    Object.assign(employee, anonymizedFields);
    await employee.save();

    anonymizedEmployees += 1;

    await auditRetentionAction({
      tenantId: tenant._id,
      userId: tenant.ownerId,
      action: 'RETENTION_EMPLOYEE_ANONYMIZED',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        reason: 'Employee PII retention period expired',
        retentionYears: policy.employeePiiYears,
        payrollDependency: Boolean(payrollExists),
      },
    });
  }

  const attendanceResult = await Attendance.deleteMany({
    tenantId: tenant._id,
    createdAt: { $lt: attendanceCutoff },
  });

  purgedAttendance = attendanceResult.deletedCount || 0;

  if (purgedAttendance > 0) {
    await auditRetentionAction({
      tenantId: tenant._id,
      userId: tenant.ownerId,
      action: 'RETENTION_ATTENDANCE_PURGED',
      resourceType: 'Attendance',
      details: {
        retentionYears: policy.attendanceYears,
        deletedCount: purgedAttendance,
        cutoffDate: attendanceCutoff,
      },
    });
  }

  const oldPayrolls = await PayrollUpdate.find({
    tenantId: tenant._id,
    createdAt: { $lt: cutoffForYears(policy.payrollYears, now) },
  })
    .select('_id')
    .lean();

  if (oldPayrolls.length > 0) {
    retainedPayrolls = oldPayrolls.length;

    await auditRetentionAction({
      tenantId: tenant._id,
      userId: tenant.ownerId,
      action: 'RETENTION_PAYROLL_RETAINED',
      resourceType: 'Payroll',
      resourceIds: oldPayrolls.map((payroll) => payroll._id),
      details: {
        retentionYears: policy.payrollYears,
        reason:
          'Historical payroll is retained because it is required for reproducible payroll and reporting.',
        count: oldPayrolls.length,
      },
    });
  }

  return {
    anonymizedEmployees,
    purgedAttendance,
    retainedPayrolls,
  };
}

async function runRetentionLifecycleJob({ now = new Date() } = {}) {
  const acquired = await acquireRetentionLock();

  if (!acquired) {
    return {
      ran: false,
      reason: 'held',
      tenants: 0,
      anonymizedEmployees: 0,
      purgedAttendance: 0,
      retainedPayrolls: 0,
    };
  }

  try {
    const tenants = await Tenant.find({
      isActive: true,
    }).setOptions({ includeDeleted: false });

    let anonymizedEmployees = 0;
    let purgedAttendance = 0;
    let retainedPayrolls = 0;

    for (const tenant of tenants) {
      const result = await processTenantRetention(tenant, now);

      anonymizedEmployees += result.anonymizedEmployees;
      purgedAttendance += result.purgedAttendance;
      retainedPayrolls += result.retainedPayrolls;
    }

    return {
      ran: true,
      tenants: tenants.length,
      anonymizedEmployees,
      purgedAttendance,
      retainedPayrolls,
    };
  } catch (error) {
    logger.error('Retention lifecycle job failed', {
      error: error.message,
    });

    throw error;
  } finally {
    await releaseRetentionLock();
  }
}

module.exports = {
  runRetentionLifecycleJob,
  normalizePolicy,
  cutoffForYears,
};