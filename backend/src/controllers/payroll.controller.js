const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const User = require("../models/user.model");
const { calculateNetSalary } = require("../utils/salaryCalculator");

// Helper: parse tag labels back into structured numbers
function parseTagValue(label) {
  const num = label.replace(/[^0-9.]/g, "");
  return num ? parseFloat(num) : 0;
}

// FINALIZE PAYROLL — process activity entries and save payroll records
exports.finalizePayroll = async (req, res) => {
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

    const results = [];
    const errors = [];

    for (const act of activities) {
      if (!act || typeof act !== "object") {
        errors.push("Invalid activity entry format");
        continue;
      }

      // Match activity precisely by employeeId (if provided) or by exact name
      const employee = employees.find(emp =>
        (act.employeeId && String(emp._id) === String(act.employeeId)) ||
        (typeof act.name === "string" && emp.fullName.toLowerCase() === act.name.trim().toLowerCase())
      );

      if (!employee) {
        errors.push(`Could not match "${act.name || 'unnamed'}" to any employee`);
        continue;
      }

      // Parse tags into structured adjustments
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

      // Calculate salary adjustments
      const {
        baseSalary,
        leaveDeduction,
        overtimePay,
        netSalary
      } = calculateNetSalary(employee, user, { leaveDays, overtimeHours, bonus, deductions });

      // Upsert payroll record (update if exists for same employee/month)
      const payrollData = {
        employeeId: employee._id,
        employeeName: employee.fullName,
        month: currentMonth,
        year: currentYear,
        baseSalary,
        overtimeRate: employee.overtimeRate || 0,
        leaveDays,
        overtimeHours,
        bonus,
        deductions,
        leaveDeduction,
        overtimePay,
        netSalary,
        createdBy: req.userId,
        status: "finalized",
      };

      const payroll = await PayrollUpdate.findOneAndUpdate(
        { employeeId: employee._id, month: currentMonth, year: currentYear, createdBy: req.userId },
        payrollData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      results.push({
        employeeName: employee.fullName,
        baseSalary,
        leaveDays,
        leaveDeduction,
        overtimeHours,
        overtimePay,
        bonus,
        deductions,
        netSalary,
        payrollId: payroll._id,
      });
    }

    res.status(200).json({
      message: `Payroll finalized for ${results.length} employee${results.length !== 1 ? "s" : ""}`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Finalize payroll error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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
