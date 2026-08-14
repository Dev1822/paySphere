const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const { getTenantId } = require('../utils/tenantScope');
const {
  anonymizeEmployeePII,
  evaluateRetentionEligibility,
} = require('../utils/retentionPolicy');
const eventBus = require('../services/event.service');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/** 403 for a request that is not scoped to a company. */
function refuseUnscoped(res) {
  return res.status(403).json({
    message:
      'Your account is not linked to a company yet. Sign in again to continue.',
  });
}

/**
 * GET /api/archive/employees — the company's soft-deleted employees.
 */
exports.getArchivedEmployees = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    let page = Number.parseInt(req.query?.page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    let limit = Number.parseInt(req.query?.limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      limit = DEFAULT_PAGE_SIZE;
    }

    const query = { tenantId, isDeleted: true };

    const [total, employees] = await Promise.all([
      Employee.countDocuments(query).setOptions({ includeDeleted: true }),
      Employee.find(query)
        .setOptions({ includeDeleted: true })
        .sort({ deletedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      data: employees,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/archive/employees/:id — one archived record.
 */
exports.getArchivedEmployee = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const employee = await Employee.findOne({
      _id: id,
      tenantId,
      isDeleted: true,
    }).setOptions({ includeDeleted: true });

    if (!employee) {
      return res.status(404).json({ message: 'Archived employee not found' });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/archive/employees/:id/anonymize — GDPR Right to be Forgotten PII Redaction.
 */
exports.anonymizeEmployee = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const employee = await Employee.findOne({
      _id: id,
      tenantId,
      isDeleted: true,
    }).setOptions({ includeDeleted: true });

    if (!employee) {
      return res.status(404).json({ message: 'Archived employee not found' });
    }

    const anonymizedFields = anonymizeEmployeePII(employee);
    Object.assign(employee, anonymizedFields);
    await employee.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'GDPR_EMPLOYEE_ANONYMIZED',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: { anonymizedAt: new Date() },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Employee PII has been cryptographically anonymized in accordance with GDPR Article 17',
      employee,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/archive/retention-check — Data retention audit for archived records.
 */
exports.evaluateRetention = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    const retentionYears = Number(req.query?.retentionYears) || 7;

    const archivedEmployees = await Employee.find({
      tenantId,
      isDeleted: true,
    })
      .setOptions({ includeDeleted: true })
      .select('_id fullName email deletedAt')
      .lean();

    const results = archivedEmployees.map((emp) => {
      const evaluation = evaluateRetentionEligibility(emp, retentionYears);
      return {
        id: emp._id,
        fullName: emp.fullName,
        deletedAt: emp.deletedAt,
        isEligibleForPurge: evaluation.isEligibleForPurge,
        daysArchived: evaluation.daysArchived,
        remainingDays: evaluation.remainingDays,
      };
    });

    const eligibleCount = results.filter((r) => r.isEligibleForPurge).length;

    res.status(200).json({
      success: true,
      retentionYears,
      totalArchived: archivedEmployees.length,
      eligibleForPurgeCount: eligibleCount,
      records: results,
    });
  } catch (error) {
    next(error);
  }
};
