const PDFDocument = require("pdfkit");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const logger = require("../utils/logger");
const { createAuditLog } = require("../services/audit.service");

// GET /api/reports/analytics
// Returns aggregated financial stats for the authenticated user's company
exports.getAnalytics = async (req, res, next) => {
  try {
    const userId = req.userId;
    const monthsBack = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 12);

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;

    // Build match condition for date range
    const dateMatch = {
      $or: [
        { year: { $gt: startYear } },
        { year: startYear, month: { $gte: startMonth } },
      ],
    };

    // --- Monthly Payout Trends (server-side aggregation) ---
    const monthlyTrends = await PayrollUpdate.aggregate([
      { $match: { createdBy: userId, ...dateMatch } },
      {
        $group: {
          _id: { month: "$month", year: "$year" },
          totalPayout: { $sum: "$netSalary" },
          totalBase: { $sum: "$baseSalary" },
          totalOvertime: { $sum: "$overtimePay" },
          totalBonus: { $sum: "$bonus" },
          totalDeductions: { $sum: { $add: ["$deductions", "$leaveDeduction"] } },
          employeeCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id.month",
          year: "$_id.year",
          label: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              { $cond: [{ $lt: ["$_id.month", 10] }, { $concat: ["0", { $toString: "$_id.month" }] }, { $toString: "$_id.month" }] },
            ],
          },
          totalPayout: 1,
          totalBase: 1,
          totalOvertime: 1,
          totalBonus: 1,
          totalDeductions: 1,
          employeeCount: 1,
        },
      },
    ]);

    // --- Role / Department Breakdown (server-side aggregation with $lookup) ---
    const roleBreakdown = await PayrollUpdate.aggregate([
      { $match: { createdBy: userId, ...dateMatch } },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$employee.role",
          totalPayout: { $sum: "$netSalary" },
          totalBase: { $sum: "$baseSalary" },
          totalOvertime: { $sum: "$overtimePay" },
          employeeCount: { $sum: 1 },
        },
      },
      { $sort: { totalPayout: -1 } },
      {
        $project: {
          _id: 0,
          role: { $ifNull: ["$_id", "Unassigned"] },
          totalPayout: 1,
          totalBase: 1,
          totalOvertime: 1,
          employeeCount: 1,
        },
      },
    ]);

    // --- Summary (derived from aggregation) ---
    const summaryResult = await PayrollUpdate.aggregate([
      { $match: { createdBy: userId, ...dateMatch } },
      {
        $group: {
          _id: null,
          totalPayout: { $sum: "$netSalary" },
          totalBase: { $sum: "$baseSalary" },
          totalOvertime: { $sum: "$overtimePay" },
          totalBonus: { $sum: "$bonus" },
          totalDeductions: { $sum: { $add: ["$deductions", "$leaveDeduction"] } },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    const summary = summaryResult[0] || {
      totalPayout: 0, totalBase: 0, totalOvertime: 0,
      totalBonus: 0, totalDeductions: 0, totalRecords: 0,
    };

    res.status(200).json({
      summary: {
        totalPayout: summary.totalPayout,
        totalBase: summary.totalBase,
        totalOvertime: summary.totalOvertime,
        totalBonus: summary.totalBonus,
        totalDeductions: summary.totalDeductions,
        totalRecords: summary.totalRecords,
        monthsCovered: monthlyTrends.length,
      },
      monthlyTrends,
      roleBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/download-pdf?month=&year=
// Generates and returns a downloadable company-wide PDF summary report
exports.downloadPDFReport = async (req, res, next) => {
  try {
    const userId = req.userId;
    let month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    let year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid month parameter" });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "Invalid year parameter" });
    }

    // Fetch payroll records for the selected month
    const payrolls = await PayrollUpdate.find({
      createdBy: userId,
      month,
      year,
    }).sort({ employeeName: 1 });

    if (payrolls.length === 0) {
      return res
        .status(404)
        .json({ message: "No payroll data found for the selected period." });
    }

    // Fetch employee details for roles
    const employeeIds = payrolls.map((p) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    // Get company name from first employee
    const companyName =
      employees.length > 0 ? employees[0].companyName : "PaySphere";

    // Month names for display
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month - 1];

    // --- Summary Section ---
    const totalPayout = payrolls.reduce((sum, p) => sum + p.netSalary, 0);
    const totalBase = payrolls.reduce((sum, p) => sum + p.baseSalary, 0);
    const totalOvertime = payrolls.reduce((sum, p) => sum + p.overtimePay, 0);
    const totalBonus = payrolls.reduce((sum, p) => sum + p.bonus, 0);
    const totalDeductions = payrolls.reduce(
      (sum, p) => sum + p.deductions + p.leaveDeduction,
      0,
    );

    const { Worker } = require("worker_threads");
    const path = require("path");

    const pdfWorker = new Worker(path.join(__dirname, "../workers/pdf.worker.js"));
    
    pdfWorker.postMessage({
      type: "GENERATE_COMPANY_REPORT",
      payload: {
        payrolls,
        employeeMap,
        companyName,
        monthName,
        year,
        totalBase,
        totalOvertime,
        totalBonus,
        totalDeductions,
        totalPayout
      }
    });

    pdfWorker.on("message", (result) => {
      if (result.success) {
        // Set response headers for PDF download
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=payroll-report-${monthName}-${year}.pdf`,
        );
        res.send(Buffer.from(result.pdfData));

        createAuditLog({
          userId: req.userId,
          action: "REPORT_DOWNLOAD",
          resourceType: "Report",
          details: { month, year, type: "payroll-pdf", employeeCount: payrolls.length },
          req,
        });
    
        logger.info(`PDF report downloaded`, { userId: req.userId, month, year, employeeCount: payrolls.length });
      } else {
        next(new Error("Failed to generate PDF: " + result.error));
      }
      pdfWorker.terminate();
    });

    pdfWorker.on("error", (err) => {
      next(err);
      pdfWorker.terminate();
    });
  } catch (error) {
    next(error);
  }
};
