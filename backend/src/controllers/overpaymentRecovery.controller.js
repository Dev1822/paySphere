/**
 * @fileoverview Statutory Overpayment Recovery Controller
 * @description Manages installment schedule creation with Section 7 Payment of Wages Act caps,
 * payroll cycle deductions, and recovery ledgers.
 * Issue: #2067
 */

const {
  generateOverpaymentInstallmentSchedule,
  processCycleOverpaymentDeduction,
  calculateMaxStatutoryDeductionCap,
} = require('../utils/overpaymentRecoveryEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed stores
const employeeOverpaymentSchedules = new Map();

/**
 * POST /api/overpayment-recovery/create-schedule
 * Creates a statutory 50% wage cap compliant overpayment recovery schedule.
 */
async function createSchedule(req, res, next) {
  try {
    const {
      employeeId,
      totalOverpaymentAmount,
      targetInstallments = 3,
      monthlyEarnings,
      reason,
      isCooperativeSociety = false,
    } = req.body;

    if (!employeeId || totalOverpaymentAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'employeeId and totalOverpaymentAmount are required',
      });
    }

    let earnings = monthlyEarnings !== undefined ? Number(monthlyEarnings) : 60000;
    try {
      const emp = await Employee.findById(employeeId);
      if (emp) {
        earnings = emp.salaryDetails?.gross || emp.salaryDetails?.basic * 1.5 || earnings;
      }
    } catch {
      // Fallback
    }

    const scheduleData = generateOverpaymentInstallmentSchedule(
      Number(totalOverpaymentAmount),
      earnings,
      Number(targetInstallments),
      Boolean(isCooperativeSociety),
    );

    const record = {
      scheduleId: `OVP-SCH-${Date.now()}`,
      employeeId: String(employeeId),
      reason: reason || 'Retroactive compensation adjustment',
      createdAt: new Date().toISOString(),
      currentBalance: Number(totalOverpaymentAmount),
      ...scheduleData,
    };

    employeeOverpaymentSchedules.set(String(employeeId), record);

    return res.status(201).json({
      success: true,
      message: 'Statutory overpayment installment schedule created successfully',
      data: record,
    });
  } catch (error) {
    logger.error('Error creating overpayment schedule:', error);
    return next(error);
  }
}

/**
 * POST /api/overpayment-recovery/deduct-cycle
 * Processes a monthly payroll cycle deduction for overpayment recovery.
 */
async function deductCycle(req, res, next) {
  try {
    const { employeeId, monthlyEarnings, requestedDeduction } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    const schedule = employeeOverpaymentSchedules.get(String(employeeId));
    if (!schedule || schedule.currentBalance <= 0) {
      return res.status(404).json({
        success: false,
        message: 'No active overpayment balance found for employee',
      });
    }

    let earnings = monthlyEarnings !== undefined ? Number(monthlyEarnings) : 60000;
    const deduction = processCycleOverpaymentDeduction(
      schedule.currentBalance,
      earnings,
      requestedDeduction !== undefined ? Number(requestedDeduction) : schedule.monthlyInstallmentAmount,
    );

    schedule.currentBalance = deduction.newBalance;

    return res.status(200).json({
      success: true,
      message: deduction.auditNotes,
      data: {
        employeeId,
        ...deduction,
      },
    });
  } catch (error) {
    logger.error('Error processing overpayment cycle deduction:', error);
    return next(error);
  }
}

/**
 * GET /api/overpayment-recovery/ledger/:employeeId
 * Retrieves employee overpayment recovery schedule and balance.
 */
async function getRecoveryLedger(req, res, next) {
  try {
    const { employeeId } = req.params;
    const schedule = employeeOverpaymentSchedules.get(String(employeeId)) || null;

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        hasActiveRecovery: Boolean(schedule && schedule.currentBalance > 0),
        schedule,
      },
    });
  } catch (error) {
    logger.error('Error fetching overpayment ledger:', error);
    return next(error);
  }
}

module.exports = {
  createSchedule,
  deductCycle,
  getRecoveryLedger,
  employeeOverpaymentSchedules,
};
