/**
 * @fileoverview Offboarding Controller
 * @description Request handlers for offboarding lifecycle, clearance, assets,
 *   knowledge transfer, exit interviews, settlements, and analytics.
 */

const offboardingService = require('../services/offboarding.service');
const Employee = require('../models/employee.model');

// ─── Process Endpoints ──────────────────────────────────────────────────────

/**
 * POST /api/offboarding
 * Initiate an offboarding process.
 */
exports.initiateOffboarding = async (req, res, next) => {
  try {
    const { employeeId, exitType, lastWorkingDay, noticePeriodDays, noticePeriodStatus, leavingReason, leavingReasonNotes, handoverToId } = req.body;
    if (!employeeId || !exitType || !lastWorkingDay) {
      return res.status(400).json({
        message: 'employeeId, exitType, and lastWorkingDay are required',
      });
    }
    const process = await offboardingService.initiateOffboarding(
      req.tenantId,
      employeeId,
      {
        exitType,
        lastWorkingDay,
        resignationDate: req.body.resignationDate,
        noticePeriodDays,
        noticePeriodStatus,
        leavingReason,
        leavingReasonNotes,
        handoverToId,
        reportingToId: req.body.reportingToId,
      },
      req.userId,
    );
    res.status(201).json({ message: 'Offboarding initiated', process });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/offboarding
 * List all offboarding processes with filters.
 */
exports.getProcesses = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.exitType) filters.exitType = req.query.exitType;
    if (req.query.department) filters.department = req.query.department;
    if (req.query.upcomingDays) filters.upcomingDays = parseInt(req.query.upcomingDays, 10);

    const processes = await offboardingService.getProcesses(req.tenantId, filters);
    res.status(200).json({ processes });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/offboarding/:processId
 * Get a specific offboarding process with full details.
 */
exports.getProcess = async (req, res, next) => {
  try {
    const process = await offboardingService.getProcess(req.params.processId, req.tenantId);

    const [checklist, assets, knowledgeTransfers, activityLog] = await Promise.all([
      offboardingService.getClearanceChecklist(process._id, req.tenantId),
      offboardingService.getAssetReturns(process._id, req.tenantId),
      offboardingService.getKnowledgeTransfers(process._id, req.tenantId),
      offboardingService.getActivityLog(process._id, req.tenantId),
    ]);

    res.status(200).json({ process, checklist, assets, knowledgeTransfers, activityLog });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/offboarding/:processId/status
 * Transition offboarding status.
 */
exports.transitionProcess = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }
    const process = await offboardingService.transitionProcess(
      req.params.processId,
      req.tenantId,
      status,
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Status updated', process });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/offboarding/:processId/handover
 * Update handover details.
 */
exports.updateHandover = async (req, res, next) => {
  try {
    const process = await offboardingService.updateHandover(
      req.params.processId,
      req.tenantId,
      req.body,
      req.userId,
    );
    res.status(200).json({ message: 'Handover updated', process });
  } catch (error) {
    next(error);
  }
};

// ─── Clearance Checklist ────────────────────────────────────────────────────

/**
 * POST /api/offboarding/:processId/checklist
 * Add a clearance checklist item.
 */
exports.addClearanceItem = async (req, res, next) => {
  try {
    const { category, title, description, isMandatory, assignedToId } = req.body;
    if (!category || !title) {
      return res.status(400).json({ message: 'category and title are required' });
    }
    const item = await offboardingService.addClearanceItem(
      req.params.processId,
      req.tenantId,
      { category, title, description, isMandatory, assignedToId },
    );
    res.status(201).json({ message: 'Checklist item added', item });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/offboarding/checklist/:itemId
 * Update a clearance checklist item.
 */
exports.updateClearanceItem = async (req, res, next) => {
  try {
    const item = await offboardingService.updateClearanceItem(
      req.params.itemId,
      req.tenantId,
      req.body,
      req.userId,
    );
    res.status(200).json({ message: 'Checklist item updated', item });
  } catch (error) {
    next(error);
  }
};

// ─── Asset Returns ──────────────────────────────────────────────────────────

/**
 * POST /api/offboarding/:processId/assets
 * Add an asset return record.
 */
exports.addAssetReturn = async (req, res, next) => {
  try {
    const { assetType, assetDescription, assetTag, serialNumber, estimatedValue } = req.body;
    if (!assetType || !assetDescription) {
      return res.status(400).json({ message: 'assetType and assetDescription are required' });
    }
    const asset = await offboardingService.addAssetReturn(
      req.params.processId,
      req.tenantId,
      { assetType, assetDescription, assetTag, serialNumber, estimatedValue },
    );
    res.status(201).json({ message: 'Asset record added', asset });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/offboarding/assets/:assetId
 * Update an asset return record.
 */
exports.updateAssetReturn = async (req, res, next) => {
  try {
    const asset = await offboardingService.updateAssetReturn(
      req.params.assetId,
      req.tenantId,
      req.body,
      req.userId,
    );
    res.status(200).json({ message: 'Asset record updated', asset });
  } catch (error) {
    next(error);
  }
};

// ─── Knowledge Transfer ─────────────────────────────────────────────────────

/**
 * POST /api/offboarding/:processId/knowledge-transfer
 * Add a knowledge transfer record.
 */
exports.addKnowledgeTransfer = async (req, res, next) => {
  try {
    const { transferToId, topic, description, documentationUrl } = req.body;
    if (!transferToId || !topic) {
      return res.status(400).json({ message: 'transferToId and topic are required' });
    }
    const kt = await offboardingService.addKnowledgeTransfer(
      req.params.processId,
      req.tenantId,
      { transferToId, topic, description, documentationUrl },
    );
    res.status(201).json({ message: 'Knowledge transfer record added', knowledgeTransfer: kt });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/offboarding/knowledge-transfer/:ktId
 * Update a knowledge transfer record.
 */
exports.updateKnowledgeTransfer = async (req, res, next) => {
  try {
    const kt = await offboardingService.updateKnowledgeTransfer(
      req.params.ktId,
      req.tenantId,
      req.body,
      req.userId,
    );
    res.status(200).json({ message: 'Knowledge transfer updated', knowledgeTransfer: kt });
  } catch (error) {
    next(error);
  }
};

// ─── Exit Interview ─────────────────────────────────────────────────────────

/**
 * POST /api/offboarding/:processId/exit-interview/schedule
 * Schedule an exit interview.
 */
exports.scheduleExitInterview = async (req, res, next) => {
  try {
    const { date, interviewerId } = req.body;
    if (!date || !interviewerId) {
      return res.status(400).json({ message: 'date and interviewerId are required' });
    }
    const process = await offboardingService.scheduleExitInterview(
      req.params.processId,
      req.tenantId,
      { date, interviewerId },
      req.userId,
    );
    res.status(200).json({ message: 'Exit interview scheduled', process });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/offboarding/:processId/exit-interview/complete
 * Complete an exit interview.
 */
exports.completeExitInterview = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;
    if (!rating) {
      return res.status(400).json({ message: 'rating is required' });
    }
    const process = await offboardingService.completeExitInterview(
      req.params.processId,
      req.tenantId,
      { rating, feedback },
      req.userId,
    );
    res.status(200).json({ message: 'Exit interview completed', process });
  } catch (error) {
    next(error);
  }
};

// ─── Settlement ─────────────────────────────────────────────────────────────

/**
 * POST /api/offboarding/:processId/settlement/initiate
 * Initiate final settlement.
 */
exports.initiateSettlement = async (req, res, next) => {
  try {
    const result = await offboardingService.initiateSettlement(
      req.params.processId,
      req.tenantId,
      req.userId,
    );
    res.status(200).json({
      message: 'Settlement initiated',
      process: result.process,
      estimate: result.estimate,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/offboarding/:processId/settlement/process
 * Mark settlement as processed.
 */
exports.processSettlement = async (req, res, next) => {
  try {
    const { finalAmount } = req.body;
    if (finalAmount === undefined) {
      return res.status(400).json({ message: 'finalAmount is required' });
    }
    const process = await offboardingService.processSettlement(
      req.params.processId,
      req.tenantId,
      finalAmount,
      req.userId,
    );
    res.status(200).json({ message: 'Settlement processed', process });
  } catch (error) {
    next(error);
  }
};

// ─── Reports & Analytics ────────────────────────────────────────────────────

/**
 * GET /api/offboarding/dashboard
 * Get offboarding dashboard summary.
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const dashboard = await offboardingService.getOffboardingDashboard(req.tenantId);
    res.status(200).json({ dashboard });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/offboarding/reports/attrition
 * Get attrition analytics report.
 */
exports.getAttritionReport = async (req, res, next) => {
  try {
    const report = await offboardingService.getAttritionReport(
      req.tenantId,
      req.query.startDate,
      req.query.endDate,
    );
    res.status(200).json({ report });
  } catch (error) {
    next(error);
  }
};
