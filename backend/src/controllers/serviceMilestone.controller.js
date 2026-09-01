/**
 * @fileoverview Service Milestone Controller
 * @description Manages milestone configuration, batch/manual evaluation,
 * achievement lifecycle (acknowledge, disburse, skip), and analytics
 * for the employee service milestone recognition feature.
 */

const mongoose = require('mongoose');
const {
  MilestoneConfig,
  MilestoneAchievement,
  MilestoneEvaluationLog,
} = require('../models/serviceMilestone.model');
const Employee = require('../models/employee.model');
const {
  completedYearsOfService,
  evaluateEmployee,
  batchEvaluate,
  upcomingMilestones,
  formatMilestoneMessage,
} = require('../utils/milestoneEvaluator');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');

// ============================================================================
// Configuration CRUD
// ============================================================================

/**
 * GET /api/milestones/config
 * Fetch the milestone configuration for the current tenant.
 */
exports.getConfig = async (req, res, next) => {
  try {
    let config = await MilestoneConfig.findOne({});
    if (!config) {
      // Return a default config (not persisted) so the frontend has something
      // to display before the admin saves one for the first time.
      config = {
        isEnabled: false,
        evaluationMode: 'Anniversary',
        advanceNoticeDays: 7,
        maxEvaluationYears: 30,
        tiers: [],
        isNew: true
      };
    }
    return res.status(200).json({ config });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/milestones/config
 * Create or update the milestone configuration for the current tenant.
 */
exports.upsertConfig = async (req, res, next) => {
  try {
    const {
      isEnabled,
      evaluationMode,
      advanceNoticeDays,
      maxEvaluationYears,
      tiers,
    } = req.body;

    // Validate tier uniqueness
    if (Array.isArray(tiers)) {
      const years = tiers.map((t) => t.yearsOfService);
      if (new Set(years).size !== years.length) {
        return res.status(400).json({
          message: 'Duplicate yearsOfService values are not allowed.',
        });
      }
    }

    const update = {};
    if (isEnabled !== undefined) update.isEnabled = isEnabled;
    if (evaluationMode !== undefined) update.evaluationMode = evaluationMode;
    if (advanceNoticeDays !== undefined)
      update.advanceNoticeDays = advanceNoticeDays;
    if (maxEvaluationYears !== undefined)
      update.maxEvaluationYears = maxEvaluationYears;
    if (tiers !== undefined) update.tiers = tiers;
    update.updatedBy = req.userId;

    const config = await MilestoneConfig.findOneAndUpdate(
      {},
      { $set: update, $setOnInsert: { createdBy: req.userId } },
      { upsert: true, new: true, runValidators: true },
    );

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'MILESTONE_CONFIG_UPDATED',
      resourceType: 'MilestoneConfig',
      resourceIds: [config._id],
      details: {
        isEnabled: config.isEnabled,
        tierCount: config.tiers?.length || 0,
        evaluationMode: config.evaluationMode,
      },
      req,
    });

    return res
      .status(200)
      .json({ message: 'Milestone configuration saved', config });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

// ============================================================================
// Employee Evaluation
// ============================================================================

/**
 * GET /api/milestones/evaluate/:employeeId
 * Evaluate a single employee and return their milestone status.
 */
exports.evaluateSingle = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    const config = await MilestoneConfig.findOne({});
    if (!config || !config.isEnabled) {
      return res
        .status(400)
        .json({ message: 'Milestone program is not configured or disabled' });
    }

    const employee = await Employee.findOne({
      _id: req.params.employeeId,
      isActive: true
    })
      .select('_id fullName department joiningDate role')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const result = evaluateEmployee(employee, config);

    // Check if this milestone was already recorded
    let existingAchievement = null;
    if (result.qualifies) {
      existingAchievement = await MilestoneAchievement.findOne({
        employeeId: employee._id,
        yearsAchieved: result.yearsOfService
      }).lean();
    }

    return res.status(200).json({
      employee: {
        id: employee._id,
        fullName: employee.fullName,
        department: employee.department,
        joiningDate: employee.joiningDate,
      },
      yearsOfService: result.yearsOfService,
      qualifies: result.qualifies,
      matchedTier: result.matchedTier
        ? {
            yearsOfService: result.matchedTier.yearsOfService,
            label: result.matchedTier.label,
            reward: result.matchedTier.reward,
          }
        : null,
      existingAchievement,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/milestones/evaluate/batch
 * Run a batch evaluation across all active employees for the tenant.
 */
exports.evaluateBatch = async (req, res, next) => {
  try {
    const config = await MilestoneConfig.findOne({});
    if (!config || !config.isEnabled) {
      return res
        .status(400)
        .json({ message: 'Milestone program is not configured or disabled' });
    }

    // Fetch all active employees
    const employees = await Employee.find({
      isActive: true
    })
      .select('_id fullName department joiningDate role')
      .lean();

    // Fetch existing achievements to avoid duplicates
    const existing = await MilestoneAchievement.find({})
      .select('employeeId yearsAchieved')
      .lean();

    const existingKeys = new Set(
      existing.map((a) => `${a.employeeId}:${a.yearsAchieved}`),
    );

    const result = batchEvaluate(employees, config, existingKeys);

    // Create achievement records for newly detected milestones
    const created = [];
    for (const detection of result.detected) {
      try {
        const achievement = await MilestoneAchievement.create({
          employeeId: detection.employeeId,
          yearsAchieved: detection.yearsOfService,
          tierLabel: detection.tier.label,
          rewardType: detection.tier.reward.type,
          rewardAmount: detection.tier.reward.cashAmount || 0,
          rewardDescription: detection.tier.reward.description || '',
          detectedAt: new Date(),
          status: 'Detected',
          announcementPosted: detection.tier.announcePublicly || false
        });
        created.push(achievement);
      } catch (createErr) {
        // Duplicate key race condition — safe to ignore
        if (createErr.code !== 11000) {
          logger.error('Failed to create milestone achievement', {
            employeeId: detection.employeeId,
            years: detection.yearsOfService,
            error: createErr.message,
          });
        }
      }
    }

    // Log the evaluation run
    const evalLog = await MilestoneEvaluationLog.create({
      triggerType: 'Manual',
      evaluatedBy: req.userId,
      evaluatedAt: new Date(),
      employeesEvaluated: result.evaluated,
      milestonesDetected: created.length,
      duplicatesSkipped: result.skipped,
      status: 'Completed'
    });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'MILESTONE_BATCH_EVALUATION',
      resourceType: 'MilestoneEvaluationLog',
      resourceIds: [evalLog._id],
      details: {
        employeesEvaluated: result.evaluated,
        milestonesDetected: created.length,
        duplicatesSkipped: result.skipped,
      },
      req,
    });

    return res.status(200).json({
      message: `Batch evaluation complete`,
      employeesEvaluated: result.evaluated,
      milestonesDetected: created.length,
      duplicatesSkipped: result.skipped,
      achievements: created,
      evaluationLog: evalLog,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Achievement Management
// ============================================================================

/**
 * GET /api/milestones/achievements
 * List achievements with filtering.
 */
exports.getAchievements = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (
      req.query.employeeId &&
      mongoose.isValidObjectId(req.query.employeeId)
    ) {
      filter.employeeId = req.query.employeeId;
    }
    if (req.query.minYears) {
      filter.yearsAchieved = {
        ...filter.yearsAchieved,
        $gte: Number(req.query.minYears),
      };
    }
    if (req.query.maxYears) {
      filter.yearsAchieved = {
        ...filter.yearsAchieved,
        $lte: Number(req.query.maxYears),
      };
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;

    const [achievements, total] = await Promise.all([
      MilestoneAchievement.find(filter)
        .populate('employeeId', 'fullName department role joiningDate')
        .populate('reviewedBy', 'fullName')
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MilestoneAchievement.countDocuments(filter),
    ]);

    return res.status(200).json({
      achievements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/milestones/achievements/:id
 * Get a single achievement by ID.
 */
exports.getAchievementById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid achievement ID' });
    }

    const achievement = await MilestoneAchievement.findOne({
      _id: req.params.id
    })
      .populate('employeeId', 'fullName department role joiningDate')
      .populate('reviewedBy', 'fullName')
      .lean();

    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    return res.status(200).json({ achievement });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/milestones/achievements/:id/acknowledge
 * Acknowledge an achievement (marks it as reviewed).
 */
exports.acknowledgeAchievement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid achievement ID' });
    }

    const achievement = await MilestoneAchievement.findOne({
      _id: req.params.id
    });

    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    if (achievement.status !== 'Detected') {
      return res.status(409).json({
        message: `Cannot acknowledge a milestone in "${achievement.status}" status`,
      });
    }

    achievement.status = 'Acknowledged';
    achievement.reviewedBy = req.userId;
    achievement.reviewedAt = new Date();
    if (req.body.notes) achievement.notes = req.body.notes;
    await achievement.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'MILESTONE_ACHIEVEMENT_ACKNOWLEDGED',
      resourceType: 'MilestoneAchievement',
      resourceIds: [achievement._id],
      details: {
        employeeId: achievement.employeeId,
        yearsAchieved: achievement.yearsAchieved,
        tierLabel: achievement.tierLabel,
      },
      req,
    });

    return res
      .status(200)
      .json({ message: 'Achievement acknowledged', achievement });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/milestones/achievements/:id/disburse
 * Mark an achievement as disbursed (reward delivered).
 */
exports.disburseAchievement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid achievement ID' });
    }

    const achievement = await MilestoneAchievement.findOne({
      _id: req.params.id
    });

    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    if (!['Detected', 'Acknowledged'].includes(achievement.status)) {
      return res.status(409).json({
        message: `Cannot disburse a milestone in "${achievement.status}" status`,
      });
    }

    achievement.status = 'Disbursed';
    achievement.disbursedAt = new Date();
    achievement.reviewedBy = req.userId;
    achievement.reviewedAt = new Date();
    if (req.body.payrollRecordId) {
      achievement.payrollRecordId = req.body.payrollRecordId;
    }
    if (req.body.notes) achievement.notes = req.body.notes;
    await achievement.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'MILESTONE_ACHIEVEMENT_DISBURSED',
      resourceType: 'MilestoneAchievement',
      resourceIds: [achievement._id],
      details: {
        employeeId: achievement.employeeId,
        yearsAchieved: achievement.yearsAchieved,
        rewardType: achievement.rewardType,
        rewardAmount: achievement.rewardAmount,
      },
      req,
    });

    return res
      .status(200)
      .json({ message: 'Achievement disbursed', achievement });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/milestones/achievements/:id/skip
 * Skip an achievement (with mandatory reason).
 */
exports.skipAchievement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid achievement ID' });
    }

    const { reason } = req.body;
    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({
        message: 'A skip reason of at least 5 characters is required',
      });
    }

    const achievement = await MilestoneAchievement.findOne({
      _id: req.params.id
    });

    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    if (achievement.status === 'Disbursed') {
      return res.status(409).json({
        message: 'Cannot skip a milestone that has already been disbursed',
      });
    }

    achievement.status = 'Skipped';
    achievement.skipReason = String(reason).trim();
    achievement.reviewedBy = req.userId;
    achievement.reviewedAt = new Date();
    await achievement.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'MILESTONE_ACHIEVEMENT_SKIPPED',
      resourceType: 'MilestoneAchievement',
      resourceIds: [achievement._id],
      details: {
        employeeId: achievement.employeeId,
        yearsAchieved: achievement.yearsAchieved,
        reason: achievement.skipReason,
      },
      req,
    });

    return res
      .status(200)
      .json({ message: 'Achievement skipped', achievement });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Self-Service — Employee view of own milestones
// ============================================================================

/**
 * GET /api/milestones/my-milestones
 * Returns milestones for the currently authenticated employee.
 */
exports.getMyMilestones = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId
    })
      .select('_id fullName department joiningDate')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const achievements = await MilestoneAchievement.find({
      employeeId: employee._id
    })
      .sort({ yearsAchieved: 1 })
      .lean();

    const yearsOfService = completedYearsOfService(employee.joiningDate);

    // Find the next milestone
    const config = await MilestoneConfig.findOne({});
    const achievedYears = new Set(achievements.map((a) => a.yearsAchieved));
    let nextMilestone = null;

    if (config?.tiers) {
      const upcoming = config.tiers
        .filter(
          (t) =>
            t.isActive &&
            !achievedYears.has(t.yearsOfService) &&
            t.yearsOfService > yearsOfService,
        )
        .sort((a, b) => a.yearsOfService - b.yearsOfService);
      if (upcoming.length > 0) {
        nextMilestone = {
          yearsOfService: upcoming[0].yearsOfService,
          label: upcoming[0].label,
          reward: upcoming[0].reward,
          yearsAway: upcoming[0].yearsOfService - yearsOfService,
        };
      }
    }

    return res.status(200).json({
      employee: {
        id: employee._id,
        fullName: employee.fullName,
        department: employee.department,
        joiningDate: employee.joiningDate,
        yearsOfService,
      },
      achievements,
      nextMilestone,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Dashboard & Analytics
// ============================================================================

/**
 * GET /api/milestones/dashboard
 * Aggregate stats and upcoming milestones for the HR dashboard.
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const config = await MilestoneConfig.findOne({});

    // Count achievements by status
    const statusCounts = await MilestoneAchievement.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusMap = {
      Detected: 0,
      Acknowledged: 0,
      Disbursed: 0,
      Skipped: 0,
    };
    for (const row of statusCounts) {
      statusMap[row._id] = row.count;
    }

    // Count achievements by year-of-service
    const yearDistribution = await MilestoneAchievement.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId) } },
      { $group: { _id: '$yearsAchieved', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Total rewards disbursed
    const rewardSummary = await MilestoneAchievement.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(req.tenantId),
          status: 'Disbursed',
          rewardType: 'Cash',
        },
      },
      {
        $group: {
          _id: null,
          totalCashDisbursed: { $sum: '$rewardAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Upcoming milestones (next 90 days)
    let upcoming = [];
    if (config?.isEnabled) {
      const employees = await Employee.find({
        isActive: true
      })
        .select('_id fullName department joiningDate')
        .lean();

      const existing = await MilestoneAchievement.find({})
        .select('employeeId yearsAchieved')
        .lean();

      const existingKeys = new Set(
        existing.map((a) => `${a.employeeId}:${a.yearsAchieved}`),
      );

      const horizon = upcomingMilestones(employees, config, 90);
      upcoming = horizon.filter(
        (m) => !existingKeys.has(`${m.employeeId}:${m.yearsOfService}`),
      );
    }

    // Recent evaluation runs
    const recentRuns = await MilestoneEvaluationLog.find({})
      .populate('evaluatedBy', 'fullName')
      .sort({ evaluatedAt: -1 })
      .limit(5)
      .lean();

    return res.status(200).json({
      config: {
        isEnabled: config?.isEnabled || false,
        evaluationMode: config?.evaluationMode || 'Anniversary',
        tierCount: config?.tiers?.length || 0,
      },
      stats: {
        totalAchievements: Object.values(statusMap).reduce((a, b) => a + b, 0),
        byStatus: statusMap,
        byYearOfService: yearDistribution.map((r) => ({
          years: r._id,
          count: r.count,
        })),
        totalCashDisbursed: rewardSummary[0]?.totalCashDisbursed || 0,
        totalCashRewards: rewardSummary[0]?.count || 0,
      },
      upcomingMilestones: upcoming.slice(0, 20),
      recentEvaluationRuns: recentRuns,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/milestones/evaluation-logs
 * Paginated list of evaluation run logs.
 */
exports.getEvaluationLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      MilestoneEvaluationLog.find({})
        .populate('evaluatedBy', 'fullName')
        .sort({ evaluatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MilestoneEvaluationLog.countDocuments({}),
    ]);

    return res.status(200).json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/milestones/employee/:employeeId/history
 * Full milestone history for a specific employee (admin view).
 */
exports.getEmployeeHistory = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    const employee = await Employee.findOne({
      _id: req.params.employeeId
    })
      .select('_id fullName department role joiningDate')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const achievements = await MilestoneAchievement.find({
      employeeId: employee._id
    })
      .populate('reviewedBy', 'fullName')
      .sort({ yearsAchieved: 1 })
      .lean();

    const yearsOfService = completedYearsOfService(employee.joiningDate);

    return res.status(200).json({
      employee,
      yearsOfService,
      achievements,
      summary: {
        totalMilestones: achievements.length,
        disbursed: achievements.filter((a) => a.status === 'Disbursed').length,
        pending: achievements.filter((a) =>
          ['Detected', 'Acknowledged'].includes(a.status),
        ).length,
        skipped: achievements.filter((a) => a.status === 'Skipped').length,
        totalCashReceived: achievements
          .filter((a) => a.status === 'Disbursed' && a.rewardType === 'Cash')
          .reduce((sum, a) => sum + (a.rewardAmount || 0), 0),
      },
    });
  } catch (error) {
    return next(error);
  }
};
