const PDFDocument = require("pdfkit");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");
const { renderPayslip } = require("../services/payslipRenderer.service");
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

    // Fetch all payroll records within the date range
    const payrolls = await PayrollUpdate.find({
      createdBy: userId,
      $or: [
        { year: { $gt: startDate.getFullYear() } },
        {
          year: startDate.getFullYear(),
          month: { $gte: startDate.getMonth() + 1 },
        },
      ],
    }).sort({ year: 1, month: 1 });

    // Fetch all employees for role breakdown
    const employees = await Employee.find({ createdBy: userId });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    // --- Monthly Payout Trends ---
    const monthlyMap = {};
    payrolls.forEach((p) => {
      const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          month: p.month,
          year: p.year,
          label: key,
          totalPayout: 0,
          totalBase: 0,
          totalOvertime: 0,
          totalBonus: 0,
          totalDeductions: 0,
          employeeCount: 0,
        };
      }
      monthlyMap[key].totalPayout += p.netSalary;
      monthlyMap[key].totalBase += p.baseSalary;
      monthlyMap[key].totalOvertime += p.overtimePay;
      monthlyMap[key].totalBonus += p.bonus;
      monthlyMap[key].totalDeductions += p.deductions + p.leaveDeduction;
      monthlyMap[key].employeeCount++;
    });

    const monthlyTrends = Object.values(monthlyMap).sort(
      (a, b) => a.year - b.year || a.month - b.month,
    );

    // --- Role / Department Breakdown ---
    const roleMap = {};
    payrolls.forEach((p) => {
      const emp = employeeMap[String(p.employeeId)];
      const role = emp?.role || "Unassigned";
      if (!roleMap[role]) {
        roleMap[role] = {
          role,
          totalPayout: 0,
          totalBase: 0,
          totalOvertime: 0,
          employeeCount: 0,
        };
      }
      roleMap[role].totalPayout += p.netSalary;
      roleMap[role].totalBase += p.baseSalary;
      roleMap[role].totalOvertime += p.overtimePay;
      roleMap[role].employeeCount++;
    });

    const roleBreakdown = Object.values(roleMap).sort(
      (a, b) => b.totalPayout - a.totalPayout,
    );

    // --- Overtime vs Base Summary ---
    const totalBase = payrolls.reduce((sum, p) => sum + p.baseSalary, 0);
    const totalOvertime = payrolls.reduce((sum, p) => sum + p.overtimePay, 0);
    const totalBonus = payrolls.reduce((sum, p) => sum + p.bonus, 0);
    const totalDeductions = payrolls.reduce(
      (sum, p) => sum + p.deductions + p.leaveDeduction,
      0,
    );
    const totalNet = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

    res.status(200).json({
      summary: {
        totalPayout: totalNet,
        totalBase,
        totalOvertime,
        totalBonus,
        totalDeductions,
        totalRecords: payrolls.length,
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

// Helper: Generate a single payslip PDF buffer for zip bundle
const generatePayslipBuffer = (employee, payroll, company = {}, currency = "INR") => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    renderPayslip(doc, { employee, payroll, company, currency });
    doc.end();
  });
};

// GET /api/reports/export-xlsx?month=&year=
// Generates and downloads an Excel spreadsheet containing payroll summary
exports.exportExcelReport = async (req, res, next) => {
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

    const employeeIds = payrolls.map((p) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month - 1];

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PaySphere";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(`Payroll Summary ${monthName} ${year}`);

    worksheet.columns = [
      { header: "Employee Name", key: "employeeName", width: 25 },
      { header: "Role / Department", key: "role", width: 20 },
      { header: "Base Salary (Rs.)", key: "baseSalary", width: 16 },
      { header: "Leave Days", key: "leaveDays", width: 12 },
      { header: "Leave Deduction (Rs.)", key: "leaveDeduction", width: 20 },
      { header: "Overtime Hours", key: "overtimeHours", width: 15 },
      { header: "Overtime Pay (Rs.)", key: "overtimePay", width: 18 },
      { header: "Bonus (Rs.)", key: "bonus", width: 14 },
      { header: "Deductions (Rs.)", key: "deductions", width: 16 },
      { header: "Net Payout (Rs.)", key: "netSalary", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1E3A5F" },
    };

    let totalBase = 0;
    let totalLeaveDed = 0;
    let totalOvertimePay = 0;
    let totalBonus = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    payrolls.forEach((p) => {
      const emp = employeeMap[String(p.employeeId)];
      const totalDed = (p.deductions || 0) + (p.leaveDeduction || 0);

      totalBase += p.baseSalary || 0;
      totalLeaveDed += p.leaveDeduction || 0;
      totalOvertimePay += p.overtimePay || 0;
      totalBonus += p.bonus || 0;
      totalDeductions += totalDed;
      totalNet += p.netSalary || 0;

      worksheet.addRow({
        employeeName: p.employeeName,
        role: emp?.role || "N/A",
        baseSalary: p.baseSalary,
        leaveDays: p.leaveDays || 0,
        leaveDeduction: p.leaveDeduction || 0,
        overtimeHours: p.overtimeHours || 0,
        overtimePay: p.overtimePay || 0,
        bonus: p.bonus || 0,
        deductions: totalDed,
        netSalary: p.netSalary,
        status: p.status || "finalized",
      });
    });

    const summaryRow = worksheet.addRow({
      employeeName: "TOTAL",
      role: "",
      baseSalary: totalBase,
      leaveDays: "",
      leaveDeduction: totalLeaveDed,
      overtimeHours: "",
      overtimePay: totalOvertimePay,
      bonus: totalBonus,
      deductions: totalDeductions,
      netSalary: totalNet,
      status: "",
    });
    summaryRow.font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payroll-summary-${monthName}-${year}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

    createAuditLog({
      userId: req.userId,
      action: "REPORT_DOWNLOAD",
      resourceType: "Report",
      details: { month, year, type: "payroll-xlsx", employeeCount: payrolls.length },
      req,
    });

    logger.info(`XLSX report downloaded`, { userId: req.userId, month, year, employeeCount: payrolls.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/download-zip?month=&year=
// Generates and downloads a ZIP archive containing all employee payslip PDFs
exports.downloadPayslipsZip = async (req, res, next) => {
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

    const user = await User.findById(userId);
    const company = {
      ...(user?.settings?.companyInfo || {}),
      companyName: user?.companyName || "PaySphere",
    };
    const currency = user?.settings?.payrollConfig?.currency || "INR";

    const employeeIds = payrolls.map((p) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month - 1];

    const archiver = require("archiver");
    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payslips-${monthName}-${year}.zip`
    );

    archive.pipe(res);

    for (const payroll of payrolls) {
      const emp = employeeMap[String(payroll.employeeId)] || { fullName: payroll.employeeName };
      const pdfBuffer = await generatePayslipBuffer(emp, payroll, company, currency);
      const safeName = (payroll.employeeName || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
      archive.append(pdfBuffer, { name: `Payslip_${safeName}_${monthName}_${year}.pdf` });
    }

    await archive.finalize();

    createAuditLog({
      userId: req.userId,
      action: "REPORT_DOWNLOAD",
      resourceType: "Report",
      details: { month, year, type: "payslips-zip", employeeCount: payrolls.length },
      req,
    });

    logger.info(`ZIP payslips report downloaded`, { userId: req.userId, month, year, employeeCount: payrolls.length });
  } catch (error) {
    next(error);
  }
};

