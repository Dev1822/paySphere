const mongoose = require("mongoose");
const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const User = require("../models/user.model");
const { calculateNetSalary } = require("../utils/salaryCalculator");
const { generatePayrollCSV } = require("../utils/csvExport");
const logger = require("../utils/logger");
const { createAuditLog } = require("../services/audit.service");

// Helper: parse tag labels back into structured numbers
function parseTagValue(label) {
  if (typeof label !== "string") return 0;
  const num = label.replace(/[^0-9.]/g, "");
  if (!num) return 0;
  const parsed = parseFloat(num);
  return (isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) ? 0 : parsed;
}

// FINALIZE PAYROLL — process activity entries and save payroll records
exports.finalizePayroll = async (req, res, next) => {
  let session = null;
  try {
    const { activities, month, year } = req.body;

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: "No activities to process" });
    }

    let currentMonth = month !== undefined ? Number(month) : new Date().getMonth() + 1;
    let currentYear = year !== undefined ? Number(year) : new Date().getFullYear();

    if (isNaN(currentMonth) || !Number.isInteger(currentMonth) || currentMonth < 1 || currentMonth > 12) {
      return res.status(400).json({ message: "Invalid month. Must be an integer between 1 and 12" });
    }

    if (isNaN(currentYear) || !Number.isInteger(currentYear) || currentYear < 2000 || currentYear > 2100) {
      return res.status(400).json({ message: "Invalid year. Must be a valid year integer" });
    }

    // Fetch all employees for this user
    const employees = await Employee.find({ createdBy: req.userId });

    if (employees.length === 0) {
      return res.status(400).json({ message: "No employees found. Add employees first." });
    }

    // Fetch user settings for default rates
    const user = await User.findById(req.userId);

    const preparedItems = [];
    const errors = [];

    // Phase 1: Upfront in-memory calculation and validation (no partial writes)
    for (const act of activities) {
      if (!act || typeof act !== "object") {
        errors.push("Invalid activity entry format");
        continue;
      }

      let employeeId = act.employeeId;
      if (!employeeId && act.name) {
        const matchedEmp = employees.find(emp => emp.fullName.toLowerCase() === act.name.toLowerCase());
        if (matchedEmp) {
          employeeId = matchedEmp._id;
        }
      }

      if (!employeeId) {
        errors.push(`employeeId is required but missing for activity involving "${act.name || 'unnamed'}"`);
        continue;
      }

      const employee = employees.find(emp => String(emp._id) === String(employeeId));

      if (!employee) {
        errors.push(`Could not find employee with ID: ${employeeId}`);
        continue;
      }

      if (!employee.isActive) {
        errors.push(`Employee ${employee.fullName} is inactive and cannot be included in payroll`);
        continue;
      }

      let leaveDays = 0, overtimeHours = 0, bonus = 0, deductions = 0;

      const tagsList = Array.isArray(act.tags) ? act.tags : [];
      for (const tag of tagsList) {
        if (!tag || typeof tag.label !== "string") continue;
        const lower = tag.label.toLowerCase();
        const value = parseTagValue(tag.label);

        if (lower.includes("leave") || lower.includes("day")) {
          leaveDays += value;
        } else if (lower.includes("overtime") || lower.includes("hr")) {
          overtimeHours += value;
        } else if (lower.includes("bonus")) {
          bonus += value;
        } else if (lower.includes("deduction")) {
          deductions += value;
        }
      }

      leaveDays = (isNaN(leaveDays) || !Number.isFinite(leaveDays) || leaveDays < 0) ? 0 : leaveDays;
      overtimeHours = (isNaN(overtimeHours) || !Number.isFinite(overtimeHours) || overtimeHours < 0) ? 0 : overtimeHours;
      bonus = (isNaN(bonus) || !Number.isFinite(bonus) || bonus < 0) ? 0 : bonus;
      deductions = (isNaN(deductions) || !Number.isFinite(deductions) || deductions < 0) ? 0 : deductions;

      const {
        baseSalary,
        leaveDeduction,
        overtimePay,
        netSalary
      } = calculateNetSalary(employee, user, { leaveDays, overtimeHours, bonus, deductions });

      if (isNaN(netSalary) || !Number.isFinite(netSalary)) {
        errors.push(`Invalid net salary calculation for employee "${employee.fullName}"`);
        continue;
      }

      preparedItems.push({
        employee,
        baseSalary,
        leaveDays,
        overtimeHours,
        bonus,
        deductions,
        leaveDeduction,
        overtimePay,
        netSalary
      });
    }

    if (preparedItems.length === 0) {
      return res.status(400).json({
        message: "No valid employee activities to process",
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Try starting a session for transaction atomicity
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessionErr) {
      session = null;
    }

    // Phase 2: Write all calculated records atomically within transaction using bulkWrite
    const bulkOps = preparedItems.map((item) => {
      const payrollData = {
        employeeId: item.employee._id,
        employeeName: item.employee.fullName,
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
        createdBy: req.userId,
        status: "finalized",
      };

      return {
        updateOne: {
          filter: {
            employeeId: item.employee._id,
            month: currentMonth,
            year: currentYear,
            createdBy: req.userId,
          },
          update: { $set: payrollData },
          upsert: true,
        },
      };
    });

    const bulkWriteOptions = session ? { session } : {};
    await PayrollUpdate.bulkWrite(bulkOps, bulkWriteOptions);

    // Phase 3: Fetch updated payrolls to construct response
    const fetchOptions = session ? { session } : {};
    const updatedPayrolls = await PayrollUpdate.find(
      {
        createdBy: req.userId,
        month: currentMonth,
        year: currentYear,
        employeeId: { $in: preparedItems.map((item) => item.employee._id) },
      },
      null,
      fetchOptions
    );

    const payrollMap = {};
    updatedPayrolls.forEach((p) => {
      payrollMap[p.employeeId.toString()] = p._id;
    });

    const results = preparedItems.map((item) => ({
      employeeName: item.employee.fullName,
      baseSalary: item.baseSalary,
      leaveDays: item.leaveDays,
      leaveDeduction: item.leaveDeduction,
      overtimeHours: item.overtimeHours,
      overtimePay: item.overtimePay,
      bonus: item.bonus,
      deductions: item.deductions,
      netSalary: item.netSalary,
      payrollId: payrollMap[item.employee._id.toString()],
    }));

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    const resourceIds = results.map(r => r.payrollId).filter(Boolean);

    createAuditLog({
      userId: req.userId,
      action: "PAYROLL_FINALIZE",
      resourceType: "Payroll",
      resourceIds,
      details: {
        month: currentMonth,
        year: currentYear,
        employeeCount: results.length,
        totalNetSalary: results.reduce((sum, r) => sum + r.netSalary, 0),
        errorCount: errors.length,
      },
      result: errors.length > 0 ? "partial" : "success",
      req,
    });

    logger.info(`Payroll finalized for ${results.length} employees`, {
      userId: req.userId,
      month: currentMonth,
      year: currentYear,
      employeeCount: results.length,
      errorCount: errors.length,
    });

    res.status(200).json({
      message: `Payroll finalized for ${results.length} employee${results.length !== 1 ? "s" : ""}`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (e) {
        // ignore session cleanup error
      }
    }

    createAuditLog({
      userId: req.userId,
      action: "PAYROLL_FINALIZE",
      resourceType: "Payroll",
      details: { month: req.body?.month, year: req.body?.year, error: error.message },
      result: "failure",
      req,
    });

    next(error);
  }
};

// GET PAYROLL SUMMARY for a month
exports.getPayrollSummary = async (req, res, next) => {
  try {
    let month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    let year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (isNaN(month) || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid month parameter" });
    }

    if (isNaN(year) || !Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "Invalid year parameter" });
    }

    const payrolls = await PayrollUpdate.find({
      createdBy: req.userId,
      month,
      year,
    }).sort({ employeeName: 1 });

    const totalPayout = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

    res.status(200).json({
      month,
      year,
      totalPayout,
      employeeCount: payrolls.length,
      payrolls,
    });
  } catch (error) {
    next(error);
  }
};

// EXPORT PAYROLL AS CSV
exports.exportPayrollCSV = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const payrolls = await PayrollUpdate.find({
      createdBy: req.userId,
      month,
      year,
    }).sort({ employeeName: 1 });

    if (payrolls.length === 0) {
      return res.status(404).json({ message: "No payroll data found for the selected month." });
    }

    const csvData = generatePayrollCSV(payrolls, month, year);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=payroll-${month}-${year}.csv`);
    res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};

const { sendPayslipEmail } = require("../services/email.service");

// SEND PAYSLIP EMAIL manually
exports.sendPayslipEmailHandler = async (req, res, next) => {
  try {
    const payrollId = req.params.id;
    const payroll = await PayrollUpdate.findOne({ _id: payrollId, createdBy: req.userId });
    
    if (!payroll) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    const employee = await Employee.findById(payroll.employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    
    if (!employee.email) {
      return res.status(400).json({ message: "Employee does not have an email address set" });
    }

    await sendPayslipEmail(employee, payroll);

    createAuditLog({
      userId: req.userId,
      action: "PAYSLIP_EMAIL",
      resourceType: "Payroll",
      resourceIds: [payroll._id],
      details: { employeeName: employee.fullName, employeeEmail: employee.email, month: payroll.month, year: payroll.year },
      req,
    });

    logger.info(`Payslip email sent`, { userId: req.userId, payrollId: payroll._id, employee: employee.fullName });

    res.status(200).json({ message: "Payslip email sent successfully" });
  } catch (error) {
    next(error);
  }
};

// BULK SEND PAYSLIP EMAILS (#140)
exports.sendAllPayslipsEmailHandler = async (req, res, next) => {
  try {
    let month = req.body.month ? Number(req.body.month) : (req.query.month ? Number(req.query.month) : new Date().getMonth() + 1);
    let year = req.body.year ? Number(req.body.year) : (req.query.year ? Number(req.query.year) : new Date().getFullYear());

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid month parameter" });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "Invalid year parameter" });
    }

    const payrolls = await PayrollUpdate.find({
      createdBy: req.userId,
      month,
      year,
    });

    if (payrolls.length === 0) {
      return res.status(404).json({ message: "No payroll records found for the selected month and year." });
    }

    const results = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const payroll of payrolls) {
      const employee = await Employee.findById(payroll.employeeId);
      if (!employee) {
        results.push({ payrollId: payroll._id, employeeName: payroll.employeeName, status: "failed", error: "Employee record not found" });
        failedCount++;
        continue;
      }

      if (!employee.email) {
        results.push({ payrollId: payroll._id, employeeName: employee.fullName, status: "no_email", message: "No email address registered" });
        skippedCount++;
        continue;
      }

      try {
        await sendPayslipEmail(employee, payroll);
        results.push({ payrollId: payroll._id, employeeName: employee.fullName, email: employee.email, status: "sent" });
        sentCount++;
      } catch (err) {
        logger.error(`Failed to send email to ${employee.fullName}`, { error: err.message, payrollId: payroll._id });
        results.push({ payrollId: payroll._id, employeeName: employee.fullName, email: employee.email, status: "failed", error: err.message });
        failedCount++;
      }
    }

    createAuditLog({
      userId: req.userId,
      action: "PAYSLIP_BULK_EMAIL",
      resourceType: "Payroll",
      resourceIds: payrolls.map(p => p._id),
      details: { month, year, sentCount, failedCount, skippedCount, total: payrolls.length },
      result: failedCount > 0 ? (sentCount > 0 ? "partial" : "failure") : "success",
      req,
    });

    logger.info(`Bulk payslip email dispatch complete`, {
      userId: req.userId, month, year, sentCount, failedCount, skippedCount, total: payrolls.length,
    });

    res.status(200).json({
      message: `Bulk email dispatch complete. Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
      sentCount,
      failedCount,
      skippedCount,
      total: payrolls.length,
      results,
    });
  } catch (error) {
    next(error);
  }
};

