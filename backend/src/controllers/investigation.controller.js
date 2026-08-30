/**
 * @fileoverview Investigation Workflow Controller
 * @description Manages the end-to-end investigation lifecycle for grievance
 * cases: creating and tracking investigation steps, managing case comments,
 * handling evidence uploads, tracking assignments, and producing workflow
 * analytics. Integrates with the existing Grievance model and event bus for
 * audit logging.
 */
const {
  InvestigationStep,
  CaseComment,
  CaseAssignment,
  CaseEvidence,
} = require('../models/investigation.model');
const { Grievance } = require('../models/grievance.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

// ============================================================================
// Investigation Steps
// ============================================================================

/**
 * POST /api/investigation/cases/:caseId/steps
 * Create a new investigation step for a case.
 */
exports.createStep = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { actionType, title, description, confidentialNotes, isConfidential, dueDate, attachments } = req.body;

    const grievance = await Grievance.findOne(tenantFilter(req, { _id: caseId }));
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance case not found' });
    }

    // Determine next step number
    const lastStep = await InvestigationStep.findOne(
      tenantFilter(req, { caseId }),
    ).sort({ stepNumber: -1 });
    const stepNumber = lastStep ? lastStep.stepNumber + 1 : 1;

    const step = await InvestigationStep.create({
      tenantId: req.tenantId,
      caseId,
      stepNumber,
      actionType,
      title,
      description,
      confidentialNotes: confidentialNotes || '',
      isConfidential: isConfidential || false,
      dueDate: dueDate ? new Date(dueDate) : null,
      attachments: attachments || [],
      performedBy: req.userId,
      status: 'PENDING',
    });

    // Auto-transition case to 'Under Inquiry' if it is still 'Filed'
    if (grievance.status === 'Filed') {
      grievance.status = 'Under Inquiry';
      await grievance.save();
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'INVESTIGATION_STEP_CREATED',
      resourceType: 'InvestigationStep',
      resourceIds: [step._id],
      details: { caseId, stepNumber, actionType, title },
      req,
    });

    res.status(201).json({ step });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/investigation/cases/:caseId/steps
 * List all investigation steps for a case.
 */
exports.getSteps = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    const steps = await InvestigationStep.find(
      tenantFilter(req, { caseId }),
    )
      .populate('performedBy', 'name email')
      .sort({ stepNumber: 1 })
      .lean();

    res.status(200).json({ steps, total: steps.length });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/investigation/steps/:stepId
 * Update an investigation step's status, notes, or details.
 */
exports.updateStep = async (req, res, next) => {
  try {
    const { stepId } = req.params;
    const { status, description, confidentialNotes, dueDate } = req.body;

    const step = await InvestigationStep.findOne(
      tenantFilter(req, { _id: stepId }),
    );
    if (!step) {
      return res.status(404).json({ message: 'Investigation step not found' });
    }

    if (status) step.status = status;
    if (description) step.description = description;
    if (confidentialNotes !== undefined) step.confidentialNotes = confidentialNotes;
    if (dueDate) step.dueDate = new Date(dueDate);

    if (status === 'COMPLETED' && !step.completedAt) {
      step.completedAt = new Date();
    }

    await step.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'INVESTIGATION_STEP_UPDATED',
      resourceType: 'InvestigationStep',
      resourceIds: [step._id],
      details: { caseId: String(step.caseId), stepNumber: step.stepNumber, status: step.status },
      req,
    });

    res.status(200).json({ step });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/investigation/steps/:stepId
 * Soft-delete (cancel) an investigation step.
 */
exports.cancelStep = async (req, res, next) => {
  try {
    const { stepId } = req.params;

    const step = await InvestigationStep.findOne(
      tenantFilter(req, { _id: stepId }),
    );
    if (!step) {
      return res.status(404).json({ message: 'Investigation step not found' });
    }

    step.status = 'CANCELLED';
    step.completedAt = new Date();
    await step.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'INVESTIGATION_STEP_CANCELLED',
      resourceType: 'InvestigationStep',
      resourceIds: [step._id],
      details: { caseId: String(step.caseId), stepNumber: step.stepNumber },
      req,
    });

    res.status(200).json({ message: 'Step cancelled', step });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Case Comments
// ============================================================================

/**
 * POST /api/investigation/cases/:caseId/comments
 * Add a comment to a case.
 */
exports.addComment = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { content, isInternal, mentions, parentCommentId } = req.body;

    const comment = await CaseComment.create({
      tenantId: req.tenantId,
      caseId,
      authorId: req.userId,
      content,
      isInternal: isInternal || false,
      mentions: mentions || [],
      parentCommentId: parentCommentId || null,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CASE_COMMENT_ADDED',
      resourceType: 'CaseComment',
      resourceIds: [comment._id],
      details: { caseId, isInternal: !!isInternal },
      req,
    });

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/investigation/cases/:caseId/comments
 * List comments for a case, with optional internal filter.
 */
exports.getComments = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { includeInternal } = req.query;

    const filter = tenantFilter(req, { caseId });
    // By default exclude internal comments unless explicitly requested
    if (includeInternal !== 'true') {
      filter.isInternal = { $ne: true };
    }

    const comments = await CaseComment.find(filter)
      .populate('authorId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ comments, total: comments.length });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/investigation/comments/:commentId
 * Delete a comment (author or admin only).
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    const comment = await CaseComment.findOne(
      tenantFilter(req, { _id: commentId }),
    );
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Only the author or an admin can delete
    if (String(comment.authorId) !== String(req.userId) && req.userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await CaseComment.deleteOne({ _id: comment._id });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CASE_COMMENT_DELETED',
      resourceType: 'CaseComment',
      resourceIds: [comment._id],
      details: { caseId: String(comment.caseId) },
      req,
    });

    res.status(200).json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Evidence Management
// ============================================================================

/**
 * POST /api/investigation/cases/:caseId/evidence
 * Upload evidence to a case.
 */
exports.addEvidence = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { evidenceType, title, description, fileUrl, fileName, fileSize, mimeType, confidentialityLevel } = req.body;

    const evidence = await CaseEvidence.create({
      tenantId: req.tenantId,
      caseId,
      evidenceType,
      title,
      description: description || '',
      fileUrl,
      fileName,
      fileSize: fileSize || 0,
      mimeType: mimeType || 'application/octet-stream',
      uploadedBy: req.userId,
      confidentialityLevel: confidentialityLevel || 'CONFIDENTIAL',
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CASE_EVIDENCE_ADDED',
      resourceType: 'CaseEvidence',
      resourceIds: [evidence._id],
      details: { caseId, evidenceType, title, confidentialityLevel: evidence.confidentialityLevel },
      req,
    });

    res.status(201).json({ evidence });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/investigation/cases/:caseId/evidence
 * List all evidence for a case.
 */
exports.getEvidence = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    const evidence = await CaseEvidence.find(
      tenantFilter(req, { caseId }),
    )
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ evidence, total: evidence.length });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/investigation/evidence/:evidenceId/verify
 * Mark evidence as verified (chain-of-custody).
 */
exports.verifyEvidence = async (req, res, next) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await CaseEvidence.findOne(
      tenantFilter(req, { _id: evidenceId }),
    );
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    evidence.verified = true;
    evidence.verifiedBy = req.userId;
    evidence.verifiedAt = new Date();
    await evidence.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CASE_EVIDENCE_VERIFIED',
      resourceType: 'CaseEvidence',
      resourceIds: [evidence._id],
      details: { caseId: String(evidence.caseId), title: evidence.title },
      req,
    });

    res.status(200).json({ evidence });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Case Assignment
// ============================================================================

/**
 * POST /api/investigation/cases/:caseId/assign
 * Assign a team member to a case.
 */
exports.assignToCase = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { assignedTo, role, reason } = req.body;

    // Deactivate any previous assignment for the same user on this case
    await CaseAssignment.updateMany(
      tenantFilter(req, { caseId, assignedTo, isActive: true }),
      { isActive: false, unassignedAt: new Date(), unassignedBy: req.userId, reason: 'Reassigned' },
    );

    const assignment = await CaseAssignment.create({
      tenantId: req.tenantId,
      caseId,
      assignedTo,
      assignedBy: req.userId,
      role,
      reason: reason || '',
    });

    await assignment.populate('assignedTo', 'name email');

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CASE_MEMBER_ASSIGNED',
      resourceType: 'CaseAssignment',
      resourceIds: [assignment._id],
      details: { caseId, role, assignedTo },
      req,
    });

    res.status(201).json({ assignment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/investigation/cases/:caseId/assignments
 * List assignment history for a case.
 */
exports.getAssignments = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    const assignments = await CaseAssignment.find(
      tenantFilter(req, { caseId }),
    )
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ assignments, total: assignments.length });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/investigation/assignments/:assignmentId/deactivate
 * Remove a team member from a case.
 */
exports.deactivateAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const { reason } = req.body;

    const assignment = await CaseAssignment.findOne(
      tenantFilter(req, { _id: assignmentId, isActive: true }),
    );
    if (!assignment) {
      return res.status(404).json({ message: 'Active assignment not found' });
    }

    assignment.isActive = false;
    assignment.unassignedAt = new Date();
    assignment.unassignedBy = req.userId;
    assignment.reason = reason || 'Removed from case';
    await assignment.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CASE_MEMBER_REMOVED',
      resourceType: 'CaseAssignment',
      resourceIds: [assignment._id],
      details: { caseId: String(assignment.caseId), reason: assignment.reason },
      req,
    });

    res.status(200).json({ assignment });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Workflow Analytics & Dashboard
// ============================================================================

/**
 * GET /api/investigation/dashboard
 * Aggregated investigation metrics across all cases for the tenant.
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();

    const [
      totalCases,
      openCases,
      stepsByStatus,
      recentSteps,
      activeAssignments,
      evidenceCount,
      slaBreachCount,
    ] = await Promise.all([
      Grievance.countDocuments(tenantFilter(req, {})),
      Grievance.countDocuments(
        tenantFilter(req, { status: { $in: ['Filed', 'Under Inquiry'] } }),
      ),
      InvestigationStep.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      InvestigationStep.find(tenantFilter(req, {}))
        .populate('performedBy', 'name')
        .populate('caseId', 'caseNumber')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      CaseAssignment.countDocuments(
        tenantFilter(req, { isActive: true }),
      ),
      CaseEvidence.countDocuments(tenantFilter(req, {})),
      Grievance.countDocuments(
        tenantFilter(req, {
          status: { $in: ['Filed', 'Under Inquiry'] },
          slaDeadline: { $lt: now },
        }),
      ),
    ]);

    // Compute step completion rate
    const completedSteps = stepsByStatus.find((s) => s._id === 'COMPLETED');
    const totalSteps = stepsByStatus.reduce((sum, s) => sum + s.count, 0);
    const completionRate = totalSteps > 0
      ? Math.round(((completedSteps?.count || 0) / totalSteps) * 100)
      : 0;

    // Category breakdown for open cases
    const categoryBreakdown = await Grievance.aggregate([
      { $match: { tenantId: req.tenantId, status: { $in: ['Filed', 'Under Inquiry'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      totalCases,
      openCases,
      activeAssignments,
      evidenceCount,
      slaBreachCount,
      completionRate,
      stepsByStatus: stepsByStatus.reduce((acc, s) => {
        acc[s._id] = s.count;
        return acc;
      }, {}),
      categoryBreakdown,
      recentSteps,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/investigation/cases/:caseId/timeline
 * Full investigation timeline for a case, merging steps, comments, assignments,
 * and evidence into a chronological feed.
 */
exports.getCaseTimeline = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    const [steps, comments, assignments, evidence, grievance] = await Promise.all([
      InvestigationStep.find(tenantFilter(req, { caseId }))
        .populate('performedBy', 'name email')
        .lean(),
      CaseComment.find(tenantFilter(req, { caseId }))
        .populate('authorId', 'name email')
        .lean(),
      CaseAssignment.find(tenantFilter(req, { caseId }))
        .populate('assignedTo', 'name email')
        .populate('assignedBy', 'name email')
        .lean(),
      CaseEvidence.find(tenantFilter(req, { caseId }))
        .populate('uploadedBy', 'name email')
        .lean(),
      Grievance.findOne(tenantFilter(req, { _id: caseId })).lean(),
    ]);

    // Merge into unified timeline
    const events = [];

    for (const step of steps) {
      events.push({
        type: 'STEP',
        timestamp: step.createdAt,
        data: step,
      });
    }

    for (const comment of comments) {
      events.push({
        type: 'COMMENT',
        timestamp: comment.createdAt,
        data: comment,
      });
    }

    for (const assignment of assignments) {
      events.push({
        type: 'ASSIGNMENT',
        timestamp: assignment.createdAt,
        data: assignment,
      });
    }

    for (const ev of evidence) {
      events.push({
        type: 'EVIDENCE',
        timestamp: ev.createdAt,
        data: ev,
      });
    }

    // Add case lifecycle events
    if (grievance) {
      events.push({
        type: 'CASE_FILED',
        timestamp: grievance.filedAt,
        data: { caseNumber: grievance.caseNumber, status: grievance.status },
      });
      if (grievance.resolutionDate) {
        events.push({
          type: 'CASE_RESOLVED',
          timestamp: grievance.resolutionDate,
          data: { caseNumber: grievance.caseNumber, verdict: grievance.finalVerdict },
        });
      }
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      caseId,
      caseNumber: grievance?.caseNumber || null,
      status: grievance?.status || null,
      timeline: events,
      summary: {
        totalSteps: steps.length,
        totalComments: comments.length,
        totalEvidence: evidence.length,
        activeAssignments: assignments.filter((a) => a.isActive).length,
      },
    });
  } catch (error) {
    next(error);
  }
};
