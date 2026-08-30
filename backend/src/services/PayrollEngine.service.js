const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const User = require('../models/user.model');
const ExchangeRate = require('../models/exchangeRate.model');
const { acquireLock, releaseLock } = require('../utils/lockManager');
const { EmploymentFinding } = require('../models/adolescentEmployment.model');
const { SEVERITY } = require('../utils/adolescentEmployment');
const { calculateNetSalary } = require('../utils/salaryCalculator');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const outboxService = require('./outbox.service');
const { PAYROLL_STATUS, normalizeStatus } = require('../config/payrollStatus');
const Attendance = require('../models/attendance.model');
const {
  getActiveCalculationRule,
  normalizeCalculationRule,
} = require('./payrollCalculationRule.service');const { derivePayrollInputs } = require('../utils/attendanceGrid');
const Loan = require('../models/loan.model');
const {
  LOAN_STATUS,
  allocateRecovery,
  applyRepayment,
} = require('../utils/loanSchedule');
const SalaryStructure = require('../models/salaryStructure.model');
const {
  resolveStructureForPeriod,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const {
  bundleUnreleasedArrears,
  markArrearsReleased,
} = require('../utils/arrearsCalculator');
const ExpenseClaim = require('../models/expenseClaim.model');

function parseTagValue(label) {
  if (typeof label !== 'string') return 0;
  const num = label.replace(/[^0-9.]/g, '');
  if (!num) return 0;
  const parsed = parseFloat(num);
  return isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;
}

class PayrollEngine {
  /**
   * Pure compute function for payroll calculation
   */
  static async compute({
    activity,
    employee,
    user,
    attendanceByEmployee,
    expensesByEmployee,
    revisionsByEmployee,
    loansByEmployee,
    tenantId,
    currentMonth,
    currentYear,
    calculationRule = null,
  }) {
    const resolvedCalculationRule =
      normalizeCalculationRule(calculationRule);

    let leaveDays = 0,      overtimeHours = 0,
      bonus = 0,
      deductions = 0;

    const tagsList = Array.isArray(activity.tags) ? activity.tags : [];
    for (const tag of tagsList) {
      if (!tag || typeof tag.label !== 'string') continue;
      const lower = tag.label.toLowerCase();
      const value = parseTagValue(tag.label);

      if (lower.includes('overtime') || lower.includes('ot')) {
        overtimeHours += value;
      } else if (lower.includes('bonus')) {
        bonus += value;
      } else if (lower.includes('deduct')) {
        deductions += value;
      } else if (
        lower.includes('leave') ||
        lower.includes('unpaid') ||
        lower.includes('absence') ||
        lower.includes('day')
      ) {
        leaveDays += value;
      } else if (lower.includes('hr') || lower.includes('hour')) {
        overtimeHours += value;
      }
    }

    leaveDays =
      isNaN(leaveDays) || !Number.isFinite(leaveDays) || leaveDays < 0
        ? 0
        : leaveDays;
    overtimeHours =
      isNaN(overtimeHours) ||
      !Number.isFinite(overtimeHours) ||
      overtimeHours < 0
        ? 0
        : overtimeHours;
    bonus = isNaN(bonus) || !Number.isFinite(bonus) || bonus < 0 ? 0 : bonus;
    deductions =
      isNaN(deductions) || !Number.isFinite(deductions) || deductions < 0
        ? 0
        : deductions;

    let attendanceSource = 'manual';
    const ledger = attendanceByEmployee.get(String(employee._id));

    if (ledger && ledger.totals) {
      const derived = derivePayrollInputs(ledger.totals);
      leaveDays = derived.leaveDays;
      overtimeHours = derived.overtimeHours;
      attendanceSource = 'ledger';
    }

    const empExpenses = expensesByEmployee.get(String(employee._id)) || {
      taxable: 0,
      nonTaxable: 0,
      ids: [],
    };

    const includeTaxableExpenses =
      resolvedCalculationRule.rules.bonus.includeTaxableExpenses !== false;

    const bonusWithTaxableExpenses = Math.round(
      (bonus + (includeTaxableExpenses ? empExpenses.taxable : 0)) * 100,
    ) / 100;

    const {
      baseSalary,
      leaveDeduction,
      overtimeRate,
      overtimePay,
      netSalary,
    } = calculateNetSalary(employee, user, {
      leaveDays,
      overtimeHours,
      bonus: bonusWithTaxableExpenses,
      deductions,
      calculationRule: resolvedCalculationRule,
    });    if (isNaN(netSalary) || !Number.isFinite(netSalary)) {
      throw new Error(
        `Invalid net salary calculation for employee "${employee.fullName}"`,
      );
    }

    let salarySnapshot = null;
    try {
      const employeeRevisions =
        revisionsByEmployee.get(String(employee._id)) || [];
      if (employeeRevisions.length > 0) {
        const period = resolveStructureForPeriod(
          employeeRevisions,
          currentMonth,
          currentYear,
        );
        if (period.segments.length > 0) {
          const primary = period.segments[period.segments.length - 1].structure;
          const breakdown = computeComponentAmounts(primary);

          salarySnapshot = {
            effectiveGross: period.effectiveGross,
            isProrated: period.segments.length > 1,
            segmentCount: period.segments.length,
            components: breakdown.components.map((c) => ({
              code: c.code,
              label: c.label,
              type: c.type,
              amount: c.amount,
            })),
          };
        }
      }
    } catch (snapshotError) {
      logger.warn('Could not snapshot the salary breakdown for a payroll row', {
        employeeId: String(employee._id),
        error: snapshotError.message,
      });
    }

    const employeeLoans = loansByEmployee.get(String(employee._id)) || [];
    const recovery = allocateRecovery({
      loans: employeeLoans,
      month: currentMonth,
      year: currentYear,
      availableForRecovery: netSalary,
    });

    const netAfterRecovery = Math.max(
      0,
      Math.round((netSalary - recovery.totalRecovered) * 100) / 100,
    );

    const { totalArrears, arrearsBreakdown, ledgerIds } =
      await bundleUnreleasedArrears(employee._id, tenantId);

    const finalNetSalary =
      Math.round(
        (netAfterRecovery + empExpenses.nonTaxable + totalArrears) * 100,
      ) / 100;

    return {
      employee,
      baseSalary,
      leaveDays,
      overtimeHours,
      bonus: bonusWithTaxableExpenses,
      deductions,
      leaveDeduction,
      overtimePay,
      reimbursements: empExpenses.nonTaxable,
      reimbursedExpenseIds: empExpenses.ids,
      netSalary: finalNetSalary,
      grossNetBeforeRecovery: netSalary,
      overtimeRate,
      loanRecoveries: recovery.recoveries,
      loanRecoveryTotal: recovery.totalRecovered,
      attendanceSource,
      salarySnapshot,
      calculationRule: resolvedCalculationRule,
      arrearsPayout: totalArrears,
      arrearsBreakdown: arrearsBreakdown,
      arrearsLedgerIds: ledgerIds,
      shortfall: recovery.shortfall,    };
  }

  /**
   * Execute the payroll run wrapping logic in a transaction
   */
  static async executeRun(req, { activities, month, year }) {
    let session = null;
    let lockKey = null;
    try {
      const tenantId = req.tenantId;
      const userId = req.userId;

      const rateDoc = await ExchangeRate.findOne().sort({ date: -1 });
      
      // Use 48 hours to account for weekends when FX markets are closed
      const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
      if (!rateDoc || !rateDoc.date || (Date.now() - new Date(rateDoc.date).getTime() > FORTY_EIGHT_HOURS)) {
        const error = new Error('Fresh exchange rates are not available (rates are older than 48 hours). Please ensure the exchange rate synchronization job is running before processing payroll.');
        error.status = 409;
        throw error;
      }

      const getRateVal = (target) => {
        const targetUpper = (target || 'USD').toUpperCase();
        if (targetUpper === 'USD') return 1.0;
        if (rateDoc && rateDoc.rates) {
          if (typeof rateDoc.rates.get === 'function')
            return rateDoc.rates.get(targetUpper) || 1.0;
          return rateDoc.rates[targetUpper] || 1.0;
        }
        return 1.0;
      };

      let currentMonth =
        month !== undefined ? Number(month) : new Date().getMonth() + 1;
      let currentYear =
        year !== undefined ? Number(year) : new Date().getFullYear();

      lockKey = `payroll_lock:${tenantId || 'global'}:${currentYear}:${currentMonth}`;
      const acquired = await acquireLock(lockKey, 300000);
      if (!acquired) {
        throw new Error(
          'Another payroll process is currently running for this company and month. Please try again later.',
        );
      }

      // Check for unresolved adolescent worker scheduling violations
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));

      const unresolvedViolations = await EmploymentFinding.find({
        tenantId,
        resolvedOn: null,
        severity: { $in: [SEVERITY.PROHIBITED, SEVERITY.BREACH] },
        occurredOn: { $gte: startOfMonth, $lte: endOfMonth },
      }).lean();

      if (unresolvedViolations.length > 0) {
        const error = new Error('Adolescent scheduling violations must be resolved before payroll finalization.');
        error.status = 400;
        throw error;
      }

      const employees = await Employee.find({
        tenantId,
        isDeleted: { $ne: true },
      });
      if (employees.length === 0)
        throw new Error('No employees found. Add employees first.');

      const user = await User.findById(userId);

      const calculationRule =
        await getActiveCalculationRule(tenantId);

      let attendanceByEmployee = new Map();      try {
        const attendanceRecords = await Attendance.find({
          tenantId,
          year: currentYear,
          month: currentMonth,
        }).select('employeeId totals');
        attendanceByEmployee = new Map(
          (attendanceRecords || []).map((record) => [
            String(record.employeeId),
            record,
          ]),
        );
      } catch (e) {
        logger.warn('Could not read the attendance ledger', {
          userId,
          month: currentMonth,
          year: currentYear,
          error: e.message,
        });
      }

      let loansByEmployee = new Map();
      try {
        const activeLoans = await Loan.find({
          tenantId,
          status: LOAN_STATUS.ACTIVE,
        });
        (activeLoans || []).forEach((loan) => {
          const key = String(loan.employeeId);
          if (!loansByEmployee.has(key)) loansByEmployee.set(key, []);
          loansByEmployee.get(key).push(loan);
        });
      } catch (e) {
        logger.warn('Could not read the loan ledger', {
          userId,
          error: e.message,
        });
      }

      let revisionsByEmployee = new Map();
      try {
        const revisions = await SalaryStructure.find({ tenantId }).sort({
          effectiveFrom: 1,
        });
        (revisions || []).forEach((revision) => {
          const key = String(revision.employeeId);
          if (!revisionsByEmployee.has(key)) revisionsByEmployee.set(key, []);
          revisionsByEmployee.get(key).push(revision);
        });
      } catch (e) {
        logger.warn('Could not read salary structures', {
          userId,
          error: e.message,
        });
      }

      const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
      const pendingExpenses = await ExpenseClaim.find({
        tenantId,
        status: 'approved',
        payrollId: null,
        expenseDate: { $lte: monthEnd },
      })
        .populate('categoryId', 'isTaxable name')
        .lean();

      const expensesByEmployee = new Map();
      const errors = [];
      for (const exp of pendingExpenses) {
        if (!exp.categoryId) {
          errors.push(
            `Expense claim ${exp._id} was skipped: its category no longer exists`,
          );
          continue;
        }
        const amount = Number(exp.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          errors.push(
            `Expense claim ${exp._id} was skipped: the amount is not a usable number`,
          );
          continue;
        }
        const key = String(exp.employeeId);
        if (!expensesByEmployee.has(key))
          expensesByEmployee.set(key, { taxable: 0, nonTaxable: 0, ids: [] });
        const bucket = expensesByEmployee.get(key);
        if (exp.categoryId.isTaxable) bucket.taxable += amount;
        else bucket.nonTaxable += amount;
        bucket.ids.push(exp._id);
      }

      const preparedItems = [];
      for (const act of activities) {
        if (!act || typeof act !== 'object') {
          errors.push('Invalid activity entry format');
          continue;
        }

        let employeeId = act.employeeId;
        if (!employeeId && act.name) {
          const matchedEmp = employees.find(
            (emp) => emp.fullName.toLowerCase() === act.name.toLowerCase(),
          );
          if (matchedEmp) employeeId = matchedEmp._id;
        }
        if (!employeeId) {
          errors.push(
            `employeeId is required but missing for activity involving "${act.name || 'unnamed'}"`,
          );
          continue;
        }

        const employee = employees.find(
          (emp) => String(emp._id) === String(employeeId),
        );
        if (!employee) {
          errors.push(`Could not find employee with ID: ${employeeId}`);
          continue;
        }
        if (employee.employmentStatus === 'exited') {
          errors.push(
            `Employee ${employee.fullName} has exited and cannot be included in payroll`,
          );
          continue;
        }
        if (!employee.isActive) {
          errors.push(
            `Employee ${employee.fullName} is inactive and cannot be included in payroll`,
          );
          continue;
        }

        try {
          const computed = await PayrollEngine.compute({
            activity: act,
            employee,
            user,
            attendanceByEmployee,
            expensesByEmployee,
            revisionsByEmployee,
            loansByEmployee,
            tenantId,
            currentMonth,
            currentYear,
            calculationRule,
          });
          if (computed.shortfall > 0) {
            errors.push(
              `Loan recovery for "${employee.fullName}" was short by ${computed.shortfall}; the balance carries forward`,
            );
          }

          preparedItems.push(computed);
        } catch (err) {
          errors.push(err.message);
        }
      }

      if (preparedItems.length === 0) {
        const error = new Error('No valid employee activities to process');
        error.validationErrors = errors;
        throw error;
      }

      const employeeIds = preparedItems.map((item) => item.employee._id);
      const lockedRecords = await PayrollUpdate.find({
        employeeId: { $in: employeeIds },
        month: currentMonth,
        year: currentYear,
        createdBy: userId,
        tenantId,
        status: {
          $in: [PAYROLL_STATUS.PAID, PAYROLL_STATUS.APPROVED, 'finalized'],
        },
      });

      if (lockedRecords.length > 0) {
        const paidEmployees = lockedRecords
          .filter((p) => normalizeStatus(p.status) === PAYROLL_STATUS.PAID)
          .map((p) => p.employeeName);
        const approvedEmployees = lockedRecords
          .filter((p) => normalizeStatus(p.status) === PAYROLL_STATUS.APPROVED)
          .map((p) => p.employeeName);
        const parts = [];
        if (paidEmployees.length > 0)
          parts.push(`already paid for: ${paidEmployees.join(', ')}`);
        if (approvedEmployees.length > 0)
          parts.push(
            `already approved for: ${approvedEmployees.join(', ')} (reject the run first to re-submit)`,
          );

        const conflictError = new Error(`Payroll is ${parts.join('; ')}.`);
        conflictError.status = 409;
        conflictError.details = {
          paidEmployees,
          approvedEmployees,
          lockedEmployees: lockedRecords.map((p) => p.employeeName),
        };
        throw conflictError;
      }

      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }

      const bulkOps = preparedItems.map((item) => {
        const targetCurrency =
          item.employee.targetCurrency || item.employee.currency || 'USD';
        const payrollData = {
          employeeId: item.employee._id,
          employeeName: item.employee.fullName,
          currency: targetCurrency,
          targetCurrency: targetCurrency,
          baseCurrency: item.employee.baseCurrency || 'USD',
          exchangeRate: getRateVal(targetCurrency),
          convertedNetSalary:
            Math.round((item.netSalary / getRateVal(targetCurrency)) * 100) /
            100,
          month: currentMonth,
          year: currentYear,
          baseSalary: item.baseSalary,
          overtimeRate: item.employee.overtimeRate || 0,
          leaveDays: item.leaveDays,
          overtimeHours: item.overtimeHours,
          bonus: item.bonus,
          deductions: item.deductions,
          leaveDeduction: item.leaveDeduction,
          overtimePay: item.overtimePay,
          netSalary: item.netSalary,
          loanRecoveries: item.loanRecoveries,
          loanRecoveryTotal: item.loanRecoveryTotal,
          reimbursements: item.reimbursements,
          reimbursedExpenseIds: item.reimbursedExpenseIds,
          arrearsPayout: item.arrearsPayout,
          arrearsBreakdown: item.arrearsBreakdown,
          arrearsLedgerIds: item.arrearsLedgerIds,
          attendanceSource: item.attendanceSource,
          salarySnapshot: item.salarySnapshot,

          calculationSnapshot: {
            version: item.calculationRule.version,
            ruleId: item.calculationRule.ruleId,
            rules: item.calculationRule.rules,
            employee: {              fullName: item.employee.fullName,
              email: item.employee.email,
              role: item.employee.role,
              companyName: item.employee.companyName,
              language: item.employee.language,
              version: item.employee.__v,
            },            inputs: {
              baseSalary: item.baseSalary,
              overtimeRate: item.overtimeRate,
              leaveDays: item.leaveDays,
              overtimeHours: item.overtimeHours,
              bonus: item.bonus,
              deductions: item.deductions,
              leaveDeduction: item.leaveDeduction,
              overtimePay: item.overtimePay,
              reimbursements: item.reimbursements,
              loanRecoveryTotal: item.loanRecoveryTotal,
              arrearsPayout: item.arrearsPayout,
              exchangeRate: getRateVal(targetCurrency),
              currency: targetCurrency,
              targetCurrency,
              baseCurrency: item.employee.baseCurrency || 'USD',
              attendanceSource: item.attendanceSource,
              defaultDailyRate: user?.defaultDailyRate || 0,
              defaultOvertimeRate: user?.defaultOvertimeRate || 0,
            },
            salarySnapshot: item.salarySnapshot,
            loanRecoveries: item.loanRecoveries,
            arrearsBreakdown: item.arrearsBreakdown,
            reimbursedExpenseIds: item.reimbursedExpenseIds,
            finalAmounts: {
              grossNetBeforeRecovery: item.grossNetBeforeRecovery,
              netSalary: item.netSalary,
            },
          },

          tenantId,
          status: PAYROLL_STATUS.PENDING_APPROVAL,          submittedBy: userId,
          submittedAt: new Date(),
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        };

        return {
          updateOne: {
            filter: {
              employeeId: item.employee._id,
              month: currentMonth,
              year: currentYear,
              tenantId,
            },
            update: { $set: payrollData },
            upsert: true,
          },
        };
      });

      const bulkWriteOptions = session ? { session } : {};
      await PayrollUpdate.bulkWrite(bulkOps, bulkWriteOptions);

      const allReimbursedIds = preparedItems.flatMap(
        (item) => item.reimbursedExpenseIds || [],
      );
      if (allReimbursedIds.length > 0) {
        const updatedPayrollsForExpenses = await PayrollUpdate.find({
          tenantId,
          month: currentMonth,
          year: currentYear,
          employeeId: { $in: preparedItems.map((i) => i.employee._id) },
        })
          .setOptions(bulkWriteOptions)
          .select('_id employeeId')
          .lean();

        const payrollMap = new Map(
          updatedPayrollsForExpenses.map((p) => [String(p.employeeId), p._id]),
        );

        const expenseUpdates = preparedItems.flatMap((item) => {
          const payrollId = payrollMap.get(String(item.employee._id));
          if (!payrollId) return [];
          return (item.reimbursedExpenseIds || []).map((expId) => ({
            updateOne: {
              filter: { _id: expId, tenantId, payrollId: null },
              update: {
                $set: {
                  status: 'reimbursed',
                  payrollId,
                  reimbursedAt: new Date(),
                },
              },
            },
          }));
        });

        if (expenseUpdates.length > 0) {
          await ExpenseClaim.bulkWrite(expenseUpdates, bulkWriteOptions);
        }
      }

      const fetchOptions = session ? { session } : {};
      const updatedPayrolls = await PayrollUpdate.find(
        {
          tenantId,
          month: currentMonth,
          year: currentYear,
          employeeId: { $in: preparedItems.map((item) => item.employee._id) },
        },
        null,
        fetchOptions,
      );

      const payrollMap = {};
      updatedPayrolls.forEach((p) => {
        payrollMap[p.employeeId.toString()] = p._id;
      });

      for (const item of preparedItems) {
        if (!item.arrearsLedgerIds || item.arrearsLedgerIds.length === 0)
          continue;
        const payrollId = payrollMap[item.employee._id.toString()];
        if (!payrollId) continue;
        await markArrearsReleased(item.arrearsLedgerIds, payrollId, {
          tenantId,
          session,
        });
      }

      // Recorded inside the same transaction as the payroll writes above
      // (#1801): a crash right after this commits still leaves the event as
      // `pending` for workers/outbox.worker.js to pick up and publish, so
      // payslip generation/emailing can never be silently skipped for a run
      // that did save.
      const finalizedPayrollIds = preparedItems
        .map((item) => payrollMap[item.employee._id.toString()])
        .filter(Boolean);
      const outboxPayload = {
        tenantId,
        userId,
        month: currentMonth,
        year: currentYear,
        payrollIds: finalizedPayrollIds,
      };
      await outboxService.recordEvent(
        outboxService.OUTBOX_EVENT_TYPES.PAYROLL_FINALIZED,
        outboxPayload,
        { tenantId, session },
      );
      await outboxService.recordEvent(
        outboxService.OUTBOX_EVENT_TYPES.PAYSLIP_GENERATION_REQUESTED,
        outboxPayload,
        { tenantId, session },
      );
      await outboxService.recordEvent(
        outboxService.OUTBOX_EVENT_TYPES.PAYSLIP_EMAIL_REQUESTED,
        outboxPayload,
        { tenantId, session },
      );

      const results = preparedItems.map((item) => ({        employeeName: item.employee.fullName,
        currency: item.employee.currency || 'INR',
        baseSalary: item.baseSalary,
        leaveDays: item.leaveDays,
        leaveDeduction: item.leaveDeduction,
        overtimeHours: item.overtimeHours,
        overtimePay: item.overtimePay,
        bonus: item.bonus,
        deductions: item.deductions,
        netSalary: item.netSalary,
        loanRecoveryTotal: item.loanRecoveryTotal,
        loanRecoveries: item.loanRecoveries,
        arrearsPayout: item.arrearsPayout,
        arrearsBreakdown: item.arrearsBreakdown,
        attendanceSource: item.attendanceSource,
        payrollId: payrollMap[item.employee._id.toString()],
      }));

      if (session) {
        await session.commitTransaction();
        session.endSession();
        session = null;
      }

      // Out of transaction updates
      for (const item of preparedItems) {
        for (const entry of item.loanRecoveries || []) {
          if (!entry.loanId || entry.alreadyRecovered) continue;
          try {
            const loan = (
              loansByEmployee.get(String(item.employee._id)) || []
            ).find((l) => String(l._id) === String(entry.loanId));
            if (!loan) continue;

            const applied = applyRepayment(loan, {
              month: currentMonth,
              year: currentYear,
              amount: entry.amount,
              payrollId: payrollMap[item.employee._id.toString()] || null,
            });

            await Loan.updateOne(
              { _id: loan._id, tenantId },
              {
                $set: {
                  repayments: applied.repayments,
                  totalRepaid: applied.totalRepaid,
                  outstanding: applied.outstanding,
                  status: applied.status,
                  ...(applied.status === LOAN_STATUS.COMPLETED
                    ? { completedAt: new Date() }
                    : {}),
                },
              },
            );

            eventBus.emit('AUDIT_LOG', {
              userId,
              action: 'LOAN_REPAYMENT',
              resourceType: 'Loan',
              resourceIds: [loan._id],
              details: {
                employeeName: item.employee.fullName,
                amount: entry.amount,
                month: currentMonth,
                year: currentYear,
                outstanding: applied.outstanding,
                source: 'payroll',
              },
              req,
            });
          } catch (repayError) {
            logger.error('Failed to record a loan repayment after payroll', {
              userId,
              loanId: String(entry.loanId),
              error: repayError.message,
            });
          }
        }
      }

      await cacheService.invalidateAnalytics(userId);
      await cacheService.invalidateDashboardSummary(userId);

      const resourceIds = results.map((r) => r.payrollId).filter(Boolean);
      eventBus.emit('AUDIT_LOG', {
        userId,
        action: 'PAYROLL_FINALIZE',
        resourceType: 'Payroll',
        resourceIds,
        details: {
          month: currentMonth,
          year: currentYear,
          employeeCount: results.length,
          totalNetSalary: results.reduce((sum, r) => sum + r.netSalary, 0),
          errorCount: errors.length,
        },
        result: errors.length > 0 ? 'partial' : 'success',
        req,
      });

      logger.info(`Payroll finalized for ${results.length} employees`, {
        userId,
        month: currentMonth,
        year: currentYear,
        employeeCount: results.length,
        errorCount: errors.length,
      });

      return { results, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      if (session) {
        try {
          await session.abortTransaction();
          session.endSession();
        } catch {}
      }

      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'PAYROLL_FINALIZE',
        resourceType: 'Payroll',
        details: { month, year, error: error.message },
        result: 'failure',
        req,
      });

      throw error;
    } finally {
      if (lockKey) {
        await releaseLock(lockKey);
      }
    }
  }
}

module.exports = PayrollEngine;
