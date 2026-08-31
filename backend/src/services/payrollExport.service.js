const mongoose = require('mongoose');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const {
  PAYROLL_STATUS,
  payableStatusFilter,
  normalizeStatus,
  isEmailable,
} = require('../config/payrollStatus');
const { generatePayrollCSV } = require('../utils/csvExport');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');
const { enqueueEmail } = require('../jobs/email.queue');
const BlockchainService = require('../services/blockchain.service');

class PayrollExportService {
  static async exportCSV(req, { tenantId, month, year }) {
    const payrolls = await PayrollUpdate.find({
      tenantId,
      month,
      year,
      ...payableStatusFilter(),
    }).sort({ employeeName: 1 });

    if (payrolls.length === 0) {
      throw new Error(
        'No approved payroll data found for the selected month. Approve the run before exporting.',
      );
    }

    const csvData = generatePayrollCSV(payrolls, month, year);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'REPORT_DOWNLOAD',
      resourceType: 'Report',
      details: {
        month,
        year,
        type: 'payroll-csv',
        employeeCount: payrolls.length,
      },
      req,
    });

    logger.info(`Payroll CSV exported`, {
      userId: req.userId,
      month,
      year,
      employeeCount: payrolls.length,
    });

    return csvData;
  }
static async exportCSV(req, { tenantId, month, year }) {
  QueryValidatorService.validateExportOperation({ tenantId });
  TenantContextService.validateTenantOwnership(tenantId);
  
  const payrolls = await PayrollUpdate.find({
    tenantId,
    month,
    year,
  });
  
  // ... rest of export logic ...
}

static async sendAllPayslipsEmail(req, { tenantId, month, year }) {
  QueryValidatorService.validateExportOperation({ tenantId });
  TenantContextService.validateTenantOwnership(tenantId);
  
  // ... rest of email logic ...
}
  static async sendPayslipEmail(req, { payrollId, tenantId }) {
    const payroll = await PayrollUpdate.findOne({ _id: payrollId, tenantId });
    if (!payroll) throw new Error('Payroll record not found');

    let employee;

    if (payroll.calculationSnapshot?.finalizedAt) {
      employee = {
        _id: payroll.employeeId,
        ...payroll.calculationSnapshot.employee,
      };
    } else {
      employee = await Employee.findById(payroll.employeeId);
      if (!employee) throw new Error('Employee not found');

      if (employee.isDeleted) {
        logger.warn(`Sending payslip email to soft-deleted employee`, {
          userId: req.userId,
          employeeId: employee._id,
          employeeName: employee.fullName,
        });
      }
    }

    if (!employee.email) {
      throw new Error('Employee does not have an email address set');
    }

    if (!isEmailable(payroll.status)) {      const status = normalizeStatus(payroll.status) || payroll.status;
      const error = new Error(
        `Cannot email a payslip for a payroll record that is "${status}". It must be approved first.`,
      );
      error.statusName = status;
      throw error;
    }

    await enqueueEmail('payslip', {
      employee,
      payroll,
      calculationSnapshot: payroll.calculationSnapshot,
    });
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYSLIP_EMAIL',
      resourceType: 'Payroll',
      resourceIds: [payroll._id],
      details: {
        employeeName: employee.fullName,
        employeeEmail: employee.email,
        month: payroll.month,
        year: payroll.year,
      },
      req,
    });

    logger.info(`Payslip email sent`, {
      userId: req.userId,
      payrollId: payroll._id,
      employee: employee.fullName,
    });
  }

  static async sendAllPayslipsEmail(req, { tenantId, month, year }) {
    const payrolls = await PayrollUpdate.find({
      tenantId,
      month,
      year,
      payslipEmailed: false,
      ...payableStatusFilter(),
    });

    if (payrolls.length === 0) {
      throw new Error(
        'No approved payroll records awaiting a payslip email for the selected month and year.',
      );
    }

    const employeeIds = [...new Set(payrolls.map((p) => p.employeeId))];
    const employees = await Employee.find({
      _id: { $in: employeeIds },
      isDeleted: { $ne: true },
    });
    const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

    const results = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const payroll of payrolls) {
      const employee = employeeMap.get(String(payroll.employeeId));
      if (!employee) {
        results.push({
          payrollId: payroll._id,
          employeeName: payroll.employeeName,
          status: 'failed',
          error: 'Employee record not found',
        });
        failedCount++;
        continue;
      }
      if (!employee.email) {
        results.push({
          payrollId: payroll._id,
          employeeName: employee.fullName,
          status: 'no_email',
          message: 'No email address registered',
        });
        skippedCount++;
        continue;
      }

      try {
        await enqueueEmail('payslip', { employee, payroll });
        results.push({
          payrollId: payroll._id,
          employeeName: employee.fullName,
          email: employee.email,
          status: 'queued',
        });
        sentCount++;
      } catch (err) {
        logger.error(`Failed to send email to ${employee.fullName}`, {
          error: err.message,
          payrollId: payroll._id,
        });
        results.push({
          payrollId: payroll._id,
          employeeName: employee.fullName,
          email: employee.email,
          status: 'failed',
          error: 'Email delivery failed',
        });
        failedCount++;
      }
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYSLIP_BULK_EMAIL',
      resourceType: 'Payroll',
      resourceIds: payrolls.map((p) => p._id),
      details: {
        month,
        year,
        sentCount,
        failedCount,
        skippedCount,
        total: payrolls.length,
      },
      result:
        failedCount > 0 ? (sentCount > 0 ? 'partial' : 'failure') : 'success',
      req,
    });

    logger.info(`Bulk payslip email dispatch complete`, {
      userId: req.userId,
      month,
      year,
      sentCount,
      failedCount,
      skippedCount,
      total: payrolls.length,
    });

    return {
      sentCount,
      failedCount,
      skippedCount,
      total: payrolls.length,
      results,
    };
  }

  static async getMerkleProof({ tenantId, id }) {
    const targetPayroll = await PayrollUpdate.findOne({
      _id: id,
      tenantId,
    }).lean();
    if (!targetPayroll) {
      throw new Error('Payroll record not found');
    }

    const batch = await PayrollUpdate.find({
      tenantId,
      month: targetPayroll.month,
      year: targetPayroll.year,
    }).lean();

    const proofData = BlockchainService.getMerkleProof(batch, id);
    const anchorData = await BlockchainService.anchorToEthereum(proofData.root);

    return {
      payrollId: id,
      ...proofData,
      anchor: anchorData,
    };
  }
}

module.exports = PayrollExportService;
