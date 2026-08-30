/**
 * @fileoverview Payroll Reversal Controller
 * @description Manages the lifecycle of payroll reversals, Form 24Q TDS adjustments,
 * balanced corrective Journal Voucher generation, and clawback tracking.
 * Issues: #1166, #1936
 */
const mongoose = require('mongoose');
const { PayrollReversal, PayrollReversalOrder, OverpaymentReceivable, TaxAdjustmentLedger } = require('../models/payrollReversal.model');
const PayrollUpdate = require('../models/payroll.model');
const {
  calculateReversalDeltas,
  generateNegativeJournals,
  verifyDoubleEntryBalancing,
  computeForm24QTdsAdjustments,
  generateClawbackSchedule,
  validateReversal,
} = require('../utils/reversalEngine.utils');
const { evaluateCrossPeriodTax, generateAmortizationSchedule } = require('../utils/reversalRecoveryEngine.utils');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const outboxService = require('../services/outbox.service');

// ==================== Legacy Reversal Endpoints (Issue #1166) ====================

exports.initiateReversal = async (req, res, next) => {
  try {
    const { originalPayrollId, correctedData, reason, recoveryMonths, startMonth, startYear, quarter, financialYear } = req.body;

    const originalPayroll = await PayrollUpdate.findOne({ _id: originalPayrollId, tenantId: req.tenantId });
    const validation = validateReversal(originalPayroll);

    if (!validation.isValid) {
      return res.status(400).json({ message: validation.reason });
    }

    const existingReversal = await PayrollReversal.findOne({
      originalPayrollId,
      tenantId: req.tenantId,
      status: { $nin: ['Cancelled', 'Fully Recovered'] },
    });

    if (existingReversal) {
      return res.status(409).json({ message: 'An active reversal already exists for this payroll run.' });
    }

    const deltas = calculateReversalDeltas(originalPayroll, correctedData);
    const glMappings = { salaryExpense: 'Salary Expense', tdsPayable: 'TDS Payable', salaryPayable: 'Employee Receivable' };
    const journalEntries = generateNegativeJournals(deltas, glMappings);

    const sMonth = Number(startMonth) || new Date().getMonth() + 1;
    const sYear = Number(startYear) || new Date().getFullYear();
    const schedule = generateClawbackSchedule(deltas.netOverpaid, recoveryMonths || 1, sMonth, sYear);

    const form24QAdjustment = computeForm24QTdsAdjustments(deltas, quarter || 'Q1', financialYear || '2026-2027');

    const reversal = await PayrollReversal.create({
      tenantId: req.tenantId,
      employeeId: originalPayroll.employeeId,
      originalPayrollId: originalPayroll._id,
      ...deltas,
      reason,
      recoveryMonths: recoveryMonths || 1,
      clawbackSchedule: schedule,
      journalEntries,
      initiatedBy: req.userId,
      status: 'Pending Approval',
    });

    res.status(201).json({
      message: 'Reversal initiated pending approval',
      reversal,
      form24QAdjustment,
    });
  } catch (error) { next(error); }
};

exports.getReversals = async (req, res, next) => {
  try {
    const reversals = await PayrollReversal.find({ tenantId: req.tenantId })
      .populate('employeeId', 'fullName department')
      .populate('originalPayrollId', 'month year netSalary')
      .sort({ createdAt: -1 });
    res.status(200).json({ reversals });
  } catch (error) { next(error); }
};

exports.approveReversal = async (req, res, next) => {
  let session = null;
  try {
    const reversal = await PayrollReversal.findById(req.params.id);
    if (!reversal || reversal.status !== 'Pending Approval') {
      return res.status(400).json({ message: 'Reversal not found or not pending approval.' });
    }

    const balancingCheck = verifyDoubleEntryBalancing(reversal.journalEntries || []);

    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    reversal.status = 'Recovery Active';
    reversal.approvedBy = req.userId;
    reversal.approvedAt = new Date();
    await reversal.save({ session });

    await PayrollUpdate.findByIdAndUpdate(
      reversal.originalPayrollId,
      { isReversed: true },
      { session },
    );

    // Persisted in the same transaction as the two writes above (#1801): a
    // crash right after this commits still leaves the row for
    // workers/outbox.worker.js to publish, so a downstream clawback/GL job
    // can never be silently skipped for an approval that did go through.
    await outboxService.recordEvent(
      outboxService.OUTBOX_EVENT_TYPES.PAYROLL_REVERSAL_REQUESTED,
      {
        reversalId: reversal._id,
        originalPayrollId: reversal.originalPayrollId,
        employeeId: reversal.employeeId,
        netOverpaid: reversal.netOverpaid,
        approvedBy: req.userId,
      },
      { tenantId: req.tenantId, session },
    );

    if (session) {
      await session.commitTransaction();
      session.endSession();
      session = null;
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYROLL_REVERSAL_APPROVED',
      resourceType: 'PayrollReversal',
      resourceIds: [reversal._id],
      details: {
        employeeId: reversal.employeeId,
        grossOverpaid: reversal.grossOverpaid,
        netOverpaid: reversal.netOverpaid,
        taxOverpaid: reversal.taxOverpaid,
        isJournalBalanced: balancingCheck.isBalanced,
      },
      req,
    });

    logger.info(`[Reversal] Approved reversal ${reversal._id} for employee ${reversal.employeeId}`);
    res.status(200).json({
      message: 'Reversal approved. Clawback schedule activated.',
      reversal,
      balancingCheck,
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch { }
    }
    next(error);
  }
};

exports.checkPayrollBlockGuard = async (req, res, next) => {
  try {
    const pendingReversals = await PayrollReversal.countDocuments({
      tenantId: req.tenantId,
      status: { $in: ['Pending Approval', 'Draft'] },
    });

    res.status(200).json({
      isBlocked: pendingReversals > 0,
      pendingCount: pendingReversals,
      message: pendingReversals > 0 ? `${pendingReversals} unresolved reversals pending. Resolve them before running next payroll.` : 'Clear to run payroll.',
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/reversals/tax-adjustment-summary
 * Summary of Form 24Q TDS adjustments and clawback recovery totals.
 */
exports.getTaxAdjustmentSummary = async (req, res, next) => {
  try {
    const reversals = await PayrollReversal.find({ tenantId: req.tenantId });

    const totalGrossOverpaid = reversals.reduce((sum, r) => sum + (r.grossOverpaid || 0), 0);
    const totalTaxOverpaid = reversals.reduce((sum, r) => sum + (r.taxOverpaid || 0), 0);
    const totalNetOverpaid = reversals.reduce((sum, r) => sum + (r.netOverpaid || 0), 0);

    res.status(200).json({
      totalReversals: reversals.length,
      activeRecoveries: reversals.filter((r) => r.status === 'Recovery Active').length,
      totals: {
        totalGrossOverpaid: Math.round(totalGrossOverpaid * 100) / 100,
        totalTaxOverpaid: Math.round(totalTaxOverpaid * 100) / 100,
        totalNetOverpaid: Math.round(totalNetOverpaid * 100) / 100,
      },
      form24QSummary: {
        section: '192',
        requiresFiling: totalTaxOverpaid > 0,
        totalTdsCreditAdjustment: Math.round(totalTaxOverpaid * 100) / 100,
      },
    });
  } catch (error) { next(error); }
};

// ==================== New Reversal Order Endpoints (Issue #1936) ====================

/**
 * POST /api/reversals/order/initiate
 * Initiate a new payroll reversal order with tax evaluation
 */
exports.initiateReversalOrder = async (req, res, next) => {
  try {
    const { employeeId, originalPayrollRunId, reason, originalGross, originalNet, originalPayDate } = req.body;
    const taxEval = evaluateCrossPeriodTax(originalPayDate, new Date());

    const reversal = await PayrollReversalOrder.create({
      tenantId: req.tenantId, employeeId, originalPayrollRunId, reason,
      originalGross, originalNet, isCrossPeriod: taxEval.isCrossPeriod
    });

    // Mock tax adjustments
    const taxTypes = ['Federal', 'State', 'FICA', 'Medicare'];
    const adjustments = taxTypes.map(t => ({
      tenantId: req.tenantId, reversalId: reversal._id, taxType: t,
      adjustmentAmount: originalGross * 0.05, // Mock 5%
      requiresAmendedReturn: taxEval.requiresAmendedReturn,
      quarter: taxEval.origQuarter, year: taxEval.origYear
    }));
    await TaxAdjustmentLedger.insertMany(adjustments);

    res.status(201).json({ message: 'Reversal initiated', reversal, taxEval });
  } catch (error) { next(error); }
};

/**
 * POST /api/reversals/order/generate-receivable
 * Generate overpayment receivable with amortization schedule
 */
exports.generateReceivable = async (req, res, next) => {
  try {
    const { reversalId, paychecksRemaining, expectedNetPay } = req.body;
    const reversal = await PayrollReversalOrder.findById(reversalId);
    if (!reversal) return res.status(404).json({ message: 'Reversal not found' });

    const schedule = generateAmortizationSchedule(reversal.originalNet, paychecksRemaining, 0.25, expectedNetPay); // 25% limit

    const receivable = await OverpaymentReceivable.create({
      tenantId: req.tenantId, reversalId, employeeId: reversal.employeeId,
      totalOwed: reversal.originalNet, remainingBalance: reversal.originalNet,
      amortizationSchedule: schedule
    });

    reversal.status = 'Receivable Created';
    await reversal.save();

    res.status(201).json({ message: 'Receivable amortization generated', receivable });
  } catch (error) { next(error); }
};

/**
 * GET /api/reversals/order/dashboard
 * Dashboard view for reversals and receivables
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const reversals = await PayrollReversalOrder.find({ tenantId: req.tenantId })
      .populate('employeeId', 'fullName').sort({ createdAt: -1 });
    const receivables = await OverpaymentReceivable.find({ tenantId: req.tenantId, status: 'Active' })
      .populate('employeeId', 'fullName');
    res.status(200).json({ reversals, receivables });
  } catch (error) { next(error); }
};
