/**
 * @fileoverview Department Budget Management Service
 * @description Business logic for cost centers, budget categories, department
 *   budgets, line items, transactions, alerts, variance analysis, and reporting.
 */

const {
  DeptCostCenter,
  DeptBudgetCategory,
  DeptBudget,
  DeptBudgetLineItem,
  BudgetTransaction,
  BudgetAlert,
} = require('../models/deptBudget.model');
const {
  calculateVariance,
  calculateYoYChange,
  validateStatusTransition,
  determineAlerts,
  projectEndOfPeriod,
  getFiscalYear,
  aggregateLineItems,
  generateVarianceReport,
} = require('../utils/deptBudget.utils');
const logger = require('../utils/logger');

// ─── Cost Center Management ─────────────────────────────────────────────────

async function createCostCenter(tenantId, data, userId) {
  const costCenter = await DeptCostCenter.create({
    ...data,
    tenantId,
    createdBy: userId,
  });
  logger.info('Cost center created', { costCenterId: costCenter._id, tenantId });
  return costCenter;
}

async function getCostCenters(tenantId, includeInactive = false) {
  const filter = { tenantId };
  if (!includeInactive) filter.isActive = true;
  return DeptCostCenter.find(filter).sort({ department: 1, code: 1 });
}

async function updateCostCenter(costCenterId, tenantId, data) {
  const cc = await DeptCostCenter.findOneAndUpdate(
    { _id: costCenterId, tenantId },
    { $set: data },
    { new: true, runValidators: true },
  );
  if (!cc) {
    throw Object.assign(new Error('Cost center not found'), { statusCode: 404 });
  }
  return cc;
}

// ─── Budget Category Management ─────────────────────────────────────────────

async function createCategory(tenantId, data) {
  const category = await DeptBudgetCategory.create({ ...data, tenantId });
  logger.info('Budget category created', { categoryId: category._id, tenantId });
  return category;
}

async function getCategories(tenantId) {
  return DeptBudgetCategory.find({ tenantId, isActive: true }).sort({
    name: 1,
  });
}

// ─── Department Budget CRUD ─────────────────────────────────────────────────

async function createBudget(tenantId, data, userId) {
  // Check for existing budget for same cost center, year, period, month
  const existing = await DeptBudget.findOne({
    tenantId,
    costCenterId: data.costCenterId,
    fiscalYear: data.fiscalYear,
    period: data.period,
    month: data.month || null,
  });
  if (existing) {
    throw Object.assign(
      new Error(
        `Budget already exists for this cost center in ${data.period} ${data.fiscalYear}`,
      ),
      { statusCode: 409 },
    );
  }

  const budget = await DeptBudget.create({
    ...data,
    tenantId,
    createdBy: userId,
    statusHistory: [
      {
        status: 'Draft',
        changedBy: userId,
        changedAt: new Date(),
        comment: 'Budget created',
      },
    ],
  });

  logger.info('Department budget created', {
    budgetId: budget._id,
    department: data.department,
    fiscalYear: data.fiscalYear,
  });
  return budget;
}

async function getBudget(budgetId, tenantId) {
  const budget = await DeptBudget.findOne({ _id: budgetId, tenantId })
    .populate('costCenterId', 'code name department')
    .populate('approvedBy', 'fullName')
    .populate('submittedBy', 'fullName');
  if (!budget) {
    throw Object.assign(new Error('Budget not found'), { statusCode: 404 });
  }
  return budget;
}

async function getBudgets(tenantId, filters = {}) {
  const query = { tenantId };
  if (filters.fiscalYear) query.fiscalYear = filters.fiscalYear;
  if (filters.department) query.department = filters.department;
  if (filters.status) query.status = filters.status;
  if (filters.period) query.period = filters.period;

  return DeptBudget.find(query)
    .populate('costCenterId', 'code name')
    .sort({ fiscalYear: -1, department: 1 });
}

async function updateBudget(budgetId, tenantId, data) {
  const budget = await DeptBudget.findOne({ _id: budgetId, tenantId });
  if (!budget) {
    throw Object.assign(new Error('Budget not found'), { statusCode: 404 });
  }
  if (budget.status === 'Closed') {
    throw Object.assign(
      new Error('Cannot edit a closed budget'),
      { statusCode: 400 },
    );
  }

  Object.assign(budget, data);
  await budget.save();
  return budget;
}

// ─── Status Transitions ─────────────────────────────────────────────────────

async function transitionBudgetStatus(
  budgetId,
  tenantId,
  targetStatus,
  userId,
  comment,
) {
  const budget = await DeptBudget.findOne({ _id: budgetId, tenantId });
  if (!budget) {
    throw Object.assign(new Error('Budget not found'), { statusCode: 404 });
  }

  const validation = validateStatusTransition(budget.status, targetStatus);
  if (!validation.allowed) {
    throw Object.assign(new Error(validation.reason), { statusCode: 400 });
  }

  budget.status = targetStatus;
  budget.statusHistory.push({
    status: targetStatus,
    changedBy: userId,
    changedAt: new Date(),
    comment: comment || '',
  });

  const now = new Date();
  switch (targetStatus) {
    case 'Submitted':
      budget.submittedBy = userId;
      budget.submittedAt = now;
      break;
    case 'Approved':
      budget.approvedBy = userId;
      budget.approvedAt = now;
      budget.approvalStatus = 'FullyApproved';
      break;
    case 'Rejected':
      budget.rejectedBy = userId;
      budget.rejectedAt = now;
      budget.rejectionReason = comment || '';
      budget.approvalStatus = 'Rejected';
      break;
  }

  await budget.save();

  logger.info('Budget status transitioned', {
    budgetId: budget._id,
    to: targetStatus,
    userId,
  });

  return budget;
}

// ─── Line Item Management ───────────────────────────────────────────────────

async function addLineItem(tenantId, budgetId, data) {
  const budget = await DeptBudget.findOne({ _id: budgetId, tenantId });
  if (!budget) {
    throw Object.assign(new Error('Budget not found'), { statusCode: 404 });
  }
  if (budget.status === 'Closed') {
    throw Object.assign(
      new Error('Cannot add items to a closed budget'),
      { statusCode: 400 },
    );
  }

  const variance = calculateVariance(
    data.budgetedAmount,
    data.actualAmount || 0,
    data.committedAmount || 0,
  );

  const lineItem = await DeptBudgetLineItem.create({
    ...data,
    tenantId,
    budgetId,
    ...variance,
  });

  // Recalculate budget totals
  await recalculateBudgetTotals(budgetId, tenantId);

  return lineItem;
}

async function updateLineItem(lineItemId, tenantId, data) {
  const item = await DeptBudgetLineItem.findOne({ _id: lineItemId, tenantId });
  if (!item) {
    throw Object.assign(new Error('Line item not found'), { statusCode: 404 });
  }

  Object.assign(item, data);

  // Recalculate variance
  const variance = calculateVariance(
    item.budgetedAmount,
    item.actualAmount,
    item.committedAmount,
  );
  Object.assign(item, variance);

  await item.save();

  // Recalculate budget totals
  await recalculateBudgetTotals(item.budgetId, tenantId);

  return item;
}

async function removeLineItem(lineItemId, tenantId) {
  const item = await DeptBudgetLineItem.findOne({ _id: lineItemId, tenantId });
  if (!item) {
    throw Object.assign(new Error('Line item not found'), { statusCode: 404 });
  }

  await DeptBudgetLineItem.deleteOne({ _id: lineItemId });

  // Recalculate budget totals
  await recalculateBudgetTotals(item.budgetId, tenantId);

  return { deleted: true };
}

async function getLineItems(budgetId, tenantId) {
  return DeptBudgetLineItem.find({ budgetId, tenantId, isActive: true })
    .populate('categoryId', 'code name')
    .sort({ name: 1 });
}

async function recalculateBudgetTotals(budgetId, tenantId) {
  const items = await DeptBudgetLineItem.find({ budgetId, tenantId, isActive: true });
  const totals = aggregateLineItems(items);

  const budget = await DeptBudget.findOne({ _id: budgetId, tenantId });
  if (!budget) return;

  budget.totalBudgeted = totals.totalBudgeted;
  budget.totalActual = totals.totalActual;
  budget.totalCommitted = totals.totalCommitted;

  const variance = calculateVariance(
    totals.totalBudgeted,
    totals.totalActual,
    totals.totalCommitted,
  );
  budget.variance = variance.variance;
  budget.variancePercent = variance.variancePercent;
  budget.utilizationRate = variance.utilizationRate;

  // Check alerts
  const alerts = determineAlerts(
    variance.utilizationRate,
    budget.warningThreshold,
    budget.criticalThreshold,
  );

  if (alerts.length > 0) {
    // Create alert records
    for (const alert of alerts) {
      const existing = await BudgetAlert.findOne({
        budgetId,
        alertType: alert.type,
        isAcknowledged: false,
      });
      if (!existing) {
        await BudgetAlert.create({
          tenantId,
          budgetId,
          alertType: alert.type,
          message: alert.message,
          utilizationAtTrigger: variance.utilizationRate,
          budgetedAmount: totals.totalBudgeted,
          actualAmount: totals.totalActual,
          notifyUserIds: budget.submittedBy ? [budget.submittedBy] : [],
        });
      }
    }
  }

  await budget.save();
}

// ─── Transaction Recording ──────────────────────────────────────────────────

async function recordTransaction(tenantId, data) {
  const transaction = await BudgetTransaction.create({
    ...data,
    tenantId,
  });

  // Update line item actual/committed amount
  const item = await DeptBudgetLineItem.findOne({
    _id: data.lineItemId,
    tenantId,
  });
  if (item) {
    if (data.transactionType === 'Actual') {
      item.actualAmount += data.amount;
    } else if (data.transactionType === 'Committed') {
      item.committedAmount += data.amount;
    } else if (data.transactionType === 'Reversal') {
      item.actualAmount = Math.max(0, item.actualAmount - Math.abs(data.amount));
    } else if (data.transactionType === 'Adjustment') {
      item.actualAmount += data.amount;
    }

    const variance = calculateVariance(
      item.budgetedAmount,
      item.actualAmount,
      item.committedAmount,
    );
    Object.assign(item, variance);
    await item.save();

    // Recalculate budget totals
    await recalculateBudgetTotals(data.budgetId, tenantId);
  }

  return transaction;
}

async function getTransactions(tenantId, lineItemId, options = {}) {
  const { limit = 50, skip = 0, type } = options;
  const query = { tenantId, lineItemId };
  if (type) query.transactionType = type;

  return BudgetTransaction.find(query)
    .sort({ transactionDate: -1 })
    .skip(skip)
    .limit(limit);
}

// ─── Alert Management ───────────────────────────────────────────────────────

async function getAlerts(tenantId, filters = {}) {
  const query = { tenantId };
  if (filters.budgetId) query.budgetId = filters.budgetId;
  if (filters.alertType) query.alertType = filters.alertType;
  if (filters.isAcknowledged !== undefined)
    query.isAcknowledged = filters.isAcknowledged;

  return BudgetAlert.find(query)
    .populate('budgetId', 'department fiscalYear period')
    .sort({ createdAt: -1 });
}

async function acknowledgeAlert(alertId, tenantId, userId) {
  const alert = await BudgetAlert.findOne({ _id: alertId, tenantId });
  if (!alert) {
    throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
  }

  alert.isAcknowledged = true;
  alert.acknowledgedBy = userId;
  alert.acknowledgedAt = new Date();
  await alert.save();

  return alert;
}

// ─── Variance Analysis & Reporting ──────────────────────────────────────────

async function getVarianceReport(tenantId, fiscalYear, department) {
  const query = { tenantId, fiscalYear };
  if (department) query.department = department;

  const budgets = await DeptBudget.find(query).populate(
    'costCenterId',
    'code name',
  );

  return generateVarianceReport(budgets);
}

async function getBudgetDashboard(tenantId, fiscalYear) {
  const budgets = await DeptBudget.find({ tenantId, fiscalYear });
  const alerts = await BudgetAlert.find({
    tenantId,
    isAcknowledged: false,
  });

  const stats = {
    totalBudgets: budgets.length,
    approvedBudgets: budgets.filter((b) => b.status === 'Approved').length,
    draftBudgets: budgets.filter((b) => b.status === 'Draft').length,
    totalBudgeted: budgets.reduce((s, b) => s + b.totalBudgeted, 0),
    totalActual: budgets.reduce((s, b) => s + b.totalActual, 0),
    totalCommitted: budgets.reduce((s, b) => s + b.totalCommitted, 0),
    overallUtilization: 0,
    alerts: {
      warning: alerts.filter((a) => a.alertType === 'Warning').length,
      critical: alerts.filter((a) => a.alertType === 'Critical').length,
      exceeded: alerts.filter((a) => a.alertType === 'Exceeded').length,
    },
    byDepartment: [],
  };

  if (stats.totalBudgeted > 0) {
    stats.overallUtilization =
      Math.round((stats.totalActual / stats.totalBudgeted) * 10000) / 100;
  }

  for (const budget of budgets) {
    stats.byDepartment.push({
      department: budget.department,
      budgeted: budget.totalBudgeted,
      actual: budget.totalActual,
      utilization: budget.utilizationRate,
      variance: budget.variance,
      status: budget.status,
    });
  }

  stats.byDepartment.sort((a, b) => b.utilization - a.utilization);

  return stats;
}

async function getBudgetComparison(tenantId, department, years) {
  const budgets = await DeptBudget.find({
    tenantId,
    department,
    fiscalYear: { $in: years },
    period: 'Annual',
  }).sort({ fiscalYear: 1 });

  return {
    department,
    years: budgets.map((b) => ({
      fiscalYear: b.fiscalYear,
      budgeted: b.totalBudgeted,
      actual: b.totalActual,
      variance: b.variance,
      utilization: b.utilizationRate,
    })),
  };
}

// ─── Bulk Operations ────────────────────────────────────────────────────────

async function bulkUpdateActuals(tenantId, budgetId, lineItemUpdates) {
  const budget = await DeptBudget.findOne({ _id: budgetId, tenantId });
  if (!budget) {
    throw Object.assign(new Error('Budget not found'), { statusCode: 404 });
  }

  const results = [];
  for (const update of lineItemUpdates) {
    const item = await DeptBudgetLineItem.findOne({
      _id: update.lineItemId,
      tenantId,
      budgetId,
    });
    if (item) {
      item.actualAmount = update.actualAmount;
      if (update.committedAmount !== undefined) {
        item.committedAmount = update.committedAmount;
      }
      if (update.forecastAmount !== undefined) {
        item.forecastAmount = update.forecastAmount;
      }

      const variance = calculateVariance(
        item.budgetedAmount,
        item.actualAmount,
        item.committedAmount,
      );
      Object.assign(item, variance);
      await item.save();
      results.push({ lineItemId: item._id, updated: true });
    } else {
      results.push({ lineItemId: update.lineItemId, updated: false, error: 'Not found' });
    }
  }

  await recalculateBudgetTotals(budgetId, tenantId);

  return results;
}

module.exports = {
  createCostCenter,
  getCostCenters,
  updateCostCenter,
  createCategory,
  getCategories,
  createBudget,
  getBudget,
  getBudgets,
  updateBudget,
  transitionBudgetStatus,
  addLineItem,
  updateLineItem,
  removeLineItem,
  getLineItems,
  recordTransaction,
  getTransactions,
  getAlerts,
  acknowledgeAlert,
  getVarianceReport,
  getBudgetDashboard,
  getBudgetComparison,
  bulkUpdateActuals,
  recalculateBudgetTotals,
};
