/**
 * @fileoverview Department Budget Controller
 * @description Request handlers for cost centers, budget categories, department
 *   budgets, line items, transactions, alerts, variance analysis, and reporting.
 */

const deptBudgetService = require('../services/deptBudget.service');

// ─── Cost Center Endpoints ──────────────────────────────────────────────────

/**
 * POST /api/dept-budgets/cost-centers
 * Create a new cost center.
 */
exports.createCostCenter = async (req, res, next) => {
  try {
    const { code, name, department, parentCostCenterId, managerId, annualBudget } = req.body;
    if (!code || !name || !department) {
      return res.status(400).json({
        message: 'Code, name, and department are required',
      });
    }
    const cc = await deptBudgetService.createCostCenter(
      req.tenantId,
      { code, name, department, parentCostCenterId, managerId, annualBudget },
      req.userId,
    );
    res.status(201).json({ message: 'Cost center created', costCenter: cc });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets/cost-centers
 * List all cost centers.
 */
exports.getCostCenters = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const costCenters = await deptBudgetService.getCostCenters(req.tenantId, includeInactive);
    res.status(200).json({ costCenters });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/cost-centers/:id
 * Update a cost center.
 */
exports.updateCostCenter = async (req, res, next) => {
  try {
    const cc = await deptBudgetService.updateCostCenter(
      req.params.id,
      req.tenantId,
      req.body,
    );
    res.status(200).json({ message: 'Cost center updated', costCenter: cc });
  } catch (error) {
    next(error);
  }
};

// ─── Budget Category Endpoints ──────────────────────────────────────────────

/**
 * POST /api/dept-budgets/categories
 * Create a budget category.
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { code, name, description, parentCategoryId, defaultAllocationPercent } = req.body;
    if (!code || !name) {
      return res.status(400).json({ message: 'Code and name are required' });
    }
    const category = await deptBudgetService.createCategory(req.tenantId, {
      code, name, description, parentCategoryId, defaultAllocationPercent,
    });
    res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets/categories
 * List all budget categories.
 */
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await deptBudgetService.getCategories(req.tenantId);
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

// ─── Department Budget Endpoints ────────────────────────────────────────────

/**
 * POST /api/dept-budgets
 * Create a new department budget.
 */
exports.createBudget = async (req, res, next) => {
  try {
    const { costCenterId, department, fiscalYear, period, month, totalBudgeted, warningThreshold, criticalThreshold, notes } = req.body;
    if (!costCenterId || !department || !fiscalYear || totalBudgeted === undefined) {
      return res.status(400).json({
        message: 'costCenterId, department, fiscalYear, and totalBudgeted are required',
      });
    }
    const budget = await deptBudgetService.createBudget(
      req.tenantId,
      { costCenterId, department, fiscalYear, period, month, totalBudgeted, warningThreshold, criticalThreshold, notes },
      req.userId,
    );
    res.status(201).json({ message: 'Budget created', budget });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets
 * List all department budgets with filters.
 */
exports.getBudgets = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.fiscalYear) filters.fiscalYear = parseInt(req.query.fiscalYear, 10);
    if (req.query.department) filters.department = req.query.department;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.period) filters.period = req.query.period;

    const budgets = await deptBudgetService.getBudgets(req.tenantId, filters);
    res.status(200).json({ budgets });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets/:budgetId
 * Get a specific budget with full details.
 */
exports.getBudget = async (req, res, next) => {
  try {
    const budget = await deptBudgetService.getBudget(req.params.budgetId, req.tenantId);
    const lineItems = await deptBudgetService.getLineItems(req.params.budgetId, req.tenantId);
    const alerts = await deptBudgetService.getAlerts(req.tenantId, { budgetId: req.params.budgetId });

    res.status(200).json({ budget, lineItems, alerts });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/:budgetId
 * Update a department budget.
 */
exports.updateBudget = async (req, res, next) => {
  try {
    const budget = await deptBudgetService.updateBudget(
      req.params.budgetId,
      req.tenantId,
      req.body,
    );
    res.status(200).json({ message: 'Budget updated', budget });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/:budgetId/submit
 * Submit a budget for approval.
 */
exports.submitBudget = async (req, res, next) => {
  try {
    const budget = await deptBudgetService.transitionBudgetStatus(
      req.params.budgetId,
      req.tenantId,
      'Submitted',
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Budget submitted', budget });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/:budgetId/approve
 * Approve a budget.
 */
exports.approveBudget = async (req, res, next) => {
  try {
    const budget = await deptBudgetService.transitionBudgetStatus(
      req.params.budgetId,
      req.tenantId,
      'Approved',
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Budget approved', budget });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/:budgetId/reject
 * Reject a budget.
 */
exports.rejectBudget = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    const budget = await deptBudgetService.transitionBudgetStatus(
      req.params.budgetId,
      req.tenantId,
      'Rejected',
      req.userId,
      reason,
    );
    res.status(200).json({ message: 'Budget rejected', budget });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/:budgetId/close
 * Close a budget (finalizes for the period).
 */
exports.closeBudget = async (req, res, next) => {
  try {
    const budget = await deptBudgetService.transitionBudgetStatus(
      req.params.budgetId,
      req.tenantId,
      'Closed',
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Budget closed', budget });
  } catch (error) {
    next(error);
  }
};

// ─── Line Item Endpoints ────────────────────────────────────────────────────

/**
 * POST /api/dept-budgets/:budgetId/line-items
 * Add a line item to a budget.
 */
exports.addLineItem = async (req, res, next) => {
  try {
    const { categoryId, name, description, budgetedAmount, headcount } = req.body;
    if (!categoryId || !name || budgetedAmount === undefined) {
      return res.status(400).json({
        message: 'categoryId, name, and budgetedAmount are required',
      });
    }
    const item = await deptBudgetService.addLineItem(req.tenantId, req.params.budgetId, {
      categoryId, name, description, budgetedAmount, headcount,
    });
    res.status(201).json({ message: 'Line item added', lineItem: item });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets/:budgetId/line-items
 * Get all line items for a budget.
 */
exports.getLineItems = async (req, res, next) => {
  try {
    const items = await deptBudgetService.getLineItems(req.params.budgetId, req.tenantId);
    res.status(200).json({ lineItems: items });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/line-items/:lineItemId
 * Update a line item.
 */
exports.updateLineItem = async (req, res, next) => {
  try {
    const item = await deptBudgetService.updateLineItem(
      req.params.lineItemId,
      req.tenantId,
      req.body,
    );
    res.status(200).json({ message: 'Line item updated', lineItem: item });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/dept-budgets/line-items/:lineItemId
 * Remove a line item.
 */
exports.removeLineItem = async (req, res, next) => {
  try {
    await deptBudgetService.removeLineItem(req.params.lineItemId, req.tenantId);
    res.status(200).json({ message: 'Line item removed' });
  } catch (error) {
    next(error);
  }
};

// ─── Transaction Endpoints ──────────────────────────────────────────────────

/**
 * POST /api/dept-budgets/:budgetId/transactions
 * Record a budget transaction (actual expenditure, commitment, adjustment).
 */
exports.recordTransaction = async (req, res, next) => {
  try {
    const { lineItemId, transactionType, amount, description, referenceType, referenceId, transactionDate } = req.body;
    if (!lineItemId || !transactionType || amount === undefined) {
      return res.status(400).json({
        message: 'lineItemId, transactionType, and amount are required',
      });
    }
    const transaction = await deptBudgetService.recordTransaction(req.tenantId, {
      budgetId: req.params.budgetId,
      lineItemId,
      transactionType,
      amount,
      description,
      referenceType,
      referenceId,
      transactionDate: transactionDate || new Date(),
      performedBy: req.userId,
    });
    res.status(201).json({ message: 'Transaction recorded', transaction });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets/:budgetId/line-items/:lineItemId/transactions
 * Get transactions for a line item.
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const options = {};
    if (req.query.type) options.type = req.query.type;
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
    if (req.query.skip) options.skip = parseInt(req.query.skip, 10);

    const transactions = await deptBudgetService.getTransactions(
      req.tenantId,
      req.params.lineItemId,
      options,
    );
    res.status(200).json({ transactions });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/:budgetId/bulk-update
 * Bulk update actuals for multiple line items.
 */
exports.bulkUpdateActuals = async (req, res, next) => {
  try {
    const { lineItemUpdates } = req.body;
    if (!Array.isArray(lineItemUpdates) || lineItemUpdates.length === 0) {
      return res.status(400).json({
        message: 'lineItemUpdates array is required',
      });
    }
    const results = await deptBudgetService.bulkUpdateActuals(
      req.tenantId,
      req.params.budgetId,
      lineItemUpdates,
    );
    res.status(200).json({ message: 'Bulk update complete', results });
  } catch (error) {
    next(error);
  }
};

// ─── Alert Endpoints ────────────────────────────────────────────────────────

/**
 * GET /api/dept-budgets/alerts
 * Get budget alerts.
 */
exports.getAlerts = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.budgetId) filters.budgetId = req.query.budgetId;
    if (req.query.alertType) filters.alertType = req.query.alertType;
    if (req.query.isAcknowledged !== undefined)
      filters.isAcknowledged = req.query.isAcknowledged === 'true';

    const alerts = await deptBudgetService.getAlerts(req.tenantId, filters);
    res.status(200).json({ alerts });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/dept-budgets/alerts/:alertId/acknowledge
 * Acknowledge a budget alert.
 */
exports.acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await deptBudgetService.acknowledgeAlert(
      req.params.alertId,
      req.tenantId,
      req.userId,
    );
    res.status(200).json({ message: 'Alert acknowledged', alert });
  } catch (error) {
    next(error);
  }
};

// ─── Reports & Dashboard ────────────────────────────────────────────────────

/**
 * GET /api/dept-budgets/reports/variance
 * Get variance report for a fiscal year.
 */
exports.getVarianceReport = async (req, res, next) => {
  try {
    const fiscalYear = req.query.fiscalYear
      ? parseInt(req.query.fiscalYear, 10)
      : new Date().getFullYear();
    const department = req.query.department;

    const report = await deptBudgetService.getVarianceReport(
      req.tenantId,
      fiscalYear,
      department,
    );
    res.status(200).json({ report });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets/reports/dashboard
 * Get budget dashboard summary.
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const fiscalYear = req.query.fiscalYear
      ? parseInt(req.query.fiscalYear, 10)
      : new Date().getFullYear();

    const dashboard = await deptBudgetService.getBudgetDashboard(
      req.tenantId,
      fiscalYear,
    );
    res.status(200).json({ dashboard });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dept-budgets/reports/comparison
 * Get year-over-year budget comparison for a department.
 */
exports.getComparison = async (req, res, next) => {
  try {
    const { department } = req.query;
    if (!department) {
      return res.status(400).json({ message: 'department query param is required' });
    }

    const currentYear = new Date().getFullYear();
    const years = [
      currentYear - 2,
      currentYear - 1,
      currentYear,
    ];

    const comparison = await deptBudgetService.getBudgetComparison(
      req.tenantId,
      department,
      years,
    );
    res.status(200).json({ comparison });
  } catch (error) {
    next(error);
  }
};
