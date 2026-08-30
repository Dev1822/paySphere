/**
 * @fileoverview Offboarding Service
 * @description Business logic for offboarding lifecycle, clearance checklists,
 *   asset returns, knowledge transfers, exit interviews, settlements, and analytics.
 */

const {
  OffboardingProcess,
  ClearanceChecklistItem,
  AssetReturn,
  KnowledgeTransfer,
  OffboardingActivityLog,
} = require('../models/offboarding.model');
const Employee = require('../models/employee.model');
const {
  DEFAULT_CLEARANCE_ITEMS,
  validateTransition,
  calculateProgress,
  checkMandatoryClearance,
  estimateSettlement,
  calculateNoticePeriod,
  generateAttritionAnalytics,
} = require('../utils/offboarding.utils');
const logger = require('../utils/logger');

// ─── Process Lifecycle ──────────────────────────────────────────────────────

async function initiateOffboarding(tenantId, employeeId, data, userId) {
  const existing = await OffboardingProcess.findOne({ tenantId, employeeId });
  if (existing) {
    throw Object.assign(
      new Error('Offboarding process already exists for this employee'),
      { statusCode: 409 },
    );
  }

  const process = await OffboardingProcess.create({
    ...data,
    tenantId,
    employeeId,
    createdBy: userId,
    statusHistory: [
      {
        status: 'Initiated',
        changedBy: userId,
        changedAt: new Date(),
        comment: 'Offboarding initiated',
      },
    ],
  });

  // Create default clearance checklist
  const checklistItems = DEFAULT_CLEARANCE_ITEMS.map((item, index) => ({
    tenantId,
    offboardingId: process._id,
    category: item.category,
    title: item.title,
    isMandatory: item.isMandatory,
    sortOrder: item.sortOrder,
    status: 'Pending',
  }));
  await ClearanceChecklistItem.insertMany(checklistItems);

  await logActivity(tenantId, process._id, 'ProcessInitiated', {
    exitType: data.exitType,
    lastWorkingDay: data.lastWorkingDay,
  }, userId);

  logger.info('Offboarding initiated', { processId: process._id, employeeId });
  return process;
}

async function getProcess(processId, tenantId) {
  const process = await OffboardingProcess.findOne({ _id: processId, tenantId })
    .populate('employeeId', 'fullName email department')
    .populate('handoverToId', 'fullName');
  if (!process) {
    throw Object.assign(new Error('Offboarding process not found'), { statusCode: 404 });
  }
  return process;
}

async function getProcesses(tenantId, filters = {}) {
  const query = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.exitType) query.exitType = filters.exitType;
  if (filters.department) {
    const employees = await Employee.find({ tenantId, department: filters.department }).select('_id');
    query.employeeId = { $in: employees.map((e) => e._id) };
  }
  if (filters.upcomingDays) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + filters.upcomingDays);
    query.lastWorkingDay = { $lte: targetDate };
  }

  return OffboardingProcess.find(query)
    .populate('employeeId', 'fullName email department')
    .sort({ lastWorkingDay: 1 });
}

async function transitionProcess(processId, tenantId, targetStatus, userId, comment) {
  const process = await OffboardingProcess.findOne({ _id: processId, tenantId });
  if (!process) {
    throw Object.assign(new Error('Offboarding process not found'), { statusCode: 404 });
  }

  const validation = validateTransition(process.status, targetStatus);
  if (!validation.allowed) {
    throw Object.assign(new Error(validation.reason), { statusCode: 400 });
  }

  process.status = targetStatus;
  process.statusHistory.push({
    status: targetStatus,
    changedBy: userId,
    changedAt: new Date(),
    comment: comment || '',
  });

  if (targetStatus === 'Completed') {
    process.completedAt = new Date();
    process.completedBy = userId;
    process.progressPercent = 100;
  }

  await process.save();

  await logActivity(tenantId, processId, 'StatusChanged', {
    to: targetStatus,
  }, userId);

  return process;
}

// ─── Clearance Checklist ────────────────────────────────────────────────────

async function getClearanceChecklist(offboardingId, tenantId) {
  return ClearanceChecklistItem.find({ offboardingId, tenantId })
    .populate('assignedToId', 'fullName')
    .populate('clearedById', 'fullName')
    .sort({ category: 1, sortOrder: 1 });
}

async function updateClearanceItem(itemId, tenantId, data, userId) {
  const item = await ClearanceChecklistItem.findOne({ _id: itemId, tenantId });
  if (!item) {
    throw Object.assign(new Error('Clearance item not found'), { statusCode: 404 });
  }

  if (data.status === 'Cleared') {
    item.clearedById = userId;
    item.clearedAt = new Date();
  }

  Object.assign(item, data);
  await item.save();

  // Recalculate progress
  const allItems = await ClearanceChecklistItem.find({
    offboardingId: item.offboardingId,
    tenantId,
  });
  const process = await OffboardingProcess.findOne({
    _id: item.offboardingId,
    tenantId,
  });

  if (process) {
    process.progressPercent = calculateProgress(allItems, process);
    await process.save();
  }

  return item;
}

async function addClearanceItem(offboardingId, tenantId, data) {
  const item = await ClearanceChecklistItem.create({
    ...data,
    tenantId,
    offboardingId,
  });
  return item;
}

// ─── Asset Returns ──────────────────────────────────────────────────────────

async function getAssetReturns(offboardingId, tenantId) {
  return AssetReturn.find({ offboardingId, tenantId }).sort({ assetType: 1 });
}

async function addAssetReturn(offboardingId, tenantId, data) {
  return AssetReturn.create({ ...data, tenantId, offboardingId });
}

async function updateAssetReturn(assetId, tenantId, data, userId) {
  const asset = await AssetReturn.findOne({ _id: assetId, tenantId });
  if (!asset) {
    throw Object.assign(new Error('Asset record not found'), { statusCode: 404 });
  }

  if (data.status === 'Returned') {
    asset.returnedAt = new Date();
    asset.receivedById = userId;
  }

  if (data.status === 'Lost' || data.status === 'Damaged') {
    asset.deductionAmount = data.deductionAmount || asset.estimatedValue;
  }

  Object.assign(asset, data);
  await asset.save();

  await logActivity(tenantId, asset.offboardingId, 'AssetReturned', {
    assetType: asset.assetType,
    status: asset.status,
    deduction: asset.deductionAmount,
  }, userId);

  return asset;
}

async function getTotalAssetDeductions(offboardingId, tenantId) {
  const assets = await AssetReturn.find({
    offboardingId,
    tenantId,
    status: { $in: ['Lost', 'Damaged'] },
  });
  return assets.reduce((sum, a) => sum + (a.deductionAmount || 0), 0);
}

// ─── Knowledge Transfer ─────────────────────────────────────────────────────

async function getKnowledgeTransfers(offboardingId, tenantId) {
  return KnowledgeTransfer.find({ offboardingId, tenantId })
    .populate('transferToId', 'fullName')
    .sort({ status: 1, topic: 1 });
}

async function addKnowledgeTransfer(offboardingId, tenantId, data) {
  return KnowledgeTransfer.create({ ...data, tenantId, offboardingId });
}

async function updateKnowledgeTransfer(ktId, tenantId, data, userId) {
  const kt = await KnowledgeTransfer.findOne({ _id: ktId, tenantId });
  if (!kt) {
    throw Object.assign(new Error('Knowledge transfer record not found'), { statusCode: 404 });
  }

  if (data.status === 'Completed') {
    kt.completedAt = new Date();
    kt.sessionConducted = true;
  }

  Object.assign(kt, data);
  await kt.save();

  await logActivity(tenantId, kt.offboardingId, 'KnowledgeTransferCompleted', {
    topic: kt.topic,
  }, userId);

  return kt;
}

// ─── Exit Interview ─────────────────────────────────────────────────────────

async function scheduleExitInterview(offboardingId, tenantId, data, userId) {
  const process = await OffboardingProcess.findOne({ _id: offboardingId, tenantId });
  if (!process) {
    throw Object.assign(new Error('Offboarding process not found'), { statusCode: 404 });
  }

  process.exitInterviewDate = data.date;
  process.exitInterviewerId = data.interviewerId;
  await process.save();

  await logActivity(tenantId, offboardingId, 'ExitInterviewScheduled', {
    date: data.date,
    interviewerId: data.interviewerId,
  }, userId);

  return process;
}

async function completeExitInterview(offboardingId, tenantId, data, userId) {
  const process = await OffboardingProcess.findOne({ _id: offboardingId, tenantId });
  if (!process) {
    throw Object.assign(new Error('Offboarding process not found'), { statusCode: 404 });
  }

  process.exitInterviewConducted = true;
  process.exitInterviewRating = data.rating;
  process.exitInterviewFeedback = data.feedback || '';
  await process.save();

  await logActivity(tenantId, offboardingId, 'ExitInterviewCompleted', {
    rating: data.rating,
  }, userId);

  return process;
}

// ─── Final Settlement ───────────────────────────────────────────────────────

async function initiateSettlement(offboardingId, tenantId, userId) {
  const process = await OffboardingProcess.findOne({ _id: offboardingId, tenantId });
  if (!process) {
    throw Object.assign(new Error('Offboarding process not found'), { statusCode: 404 });
  }

  // Calculate asset deductions
  const assetDeductions = await getTotalAssetDeductions(offboardingId, tenantId);

  // Get employee salary
  const employee = await Employee.findById(process.employeeId);
  const monthlySalary = employee?.monthlySalary || 0;

  // Estimate settlement
  const estimate = estimateSettlement({
    monthlySalary,
    lastWorkingDayIndex: new Date(process.lastWorkingDay).getDate(),
    assetDeductions,
  });

  process.settlementStatus = 'InProgress';
  process.settlementAmount = estimate.total;
  process.statusHistory.push({
    status: process.status,
    changedBy: userId,
    changedAt: new Date(),
    comment: `Settlement initiated: estimated ₹${estimate.total}`,
  });
  await process.save();

  await logActivity(tenantId, offboardingId, 'SettlementInitiated', {
    estimatedAmount: estimate.total,
    components: estimate.components,
  }, userId);

  return { process, estimate };
}

async function processSettlement(offboardingId, tenantId, finalAmount, userId) {
  const process = await OffboardingProcess.findOne({ _id: offboardingId, tenantId });
  if (!process) {
    throw Object.assign(new Error('Offboarding process not found'), { statusCode: 404 });
  }

  process.settlementStatus = 'Processed';
  process.settlementAmount = finalAmount;
  process.settlementProcessedAt = new Date();
  await process.save();

  await logActivity(tenantId, offboardingId, 'SettlementProcessed', {
    amount: finalAmount,
  }, userId);

  return process;
}

// ─── Handover ───────────────────────────────────────────────────────────────

async function updateHandover(offboardingId, tenantId, data, userId) {
  const process = await OffboardingProcess.findOne({ _id: offboardingId, tenantId });
  if (!process) {
    throw Object.assign(new Error('Offboarding process not found'), { statusCode: 404 });
  }

  if (data.handoverToId) process.handoverToId = data.handoverToId;
  if (data.handoverStatus) process.handoverStatus = data.handoverStatus;
  if (data.handoverNotes) process.handoverNotes = data.handoverNotes;

  await process.save();
  return process;
}

// ─── Reports & Analytics ────────────────────────────────────────────────────

async function getOffboardingDashboard(tenantId) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [active, upcoming30, completed, recent] = await Promise.all([
    OffboardingProcess.find({
      tenantId,
      status: { $in: ['Initiated', 'InProgress', 'ClearancePending', 'SettlementPending'] },
    }).populate('employeeId', 'fullName department'),
    OffboardingProcess.find({
      tenantId,
      lastWorkingDay: { $gte: now, $lte: thirtyDaysFromNow },
    }).populate('employeeId', 'fullName department'),
    OffboardingProcess.find({
      tenantId,
      status: 'Completed',
    }).sort({ completedAt: -1 }).limit(10).populate('employeeId', 'fullName department'),
    OffboardingProcess.find({
      tenantId,
      createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1) },
    }),
  ]);

  return {
    activeCount: active.length,
    activeProcesses: active,
    upcomingCount: upcoming30.length,
    upcomingProcesses: upcoming30,
    recentCompleted: completed,
    monthlyExitCount: recent.length,
  };
}

async function getAttritionReport(tenantId, startDate, endDate) {
  const query = { tenantId };
  if (startDate || endDate) {
    query.lastWorkingDay = {};
    if (startDate) query.lastWorkingDay.$gte = new Date(startDate);
    if (endDate) query.lastWorkingDay.$lte = new Date(endDate);
  }

  const processes = await OffboardingProcess.find(query);
  const totalHeadcount = await Employee.countDocuments({ tenantId, isActive: { $ne: false } });

  return generateAttritionAnalytics(processes, totalHeadcount);
}

// ─── Activity Log ───────────────────────────────────────────────────────────

async function logActivity(tenantId, offboardingId, action, details, userId) {
  await OffboardingActivityLog.create({
    tenantId,
    offboardingId,
    action,
    details,
    performedBy: userId,
  });
}

async function getActivityLog(offboardingId, tenantId, options = {}) {
  const { limit = 50, skip = 0 } = options;
  return OffboardingActivityLog.find({ offboardingId, tenantId })
    .populate('performedBy', 'fullName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

module.exports = {
  initiateOffboarding,
  getProcess,
  getProcesses,
  transitionProcess,
  getClearanceChecklist,
  updateClearanceItem,
  addClearanceItem,
  getAssetReturns,
  addAssetReturn,
  updateAssetReturn,
  getTotalAssetDeductions,
  getKnowledgeTransfers,
  addKnowledgeTransfer,
  updateKnowledgeTransfer,
  scheduleExitInterview,
  completeExitInterview,
  initiateSettlement,
  processSettlement,
  updateHandover,
  getOffboardingDashboard,
  getAttritionReport,
  getActivityLog,
};
