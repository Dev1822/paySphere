import type { Request, Response, NextFunction } from 'express';
import mongoose = require('mongoose');
import PDFDocument = require('pdfkit');
import ExcelJS = require('exceljs');
import archiver = require('archiver');
import { Worker } from 'worker_threads';
import path = require('path');

import PayrollUpdate = require('../models/payroll.model');
import payrollStatusConfig = require('../config/payrollStatus');
const { payableStatusFilter } = payrollStatusConfig;

import Employee = require('../models/employee.model');
import User = require('../models/user.model');
import logger = require('../utils/logger');
const { getDownloadUrl, putObject } = require('../services/objectStorage.service');
import eventBus = require('../services/event.service');

import currencyUtils = require('../utils/currency');
const { getCurrencySymbol, formatCurrency } = currencyUtils;

import tenantScopeUtils = require('../utils/tenantScope');
const { getTenantId } = tenantScopeUtils;

import type { TurnoverMetrics } from '../services/turnover.service';
export interface AuthenticatedRequest extends Request {
  userId?: string;
  tenantId?: string;
  user?: any;
}

interface AnalyticsQuery {
  months?: string;
  startDate?: string;
  endDate?: string;
  departments?: string;
  delivery?: string;
}

interface DownloadPDFQuery {
  month?: string;
  year?: string;
  departments?: string;
  delivery?: string;
}

interface CustomReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt';
  value: any;
}

interface CustomReportBody {
  dataset?: 'employees' | 'payroll';
  columns?: string[];
  filters?: CustomReportFilter[];
}

interface TurnoverMonthlyTrend {
  month: string;
  year: number;
  active: number;
  terminated: number;
}

interface TurnoverMetricsResponseBody {
  turnoverRate: number;
  averageTenureDays: number;
  averageTenureMonths: number;
  totalTerminated: number;
  departuresByReason: TurnoverMetrics['departuresByReason'];
  trends: TurnoverMonthlyTrend[];
}
/**
 * Helper function to parse department filter from query parameters
 * Supports both single department (backward compatibility) and comma-separated list
 *
 * @param departmentsParam - Comma-separated department names from query
 * @returns Array of department names
 */
function parseDepartments(departmentsParam: any): string[] {
  if (!departmentsParam || typeof departmentsParam !== 'string') {
    return [];
  }

  // Split by comma, trim whitespace, and filter out empty strings
  const departments = departmentsParam
    .split(',')
    .map((dept) => dept.trim())
    .filter((dept) => dept.length > 0);

  return departments;
}

/**
 * Helper function to get employee IDs filtered by departments
 *
 * @param userId - The user's ID
 * @param departments - Array of department names to filter by
 * @returns Array of employee IDs matching the departments
 */
async function getEmployeeIdsByDepartments(
  userId: string,
  departments: string[],
): Promise<string[] | null> {
  if (!departments || departments.length === 0) {
    return null; // null means no filter (all employees)
  }

  // Find employees whose department or role matches any of the selected departments
  const employees = await Employee.find({
    createdBy: userId,
    deletedAt: null,
    $or: [{ department: { $in: departments } }, { role: { $in: departments } }],
  }).select('_id');

  return employees.map((emp) => emp._id.toString());
}

/**
 * Build a { year, month } period filter that covers the calendar range
 * [start, end]. Payroll rows carry `month` (1-12) and `year` rather than a
 * single timestamp, so a calendar date range maps onto those two fields.
 */
function periodRangeFilter(start: Date, end: Date): any {
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  if (startYear === endYear) {
    return { year: startYear, month: { $gte: startMonth, $lte: endMonth } };
  }
  return {
    $or: [
      { year: { $gt: startYear, $lt: endYear } },
      { year: startYear, month: { $gte: startMonth } },
      { year: endYear, month: { $lte: endMonth } },
    ],
  };
}

// GET /api/reports/analytics
// Returns aggregated financial stats for the authenticated user's company
const getAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req.userId;
    const tenantId = getTenantId(req);
    const query = req.query as AnalyticsQuery;
    const monthsBack = Math.min(
      Math.max(parseInt(query.months || '') || 6, 1),
      12,
    );

    // Validate the optional date range (#527). An invalid date, or a startDate
    // that falls after endDate, used to reach the query and crash with a 500;
    // now it is a 400 with a meaningful message.
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    if (query.startDate) {
      rangeStart = new Date(query.startDate);
      if (isNaN(rangeStart.getTime())) {
        return res.status(400).json({ message: 'Invalid startDate format' });
      }
    }
    if (query.endDate) {
      rangeEnd = new Date(query.endDate);
      if (isNaN(rangeEnd.getTime())) {
        return res.status(400).json({ message: 'Invalid endDate format' });
      }
    }
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      return res.status(400).json({
        message: 'startDate must be on or before endDate',
      });
    }

    // Parse department filter
    const departments = parseDepartments(query.departments);
    const employeeIds = await getEmployeeIdsByDepartments(userId!, departments);

    // Resolve the effective period
    const now = new Date();
    const defaultStart = new Date(
      now.getFullYear(),
      now.getMonth() - monthsBack,
      1,
    );
    const periodQuery =
      rangeStart || rangeEnd
        ? periodRangeFilter(rangeStart || defaultStart, rangeEnd || now)
        : {
            $or: [
              { year: { $gt: defaultStart.getFullYear() } },
              {
                year: defaultStart.getFullYear(),
                month: { $gte: defaultStart.getMonth() + 1 },
              },
            ],
          };

    // Fetch all payroll records within the date range
    const payrolls = await PayrollUpdate.find({
      tenantId,
      ...payableStatusFilter(),
      ...periodQuery,
    }).sort({ year: 1, month: 1 });

    // Fetch all employees for role breakdown - filter by departments if specified
    const employeeQuery: any = {
      createdBy: userId,
      isDeleted: { $ne: true }, // Filter soft-deleted
    };
    if (employeeIds && employeeIds.length > 0) {
      employeeQuery._id = { $in: employeeIds };
    }

    const employees = await Employee.find(employeeQuery);
    const employeeMap: Record<string, any> = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    // --- Monthly Payout Trends ---
    const monthlyMap: Record<string, any> = {};
    payrolls.forEach((p: any) => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
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
      (a: any, b: any) => a.year - b.year || a.month - b.month,
    );

    // --- Role / Department Breakdown ---
    const roleMap: Record<string, any> = {};
    payrolls.forEach((p: any) => {
      const emp = employeeMap[String(p.employeeId)];
      const role = emp?.department || emp?.role || 'Unassigned';
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
      (a: any, b: any) => b.totalPayout - a.totalPayout,
    );

    // --- Overtime vs Base Summary ---
    const totalBase = payrolls.reduce(
      (sum: number, p: any) => sum + p.baseSalary,
      0,
    );
    const totalOvertime = payrolls.reduce(
      (sum: number, p: any) => sum + p.overtimePay,
      0,
    );
    const totalBonus = payrolls.reduce(
      (sum: number, p: any) => sum + p.bonus,
      0,
    );
    const totalDeductions = payrolls.reduce(
      (sum: number, p: any) => sum + p.deductions + p.leaveDeduction,
      0,
    );
    const totalNet = payrolls.reduce(
      (sum: number, p: any) => sum + p.netSalary,
      0,
    );

    const responseData = {
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
    };

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/download-pdf?month=&year=
// Generates and returns a downloadable company-wide PDF summary report
const downloadPDFReport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req.userId;
    const tenantId = getTenantId(req);
    const query = req.query as DownloadPDFQuery;
    let month = query.month ? Number(query.month) : new Date().getMonth() + 1;
    let year = query.year ? Number(query.year) : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    const payrollQuery: any = {
      tenantId,
      month,
      year,
      ...payableStatusFilter(),
    };

    // Parse department filter from query params (#656)
    const departments = parseDepartments(query.departments);
    const employeeIds = await getEmployeeIdsByDepartments(userId!, departments);

    if (employeeIds && employeeIds.length > 0) {
      payrollQuery.employeeId = { $in: employeeIds };
    }

    // Fetch payroll records for the selected month
    const payrolls = await PayrollUpdate.find(payrollQuery).sort({
      employeeName: 1,
    });

    if (payrolls.length === 0) {
      return res
        .status(404)
        .json({ message: 'No payroll data found for the selected period.' });
    }

    const user = await User.findById(userId);
    const companyLogo = user?.settings?.companyInfo?.companyLogo;
    const currency = user?.settings?.payrollConfig?.currency || 'INR';

    // Fetch employee details for roles
    const payrollEmployeeIds = payrolls.map((p: any) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: payrollEmployeeIds } });
    const employeeMap: Record<string, any> = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    // Get company name from first employee
    const companyName =
      employees.length > 0 ? employees[0]!.companyName : 'PaySphere';

    // Month names for display
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = monthNames[month - 1];

    // --- Summary Section ---
    const totalPayout = payrolls.reduce(
      (sum: number, p: any) => sum + p.netSalary,
      0,
    );
    const totalBase = payrolls.reduce(
      (sum: number, p: any) => sum + p.baseSalary,
      0,
    );
    const totalOvertime = payrolls.reduce(
      (sum: number, p: any) => sum + p.overtimePay,
      0,
    );
    const totalBonus = payrolls.reduce(
      (sum: number, p: any) => sum + p.bonus,
      0,
    );
    const totalDeductions = payrolls.reduce(
      (sum: number, p: any) => sum + p.deductions + p.leaveDeduction,
      0,
    );

    const pdfWorker = new Worker(
      path.join(__dirname, '../workers/pdf.worker.js'),
    );

    let isHandled = false;
    const workerTimeout = setTimeout(() => {
      if (!isHandled) {
        isHandled = true;
        pdfWorker.terminate();
        next(new Error('PDF generation timed out after 30 seconds.'));
      }
    }, 30000);

    pdfWorker.postMessage({
      type: 'GENERATE_COMPANY_REPORT',
      payload: {
        payrolls,
        employeeMap,
        companyName,
        companyLogo,
        monthName,
        year,
        totalBase,
        totalOvertime,
        totalBonus,
        totalDeductions,
        totalPayout,
        currency,
      },
    });

    pdfWorker.on('message', async (result: any) => {
      if (isHandled) return;
      isHandled = true;
      clearTimeout(workerTimeout);

      if (result.success) {
        const pdfBuffer = Buffer.from(result.pdfData);
        let storedFile: { uri: string; key: string } | null = null;
        let signedUrl = '';

        // When S3 is configured, persist the generated artifact there rather
        // than relying on instance-local storage. The existing binary response
        // remains backward compatible; callers that want a portable cloud URL
        // can request `?delivery=signed-url`.
        if (process.env.AWS_S3_BUCKET || process.env.S3_BUCKET) {
          storedFile = await putObject({
            key: `exports/${tenantId}/payroll-report-${monthName.toLowerCase()}-${year}-${Date.now()}.pdf`,
            body: pdfBuffer,
            contentType: 'application/pdf',
          });
          signedUrl = await getDownloadUrl(storedFile.uri, { expiresIn: 3600 });
        }

        if (String(query.delivery || '').toLowerCase() === 'signed-url') {
          if (!signedUrl) {
            return res.status(503).json({
              message: 'S3 storage is not configured for signed downloads.',
            });
          }
          return res.status(200).json({
            fileUrl: signedUrl,
            key: storedFile!.key,
            expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=payroll-report-${monthName}-${year}.pdf`,
        );
        if (signedUrl) res.setHeader('X-PaySphere-File-URL', signedUrl);
        res.send(pdfBuffer);

        eventBus.emit('AUDIT_LOG', {
          userId: req.userId,
          action: 'REPORT_DOWNLOAD',
          resourceType: 'Report',
          details: {
            month,
            year,
            type: 'payroll-pdf',
            employeeCount: payrolls.length,
            departments,
          },
          req,
        });

        logger.info(`PDF report downloaded`, {
          userId: req.userId,
          month,
          year,
          employeeCount: payrolls.length,
          departments,
        });
      } else {
        next(new Error('Failed to generate PDF: ' + result.error));
      }
      pdfWorker.terminate();
    });

    pdfWorker.on('error', (err) => {
      if (isHandled) return;
      isHandled = true;
      clearTimeout(workerTimeout);

      next(err);
      pdfWorker.terminate();
    });

    pdfWorker.on('exit', (code) => {
      if (isHandled) return;
      isHandled = true;
      clearTimeout(workerTimeout);

      if (code !== 0) {
        next(new Error(`PDF Worker stopped with exit code ${code}`));
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Generate a single payslip PDF buffer for zip bundle
const generatePayslipBuffer = (
  employee: any,
  payroll: any,
  currency = 'INR',
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: any[] = [];
    doc.on('data', (chunk: any) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err: any) => reject(err));

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#1e3a5f')
      .text('PaySphere', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#555555')
      .text(`Payslip for ${payroll.month}/${payroll.year}`, {
        align: 'center',
      });
    doc.moveDown(1.5);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text('Employee Details');
    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    doc.text(`Employee Name: ${employee.fullName || payroll.employeeName}`);
    doc.text(`Role: ${employee.role || 'N/A'}`);
    doc.text(`Department: ${employee.department || 'N/A'}`);
    doc.text(`Company: ${employee.companyName || 'PaySphere'}`);
    doc.moveDown(1);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text('Earnings & Deductions');
    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    doc.text(
      `Base Salary: ${formatCurrency(payroll.baseSalary || 0, currency)}`,
    );
    doc.text(
      `Leave Days: ${payroll.leaveDays || 0} (-${formatCurrency(payroll.leaveDeduction || 0, currency)})`,
    );
    doc.text(
      `Overtime Hours: ${payroll.overtimeHours || 0} (+${formatCurrency(payroll.overtimePay || 0, currency)})`,
    );
    doc.text(`Bonus: +${formatCurrency(payroll.bonus || 0, currency)}`);
    doc.text(
      `Deductions: -${formatCurrency(payroll.deductions || 0, currency)}`,
    );
    doc.moveDown(1);

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1e3a5f')
      .text(`Net Salary: ${formatCurrency(payroll.netSalary || 0, currency)}`, {
        underline: true,
      });

    // Bank Details section (if available)
    const bd = employee.bankDetails;
    if (bd && (bd.bankName || bd.accountNumber || bd.routingCode)) {
      doc.moveDown(1.5);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Bank Details');
      doc.fontSize(10).font('Helvetica').fillColor('#555555');
      if (bd.bankName) doc.text(`Bank Name: ${bd.bankName}`);
      if (bd.accountNumber) doc.text(`Account Number: ${bd.accountNumber}`);
      if (bd.routingCode) doc.text(`Routing / IFSC Code: ${bd.routingCode}`);
    }
    doc.end();
  });
};

// GET /api/reports/export-xlsx?month=&year=
// Generates and downloads an Excel spreadsheet containing payroll summary
const exportExcelReport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req.userId;
    const tenantId = getTenantId(req);
    const query = req.query as DownloadPDFQuery;
    let month = query.month ? Number(query.month) : new Date().getMonth() + 1;
    let year = query.year ? Number(query.year) : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    const payrollQuery: any = {
      tenantId,
      month,
      year,
      ...payableStatusFilter(),
    };

    // Parse department filter from query params (#656)
    const departments = parseDepartments(query.departments);
    const employeeIds = await getEmployeeIdsByDepartments(userId!, departments);

    if (employeeIds && employeeIds.length > 0) {
      payrollQuery.employeeId = {
        $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const payrolls = await PayrollUpdate.find(payrollQuery).sort({
      employeeName: 1,
    });

    if (payrolls.length === 0) {
      return res
        .status(404)
        .json({ message: 'No payroll data found for the selected period.' });
    }

    const payrollEmployeeIds = payrolls.map((p: any) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: payrollEmployeeIds } });
    const employeeMap: Record<string, any> = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = monthNames[month - 1];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PaySphere';
    workbook.created = new Date();

    const user = await User.findById(userId);
    const currency = user?.settings?.payrollConfig?.currency || 'INR';
    const symbol = getCurrencySymbol(currency);

    const worksheet = workbook.addWorksheet(
      `Payroll Summary ${monthName} ${year}`,
    );

    worksheet.columns = [
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: `Base Salary (${symbol})`, key: 'baseSalary', width: 16 },
      { header: 'Leave Days', key: 'leaveDays', width: 12 },
      {
        header: `Leave Deduction (${symbol})`,
        key: 'leaveDeduction',
        width: 20,
      },
      { header: 'Overtime Hours', key: 'overtimeHours', width: 15 },
      { header: `Overtime Pay (${symbol})`, key: 'overtimePay', width: 18 },
      { header: `Bonus (${symbol})`, key: 'bonus', width: 14 },
      { header: `Deductions (${symbol})`, key: 'deductions', width: 16 },
      { header: `Net Payout (${symbol})`, key: 'netSalary', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A5F' },
    };

    let totalBase = 0;
    let totalLeaveDed = 0;
    let totalOvertimePay = 0;
    let totalBonus = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    payrolls.forEach((p: any) => {
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
        role: emp?.role || 'N/A',
        department: emp?.department || 'N/A',
        baseSalary: p.baseSalary,
        leaveDays: p.leaveDays || 0,
        leaveDeduction: p.leaveDeduction || 0,
        overtimeHours: p.overtimeHours || 0,
        overtimePay: p.overtimePay || 0,
        bonus: p.bonus || 0,
        deductions: totalDed,
        netSalary: p.netSalary,
        status: p.status || 'finalized',
      });
    });

    const summaryRow = worksheet.addRow({
      employeeName: 'TOTAL',
      role: '',
      department: '',
      baseSalary: totalBase,
      leaveDays: '',
      leaveDeduction: totalLeaveDed,
      overtimeHours: '',
      overtimePay: totalOvertimePay,
      bonus: totalBonus,
      deductions: totalDeductions,
      netSalary: totalNet,
      status: '',
    });
    summaryRow.font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=payroll-summary-${monthName}-${year}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'REPORT_DOWNLOAD',
      resourceType: 'Report',
      details: {
        month,
        year,
        type: 'payroll-xlsx',
        employeeCount: payrolls.length,
        departments,
      },
      req,
    });

    logger.info(`XLSX report downloaded`, {
      userId: req.userId,
      month,
      year,
      employeeCount: payrolls.length,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/download-zip?month=&year=
// Generates and downloads a ZIP archive containing all employee payslip PDFs
const downloadPayslipsZip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req.userId;
    const tenantId = getTenantId(req);
    const query = req.query as DownloadPDFQuery;
    let month = query.month ? Number(query.month) : new Date().getMonth() + 1;
    let year = query.year ? Number(query.year) : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    const payrollQuery: any = {
      tenantId,
      month,
      year,
      ...payableStatusFilter(),
    };

    // Parse department filter from query params (#656)
    const departments = parseDepartments(query.departments);
    const employeeIds = await getEmployeeIdsByDepartments(userId!, departments);

    if (employeeIds && employeeIds.length > 0) {
      payrollQuery.employeeId = {
        $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const payrolls = await PayrollUpdate.find(payrollQuery).sort({
      employeeName: 1,
    });

    if (payrolls.length === 0) {
      return res
        .status(404)
        .json({ message: 'No payroll data found for the selected period.' });
    }

    const payrollEmployeeIds = payrolls.map((p: any) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: payrollEmployeeIds } });
    const employeeMap: Record<string, any> = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = monthNames[month - 1];

    const user = await User.findById(userId);
    const currency = user?.settings?.payrollConfig?.currency || 'INR';

    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=payslips-${monthName}-${year}.zip`,
    );

    archive.pipe(res);

    for (const payroll of payrolls) {
      const emp = employeeMap[String(payroll.employeeId)] || {
        fullName: payroll.employeeName,
      };
      const pdfBuffer = await generatePayslipBuffer(emp, payroll, currency);
      const safeName = (payroll.employeeName || 'Employee').replace(
        /[^a-zA-Z0-9_-]/g,
        '_',
      );
      archive.append(pdfBuffer, {
        name: `Payslip_${safeName}_${monthName}_${year}.pdf`,
      });
    }

    await archive.finalize();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'REPORT_DOWNLOAD',
      resourceType: 'Report',
      details: {
        month,
        year,
        type: 'payslips-zip',
        employeeCount: payrolls.length,
        departments,
      },
      req,
    });

    logger.info(`ZIP payslips report downloaded`, {
      userId: req.userId,
      month,
      year,
      employeeCount: payrolls.length,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

const getTurnoverMetrics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const userId = req.userId;
    const turnoverService: {
      getTurnoverMetrics: (
        userId: string,
        monthsBack?: number,
      ) => Promise<TurnoverMetrics>;
    } = require('../services/turnover.service');
    // Include all employees (even deleted) for historical turnover analysis
    const allEmployees = await Employee.find({
      createdBy: userId,
      isDeleted: { $ne: true }, // Filter soft-deleted for active analysis
    }).lean();

    const now = new Date();
    const monthsBack = 12;
    const trends: TurnoverMonthlyTrend[] = [];
    let totalTenureDays = 0;
    let terminatedCount = 0;

    for (let i = monthsBack - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
      );

      let activeCount = 0;
      let terminatedThisMonth = 0;

      for (const emp of allEmployees) {
        const joinDate = new Date(
          emp.joinDate || emp.joiningDate || emp.createdAt,
        );
        const termDate = emp.deletedAt
          ? new Date(emp.deletedAt)
          : emp.exitDetails?.lastWorkingDay
            ? new Date(emp.exitDetails.lastWorkingDay)
            : null;

        if (joinDate <= monthEnd) {
          if (!termDate || termDate > monthEnd) {
            activeCount++;
          } else if (termDate >= monthStart && termDate <= monthEnd) {
            terminatedThisMonth++;
            const tenureDays =
              (termDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
            totalTenureDays += tenureDays;
            terminatedCount++;
          }
        }
      }

      trends.push({
        month: monthStart.toLocaleString('default', { month: 'short' }),
        year: monthStart.getFullYear(),
        active: activeCount,
        terminated: terminatedThisMonth,
      });
    }

    const averageActiveEmployees =
      trends.reduce((acc, curr) => acc + curr.active, 0) / monthsBack;
    const turnoverRate =
      averageActiveEmployees > 0
        ? ((terminatedCount / averageActiveEmployees) * 100).toFixed(2)
        : 0;

    const averageTenureDays =
      terminatedCount > 0 ? Math.round(totalTenureDays / terminatedCount) : 0;

    const averageTenureMonths = (averageTenureDays / 30).toFixed(1);

    const { departuresByReason } = await turnoverService.getTurnoverMetrics(
      userId,
      monthsBack,
    );

    const responseBody: TurnoverMetricsResponseBody = {
      turnoverRate: parseFloat(turnoverRate as string),
      averageTenureDays,
      averageTenureMonths: parseFloat(averageTenureMonths),
      totalTerminated: terminatedCount,
      departuresByReason,
      trends,
    };

    return res.status(200).json(responseBody);  } catch (error) {
    next(error);
  }
};

// POST /api/reports/custom
// Generates a custom report dynamically with NoSQL injection prevention
const generateCustomReport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { dataset, columns, filters } = req.body as CustomReportBody;
    if (!dataset || !['employees', 'payroll'].includes(dataset)) {
      return res.status(400).json({ message: 'Invalid dataset' });
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ message: 'Columns are required' });
    }

    // Validate columns (prevent projection injection)
    const validColumns: Record<string, string[]> = {
      employees: [
        'fullName',
        'email',
        'department',
        'role',
        'baseSalary',
        'status',
        'createdAt',
      ],
      payroll: [
        'employeeName',
        'month',
        'year',
        'baseSalary',
        'netSalary',
        'status',
        'approvedAt',
      ],
    };
    const allowed = validColumns[dataset]!;
    const project: Record<string, number> = { _id: 1 };

    for (const col of columns) {
      if (allowed.includes(col)) {
        project[col] = 1;
      }
    }

    // Secure query construction
    const query: any = { tenantId: getTenantId(req) }; // always scope by tenant/user

    if (Array.isArray(filters)) {
      for (const filter of filters) {
        // filter format: { field: "role", operator: "equals", value: "Manager" }
        if (!allowed.includes(filter.field)) continue;

        // Prevent NoSQL injection by strictly casting/building the query object
        const val = filter.value;
        switch (filter.operator) {
          case 'equals':
            query[filter.field] = val;
            break;
          case 'not_equals':
            query[filter.field] = { $ne: val };
            break;
          case 'contains':
            query[filter.field] = {
              $regex: String(val).replace(/[.*+?^${}()|[\]\\]/g, '$&'),
              $options: 'i',
            };
            break;
          case 'gt':
            query[filter.field] = { $gt: Number(val) };
            break;
          case 'lt':
            query[filter.field] = { $lt: Number(val) };
            break;
        }
      }
    }

    const Model = dataset === 'employees' ? Employee : PayrollUpdate;
    const results = await Model.find(query, project).lean();

    res
      .status(200)
      .json({
        results,
        columns: Object.keys(project).filter((k) => k !== '_id'),
      });
  } catch (error) {
    next(error);
  }
};

const reportsController = {
  getAnalytics,
  downloadPDFReport,
  exportExcelReport,
  downloadPayslipsZip,
  getTurnoverMetrics,
  generateCustomReport,
};

export = reportsController;
