/**
 * @fileoverview Comp-Off Management Controller
 * @description Request handlers for comp-off policies, requests, approvals,
 *   balances, ledger, expiry processing, and summary reports.
 */

const compOffService = require('../services/compOff.service');
const Employee = require('../models/employee.model');

// ─── Policy Endpoints ───────────────────────────────────────────────────────

/**
 * POST /api/comp-off/policies
 * Create a new comp-off accrual policy.
 */
exports.createPolicy = async (req, res, next) => {
  try {
    const { name, description, accrualRules, maxAccrualPerMonth, maxAccrualPerYear, maxBalanceCarry, expiryDays, minAdvanceNoticeDays, requiresApproval, approverRoles } = req.body;

    if (!name || !accrualRules || !Array.isArray(accrualRules) || accrualRules.length === 0) {
      return res.status(400).json({
        message: 'Policy name and at least one accrual rule are required',
      });
    }

    const policy = await compOffService.createPolicy(
      req.tenantId,
      {
        name,
        description,
        accrualRules,
        maxAccrualPerMonth,
        maxAccrualPerYear,
        maxBalanceCarry,
        expiryDays,
        minAdvanceNoticeDays,
        requiresApproval,
        approverRoles,
      },
      req.userId,
    );

    res.status(201).json({ message: 'Policy created', policy });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/comp-off/policies
 * List all comp-off policies for the tenant.
 */
exports.getPolicies = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const policies = await compOffService.getPolicies(req.tenantId, includeInactive);
    res.status(200).json({ policies });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/comp-off/policies/:policyId
 * Update a comp-off policy.
 */
exports.updatePolicy = async (req, res, next) => {
  try {
    const { policyId } = req.params;
    const policy = await compOffService.updatePolicy(policyId, req.tenantId, req.body);
    res.status(200).json({ message: 'Policy updated', policy });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/comp-off/policies/:policyId
 * Deactivate a comp-off policy.
 */
exports.deactivatePolicy = async (req, res, next) => {
  try {
    const { policyId } = req.params;
    await compOffService.deactivatePolicy(policyId, req.tenantId);
    res.status(200).json({ message: 'Policy deactivated' });
  } catch (error) {
    next(error);
  }
};

// ─── Request Endpoints ──────────────────────────────────────────────────────

/**
 * POST /api/comp-off/requests
 * Submit a new comp-off request.
 */
exports.submitRequest = async (req, res, next) => {
  try {
    const { policyId, workDate, compOffDate, workType, hoursWorked, reason } = req.body;

    if (!policyId || !workDate || !compOffDate || !workType || !reason) {
      return res.status(400).json({
        message: 'policyId, workDate, compOffDate, workType, and reason are required',
      });
    }

    // Resolve employee from authenticated user
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const request = await compOffService.submitRequest(
      req.tenantId,
      employee._id,
      { workDate, compOffDate, workType, hoursWorked: hoursWorked || 8, reason },
      policyId,
    );

    res.status(201).json({ message: 'Comp-off request submitted', request });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/comp-off/requests/my
 * Get the authenticated employee's comp-off requests.
 */
exports.getMyRequests = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.year) filters.year = parseInt(req.query.year, 10);

    const requests = await compOffService.getEmployeeRequests(
      req.tenantId,
      employee._id,
      filters,
    );

    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/comp-off/requests/pending
 * Get pending comp-off requests awaiting approval (manager/admin view).
 */
exports.getPendingApprovals = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.employeeId) filters.employeeId = req.query.employeeId;
    if (req.query.workType) filters.workType = req.query.workType;

    const requests = await compOffService.getPendingApprovals(
      req.tenantId,
      filters,
    );

    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/comp-off/requests/:requestId/approve
 * Approve a comp-off request.
 */
exports.approveRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { note } = req.body || {};

    const request = await compOffService.approveRequest(
      requestId,
      req.tenantId,
      req.userId,
      note,
    );

    res.status(200).json({ message: 'Request approved', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/comp-off/requests/:requestId/reject
 * Reject a comp-off request.
 */
exports.rejectRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body || {};

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const request = await compOffService.rejectRequest(
      requestId,
      req.tenantId,
      req.userId,
      reason,
    );

    res.status(200).json({ message: 'Request rejected', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/comp-off/requests/:requestId/cancel
 * Cancel a comp-off request.
 */
exports.cancelRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body || {};
    const isAdmin = req.userRole === 'Admin' || req.accountType === 'owner';

    const request = await compOffService.cancelRequest(
      requestId,
      req.tenantId,
      req.userId,
      reason,
      isAdmin,
    );

    res.status(200).json({ message: 'Request cancelled', request });
  } catch (error) {
    next(error);
  }
};

// ─── Balance & Ledger ───────────────────────────────────────────────────────

/**
 * GET /api/comp-off/balance
 * Get the authenticated employee's comp-off balance.
 */
exports.getBalance = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();

    const balance = await compOffService.getBalance(
      req.tenantId,
      employee._id,
      year,
    );

    res.status(200).json({ balance });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/comp-off/balance/:employeeId
 * Get comp-off balance for a specific employee (admin/manager view).
 */
exports.getEmployeeBalance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();

    const balance = await compOffService.getBalance(
      req.tenantId,
      employeeId,
      year,
    );

    res.status(200).json({ balance });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/comp-off/ledger
 * Get the comp-off transaction ledger for the authenticated employee.
 */
exports.getLedger = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const options = {};
    if (req.query.type) options.type = req.query.type;
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
    if (req.query.skip) options.skip = parseInt(req.query.skip, 10);

    const ledger = await compOffService.getLedger(
      req.tenantId,
      employee._id,
      options,
    );

    res.status(200).json({ ledger });
  } catch (error) {
    next(error);
  }
};

// ─── Admin / System ─────────────────────────────────────────────────────────

/**
 * POST /api/comp-off/process-expiries
 * Process expired comp-off requests (called by cron job or admin).
 */
exports.processExpiries = async (req, res, next) => {
  try {
    const result = await compOffService.processExpiries(req.tenantId);
    res.status(200).json({
      message: 'Expiry processing complete',
      result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/comp-off/reports/summary
 * Generate a comp-off summary report for the tenant.
 */
exports.getSummaryReport = async (req, res, next) => {
  try {
    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();

    const report = await compOffService.generateSummaryReport(
      req.tenantId,
      year,
    );

    res.status(200).json({ report });
  } catch (error) {
    next(error);
  }
};
