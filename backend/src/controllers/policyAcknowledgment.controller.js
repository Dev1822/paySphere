const CompanyPolicy = require('../models/companyPolicy.model');
const PolicyAcknowledgment = require('../models/policyAcknowledgment.model');
const Employee = require('../models/employee.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

// ─── Admin: Policy Management ────────────────────────────────────────────────

/**
 * Create a new company policy.
 *
 * Only admins and HR should call this — gated by `employee:write` on the
 * route.  The policy starts active by default so it is immediately visible
 * to employees.
 */
exports.createPolicy = async (req, res, next) => {
  try {
    const { title, description, content, category, version, isMandatory, applicableDepartments } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ message: 'title, content, and category are required' });
    }

    const policy = await CompanyPolicy.create({
      title: title.trim(),
      description: description || '',
      content,
      category: category.trim(),
      version: version || '1.0',
      isMandatory: isMandatory !== false,
      applicableDepartments: Array.isArray(applicableDepartments) ? applicableDepartments : [],
      createdBy: req.userId,
      tenantId: req.tenantId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_CREATE',
      resourceType: 'CompanyPolicy',
      resourceIds: [policy._id],
      details: { title: policy.title, category: policy.category, version: policy.version },
      req,
    });

    logger.info('Policy created', { userId: req.userId, policyId: policy._id, title });

    res.status(201).json({ message: 'Policy created successfully', policy });
  } catch (error) {
    next(error);
  }
};

/**
 * List all policies (active and inactive) for the tenant.
 *
 * Supports `?category=` and `?isActive=` query filters.
 */
exports.getPolicies = async (req, res, next) => {
  try {
    const filter = tenantFilter(req);

    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const policies = await CompanyPolicy.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'fullName email');

    res.status(200).json({ policies });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single policy by ID with acknowledgment stats.
 */
exports.getPolicyById = async (req, res, next) => {
  try {
    const policy = await CompanyPolicy.findOne(
      tenantFilter(req, { _id: req.params.id }),
    ).populate('createdBy', 'fullName email');

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    const totalEmployees = await Employee.countDocuments(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    );

    const acknowledgedCount = await PolicyAcknowledgment.countDocuments({
      policyId: policy._id,
      tenantId: req.tenantId,
    });

    res.status(200).json({
      policy,
      stats: {
        totalEmployees,
        acknowledgedCount,
        pendingCount: totalEmployees - acknowledgedCount,
        completionRate: totalEmployees > 0
          ? Math.round((acknowledgedCount / totalEmployees) * 100)
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a policy.  Does not create a new version — keeps it simple for V1.
 */
exports.updatePolicy = async (req, res, next) => {
  try {
    const policy = await CompanyPolicy.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    const { title, description, content, category, version, isMandatory, isActive, applicableDepartments } = req.body;

    if (title !== undefined) policy.title = title.trim();
    if (description !== undefined) policy.description = description;
    if (content !== undefined) policy.content = content;
    if (category !== undefined) policy.category = category.trim();
    if (version !== undefined) policy.version = version;
    if (isMandatory !== undefined) policy.isMandatory = isMandatory;
    if (isActive !== undefined) policy.isActive = isActive;
    if (Array.isArray(applicableDepartments)) policy.applicableDepartments = applicableDepartments;

    await policy.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_UPDATE',
      resourceType: 'CompanyPolicy',
      resourceIds: [policy._id],
      details: { title: policy.title, changes: Object.keys(req.body) },
      req,
    });

    res.status(200).json({ message: 'Policy updated successfully', policy });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete (deactivate) a policy.
 *
 * Soft-deactivation rather than hard delete because acknowledgment records
 * reference the policy and historical compliance must remain verifiable.
 */
exports.deletePolicy = async (req, res, next) => {
  try {
    const policy = await CompanyPolicy.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    policy.isActive = false;
    await policy.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_DELETE',
      resourceType: 'CompanyPolicy',
      resourceIds: [policy._id],
      details: { title: policy.title },
      req,
    });

    res.status(200).json({ message: 'Policy deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── Employee: Acknowledgment ────────────────────────────────────────────────

/**
 * Get policies pending acknowledgment for the authenticated employee.
 *
 * Returns active, mandatory policies the employee has NOT yet acknowledged.
 * Includes policies already acknowledged so the UI can show completion state.
 */
exports.getMyPolicies = async (req, res, next) => {
  try {
    const employee = await Employee.findOne(
      tenantFilter(req, { createdBy: req.userId }),
    );
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const activePolicies = await CompanyPolicy.find(
      tenantFilter(req, { isActive: true }),
    ).sort({ createdAt: -1 });

    const acks = await PolicyAcknowledgment.find({
      employeeId: employee._id,
      tenantId: req.tenantId,
    });

    const ackMap = {};
    for (const ack of acks) {
      ackMap[ack.policyId.toString()] = ack;
    }

    const policies = activePolicies
      .filter((p) => {
        if (!p.applicableDepartments || p.applicableDepartments.length === 0) return true;
        return p.applicableDepartments.includes(employee.department);
      })
      .map((p) => {
        const ack = ackMap[p._id.toString()];
        return {
          _id: p._id,
          title: p.title,
          description: p.description,
          category: p.category,
          version: p.version,
          isMandatory: p.isMandatory,
          acknowledged: !!ack,
          acknowledgedAt: ack?.acknowledgedAt || null,
        };
      });

    const mandatoryPending = policies.filter(
      (p) => p.isMandatory && !p.acknowledged,
    ).length;
    const totalMandatory = policies.filter((p) => p.isMandatory).length;

    res.status(200).json({
      policies,
      summary: {
        total: policies.length,
        acknowledged: policies.filter((p) => p.acknowledged).length,
        mandatoryPending,
        totalMandatory,
        complianceRate: totalMandatory > 0
          ? Math.round(((totalMandatory - mandatoryPending) / totalMandatory) * 100)
          : 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Acknowledge a policy.
 *
 * Idempotent — if the employee has already acknowledged, returns 200 without
 * creating a duplicate.  The response always includes the current state.
 */
exports.acknowledgePolicy = async (req, res, next) => {
  try {
    const { policyId } = req.params;
    const { notes } = req.body || {};

    const policy = await CompanyPolicy.findOne(
      tenantFilter(req, { _id: policyId, isActive: true }),
    );
    if (!policy) {
      return res.status(404).json({ message: 'Active policy not found' });
    }

    const employee = await Employee.findOne(
      tenantFilter(req, { createdBy: req.userId }),
    );
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    // Idempotent — already acknowledged
    const existing = await PolicyAcknowledgment.findOne({
      policyId,
      employeeId: employee._id,
      tenantId: req.tenantId,
    });
    if (existing) {
      return res.status(200).json({
        message: 'Policy already acknowledged',
        acknowledgment: existing,
      });
    }

    const acknowledgment = await PolicyAcknowledgment.create({
      policyId,
      employeeId: employee._id,
      notes: notes || '',
      tenantId: req.tenantId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POLICY_ACKNOWLEDGE',
      resourceType: 'PolicyAcknowledgment',
      resourceIds: [acknowledgment._id],
      details: { policyTitle: policy.title, employeeName: employee.fullName },
      req,
    });

    logger.info('Policy acknowledged', {
      userId: req.userId,
      policyId,
      employeeId: employee._id,
    });

    res.status(201).json({ message: 'Policy acknowledged successfully', acknowledgment });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Compliance Reporting ─────────────────────────────────────────────

/**
 * Compliance report — for each active mandatory policy, list every employee
 * and whether they have acknowledged it.  Useful for audit readiness.
 */
exports.getComplianceReport = async (req, res, next) => {
  try {
    const policies = await CompanyPolicy.find(
      tenantFilter(req, { isActive: true, isMandatory: true }),
    ).sort({ category: 1, title: 1 });

    const employees = await Employee.find(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    ).select('fullName role department email');

    const employeeIds = employees.map((e) => e._id);

    const allAcks = await PolicyAcknowledgment.find({
      tenantId: req.tenantId,
      employeeId: { $in: employeeIds },
    });

    // Build lookup: policyId -> Set of employeeId strings
    const ackLookup = {};
    for (const ack of allAcks) {
      const pid = ack.policyId.toString();
      if (!ackLookup[pid]) ackLookup[pid] = new Set();
      ackLookup[pid].add(ack.employeeId.toString());
    }

    const report = policies.map((policy) => {
      const policyAcks = ackLookup[policy._id.toString()] || new Set();
      const acknowledgedEmployees = employees
        .filter((e) => policyAcks.has(e._id.toString()))
        .map((e) => ({ id: e._id, name: e.fullName, department: e.department }));
      const pendingEmployees = employees
        .filter((e) => !policyAcks.has(e._id.toString()))
        .map((e) => ({ id: e._id, name: e.fullName, department: e.department }));

      return {
        policyId: policy._id,
        title: policy.title,
        category: policy.category,
        version: policy.version,
        totalEmployees: employees.length,
        acknowledgedCount: acknowledgedEmployees.length,
        pendingCount: pendingEmployees.length,
        completionRate: employees.length > 0
          ? Math.round((acknowledgedEmployees.length / employees.length) * 100)
          : 0,
        acknowledgedEmployees,
        pendingEmployees,
      };
    });

    const overallCompliance =
      report.length > 0
        ? Math.round(report.reduce((sum, r) => sum + r.completionRate, 0) / report.length)
        : 100;

    res.status(200).json({ report, overallCompliance });
  } catch (error) {
    next(error);
  }
};

/**
 * List all employees who have acknowledged a specific policy.
 */
exports.getPolicyAcknowledgments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const policy = await CompanyPolicy.findOne(
      tenantFilter(req, { _id: id }),
    );
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    const acknowledgments = await PolicyAcknowledgment.find({
      policyId: id,
      tenantId: req.tenantId,
    })
      .populate('employeeId', 'fullName role department email')
      .sort({ acknowledgedAt: -1 });

    res.status(200).json({ policy, acknowledgments });
  } catch (error) {
    next(error);
  }
};
