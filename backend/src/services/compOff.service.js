/**
 * @fileoverview Comp-Off Management Service
 * @description Business logic for comp-off accrual, approval workflow,
 *   balance management, expiry processing, and reporting.
 */

const {
  CompOffPolicy,
  CompOffRequest,
  CompOffBalance,
  CompOffLedger,
} = require('../models/compOff.model');
const {
  calculateDaysEarned,
  computeExpiryDate,
  validateEligibility,
  validateCancellation,
  calculateStats,
  getExpiringInMonth,
} = require('../utils/compOff.utils');
const logger = require('../utils/logger');

// ─── Policy Management ──────────────────────────────────────────────────────

/**
 * Creates a new comp-off accrual policy.
 */
async function createPolicy(tenantId, data, userId) {
  const policy = await CompOffPolicy.create({
    ...data,
    tenantId,
    createdBy: userId,
  });
  logger.info('Comp-off policy created', { policyId: policy._id, tenantId });
  return policy;
}

/**
 * Retrieves all active comp-off policies for a tenant.
 */
async function getPolicies(tenantId, includeInactive = false) {
  const filter = { tenantId };
  if (!includeInactive) filter.isActive = true;
  return CompOffPolicy.find(filter).sort({ createdAt: -1 });
}

/**
 * Updates a comp-off policy.
 */
async function updatePolicy(policyId, tenantId, data) {
  const policy = await CompOffPolicy.findOneAndUpdate(
    { _id: policyId, tenantId },
    { $set: data },
    { new: true, runValidators: true },
  );
  if (!policy) {
    throw Object.assign(new Error('Policy not found'), { statusCode: 404 });
  }
  return policy;
}

/**
 * Deactivates a comp-off policy (soft delete).
 */
async function deactivatePolicy(policyId, tenantId) {
  const policy = await CompOffPolicy.findOneAndUpdate(
    { _id: policyId, tenantId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!policy) {
    throw Object.assign(new Error('Policy not found'), { statusCode: 404 });
  }
  return policy;
}

// ─── Request Submission ─────────────────────────────────────────────────────

/**
 * Submits a new comp-off request after eligibility validation.
 */
async function submitRequest(tenantId, employeeId, data, policyId) {
  const policy = await CompOffPolicy.findOne({
    _id: policyId,
    tenantId,
    isActive: true,
  });
  if (!policy) {
    throw Object.assign(new Error('Active policy not found'), {
      statusCode: 404,
    });
  }

  // Calculate days earned
  const { daysEarned, hoursEarned, matched } = calculateDaysEarned(
    data.workType,
    data.hoursWorked,
    policy.accrualRules,
  );
  if (!matched) {
    throw Object.assign(
      new Error(`No accrual rule found for work type: ${data.workType}`),
      { statusCode: 400 },
    );
  }

  // Get current balance
  const balance = await CompOffBalance.findOne({
    tenantId,
    employeeId,
    year: new Date(data.workDate).getFullYear(),
  });
  const currentBalance = balance ? balance.availableBalance : 0;

  // Count accruals this month
  const monthStart = new Date(
    data.workDate.getFullYear(),
    data.workDate.getMonth(),
    1,
  );
  const monthEnd = new Date(
    data.workDate.getFullYear(),
    data.workDate.getMonth() + 1,
    0,
  );
  const monthAccruals = await CompOffRequest.countDocuments({
    tenantId,
    employeeId,
    workType: data.workType,
    status: { $in: ['pending', 'approved'] },
    workDate: { $gte: monthStart, $lte: monthEnd },
  });

  // Validate eligibility
  const validation = validateEligibility({
    workDate: new Date(data.workDate),
    compOffDate: new Date(data.compOffDate),
    minAdvanceNoticeDays: policy.minAdvanceNoticeDays,
    currentBalance,
    maxBalance: policy.maxBalanceCarry,
    maxAccrualPerMonth: policy.maxAccrualPerMonth,
    monthAccrualsSoFar: monthAccruals,
  });

  if (!validation.eligible) {
    throw Object.assign(new Error(validation.reason), { statusCode: 400 });
  }

  // Compute expiry
  const expiresAt = computeExpiryDate(
    new Date(data.workDate),
    policy.expiryDays,
  );

  // Auto-approve if policy doesn't require approval
  const initialStatus = policy.requiresApproval ? 'pending' : 'approved';
  const statusHistory = [
    {
      status: initialStatus,
      changedAt: new Date(),
      note: initialStatus === 'approved' ? 'Auto-approved by policy' : '',
    },
  ];

  const request = await CompOffRequest.create({
    tenantId,
    employeeId,
    policyId,
    workDate: new Date(data.workDate),
    compOffDate: new Date(data.compOffDate),
    hoursEarned,
    daysEarned,
    workType: data.workType,
    reason: data.reason,
    status: initialStatus,
    expiresAt,
    approvedAt: initialStatus === 'approved' ? new Date() : null,
    statusHistory,
  });

  // If auto-approved, update balance immediately
  if (initialStatus === 'approved') {
    await updateBalanceOnAccrual(tenantId, employeeId, daysEarned, request._id, policyId);
  }

  logger.info('Comp-off request submitted', {
    requestId: request._id,
    employeeId,
    daysEarned,
    status: initialStatus,
  });

  return request;
}

// ─── Approval Workflow ──────────────────────────────────────────────────────

/**
 * Approves a pending comp-off request.
 */
async function approveRequest(requestId, tenantId, approverId, note = '') {
  const request = await CompOffRequest.findOne({
    _id: requestId,
    tenantId,
  });
  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }
  if (request.status !== 'pending') {
    throw Object.assign(
      new Error(`Cannot approve a request with status: ${request.status}`),
      { statusCode: 400 },
    );
  }

  request.status = 'approved';
  request.approverId = approverId;
  request.approvalNote = note;
  request.approvedAt = new Date();
  request.statusHistory.push({
    status: 'approved',
    changedBy: approverId,
    changedAt: new Date(),
    note,
  });

  await request.save();

  // Update balance
  await updateBalanceOnAccrual(
    tenantId,
    request.employeeId,
    request.daysEarned,
    request._id,
    request.policyId,
  );

  logger.info('Comp-off request approved', {
    requestId: request._id,
    approverId,
  });
  return request;
}

/**
 * Rejects a pending comp-off request.
 */
async function rejectRequest(requestId, tenantId, approverId, reason) {
  if (!reason || reason.trim().length === 0) {
    throw Object.assign(
      new Error('Rejection reason is required'),
      { statusCode: 400 },
    );
  }

  const request = await CompOffRequest.findOne({
    _id: requestId,
    tenantId,
  });
  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }
  if (request.status !== 'pending') {
    throw Object.assign(
      new Error(`Cannot reject a request with status: ${request.status}`),
      { statusCode: 400 },
    );
  }

  request.status = 'rejected';
  request.approverId = approverId;
  request.approvalNote = reason;
  request.statusHistory.push({
    status: 'rejected',
    changedBy: approverId,
    changedAt: new Date(),
    note: reason,
  });

  await request.save();

  logger.info('Comp-off request rejected', {
    requestId: request._id,
    approverId,
    reason,
  });
  return request;
}

// ─── Balance Management ─────────────────────────────────────────────────────

/**
 * Updates the comp-off balance on accrual.
 */
async function updateBalanceOnAccrual(
  tenantId,
  employeeId,
  days,
  requestId,
  policyId,
) {
  const year = new Date().getFullYear();

  const balance = await CompOffBalance.findOneAndUpdate(
    { tenantId, employeeId, year },
    {
      $inc: {
        totalAccrued: days,
        availableBalance: days,
      },
      $set: { lastAccruedAt: new Date() },
    },
    { upsert: true, new: true },
  );

  // Ledger entry
  await CompOffLedger.create({
    tenantId,
    employeeId,
    type: 'accrual',
    days,
    balanceBefore: balance.availableBalance - days,
    balanceAfter: balance.availableBalance,
    requestId,
    policyId,
    note: `Comp-off earned: ${days} day(s)`,
  });

  return balance;
}

/**
 * Updates the comp-off balance on usage (when employee takes the comp-off day).
 */
async function updateBalanceOnUsage(
  tenantId,
  employeeId,
  days,
  requestId,
) {
  const year = new Date().getFullYear();

  const balance = await CompOffBalance.findOne({
    tenantId,
    employeeId,
    year,
  });
  if (!balance) {
    throw Object.assign(new Error('No balance record found'), {
      statusCode: 404,
    });
  }

  if (balance.availableBalance < days) {
    throw Object.assign(
      new Error(`Insufficient comp-off balance: ${balance.availableBalance} available, ${days} requested`),
      { statusCode: 400 },
    );
  }

  balance.totalUsed += days;
  balance.availableBalance -= days;
  await balance.save();

  await CompOffLedger.create({
    tenantId,
    employeeId,
    type: 'usage',
    days,
    balanceBefore: balance.availableBalance + days,
    balanceAfter: balance.availableBalance,
    requestId,
    note: `Comp-off used: ${days} day(s)`,
  });

  return balance;
}

/**
 * Updates the comp-off balance on cancellation.
 */
async function updateBalanceOnCancellation(
  tenantId,
  employeeId,
  days,
  requestId,
) {
  const year = new Date().getFullYear();

  const balance = await CompOffBalance.findOne({
    tenantId,
    employeeId,
    year,
  });
  if (!balance) {
    throw Object.assign(new Error('No balance record found'), {
      statusCode: 404,
    });
  }

  balance.totalCancelled += days;
  balance.availableBalance = Math.max(0, balance.availableBalance - days);
  await balance.save();

  await CompOffLedger.create({
    tenantId,
    employeeId,
    type: 'cancellation',
    days: -days,
    balanceBefore: balance.availableBalance + days,
    balanceAfter: balance.availableBalance,
    requestId,
    note: `Comp-off cancelled: ${days} day(s)`,
  });

  return balance;
}

/**
 * Cancels an existing comp-off request.
 */
async function cancelRequest(requestId, tenantId, userId, reason, isAdmin) {
  const request = await CompOffRequest.findOne({
    _id: requestId,
    tenantId,
  });
  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }

  const validation = validateCancellation(request, userId, isAdmin);
  if (!validation.canCancel) {
    throw Object.assign(new Error(validation.reason), { statusCode: 400 });
  }

  const wasApproved = request.status === 'approved';
  request.status = 'cancelled';
  request.cancelledAt = new Date();
  request.cancelledBy = userId;
  request.cancelledReason = reason || '';
  request.statusHistory.push({
    status: 'cancelled',
    changedBy: userId,
    changedAt: new Date(),
    note: reason || '',
  });

  await request.save();

  // If the request was already approved, reverse the balance
  if (wasApproved) {
    await updateBalanceOnCancellation(
      tenantId,
      request.employeeId,
      request.daysEarned,
      request._id,
    );
  }

  logger.info('Comp-off request cancelled', {
    requestId: request._id,
    cancelledBy: userId,
  });
  return request;
}

// ─── Expiry Processing ──────────────────────────────────────────────────────

/**
 * Processes expired comp-off requests. Called by a cron job.
 * Finds all approved/pending requests past their expiry date and marks them expired.
 */
async function processExpiries(tenantId) {
  const now = new Date();
  const expiredRequests = await CompOffRequest.find({
    tenantId,
    status: { $in: ['pending', 'approved'] },
    expiresAt: { $lte: now },
  });

  let processedCount = 0;
  let balanceAdjusted = 0;

  for (const request of expiredRequests) {
    const wasApproved = request.status === 'approved';
    request.status = 'expired';
    request.statusHistory.push({
      status: 'expired',
      changedAt: now,
      note: 'Expired automatically by system',
    });
    await request.save();

    processedCount++;

    // Reverse balance for approved requests that expired
    if (wasApproved) {
      const year = request.workDate.getFullYear();
      const balance = await CompOffBalance.findOne({
        tenantId,
        employeeId: request.employeeId,
        year,
      });

      if (balance) {
        balance.totalExpired += request.daysEarned;
        balance.totalUsed = Math.max(0, balance.totalUsed - request.daysEarned);
        balance.availableBalance = Math.max(
          0,
          balance.availableBalance + request.daysEarned,
        );
        await balance.save();

        await CompOffLedger.create({
          tenantId,
          employeeId: request.employeeId,
          type: 'expiry',
          days: request.daysEarned,
          balanceBefore: balance.availableBalance - request.daysEarned,
          balanceAfter: balance.availableBalance,
          requestId: request._id,
          policyId: request.policyId,
          note: `Comp-off expired: ${request.daysEarned} day(s)`,
        });

        balanceAdjusted++;
      }
    }
  }

  logger.info('Comp-off expiry processing complete', {
    tenantId,
    processedCount,
    balanceAdjusted,
  });

  return { processedCount, balanceAdjusted };
}

// ─── Queries & Reporting ────────────────────────────────────────────────────

/**
 * Gets comp-off requests for an employee with optional filters.
 */
async function getEmployeeRequests(tenantId, employeeId, filters = {}) {
  const query = { tenantId, employeeId };

  if (filters.status) query.status = filters.status;
  if (filters.year) {
    const startOfYear = new Date(filters.year, 0, 1);
    const endOfYear = new Date(filters.year, 11, 31, 23, 59, 59);
    query.createdAt = { $gte: startOfYear, $lte: endOfYear };
  }

  return CompOffRequest.find(query)
    .populate('policyId', 'name')
    .populate('approverId', 'fullName')
    .sort({ createdAt: -1 });
}

/**
 * Gets pending comp-off requests awaiting approval for a manager.
 */
async function getPendingApprovals(tenantId, filters = {}) {
  const query = { tenantId, status: 'pending' };

  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.workType) query.workType = filters.workType;

  return CompOffRequest.find(query)
    .populate('employeeId', 'fullName email department')
    .populate('policyId', 'name')
    .sort({ workDate: 1 });
}

/**
 * Gets the comp-off balance for an employee.
 */
async function getBalance(tenantId, employeeId, year) {
  const balance = await CompOffBalance.findOne({
    tenantId,
    employeeId,
    year: year || new Date().getFullYear(),
  });

  if (!balance) {
    return {
      tenantId,
      employeeId,
      year: year || new Date().getFullYear(),
      totalAccrued: 0,
      totalUsed: 0,
      totalExpired: 0,
      totalCancelled: 0,
      availableBalance: 0,
    };
  }

  return balance;
}

/**
 * Gets the comp-off ledger (transaction history) for an employee.
 */
async function getLedger(tenantId, employeeId, options = {}) {
  const { limit = 50, skip = 0, type } = options;
  const query = { tenantId, employeeId };
  if (type) query.type = type;

  return CompOffLedger.find(query)
    .populate('requestId', 'workDate compOffDate workType')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

/**
 * Generates a summary report for a tenant.
 */
async function generateSummaryReport(tenantId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const [requests, balances] = await Promise.all([
    CompOffRequest.find({
      tenantId,
      createdAt: { $gte: startDate, $lte: endDate },
    }).populate('employeeId', 'fullName department'),
    CompOffBalance.find({ tenantId, year }),
  ]);

  const stats = calculateStats(requests);

  // Group by work type
  const byWorkType = {};
  for (const req of requests) {
    if (!byWorkType[req.workType]) {
      byWorkType[req.workType] = { count: 0, daysEarned: 0 };
    }
    byWorkType[req.workType].count++;
    byWorkType[req.workType].daysEarned += req.daysEarned;
  }

  // Group by department
  const byDepartment = {};
  for (const req of requests) {
    const dept = req.employeeId?.department || 'Unassigned';
    if (!byDepartment[dept]) {
      byDepartment[dept] = { count: 0, daysEarned: 0 };
    }
    byDepartment[dept].count++;
    byDepartment[dept].daysEarned += req.daysEarned;
  }

  // Top users
  const employeeMap = new Map();
  for (const req of requests) {
    const empId = req.employeeId?._id?.toString();
    if (!empId) continue;
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        employee: req.employeeId,
        daysEarned: 0,
        daysUsed: 0,
        requestCount: 0,
      });
    }
    const entry = employeeMap.get(empId);
    entry.daysEarned += req.daysEarned;
    entry.requestCount++;
    if (req.status === 'approved' && req.compOffDate <= new Date()) {
      entry.daysUsed += req.daysEarned;
    }
  }

  const topUsers = [...employeeMap.values()]
    .sort((a, b) => b.daysEarned - a.daysEarned)
    .slice(0, 10);

  return {
    year,
    totalEmployees: balances.length,
    overallStats: stats,
    byWorkType,
    byDepartment,
    topUsers,
    balanceSummary: {
      totalAccrued: balances.reduce((s, b) => s + b.totalAccrued, 0),
      totalUsed: balances.reduce((s, b) => s + b.totalUsed, 0),
      totalExpired: balances.reduce((s, b) => s + b.totalExpired, 0),
      totalAvailable: balances.reduce((s, b) => s + b.availableBalance, 0),
    },
  };
}

module.exports = {
  createPolicy,
  getPolicies,
  updatePolicy,
  deactivatePolicy,
  submitRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  processExpiries,
  getEmployeeRequests,
  getPendingApprovals,
  getBalance,
  getLedger,
  generateSummaryReport,
  updateBalanceOnUsage,
};
