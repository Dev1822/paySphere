/**
 * @fileoverview Handover Controller
 * @description Manages offboarding plans, knowledge transfers, asset recoveries,
 * clearance scoring, and FnF release certification.
 */
const { HandoverPlan } = require('../models/handover.model');
const Employee = require('../models/employee.model');
const {
  generateAccessRevocationChecklist,
  calculateClearanceScore,
  calculateAssetRecoveryDeductions,
  checkFnFBlock,
  buildClearanceCertificate,
} = require('../utils/handoverEngine.utils');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

exports.initiateHandover = async (req, res, next) => {
  try {
    const { employeeId, exitDate } = req.body;
    const employee = await Employee.findOne({
      _id: employeeId
    });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const accessChecklist = generateAccessRevocationChecklist(employee.department, employee.role);

    const plan = await HandoverPlan.create({
      employeeId: employee._id,
      exitDate: new Date(exitDate),
      accessRevocations: accessChecklist,
      status: 'In Progress'
    });

    res.status(201).json({ message: 'Handover plan initiated', plan });
  } catch (error) { next(error); }
};

exports.updateKnowledgeTransfer = async (req, res, next) => {
  try {
    const { planId, ktId, isCompleted, link, attachmentUrl } = req.body;
    const plan = await HandoverPlan.findOne({
      _id: planId
    });
    if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

    const kt = plan.knowledgeTransfers.id(ktId);
    if (!kt) return res.status(404).json({ message: 'Knowledge transfer item not found' });

    if (isCompleted !== undefined) {
      kt.isCompleted = isCompleted;
      kt.completedAt = isCompleted ? new Date() : null;
    }
    if (link) kt.link = link;
    if (attachmentUrl) kt.attachmentUrl = attachmentUrl;

    plan.clearanceScore = calculateClearanceScore(plan);
    const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
    plan.isFnFBlocked = blockCheck.isBlocked;

    await plan.save();
    res.status(200).json({ message: 'Knowledge transfer updated', plan });
  } catch (error) { next(error); }
};

exports.updateAssetRecovery = async (req, res, next) => {
  try {
    const { planId, assetId, condition, recoveryNotes, payrollDeduction } = req.body;
    const plan = await HandoverPlan.findOne({
      _id: planId
    });
    if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

    const asset = plan.assetRecoveries.id(assetId);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    asset.condition = condition;
    asset.recoveryNotes = recoveryNotes || asset.recoveryNotes;
    asset.payrollDeduction = payrollDeduction || 0;
    if (condition !== 'Pending Return') asset.recoveredAt = new Date();

    plan.clearanceScore = calculateClearanceScore(plan);
    const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
    plan.isFnFBlocked = blockCheck.isBlocked;

    await plan.save();
    res.status(200).json({ message: 'Asset recovery updated', plan });
  } catch (error) { next(error); }
};

exports.revokeAccess = async (req, res, next) => {
  try {
    const { planId, accessId } = req.body;
    const plan = await HandoverPlan.findOne({
      _id: planId
    });
    if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

    const access = plan.accessRevocations.id(accessId);
    if (!access) return res.status(404).json({ message: 'Access item not found' });

    access.isRevoked = true;
    access.revokedAt = new Date();
    access.revokedBy = req.userId;

    plan.clearanceScore = calculateClearanceScore(plan);
    plan.itSignOff = plan.accessRevocations.every((a) => a.isRevoked);
    if (plan.itSignOff) plan.itSignOffDate = new Date();

    const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
    plan.isFnFBlocked = blockCheck.isBlocked;

    if (!plan.isFnFBlocked) plan.status = 'Cleared';

    await plan.save();
    res.status(200).json({ message: 'Access revoked', plan });
  } catch (error) { next(error); }
};

exports.managerSignOff = async (req, res, next) => {
  try {
    const { planId, remarks } = req.body;
    const plan = await HandoverPlan.findOne({
      _id: planId
    });
    if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

    plan.managerSignOff = true;
    plan.managerSignOffDate = new Date();
    plan.managerRemarks = remarks || '';

    const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
    plan.isFnFBlocked = blockCheck.isBlocked;
    if (!plan.isFnFBlocked) plan.status = 'Cleared';

    await plan.save();
    logger.info(`[Handover] Manager signed off on plan ${planId}`);
    res.status(200).json({ message: 'Manager sign-off recorded', plan });
  } catch (error) { next(error); }
};

exports.getMyHandover = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId
    });
    if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

    const plan = await HandoverPlan.findOne({
      employeeId: employee._id
    });
    res.status(200).json({ plan });
  } catch (error) { next(error); }
};

exports.checkFnFEligibility = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const plan = await HandoverPlan.findOne({
      employeeId
    });

    if (!plan) {
      return res.status(200).json({ isEligible: true, reason: 'No active handover plan found. Clear to proceed.' });
    }

    const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
    res.status(200).json({
      isEligible: !blockCheck.isBlocked,
      reason: blockCheck.reason,
      clearanceScore: plan.clearanceScore,
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/handover/:planId/asset-deductions
 * Summary of physical asset damage/loss deductions for FnF ledger settlement.
 */
exports.getAssetDeductionSummary = async (req, res, next) => {
  try {
    const plan = await HandoverPlan.findOne({
      _id: req.params.planId
    });
    if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

    const deductions = calculateAssetRecoveryDeductions(plan.assetRecoveries || []);
    res.status(200).json({
      planId: plan._id,
      employeeId: plan.employeeId,
      ...deductions,
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/handover/:planId/certificate
 * Generates digital exit clearance certificate when clearance is 100%.
 */
exports.generateClearanceCertificate = async (req, res, next) => {
  try {
    const plan = await HandoverPlan.findOne({
      _id: req.params.planId
    });
    if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

    const employee = await Employee.findById(plan.employeeId);
    const certificate = buildClearanceCertificate(plan, employee || {});

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXIT_CLEARANCE_CERTIFICATE_GENERATED',
      resourceType: 'HandoverPlan',
      resourceIds: [plan._id],
      details: {
        certificateNumber: certificate.certificateNumber,
        employeeId: plan.employeeId,
        clearanceScore: certificate.clearanceScore,
      },
      req,
    });

    res.status(200).json({
      message: 'Clearance certificate generated successfully',
      certificate,
    });
  } catch (error) {
    if (error.message.startsWith('Cannot issue clearance certificate')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};
