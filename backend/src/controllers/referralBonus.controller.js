/**
 * @fileoverview Referral Bonus Controller
 * @description Manages referral program configuration, referral submissions,
 * candidate pipeline, bonus evaluation/payouts, and program analytics.
 */

const mongoose = require('mongoose');
const {
  ReferralProgramConfig,
  ReferralSubmission,
  ReferralBonusPayout,
  ReferralActivityLog,
} = require('../models/referralBonus.model');
const Employee = require('../models/employee.model');
const {
  isBlacklistedDomain,
  findBonusTier,
  evaluateBonusEligibility,
  checkExpiry,
  computeReferralMetrics,
  detectDuplicate,
  formatStatusMessage,
} = require('../utils/referralBonusEvaluator');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');

// ============================================================================
// Helper: log referral activity
// ============================================================================

async function logActivity(
  tenantId,
  referralId,
  action,
  performedBy,
  details,
  req,
) {
  try {
    await ReferralActivityLog.create({
      tenantId,
      referralId,
      action,
      performedBy,
      details: details || {},
      timestamp: new Date(),
    });
    eventBus.emitAuditLog({
      userId: performedBy,
      action: `REFERRAL_${action.toUpperCase().replace(/\s+/g, '_')}`,
      resourceType: 'ReferralSubmission',
      resourceIds: [referralId],
      details,
      req,
    });
  } catch (err) {
    logger.error('Failed to log referral activity', {
      referralId,
      action,
      error: err.message,
    });
  }
}

// ============================================================================
// Program Configuration
// ============================================================================

exports.getConfig = async (req, res, next) => {
  try {
    let config = await ReferralProgramConfig.findOne({
      tenantId: req.tenantId,
    });
    if (!config) {
      config = {
        tenantId: req.tenantId,
        isEnabled: false,
        maxActiveReferrals: 10,
        referralExpiryDays: 90,
        bonusTiers: [],
        blacklistedDomains: [],
        requireManagerApproval: false,
        allowSelfReferrals: false,
        isNew: true,
      };
    }
    return res.status(200).json({ config });
  } catch (error) {
    return next(error);
  }
};

exports.upsertConfig = async (req, res, next) => {
  try {
    const {
      isEnabled,
      maxActiveReferrals,
      referralExpiryDays,
      bonusTiers,
      blacklistedDomains,
      requireManagerApproval,
      allowSelfReferrals,
      notificationPreferences,
    } = req.body;

    const update = {};
    if (isEnabled !== undefined) update.isEnabled = isEnabled;
    if (maxActiveReferrals !== undefined)
      update.maxActiveReferrals = maxActiveReferrals;
    if (referralExpiryDays !== undefined)
      update.referralExpiryDays = referralExpiryDays;
    if (bonusTiers !== undefined) update.bonusTiers = bonusTiers;
    if (blacklistedDomains !== undefined)
      update.blacklistedDomains = blacklistedDomains;
    if (requireManagerApproval !== undefined)
      update.requireManagerApproval = requireManagerApproval;
    if (allowSelfReferrals !== undefined)
      update.allowSelfReferrals = allowSelfReferrals;
    if (notificationPreferences !== undefined)
      update.notificationPreferences = notificationPreferences;
    update.updatedBy = req.userId;

    const config = await ReferralProgramConfig.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: update, $setOnInsert: { createdBy: req.userId } },
      { upsert: true, new: true, runValidators: true },
    );

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'REFERRAL_CONFIG_UPDATED',
      resourceType: 'ReferralProgramConfig',
      resourceIds: [config._id],
      details: {
        isEnabled: config.isEnabled,
        tierCount: config.bonusTiers?.length || 0,
      },
      req,
    });

    return res.status(200).json({ message: 'Referral config saved', config });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

// ============================================================================
// Referral Submissions
// ============================================================================

exports.createReferral = async (req, res, next) => {
  try {
    const {
      candidateName,
      candidateEmail,
      candidatePhone,
      candidateLinkedIn,
      positionReferred,
      department,
      relationship,
      channel,
      resumeUrl,
      notes,
    } = req.body;

    const config = await ReferralProgramConfig.findOne({
      tenantId: req.tenantId,
    });
    if (!config || !config.isEnabled) {
      return res
        .status(400)
        .json({ message: 'Referral program is not active' });
    }

    if (!candidateName || !candidateEmail || !positionReferred) {
      return res
        .status(400)
        .json({
          message:
            'candidateName, candidateEmail, and positionReferred are required',
        });
    }

    // Find the employee
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id fullName');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    // Self-referral check
    if (!config.allowSelfReferrals) {
      const empEmail = await Employee.findOne({
        userId: req.userId,
        tenantId: req.tenantId,
      }).select('email');
      if (
        empEmail &&
        empEmail.email?.toLowerCase() === candidateEmail.toLowerCase()
      ) {
        return res
          .status(400)
          .json({ message: 'Self-referrals are not allowed' });
      }
    }

    // Blacklisted domain check
    if (isBlacklistedDomain(candidateEmail, config.blacklistedDomains)) {
      return res
        .status(400)
        .json({ message: 'This email domain is not eligible for referrals' });
    }

    // Active referral limit
    const activeCount = await ReferralSubmission.countDocuments({
      tenantId: req.tenantId,
      referrerId: employee._id,
      status: { $in: ['Submitted', 'Screening', 'Interviewing', 'Offered'] },
    });
    if (activeCount >= config.maxActiveReferrals) {
      return res.status(400).json({
        message: `Maximum active referrals (${config.maxActiveReferrals}) reached`,
      });
    }

    // Duplicate detection
    const existing = await ReferralSubmission.find({
      tenantId: req.tenantId,
      status: { $ne: 'Withdrawn' },
    })
      .select('candidateEmail status')
      .lean();

    const dup = detectDuplicate(candidateEmail, existing);
    if (dup.isDuplicate) {
      return res.status(409).json({
        message: 'This candidate has already been referred',
        duplicateOf: dup.duplicateOf._id,
      });
    }

    // Create referral
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.referralExpiryDays);

    const referral = await ReferralSubmission.create({
      tenantId: req.tenantId,
      referrerId: employee._id,
      candidateName: candidateName.trim(),
      candidateEmail: candidateEmail.toLowerCase().trim(),
      candidatePhone: candidatePhone || '',
      candidateLinkedIn: candidateLinkedIn || '',
      positionReferred: positionReferred.trim(),
      department: department || '',
      relationship: relationship || 'ProfessionalNetwork',
      channel: channel || 'Direct',
      resumeUrl: resumeUrl || '',
      notes: notes || '',
      status: 'Submitted',
      submittedAt: new Date(),
      expiresAt,
    });

    await logActivity(
      req.tenantId,
      referral._id,
      'Submitted',
      req.userId,
      {
        candidateName: referral.candidateName,
        positionReferred: referral.positionReferred,
        channel: referral.channel,
      },
      req,
    );

    return res.status(201).json({ message: 'Referral submitted', referral });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'This candidate has already been referred' });
    }
    return next(error);
  }
};

exports.getMyReferrals = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const filter = { tenantId: req.tenantId, referrerId: employee._id };
    if (req.query.status) filter.status = req.query.status;

    const referrals = await ReferralSubmission.find(filter)
      .sort({ submittedAt: -1 })
      .limit(50)
      .lean();

    // Add bonus eligibility info
    const config = await ReferralProgramConfig.findOne({
      tenantId: req.tenantId,
    });
    const enriched = referrals.map((r) => {
      const evaluation = evaluateBonusEligibility(r, config);
      const expiry = checkExpiry(r);
      return { ...r, bonusEvaluation: evaluation, expiry };
    });

    return res.status(200).json({ referrals: enriched });
  } catch (error) {
    return next(error);
  }
};

exports.getAllReferrals = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (
      req.query.referrerId &&
      mongoose.isValidObjectId(req.query.referrerId)
    ) {
      filter.referrerId = req.query.referrerId;
    }
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.position)
      filter.positionReferred = new RegExp(req.query.position, 'i');

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [referrals, total] = await Promise.all([
      ReferralSubmission.find(filter)
        .populate('referrerId', 'fullName department')
        .sort({ submittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReferralSubmission.countDocuments(filter),
    ]);

    return res.status(200).json({
      referrals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getReferralById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid referral ID' });
    }

    const referral = await ReferralSubmission.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate('referrerId', 'fullName department email')
      .populate('assignedTo', 'fullName')
      .lean();

    if (!referral)
      return res.status(404).json({ message: 'Referral not found' });

    // Get activity log
    const activities = await ReferralActivityLog.find({
      tenantId: req.tenantId,
      referralId: referral._id,
    })
      .populate('performedBy', 'fullName')
      .sort({ timestamp: -1 })
      .lean();

    // Get bonus evaluation
    const config = await ReferralProgramConfig.findOne({
      tenantId: req.tenantId,
    });
    const bonusEvaluation = evaluateBonusEligibility(referral, config);

    return res.status(200).json({ referral, activities, bonusEvaluation });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Candidate Pipeline Updates
// ============================================================================

exports.updateReferralStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid referral ID' });
    }

    const { status, pipelineStage, rejectionReason, interview } = req.body;

    const referral = await ReferralSubmission.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!referral)
      return res.status(404).json({ message: 'Referral not found' });

    const oldStatus = referral.status;

    if (status) {
      const validTransitions = {
        Submitted: ['Screening', 'Rejected', 'Withdrawn'],
        Screening: ['Interviewing', 'Rejected', 'Withdrawn'],
        Interviewing: ['Offered', 'Rejected', 'Withdrawn'],
        Offered: ['Hired', 'Rejected', 'Withdrawn'],
      };
      if (
        validTransitions[referral.status] &&
        !validTransitions[referral.status].includes(status)
      ) {
        return res.status(400).json({
          message: `Cannot transition from "${referral.status}" to "${status}"`,
        });
      }
      referral.status = status;
    }

    if (pipelineStage) referral.pipelineStage = pipelineStage;
    if (rejectionReason) referral.rejectionReason = rejectionReason;

    // Handle hired status
    if (status === 'Hired') {
      referral.hiredAt = new Date();
      referral.probationEndDate = new Date();
      referral.probationEndDate.setMonth(
        referral.probationEndDate.getMonth() + 3,
      );
    }

    // Handle interview
    if (interview) {
      referral.interviews.push({
        scheduledAt: interview.scheduledAt || new Date(),
        interviewer: interview.interviewer || '',
        outcome: interview.outcome || 'Pending',
        feedback: interview.feedback || '',
      });
    }

    // Handle withdrawal
    if (status === 'Withdrawn') {
      referral.withdrawnAt = new Date();
    }

    await referral.save();

    await logActivity(
      req.tenantId,
      referral._id,
      'StatusChanged',
      req.userId,
      {
        oldStatus,
        newStatus: referral.status,
        pipelineStage: referral.pipelineStage,
      },
      req,
    );

    // Auto-trigger bonus evaluation on hire
    if (status === 'Hired') {
      const config = await ReferralProgramConfig.findOne({
        tenantId: req.tenantId,
      });
      const evaluation = evaluateBonusEligibility(referral, config);
      if (evaluation.qualifies) {
        await logActivity(
          req.tenantId,
          referral._id,
          'BonusTriggered',
          req.userId,
          {
            totalBonus: evaluation.totalBonus,
            payoutTrigger: evaluation.payoutTrigger,
          },
          req,
        );
      }
    }

    return res.status(200).json({ message: 'Referral updated', referral });
  } catch (error) {
    return next(error);
  }
};

exports.assignReferral = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid referral ID' });
    }

    const { assignedTo } = req.body;
    if (!assignedTo || !mongoose.isValidObjectId(assignedTo)) {
      return res
        .status(400)
        .json({ message: 'Valid assignedTo user ID is required' });
    }

    const referral = await ReferralSubmission.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!referral)
      return res.status(404).json({ message: 'Referral not found' });

    referral.assignedTo = assignedTo;
    referral.assignedAt = new Date();
    if (referral.status === 'Submitted') referral.status = 'Screening';
    await referral.save();

    await logActivity(
      req.tenantId,
      referral._id,
      'Assigned',
      req.userId,
      {
        assignedTo,
      },
      req,
    );

    return res.status(200).json({ message: 'Referral assigned', referral });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Bonus Payouts
// ============================================================================

exports.triggerBonus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid referral ID' });
    }

    const referral = await ReferralSubmission.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!referral)
      return res.status(404).json({ message: 'Referral not found' });

    const config = await ReferralProgramConfig.findOne({
      tenantId: req.tenantId,
    });
    const evaluation = evaluateBonusEligibility(referral, config);

    if (!evaluation.qualifies) {
      return res.status(400).json({ message: evaluation.reason, evaluation });
    }

    // Check if bonus already triggered
    const existingPayout = await ReferralBonusPayout.findOne({
      tenantId: req.tenantId,
      referralId: referral._id,
      payoutTrigger: evaluation.payoutTrigger,
      status: { $ne: 'Cancelled' },
    });
    if (existingPayout) {
      return res
        .status(409)
        .json({ message: 'Bonus already triggered for this milestone' });
    }

    const payout = await ReferralBonusPayout.create({
      tenantId: req.tenantId,
      referralId: referral._id,
      referrerId: referral.referrerId,
      tierTargetRole: evaluation.bonusTier.targetRole,
      baseBonus:
        evaluation.totalBonus - (evaluation.bonusTier.channelBonus || 0),
      channelBonus: evaluation.bonusTier.channelBonus || 0,
      totalBonus: evaluation.totalBonus,
      payoutTrigger: evaluation.payoutTrigger,
      status: 'Pending',
      triggeredAt: new Date(),
    });

    await logActivity(
      req.tenantId,
      referral._id,
      'BonusTriggered',
      req.userId,
      {
        totalBonus: payout.totalBonus,
        payoutTrigger: payout.payoutTrigger,
      },
      req,
    );

    return res.status(201).json({ message: 'Bonus triggered', payout });
  } catch (error) {
    return next(error);
  }
};

exports.approveBonus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.payoutId)) {
      return res.status(400).json({ message: 'Invalid payout ID' });
    }

    const { action, notes } = req.body;
    if (!['Approved', 'Cancelled'].includes(action)) {
      return res
        .status(400)
        .json({ message: 'action must be "Approved" or "Cancelled"' });
    }

    const payout = await ReferralBonusPayout.findOne({
      _id: req.params.payoutId,
      tenantId: req.tenantId,
    });
    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    if (payout.status !== 'Pending') {
      return res
        .status(409)
        .json({
          message: `Cannot ${action.toLowerCase()} a payout in "${payout.status}" status`,
        });
    }

    payout.status = action;
    payout.approvedBy = req.userId;
    payout.approvedAt = new Date();
    if (notes) payout.notes = notes;
    await payout.save();

    await logActivity(
      req.tenantId,
      payout.referralId,
      'BonusApproved',
      req.userId,
      {
        totalBonus: payout.totalBonus,
        action,
      },
      req,
    );

    return res
      .status(200)
      .json({ message: `Payout ${action.toLowerCase()}`, payout });
  } catch (error) {
    return next(error);
  }
};

exports.markBonusPaid = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.payoutId)) {
      return res.status(400).json({ message: 'Invalid payout ID' });
    }

    const { paymentMethod, payrollRecordId, notes } = req.body;

    const payout = await ReferralBonusPayout.findOne({
      _id: req.params.payoutId,
      tenantId: req.tenantId,
    });
    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    if (payout.status !== 'Approved') {
      return res
        .status(409)
        .json({
          message: `Cannot mark as paid from "${payout.status}" status`,
        });
    }

    payout.status = 'Paid';
    payout.paidAt = new Date();
    payout.paymentMethod = paymentMethod || 'Payroll';
    if (payrollRecordId) payout.payrollRecordId = payrollRecordId;
    if (notes) payout.notes = notes;
    await payout.save();

    // Update referral status
    await ReferralSubmission.findByIdAndUpdate(payout.referralId, {
      status: 'BonusPaid',
    });

    await logActivity(
      req.tenantId,
      payout.referralId,
      'BonusPaid',
      req.userId,
      {
        totalBonus: payout.totalBonus,
        paymentMethod: payout.paymentMethod,
      },
      req,
    );

    return res.status(200).json({ message: 'Bonus marked as paid', payout });
  } catch (error) {
    return next(error);
  }
};

exports.getPayouts = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (
      req.query.referrerId &&
      mongoose.isValidObjectId(req.query.referrerId)
    ) {
      filter.referrerId = req.query.referrerId;
    }

    const payouts = await ReferralBonusPayout.find(filter)
      .populate('referrerId', 'fullName department')
      .populate('referralId', 'candidateName positionReferred')
      .sort({ triggeredAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ payouts });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Expiry Management
// ============================================================================

exports.expireReferrals = async (req, res, next) => {
  try {
    const now = new Date();
    const expired = await ReferralSubmission.updateMany(
      {
        tenantId: req.tenantId,
        status: { $in: ['Submitted', 'Screening', 'Interviewing'] },
        expiresAt: { $lte: now },
      },
      { $set: { status: 'Expired' } },
    );

    if (expired.modifiedCount > 0) {
      logger.info(
        `Expired ${expired.modifiedCount} referrals for tenant ${req.tenantId}`,
      );
    }

    return res
      .status(200)
      .json({
        message: 'Expiry check complete',
        expired: expired.modifiedCount,
      });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Analytics Dashboard
// ============================================================================

exports.getDashboard = async (req, res, next) => {
  try {
    const [submissions, payouts, config] = await Promise.all([
      ReferralSubmission.find({ tenantId: req.tenantId }).lean(),
      ReferralBonusPayout.find({ tenantId: req.tenantId }).lean(),
      ReferralProgramConfig.findOne({ tenantId: req.tenantId }),
    ]);

    const metrics = computeReferralMetrics(submissions, payouts);

    // Upcoming expirations (next 7 days)
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const expiringSoon = await ReferralSubmission.countDocuments({
      tenantId: req.tenantId,
      status: { $in: ['Submitted', 'Screening', 'Interviewing'] },
      expiresAt: { $lte: in7Days, $gt: new Date() },
    });

    // Pending approvals
    const pendingApprovals = await ReferralBonusPayout.countDocuments({
      tenantId: req.tenantId,
      status: 'Pending',
    });

    return res.status(200).json({
      config: {
        isEnabled: config?.isEnabled || false,
        tierCount: config?.bonusTiers?.length || 0,
      },
      metrics,
      alerts: {
        expiringSoon,
        pendingApprovals,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getMyStats = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const referrals = await ReferralSubmission.find({
      tenantId: req.tenantId,
      referrerId: employee._id,
    }).lean();

    const payouts = await ReferralBonusPayout.find({
      tenantId: req.tenantId,
      referrerId: employee._id,
    }).lean();

    const totalReferrals = referrals.length;
    const hired = referrals.filter(
      (r) => r.status === 'Hired' || r.status === 'BonusPaid',
    ).length;
    const totalEarned = payouts
      .filter((p) => p.status === 'Paid')
      .reduce((sum, p) => sum + (p.totalBonus || 0), 0);
    const pendingBonus = payouts
      .filter((p) => ['Pending', 'Approved'].includes(p.status))
      .reduce((sum, p) => sum + (p.totalBonus || 0), 0);

    return res.status(200).json({
      stats: {
        totalReferrals,
        hired,
        conversionRate:
          totalReferrals > 0 ? Math.round((hired / totalReferrals) * 100) : 0,
        totalEarned,
        pendingBonus,
        activeReferrals: referrals.filter((r) =>
          ['Submitted', 'Screening', 'Interviewing', 'Offered'].includes(
            r.status,
          ),
        ).length,
      },
    });
  } catch (error) {
    return next(error);
  }
};
