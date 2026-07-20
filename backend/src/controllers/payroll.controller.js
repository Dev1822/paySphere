const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const User = require("../models/user.model");

// Helper: parse tag labels back into structured numbers
function parseTagValue(label) {
  const match = label.match(/[0-9.]+/);
  return match ? parseFloat(match[0]) : 0;
}

// FINALIZE PAYROLL — process activity entries and save payroll records
exports.finalizePayroll = async (req, res) => {
  try {
    const { activities, month, year } = req.body;

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: "No activities to process" });
    }

    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

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
      // Match activity name to an employee (case-insensitive partial match)
      const employee = employees.find(emp =>
        emp.fullName.toLowerCase() === act.name.toLowerCase() ||
        emp.fullName.toLowerCase().includes(act.name.toLowerCase()) ||
        act.name.toLowerCase().includes(emp.fullName.toLowerCase())
      );

      if (!employee) {
        errors.push(`Could not match "${act.name}" to any employee`);
        continue;
      }

      // Parse tags into structured adjustments
      let leaveDays = 0, overtimeHours = 0, bonus = 0, deductions = 0;

      for (const tag of act.tags) {
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
      const baseSalary = employee.monthlySalary;
      
      // Use user default daily rate if available, otherwise fallback to salary/30
      const dailyRate = (user && user.defaultDailyRate) || (baseSalary / 30);
      const leaveDeduction = Math.round(dailyRate * leaveDays);
      
      // Use employee's overtime rate if set, otherwise use user default, otherwise 0
      const overtimeRate = employee.overtimeRate || (user && user.defaultOvertimeRate) || 0;
      const overtimePay = Math.round(overtimeRate * overtimeHours);
      
      const netSalary = baseSalary - leaveDeduction + overtimePay + bonus - deductions;

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
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

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
