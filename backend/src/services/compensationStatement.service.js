/**
 * @fileoverview Total Compensation Statement Service
 *
 * Generates per-employee total compensation statements by aggregating
 * payroll data across a fiscal year. Computes CTC breakdowns, statutory
 * contributions, benefits, and estimated take-home.
 */

'use strict';

const mongoose = require('mongoose');
const CompensationStatement = require('../models/compensationStatement.model');
const Employee = require('../models/employee.model');
const Payroll = require('../models/payroll.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

// ─── Statutory Constants (India) ─────────────────────────────────────────

const PF_EMPLOYEE_RATE = 0.12;
const PF_EMPLOYER_RATE = 0.12;
const PF_ANNUAL_CEILING = 15000 * 12; // ₹15,000/month ceiling
const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_EMPLOYER_RATE = 0.0325;
const ESI_ANNUAL_CEILING = 21000 * 12;
const GRATUITY_ACCRUAL_RATE = 4.81 / 100;
const PROFESSIONAL_TAX_MONTHLY = 200; // Simplified; varies by state
const MONTHS_IN_YEAR = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────

function safeNum(val) {
  const n = Number(val);
  return isNaN(n) || n < 0 ? 0 : n;
}

function computeEmployerPF(annualBasic) {
  const pfWage = Math.min(annualBasic, PF_ANNUAL_CEILING);
  return Math.round(pfWage * PF_EMPLOYER_RATE);
}

function computeEmployeePF(annualBasic) {
  const pfWage = Math.min(annualBasic, PF_ANNUAL_CEILING);
  return Math.round(pfWage * PF_EMPLOYEE_RATE);
}

function computeEmployerESI(totalGross) {
  if (totalGross > ESI_ANNUAL_CEILING) return 0;
  return Math.round(totalGross * ESI_EMPLOYER_RATE);
}

function computeEmployeeESI(totalGross) {
  if (totalGross > ESI_ANNUAL_CEILING) return 0;
  return Math.round(totalGross * ESI_EMPLOYEE_RATE);
}

function computeGratuity(annualBasic) {
  return Math.round(annualBasic * GRATUITY_ACCRUAL_RATE);
}

function computeProfessionalTax() {
  return PROFESSIONAL_TAX_MONTHLY * MONTHS_IN_YEAR;
}

// ─── Statement Generation ────────────────────────────────────────────────

/**
 * Generate a total compensation statement for one employee in a fiscal year.
 *
 * @param {ObjectId} tenantId
 * @param {ObjectId} employeeId
 * @param {number} fiscalYear
 * @param {ObjectId} userId — who triggered the generation
 * @returns {object} The saved CompensationStatement document
 */
async function generateStatement(tenantId, employeeId, fiscalYear, userId) {
  // 1. Fetch employee
  const employee = await Employee.findOne(
    tenantFilter({ tenantId }, { _id: employeeId, deletedAt: null }),
  ).lean();

  if (!employee) {
    throw new ObjectNotFoundException('Employee not found');
  }

  // 2. Fetch all payroll records for this employee in the fiscal year
  // Fiscal year runs April–March; FY 2026 means Apr 2025 – Mar 2026
  const startYear = fiscalYear - 1;
  const startMonth = 4; // April
  const endYear = fiscalYear;
  const endMonth = 3; // March

  const payrolls = await Payroll.find({
    tenantId,
    employeeId,
    $or: [
      { year: startYear, month: { $gte: startMonth } },
      { year: endYear, month: { $lte: endMonth } },
    ],
  }).sort({ year: 1, month: 1 }).lean();

  // 3. Aggregate payroll components
  let totalBasic = 0;
  let totalBonus = 0;
  let totalOvertimePay = 0;
  let totalDeductions = 0;
  let totalGrossEarnings = 0;

  const monthlyBreakdown = [];

  for (const p of payrolls) {
    const basic = safeNum(p.baseSalary);
    const overtime = safeNum(p.overtimePay);
    const bonus = safeNum(p.bonus);
    const deductions = safeNum(p.deductions) + safeNum(p.leaveDeduction);
    const net = safeNum(p.netSalary);

    totalBasic += basic;
    totalBonus += bonus;
    totalOvertimePay += overtime;
    totalDeductions += deductions;
    totalGrossEarnings += basic + overtime + bonus;

    monthlyBreakdown.push({
      month: p.month,
      basic,
      hra: safeNum(p.salarySnapshot?.components?.find?.((c) => c.code === 'HRA')?.amount) || Math.round(basic * 0.4),
      otherAllowances: Math.round(basic * 0.15),
      grossEarnings: basic + overtime + bonus,
      deductions,
      netPay: net,
    });
  }

  // 4. If no payroll data, estimate from base salary
  const monthsOfData = payrolls.length;
  const monthlyBase = employee.monthlySalary || 0;

  if (monthsOfData === 0) {
    totalBasic = monthlyBase * MONTHS_IN_YEAR;
  }

  const annualBasic = totalBasic;
  const annualHRA = Math.round(annualBasic * 0.40);
  const annualSpecialAllowance = Math.round(annualBasic * 0.15);
  const annualTransportAllowance = Math.round(1600 * MONTHS_IN_YEAR);
  const annualMedicalAllowance = Math.round(1250 * MONTHS_IN_YEAR);
  const totalFixed = annualBasic + annualHRA + annualSpecialAllowance + annualTransportAllowance + annualMedicalAllowance;

  const totalVariable = totalBonus + totalOvertimePay;

  // 5. Statutory contributions
  const employerPF = computeEmployerPF(annualBasic);
  const employerESI = computeEmployerESI(totalFixed + totalVariable);
  const employerGratuity = computeGratuity(annualBasic);
  const totalEmployerContributions = employerPF + employerESI + employerGratuity;

  const employeePF = computeEmployeePF(annualBasic);
  const employeeESI = computeEmployeeESI(totalFixed + totalVariable);
  const ptax = computeProfessionalTax();
  const totalEmployeeDeductions = employeePF + employeeESI + ptax;

  // 6. CTC and take-home
  const totalCTC = totalFixed + totalVariable + totalEmployerContributions;
  const estimatedAnnualTakeHome = totalFixed + totalVariable - totalEmployeeDeductions;
  const estimatedMonthlyTakeHome = Math.round(estimatedAnnualTakeHome / MONTHS_IN_YEAR);

  // 7. Build & persist
  const statement = await CompensationStatement.findOneAndUpdate(
    { tenantId, employeeId, fiscalYear },
    {
      tenantId,
      employeeId,
      employeeName: employee.fullName || '',
      department: employee.department || '',
      role: employee.role || '',
      jobLevel: employee.jobLevel || '',
      fiscalYear,
      currency: employee.currency || 'INR',

      annualBasic,
      annualHRA,
      annualSpecialAllowance,
      annualTransportAllowance,
      annualMedicalAllowance,
      annualOtherFixed: 0,
      totalFixed,

      annualBonus: totalBonus,
      annualPerformancePay: 0,
      annualOvertimePay: totalOvertimePay,
      annualIncentives: 0,
      annualOtherVariable: 0,
      totalVariable,

      totalCTC,

      employerPF,
      employerESI,
      employerGratuity,
      employerInsurance: 0,
      totalEmployerContributions,

      employeePF,
      employeeESI,
      professionalTax: ptax,
      incomeTax: 0,
      totalEmployeeDeductions,

      annualInsuranceValue: 0,
      annualLeaveEncashment: 0,
      annualFoodCoupon: 24000,
      annualNPS: 0,
      annualOtherBenefits: 0,
      totalBenefits: 24000,

      estimatedAnnualTakeHome,
      estimatedMonthlyTakeHome,

      status: 'GENERATED',
      generatedAt: new Date(),
      monthlyBreakdown,
      sourcePayrollIds: payrolls.map((p) => p._id),
      createdBy: userId,
    },
    { new: true, upsert: true, runValidators: true },
  );

  logger.info('Compensation statement generated', {
    tenantId: String(tenantId),
    employeeId: String(employeeId),
    fiscalYear,
  });

  return statement;
}

/**
 * Bulk-generate statements for all active employees in a fiscal year.
 */
async function generateBulk(tenantId, fiscalYear, userId) {
  const employees = await Employee.find(
    tenantFilter({ tenantId }, { isActive: true, deletedAt: null }),
  ).select('_id fullName department role jobLevel').lean();

  const results = { generated: 0, failed: 0, errors: [] };

  for (const emp of employees) {
    try {
      await generateStatement(tenantId, emp._id, fiscalYear, userId);
      results.generated += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ employeeId: emp._id, name: emp.fullName, error: err.message });
    }
  }

  return results;
}

/**
 * Retrieve a statement for one employee.
 */
async function getStatement(tenantId, employeeId, fiscalYear) {
  return CompensationStatement.findOne({
    tenantId,
    employeeId,
    fiscalYear,
    deletedAt: null,
  }).lean();
}

/**
 * List all statements for a fiscal year with pagination.
 */
async function listStatements(tenantId, fiscalYear, { department, status, page = 1, limit = 50 } = {}) {
  const filter = { tenantId, fiscalYear, deletedAt: null };
  if (department) filter.department = department;
  if (status) filter.status = status;

  const skip = (Math.max(1, page) - 1) * limit;
  const [records, total] = await Promise.all([
    CompensationStatement.find(filter)
      .sort({ department: 1, employeeName: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CompensationStatement.countDocuments(filter),
  ]);

  return {
    records,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get aggregate CTC summary for a fiscal year.
 */
async function getCTCSummary(tenantId, fiscalYear) {
  const results = await CompensationStatement.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), fiscalYear, deletedAt: null } },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalCTC: { $sum: '$totalCTC' },
        totalFixed: { $sum: '$totalFixed' },
        totalVariable: { $sum: '$totalVariable' },
        totalEmployerContributions: { $sum: '$totalEmployerContributions' },
        avgCTC: { $avg: '$totalCTC' },
        maxCTC: { $max: '$totalCTC' },
        minCTC: { $min: '$totalCTC' },
      },
    },
  ]);

  const byDepartment = await CompensationStatement.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), fiscalYear, deletedAt: null } },
    {
      $group: {
        _id: '$department',
        headcount: { $sum: 1 },
        totalCTC: { $sum: '$totalCTC' },
        avgCTC: { $avg: '$totalCTC' },
      },
    },
    { $sort: { totalCTC: -1 } },
  ]);

  return {
    summary: results[0] || { totalEmployees: 0, totalCTC: 0, totalFixed: 0, totalVariable: 0, totalEmployerContributions: 0, avgCTC: 0, maxCTC: 0, minCTC: 0 },
    byDepartment,
  };
}

/**
 * Mark a statement as shared with the employee.
 */
async function markShared(tenantId, statementId, userId) {
  const record = await CompensationStatement.findOneAndUpdate(
    { _id: statementId, tenantId, deletedAt: null },
    { status: 'SHARED', sharedAt: new Date() },
    { new: true },
  );
  return record;
}

/**
 * ObjectNotFoundException for missing resources.
 */
class ObjectNotFoundException extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'ObjectNotFoundException';
    this.status = 404;
  }
}

module.exports = {
  generateStatement,
  generateBulk,
  getStatement,
  listStatements,
  getCTCSummary,
  markShared,
  ObjectNotFoundException,
};
