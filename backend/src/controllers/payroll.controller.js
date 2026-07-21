const mongoose = require("mongoose");
const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const User = require("../models/user.model");
const { calculateNetSalary } = require("../utils/salaryCalculator");

// Helper: parse tag labels back into structured numbers
function parseTagValue(label) {
  if (typeof label !== "string") return 0;
  const num = label.replace(/[^0-9.]/g, "");
  if (!num) return 0;
  const parsed = parseFloat(num);
  return (isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) ? 0 : parsed;
}

// FINALIZE PAYROLL — process activity entries and save payroll records atomically
exports.finalizePayroll = async (req, res) => {
  let session = null;
  try {
    const { activities, month, year } = req.body;

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: "No activities to process" });
    }

    let currentMonth = month ? Number(month) : new Date().getMonth() + 1;
    let currentYear = year ? Number(year) : new Date().getFullYear();

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

      const employee = employees.find(emp =>
        (act.employeeId && String(emp._id) === String(act.employeeId)) ||
        (typeof act.name === "string" && emp.fullName.toLowerCase() === act.name.trim().toLowerCase())
      );

      if (!employee) {
        errors.push(`Could not match "${act.name || 'unnamed'}" to any employee`);
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

    // Phase 2: Write all calculated records atomically within transaction
    const results = [];
    const writeOptions = { upsert: true, new: true, setDefaultsOnInsert: true };
    if (session) writeOptions.session = session;

    for (const item of preparedItems) {
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

      const payroll = await PayrollUpdate.findOneAndUpdate(
        { employeeId: item.employee._id, month: currentMonth, year: currentYear, createdBy: req.userId },
        payrollData,
        writeOptions
      );

      results.push({
        employeeName: item.employee.fullName,
        baseSalary: item.baseSalary,
        leaveDays: item.leaveDays,
        leaveDeduction: item.leaveDeduction,
        overtimeHours: item.overtimeHours,
        overtimePay: item.overtimePay,
        bonus: item.bonus,
        deductions: item.deductions,
        netSalary: item.netSalary,
        payrollId: payroll._id,
      });
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

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
    console.error("Finalize payroll error:", error);
    res.status(500).json({ message: "Server error during payroll finalization", error: error.message });
  }
};

// GET PAYROLL SUMMARY for a month
exports.getPayrollSummary = async (req, res) => {
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
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
