/**
 * @fileoverview Company Policy Management Controller
 * @description CRUD for company policies with versioning and employee
 * acknowledgment tracking.  Admins manage policies; employees acknowledge
 * the active versions assigned to their department.
 */

const CompanyPolicy = require('../models/companyPolicy.model');
const PolicyAcknowledgment = require('../models/policyAcknowledgment.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { sanitizeText } = require('../utils/validators');

// ─── Admin: Create Policy ─────────────────────────────────────────────────

exports.createPolicy = async (req, res, next) => {
  try {
    const {
      policyCode,
      title,
      content,
      category,
      description,
      summary,
      effectiveDate,
      expiryDate,
      requiresAcknowledgment,
      assignedDepartments,
    } = req.body;

    if (!policyCode || !policyCode.trim()) {
      return res.status(400).json({ message: 'Policy code is required' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Policy title is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Policy content is required' });
    }

    const normalisedCode = policyCode.trim().toUpperCase().replace(/\s+/g, '-');

    const existing = await CompanyPolicy.findOne({
      tenantId: req.tenantId,
      policyCode: normalisedCode,
      });
    if (existing) {
      return res
        .status(409)
        .json({ message: `Policy "${normalisedCode}" already exists` });
    }

    const isGlobal = !assignedDepartments || assignedDepartments.length === 0;

    const policy = await CompanyPolicy.create({
      tenantId: req.tenantId,
      policyCode: normalisedCode,
      category: category || 'general',
      description: description ? sanitizeText(description) : '',
      currentVersion: 1,
      versions: [
        {
          versionNumber: 1,
          title: sanitizeText(title),
          content,
          summary: summary ? sanitizeText(summary) : '',
          publishedBy: req.userId,
          publishedAt: new Date(),
          changeNote: 'Initial version',
        },
      ],
      status: 'draft',
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      requiresAcknowledgment: requiresAcknowledgment !== false,
      assignedDepartments: isGlobal
        ? []
        : assignedDepartments.map(sanitizeText),
      isGlobal,
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_CREATE',
      resourceType: 'CompanyPolicy',
      resourceIds: [policy._id],
      details: { policyCode: policy.policyCode, category: policy.category },
      req,
    });
    logger.info('Policy created', { userId: req.userId, policyId: policy._id });
    return res.status(201).json({ message: 'Policy created', policy });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Policy code already exists' });
    }
    logger.error('Failed to create policy', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: List All Policies ─────────────────────────────────────────────

exports.getPolicies = async (req, res, next) => {
  try {
    const { category, status, search } = req.query;
    const filter = { tenantId: req.tenantId };
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search && typeof search === 'string' && search.trim()) {
      filter.$or = [
        { policyCode: new RegExp(search.trim(), 'i') },
        { 'versions.title': new RegExp(search.trim(), 'i') },
      ];
    }

    const policies = await CompanyPolicy.find(filter)
      .populate('createdBy', 'fullName email')
      .sort({ updatedAt: -1 });
    return res.status(200).json({ policies });
  } catch (error) {
    logger.error('Failed to fetch policies', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin/Employee: Get Single Policy ────────────────────────────────────

exports.getPolicyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const policy = await CompanyPolicy.findOne({
      _id: id,
      tenantId: req.tenantId,
      }).populate('createdBy', 'fullName email');

    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    // Non-admins cannot see drafts
    if (policy.status === 'draft' && req.user?.role?.name !== 'admin') {
      return res.status(404).json({ message: 'Policy not found' });
    }

    return res.status(200).json({ policy });
  } catch (error) {
    logger.error('Failed to fetch policy', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Update Policy Metadata ────────────────────────────────────────

exports.updatePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      description,
      category,
      effectiveDate,
      expiryDate,
      requiresAcknowledgment,
      assignedDepartments,
    } = req.body;

    const policy = await CompanyPolicy.findOne({
      _id: id,
      tenantId: req.tenantId,
      });
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    if (description !== undefined)
      policy.description = sanitizeText(description);
    if (category !== undefined) policy.category = category;
    if (effectiveDate !== undefined)
      policy.effectiveDate = effectiveDate
        ? new Date(effectiveDate)
        : undefined;
    if (expiryDate !== undefined)
      policy.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
    if (requiresAcknowledgment !== undefined)
      policy.requiresAcknowledgment = requiresAcknowledgment;
    if (assignedDepartments !== undefined) {
      policy.assignedDepartments = Array.isArray(assignedDepartments)
        ? assignedDepartments.map(sanitizeText)
        : [];
      policy.isGlobal = policy.assignedDepartments.length === 0;
    }

    await policy.save();
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_UPDATE',
      resourceType: 'CompanyPolicy',
      resourceIds: [policy._id],
      details: {
        policyCode: policy.policyCode,
        changes: Object.keys(req.body),
      },
      req,
    });
    logger.info('Policy updated', { userId: req.userId, policyId: policy._id });
    return res.status(200).json({ message: 'Policy updated', policy });
  } catch (error) {
    logger.error('Failed to update policy', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Publish New Version ───────────────────────────────────────────

exports.publishVersion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, summary, changeNote } = req.body;

    if (!title || !title.trim())
      return res.status(400).json({ message: 'Version title is required' });
    if (!content || !content.trim())
      return res.status(400).json({ message: 'Version content is required' });

    const policy = await CompanyPolicy.findOne({
      _id: id,
      tenantId: req.tenantId,
      });
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const newVersion = policy.currentVersion + 1;
    policy.versions.push({
      versionNumber: newVersion,
      title: sanitizeText(title),
      content,
      summary: summary ? sanitizeText(summary) : '',
      publishedBy: req.userId,
      publishedAt: new Date(),
      changeNote: changeNote ? sanitizeText(changeNote) : '',
    });
    policy.currentVersion = newVersion;
    policy.status = 'active';
    await policy.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_VERSION_PUBLISH',
      resourceType: 'CompanyPolicy',
      resourceIds: [policy._id],
      details: { policyCode: policy.policyCode, newVersion },
      req,
    });
    logger.info('Policy version published', {
      userId: req.userId,
      version: newVersion,
    });
    return res
      .status(200)
      .json({ message: `Version ${newVersion} published`, policy });
  } catch (error) {
    logger.error('Failed to publish version', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Soft-Delete Policy ────────────────────────────────────────────

exports.deletePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const policy = await CompanyPolicy.findOne({
      _id: id,
      tenantId: req.tenantId,
      });
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    await policy.softDelete();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_DELETE',
      resourceType: 'CompanyPolicy',
      resourceIds: [policy._id],
      details: { policyCode: policy.policyCode },
      req,
    });
    logger.info('Policy soft deleted', {
      userId: req.userId,
      policyId: policy._id,
    });
    return res.status(200).json({ message: 'Policy deleted' });
  } catch (error) {
    logger.error('Failed to delete policy', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: Acknowledge Policy ─────────────────────────────────────────

exports.acknowledgePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    const policy = await CompanyPolicy.findOne({
      _id: id,
      tenantId: req.tenantId,
      status: 'active',
    });
    if (!policy)
      return res.status(404).json({ message: 'Active policy not found' });

    if (!policy.requiresAcknowledgment) {
      return res
        .status(400)
        .json({ message: 'This policy does not require acknowledgment' });
    }

    const employee = await Employee.findOne({
      createdBy: req.userId,
      tenantId: req.tenantId,
      });
    if (!employee)
      return res.status(404).json({ message: 'No employee record found' });

    // Department assignment check
    if (
      !policy.isGlobal &&
      policy.assignedDepartments.length > 0 &&
      employee.department &&
      !policy.assignedDepartments.includes(employee.department)
    ) {
      return res
        .status(400)
        .json({ message: 'Policy not assigned to your department' });
    }

    const existingAck = await PolicyAcknowledgment.findOne({
      policyId: policy._id,
      employeeId: employee._id,
      policyVersion: policy.currentVersion,
    });
    if (existingAck) {
      return res
        .status(409)
        .json({
          message: 'Already acknowledged',
          acknowledgedAt: existingAck.acknowledgedAt,
        });
    }

    const acknowledgment = await PolicyAcknowledgment.create({
      policyId: policy._id,
      employeeId: employee._id,
      tenantId: req.tenantId,
      policyVersion: policy.currentVersion,
      policyCode: policy.policyCode,
      acknowledgedAt: new Date(),
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_ACKNOWLEDGE',
      resourceType: 'PolicyAcknowledgment',
      resourceIds: [acknowledgment._id],
      details: {
        policyCode: policy.policyCode,
        version: policy.currentVersion,
      },
      req,
    });
    logger.info('Policy acknowledged', {
      userId: req.userId,
      version: policy.currentVersion,
    });
    return res.status(201).json({ message: 'Acknowledged', acknowledgment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Already acknowledged' });
    }
    logger.error('Failed to acknowledge policy', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Employee: Pending Policies ───────────────────────────────────────────

exports.getPendingPolicies = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      createdBy: req.userId,
      tenantId: req.tenantId,
      });
    if (!employee) return res.status(204).json({ policies: [] });

    const activePolicies = await CompanyPolicy.find({
      tenantId: req.tenantId,
      status: 'active',
      requiresAcknowledgment: true,
      });

    // Filter by department assignment
    const applicable = activePolicies.filter((p) => {
      if (p.isGlobal || p.assignedDepartments.length === 0) return true;
      return (
        employee.department &&
        p.assignedDepartments.includes(employee.department)
      );
    });

    // Which versions has this employee already acknowledged?
    const acks = await PolicyAcknowledgment.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
    }).select('policyId policyVersion');
    const ackMap = new Map(
      acks.map((a) => [`${a.policyId}:${a.policyVersion}`, true]),
    );

    const pending = applicable
      .filter((p) => !ackMap.has(`${p._id}:${p.currentVersion}`))
      .map((p) => {
        const v = p.versions[p.versions.length - 1];
        return {
          _id: p._id,
          policyCode: p.policyCode,
          category: p.category,
          version: p.currentVersion,
          title: v?.title || p.policyCode,
          summary: v?.summary || '',
          effectiveDate: p.effectiveDate,
        };
      });

    return res.status(200).json({ policies: pending });
  } catch (error) {
    logger.error('Failed to fetch pending policies', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ─── Admin: Acknowledgment Analytics ──────────────────────────────────────

exports.getAcknowledgmentStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const policy = await CompanyPolicy.findOne({
      _id: id,
      tenantId: req.tenantId,
      });
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const totalEmployees = await Employee.countDocuments({
      tenantId: req.tenantId,
      isActive: true,
    });
    const acknowledgedCount = await PolicyAcknowledgment.countDocuments({
      policyId: policy._id,
      tenantId: req.tenantId,
      policyVersion: policy.currentVersion,
    });
    const pendingCount = Math.max(0, totalEmployees - acknowledgedCount);
    const acknowledgmentRate =
      totalEmployees > 0
        ? Math.round((acknowledgedCount / totalEmployees) * 100)
        : 0;

    const versionStats = policy.versions.map((v) => ({
      versionNumber: v.versionNumber,
      title: v.title,
      publishedAt: v.publishedAt,
    }));

    const recentAcks = await PolicyAcknowledgment.find({
      policyId: policy._id,
      tenantId: req.tenantId,
      policyVersion: policy.currentVersion,
    })
      .populate('employeeId', 'fullName department')
      .sort({ acknowledgedAt: -1 })
      .limit(20);

    return res.status(200).json({
      policyCode: policy.policyCode,
      currentVersion: policy.currentVersion,
      totalEmployees,
      acknowledgedCount,
      pendingCount,
      acknowledgmentRate,
      versionStats,
      recentAcknowledgments: recentAcks,
    });
  } catch (error) {
    logger.error('Failed to fetch acknowledgment stats', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};
