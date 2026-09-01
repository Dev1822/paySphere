/**
 * @fileoverview Role-Based Dynamic Dashboard Widget Persistence & Layout Engine
 * @description Provides widget layout persistence per user and role-based default widget presets (ADMIN, HR, FINANCE, EMPLOYEE).
 */

'use strict';

const DashboardLayout = require('../models/dashboardLayout.model');
const logger = require('../utils/logger');

const MAX_WIDGETS = 50;
const MAX_WIDGET_ID_LENGTH = 64;

const DEFAULT_ROLE_PRESETS = {
  ADMIN: ['payroll_summary', 'employee_overview', 'anomaly_alerts', 'audit_stream', 'expense_claims'],
  HR: ['employee_overview', 'attendance_grid', 'leave_requests', 'onboarding_tracker'],
  FINANCE: ['payroll_summary', 'expense_claims', 'fx_calculator', 'tax_compliance', 'loan_recovery'],
  EMPLOYEE: ['payslip_quickview', 'leave_balance', 'expense_reimbursements'],
  DEFAULT: ['payroll_summary', 'employee_overview', 'leave_balance'],
};

function validateWidgetOrder(order) {
  if (!Array.isArray(order)) {
    return { ok: false, message: 'order must be an array of widget ids' };
  }

  if (order.length > MAX_WIDGETS) {
    return {
      ok: false,
      message: `order cannot contain more than ${MAX_WIDGETS} widgets`,
    };
  }

  const cleaned = [];
  for (const id of order) {
    if (typeof id !== 'string') {
      return { ok: false, message: 'every widget id must be a string' };
    }

    const trimmed = id.trim();
    if (trimmed === '') {
      return { ok: false, message: 'a widget id cannot be empty' };
    }

    if (trimmed.length > MAX_WIDGET_ID_LENGTH) {
      return {
        ok: false,
        message: `a widget id cannot exceed ${MAX_WIDGET_ID_LENGTH} characters`,
      };
    }

    if (cleaned.includes(trimmed)) {
      return { ok: false, message: `duplicate widget id: ${trimmed}` };
    }

    cleaned.push(trimmed);
  }

  return { ok: true, order: cleaned };
}

exports.getLayout = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);

    const layout = await DashboardLayout.findOne({
      userId: req.userId,
      tenantId,
    }).lean();

    if (layout && Array.isArray(layout.order) && layout.order.length > 0) {
      return res.status(200).json({ order: layout.order, isPreset: false });
    }

    const userRole = (req.userRole || 'DEFAULT').toUpperCase();
    const defaultOrder = DEFAULT_ROLE_PRESETS[userRole] || DEFAULT_ROLE_PRESETS.DEFAULT;

    return res.status(200).json({ order: defaultOrder, isPreset: true, role: userRole });
  } catch (error) {
    next(error);
  }
};

exports.saveLayout = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const validated = validateWidgetOrder(req.body?.order);

    if (!validated.ok) {
      return res.status(400).json({ message: validated.message });
    }

    const layout = await DashboardLayout.findOneAndUpdate(
      { userId: req.userId },
      { $set: { order: validated.order, tenantId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    logger.debug('Dashboard layout saved', {
      userId: req.userId,
      widgets: layout.order.length,
    });

    return res.status(200).json({ success: true, order: layout.order });
  } catch (error) {
    next(error);
  }
};

exports.MAX_WIDGETS = MAX_WIDGETS;
exports.MAX_WIDGET_ID_LENGTH = MAX_WIDGET_ID_LENGTH;
exports.DEFAULT_ROLE_PRESETS = DEFAULT_ROLE_PRESETS;
exports.validateWidgetOrder = validateWidgetOrder;
