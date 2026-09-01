/**
 * @fileoverview Alert Rule Controller
 *
 * CRUD endpoints for payroll anomaly alert rules, plus scan trigger,
 * alert record management, and statistics.
 *
 * Mounted at /api/alert-rules
 */

const AlertRule = require('../models/alertRule.model');
const AlertRecord = require('../models/alertRecord.model');
const { tenantFilter } = require('../utils/tenantScope');
const alertRuleService = require('../services/alertRule.service');
const logger = require('../utils/logger');

// ─── Alert Rules CRUD ────────────────────────────────────────────────────

/**
 * POST /api/alert-rules
 * Create a new alert rule.
 */
exports.createRule = async (req, res, next) => {
  try {
    const {
      name,
      alertType,
      threshold,
      secondaryThreshold,
      severity,
      enabled,
      notificationChannels,
      webhookUrl,
      departmentScope,
      roleScope,
      description,
    } = req.body || {};

    if (!name || !alertType || threshold === undefined || threshold === null) {
      return res.status(400).json({ message: 'name, alertType, and threshold are required' });
    }

    const rule = await AlertRule.create({
      name,
      alertType,
      threshold: Number(threshold),
      secondaryThreshold: secondaryThreshold != null ? Number(secondaryThreshold) : null,
      severity: severity || 'MEDIUM',
      enabled: enabled !== false,
      notificationChannels: notificationChannels || ['IN_APP'],
      webhookUrl: webhookUrl || '',
      departmentScope: departmentScope || [],
      roleScope: roleScope || [],
      description: description || '',
      createdBy: req.userId,
      tenantId: req.tenantId,
    });

    res.status(201).json(rule);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alert-rules
 * List all alert rules for the current tenant.
 */
exports.listRules = async (req, res, next) => {
  try {
    const { enabled, alertType } = req.query;
    const filter = tenantFilter(req, { deletedAt: null });
    if (enabled !== undefined) filter.enabled = enabled === 'true';
    if (alertType) filter.alertType = alertType;

    const rules = await AlertRule.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ rules, total: rules.length });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alert-rules/:id
 * Get a single alert rule by ID.
 */
exports.getRule = async (req, res, next) => {
  try {
    const filter = tenantFilter(req, { _id: req.params.id, deletedAt: null });
    const rule = await AlertRule.findOne(filter).lean();

    if (!rule) {
      return res.status(404).json({ message: 'Alert rule not found' });
    }

    res.status(200).json(rule);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/alert-rules/:id
 * Update an existing alert rule.
 */
exports.updateRule = async (req, res, next) => {
  try {
    const allowed = [
      'name', 'alertType', 'threshold', 'secondaryThreshold',
      'severity', 'enabled', 'notificationChannels', 'webhookUrl',
      'departmentScope', 'roleScope', 'description',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.threshold !== undefined) updates.threshold = Number(updates.threshold);
    if (updates.secondaryThreshold !== undefined) updates.secondaryThreshold = Number(updates.secondaryThreshold);

    const filter = tenantFilter(req, { _id: req.params.id, deletedAt: null });
    const rule = await AlertRule.findOneAndUpdate(filter, updates, { new: true, runValidators: true });

    if (!rule) {
      return res.status(404).json({ message: 'Alert rule not found' });
    }

    res.status(200).json(rule);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/alert-rules/:id
 * Soft-delete an alert rule.
 */
exports.deleteRule = async (req, res, next) => {
  try {
    const filter = tenantFilter(req, { _id: req.params.id, deletedAt: null });
    const rule = await AlertRule.findOneAndUpdate(
      filter,
      { deletedAt: new Date() },
      { new: true },
    );

    if (!rule) {
      return res.status(404).json({ message: 'Alert rule not found' });
    }

    res.status(200).json({ message: 'Alert rule deleted', id: rule._id });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/alert-rules/:id/toggle
 * Quick toggle for enable/disable.
 */
exports.toggleRule = async (req, res, next) => {
  try {
    const filter = tenantFilter(req, { _id: req.params.id, deletedAt: null });
    const rule = await AlertRule.findOne(filter);

    if (!rule) {
      return res.status(404).json({ message: 'Alert rule not found' });
    }

    rule.enabled = !rule.enabled;
    await rule.save();

    res.status(200).json({ id: rule._id, enabled: rule.enabled });
  } catch (error) {
    next(error);
  }
};

// ─── Scan & Alert Records ────────────────────────────────────────────────

/**
 * POST /api/alert-rules/scan
 * Trigger an anomaly scan for a given payroll period.
 */
exports.runScan = async (req, res, next) => {
  try {
    const { year, month, employeeId } = req.body || {};

    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }

    const parsedYear = Number(year);
    const parsedMonth = Number(month);

    if (parsedMonth < 1 || parsedMonth > 12 || parsedYear < 2000 || parsedYear > 2100) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }

    const result = await alertRuleService.runScan(req, {
      year: parsedYear,
      month: parsedMonth,
      employeeId: employeeId || null,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alert-rules/records
 * List alert records with filtering and pagination.
 */
exports.listRecords = async (req, res, next) => {
  try {
    const { year, month, disposition, severity, page, limit } = req.query;

    const result = await alertRuleService.getAlertRecords(req, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      disposition,
      severity,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alert-rules/stats
 * Aggregate statistics about alerts.
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await alertRuleService.getScanStats(req);
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/alert-rules/records/:id/disposition
 * Update the disposition of an alert record.
 */
exports.updateDisposition = async (req, res, next) => {
  try {
    const { disposition, note } = req.body || {};
    const validDispositions = ['ACKNOWLEDGED', 'DISMISSED', 'FALSE_POSITIVE'];

    if (!disposition || !validDispositions.includes(disposition)) {
      return res.status(400).json({
        message: `disposition must be one of: ${validDispositions.join(', ')}`,
      });
    }

    const record = await AlertRecord.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        disposition,
        dispositionBy: req.userId,
        dispositionAt: new Date(),
        dispositionNote: note || '',
      },
      { new: true },
    );

    if (!record) {
      return res.status(404).json({ message: 'Alert record not found' });
    }

    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/alert-rules/seed
 * Create a default set of alert rules for a new tenant.
 */
exports.seedDefaultRules = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const existingCount = await AlertRule.countDocuments({ tenantId, deletedAt: null });
    if (existingCount > 0) {
      return res.status(409).json({
        message: 'Tenant already has alert rules. Delete them first or create individually.',
        existingRules: existingCount,
      });
    }

    const defaults = [
      {
        name: 'Salary Spike > 30%',
        alertType: 'SALARY_SPIKE',
        threshold: 30,
        severity: 'HIGH',
        notificationChannels: ['IN_APP', 'EMAIL'],
        description: "Fires when an employee's net salary is 30% or more above their historical average.",
      },
      {
        name: 'Excessive Overtime > 80 hours',
        alertType: 'EXCESSIVE_OVERTIME',
        threshold: 80,
        secondaryThreshold: 60,
        severity: 'HIGH',
        notificationChannels: ['IN_APP'],
        description: 'Fires when overtime hours exceed 80h in a month (hard limit 60h).',
      },
      {
        name: 'Bonus > 50% of Base Salary',
        alertType: 'EXCESSIVE_BONUS_RATIO',
        threshold: 50,
        severity: 'MEDIUM',
        notificationChannels: ['IN_APP'],
        description: "Fires when a bonus payout exceeds 50% of the employee's base salary.",
      },
      {
        name: 'Duplicate Bank Account',
        alertType: 'DUPLICATE_BANK_ACCOUNT',
        threshold: 1,
        severity: 'CRITICAL',
        notificationChannels: ['IN_APP', 'EMAIL'],
        description: 'Fires when two or more employees share the same bank account number.',
      },
      {
        name: 'Statistical Salary Outlier (Z > 3.5)',
        alertType: 'NET_SALARY_OUTLIER',
        threshold: 3.5,
        severity: 'MEDIUM',
        notificationChannels: ['IN_APP'],
        description: 'Fires when an employee\'s net salary is 3.5+ standard deviations from the batch mean.',
      },
      {
        name: 'Abnormal Deductions > 25%',
        alertType: 'ABNORMAL_DEDUCTION',
        threshold: 25,
        severity: 'MEDIUM',
        notificationChannels: ['IN_APP'],
        description: "Fires when total deductions exceed 25% of the employee's base salary.",
      },
      {
        name: 'High Leave Days > 20',
        alertType: 'HIGH_LEAVE_WITH_PAY',
        threshold: 20,
        severity: 'LOW',
        notificationChannels: ['IN_APP'],
        description: 'Fires when an employee takes more than 20 leave days in a single period.',
      },
    ];

    const created = await AlertRule.insertMany(
      defaults.map((d) => ({
        ...d,
        createdBy: req.userId,
        tenantId,
      })),
    );

    res.status(201).json({ message: `${created.length} default alert rules created`, rules: created });
  } catch (error) {
    next(error);
  }
};
