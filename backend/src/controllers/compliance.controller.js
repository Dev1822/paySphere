/**
 * Statutory compliance: Form 16 and Form 24Q (#933, reachable since #951).
 *
 * Form 16 is the certificate an employer is required to issue to every employee
 * it deducted tax from. Form 24Q is the quarterly return filed against those
 * deductions. #933 wrote both handlers, a PDF worker branch to render the
 * certificate, and a financial-year aggregator — and neither of the two models
 * they require was ever committed, so the whole feature threw
 * `Cannot find module` on require. Nothing mounted it either, so there was no
 * URL that could have reached it.
 *
 * This file now also owns the two things a report needs before it can be run:
 * the employer's TAN and PAN, and each employee's declaration for the year.
 */

const mongoose = require('mongoose');
const { Worker } = require('worker_threads');
const path = require('path');
const { aggregateFYData } = require('../utils/complianceAggregator');
const ComplianceConfig = require('../models/complianceConfig.model');
const EmployeeTaxDeclaration = require('../models/employeeTaxDeclaration.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/** Form 16 generation is offloaded to a worker; this caps how long we wait. */
const PDF_TIMEOUT_MS = 45000;

/** The months each quarter of an Indian financial year covers. */
const QUARTER_MONTHS = {
  Q1: [4, 5, 6],
  Q2: [7, 8, 9],
  Q3: [10, 11, 12],
  Q4: [1, 2, 3],
};

/**
 * Resolve and validate the financial year from a query string.
 *
 * Defaults to the year that has most recently ended: before April, the current
 * financial year is not over, so the last complete one started the year before.
 *
 * @param {string|number|undefined} raw
 * @returns {{ok: true, fyStartYear: number} | {ok: false, message: string}}
 */
function parseFinancialYear(raw) {
  const now = new Date();
  const defaultYear =
    now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;

  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, fyStartYear: defaultYear };
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return {
      ok: false,
      message: 'fy must be the year the financial year starts in, e.g. 2026',
    };
  }

  return { ok: true, fyStartYear: parsed };
}

/** A financial year written the way the department writes it: 2026-27. */
function formatFY(fyStartYear) {
  return `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
}

/**
 * Render a value as a CSV cell it cannot break out of.
 *
 * An employee name is user-supplied and lands in a file that opens in a
 * spreadsheet. #933 wrapped names in quotes without escaping the quotes inside
 * them, so a name containing one split the row.
 *
 * @param {*} value
 * @returns {string}
 */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  const cleaned = text.replace(/[\r\n]+/g, ' ');

  // A leading =, +, - or @ is executed as a formula by Excel and Sheets.
  const guarded = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;

  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * GET /api/compliance/form-16/:employeeId?fy=2026
 *
 * The employee's certificate for the year, as a PDF.
 */
exports.generateForm16 = async (req, res, next) => {
  let pdfWorker = null;

  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    const fy = parseFinancialYear(req.query.fy);
    if (!fy.ok) return res.status(400).json({ message: fy.message });

    const config = await ComplianceConfig.findOne({}).lean();

    if (!config) {
      return res.status(400).json({
        message:
          'Company compliance details (TAN/PAN) are not set. Add them under Settings before generating Form 16.',
      });
    }

    const fyData = await aggregateFYData(req.tenantId, fy.fyStartYear);
    const empData = fyData.find((e) => e.employeeId === String(employeeId));

    if (!empData) {
      return res.status(404).json({
        message: `No approved or paid payroll found for this employee in FY ${formatFY(fy.fyStartYear)}.`,
      });
    }

    pdfWorker = new Worker(path.join(__dirname, '../workers/pdf.worker.js'));

    let settled = false;

    const finish = (respond) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Terminated on every path, including the happy one. A worker left
      // running holds the event loop open and, under load, leaks a thread per
      // request.
      pdfWorker.terminate().catch(() => {});
      respond();
    };

    const timer = setTimeout(
      () => finish(() => next(new Error('Form 16 generation timed out'))),
      PDF_TIMEOUT_MS,
    );

    pdfWorker.on('message', (result) => {
      finish(() => {
        if (!result?.success) {
          return next(
            new Error(
              `Failed to generate Form 16: ${result?.error || 'unknown error'}`,
            ),
          );
        }

        eventBus.emit('AUDIT_LOG', {
          userId: req.userId,
          action: 'COMPLIANCE_FORM16_GENERATE',
          resourceType: 'Employee',
          resourceIds: [employeeId],
          details: {
            employeeName: empData.employeeName,
            financialYear: fy.fyStartYear,
          },
          req,
        });

        // The filename carries an employee name, which is user-supplied, so it
        // is reduced to characters that cannot terminate the header.
        const safeName = String(empData.employeeName || 'employee').replace(
          /[^A-Za-z0-9_-]/g,
          '_',
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=Form16_${safeName}_${formatFY(fy.fyStartYear)}.pdf`,
        );
        res.send(Buffer.from(result.pdfData));
      });
    });

    pdfWorker.on('error', (err) => finish(() => next(err)));

    pdfWorker.postMessage({
      type: 'GENERATE_FORM_16',
      payload: {
        employee: empData,
        employer: config,
        fyStartYear: fy.fyStartYear,
      },
    });
  } catch (error) {
    if (pdfWorker) pdfWorker.terminate().catch(() => {});
    next(error);
  }
};

/**
 * GET /api/compliance/form-24q?quarter=Q4&fy=2026
 *
 * Annexure II of the quarterly TDS return, as CSV.
 */
exports.generateForm24Q = async (req, res, next) => {
  try {
    const fy = parseFinancialYear(req.query.fy);
    if (!fy.ok) return res.status(400).json({ message: fy.message });

    const quarter = String(req.query.quarter || 'Q4').toUpperCase();
    const months = QUARTER_MONTHS[quarter];

    if (!months) {
      return res
        .status(400)
        .json({ message: 'Invalid quarter. Use Q1, Q2, Q3 or Q4.' });
    }

    const config = await ComplianceConfig.findOne({}).lean();

    // #933 read the config and then went straight to `config.tan` inside the
    // row map — a TypeError for every tenant that has not set compliance up,
    // which is all of them on day one. `generateForm16` checked; this did not.
    if (!config) {
      return res.status(400).json({
        message:
          'Company compliance details (TAN/PAN) are not set. Add them under Settings before exporting Form 24Q.',
      });
    }

    const fyData = await aggregateFYData(req.tenantId, fy.fyStartYear);

    // The quarter is the whole point of the export: a return covers three
    // months. #933 wrote the full year's aggregate into a quarterly file, and
    // included every employee whether or not they were paid in that quarter.
    const rows = fyData
      .map((emp) => {
        const inQuarter = (emp.payrolls || []).filter((p) =>
          months.includes(p.month),
        );

        if (inQuarter.length === 0) return null;

        const quarterGross = inQuarter.reduce(
          (sum, p) =>
            sum +
            (Number(p.baseSalary) || 0) +
            (Number(p.bonus) || 0) +
            (Number(p.overtimePay) || 0) +
            (Number(p.arrearsPayout) || 0),
          0,
        );

        return [
          csvCell(config.tan),
          csvCell(emp.pan),
          csvCell(emp.employeeName),
          csvCell(emp.department),
          csvCell(emp.regime),
          Math.round(quarterGross),
          emp.perquisites,
          0,
          emp.standardDeduction,
          emp.professionalTax,
          emp.netTaxableIncome,
          emp.totalTDS,
        ];
      })
      .filter(Boolean);

    const headers = [
      'TAN',
      'PAN',
      'Employee Name',
      'Department',
      'Regime',
      'Gross Salary (Quarter)',
      'Perquisites',
      'Profits in lieu of salary',
      'Standard Deduction',
      'Professional Tax',
      'Net Taxable Income (Year)',
      'Total TDS (Year)',
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'COMPLIANCE_FORM24Q_EXPORT',
      resourceType: 'Payroll',
      details: {
        financialYear: fy.fyStartYear,
        quarter,
        employeeCount: rows.length,
      },
      req,
    });

    logger.info('Form 24Q exported', {
      tenantId: String(req.tenantId),
      financialYear: fy.fyStartYear,
      quarter,
      employeeCount: rows.length,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Form24Q_${quarter}_FY${formatFY(fy.fyStartYear)}.csv`,
    );
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/compliance/config
 */
exports.getComplianceConfig = async (req, res, next) => {
  try {
    const config = await ComplianceConfig.findOne({}).lean();

    // Null rather than a 404: a tenant that has never set this up is the normal
    // state, and the client needs to render an empty form for it.
    res.status(200).json({ config: config || null });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/compliance/config
 *
 * Upsert, because there is exactly one row per tenant and the client should not
 * have to know whether it exists yet.
 */
exports.upsertComplianceConfig = async (req, res, next) => {
  try {
    const body = req.body || {};

    const update = {
      companyName: String(body.companyName || '').trim(),
      tan: String(body.tan || '')
        .trim()
        .toUpperCase(),
      pan: String(body.pan || '')
        .trim()
        .toUpperCase(),
      address: String(body.address || '').trim(),
      updatedBy: req.userId,
    };

    if (body.deductorType) update.deductorType = String(body.deductorType);

    if (body.responsiblePerson) {
      update.responsiblePerson = {
        name: String(body.responsiblePerson.name || '').trim(),
        designation: String(body.responsiblePerson.designation || '').trim(),
        pan: String(body.responsiblePerson.pan || '')
          .trim()
          .toUpperCase(),
      };
    }

    const config = await ComplianceConfig.findOneAndUpdate(
      {},
      { $set: update, $setOnInsert: {} },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'COMPLIANCE_CONFIG_UPDATE',
      resourceType: 'ComplianceConfig',
      resourceIds: [config._id],
      details: { tan: config.tan },
      req,
    });

    res.status(200).json({ message: 'Compliance details saved', config });
  } catch (error) {
    // A malformed TAN or PAN is the caller's mistake, not a server fault, and
    // the schema message already names the field.
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Compliance details are invalid',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    next(error);
  }
};

/**
 * GET /api/compliance/declarations?fy=2026[&employeeId=]
 */
exports.getTaxDeclarations = async (req, res, next) => {
  try {
    const fy = parseFinancialYear(req.query.fy);
    if (!fy.ok) return res.status(400).json({ message: fy.message });

    const filter = {
      financialYear: fy.fyStartYear
    };

    if (req.query.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.employeeId)) {
        return res.status(400).json({ message: 'Invalid employee ID' });
      }
      filter.employeeId = req.query.employeeId;
    }

    const declarations = await EmployeeTaxDeclaration.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      financialYear: fy.fyStartYear,
      count: declarations.length,
      declarations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/compliance/declarations/:employeeId
 */
exports.upsertTaxDeclaration = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    const body = req.body || {};
    const fy = parseFinancialYear(body.financialYear ?? req.query.fy);
    if (!fy.ok) return res.status(400).json({ message: fy.message });

    // Scoped by tenant: without it, a valid employee id belonging to another
    // company would open a declaration row against that company's employee.
    const employee = await Employee.findOne({
      _id: employeeId
    }).lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const update = { updatedBy: req.userId };

    if (body.regime) update.regime = String(body.regime).toLowerCase();
    if (body.pan !== undefined) {
      update.pan = String(body.pan || '')
        .trim()
        .toUpperCase();
    }
    if (body.status) update.status = String(body.status).toLowerCase();

    if (body.declarations && typeof body.declarations === 'object') {
      // Only the sections the schema knows about are copied across, each
      // coerced to a non-negative number: a client should not be able to decide
      // what a declaration contains.
      const allowed = [
        'section80C',
        'section80D',
        'section80CCD1B',
        'section80G',
        'section80TTA',
        'houseRentPaid',
        'homeLoanInterest',
        'otherIncome',
      ];

      update.declarations = allowed.reduce((acc, key) => {
        acc[key] = Math.max(0, Number(body.declarations[key]) || 0);
        return acc;
      }, {});
    }

    if (update.status === EmployeeTaxDeclaration.DECLARATION_STATUS.VERIFIED) {
      update.verifiedBy = req.userId;
      update.verifiedAt = new Date();
    }

    const declaration = await EmployeeTaxDeclaration.findOneAndUpdate(
      {
        employeeId,
        financialYear: fy.fyStartYear
      },
      {
        $set: update,
        $setOnInsert: {
          employeeId,
          financialYear: fy.fyStartYear
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'COMPLIANCE_DECLARATION_UPDATE',
      resourceType: 'EmployeeTaxDeclaration',
      resourceIds: [declaration._id],
      details: {
        employeeName: employee.fullName,
        financialYear: fy.fyStartYear,
        regime: declaration.regime,
      },
      req,
    });

    res.status(200).json({ message: 'Declaration saved', declaration });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Declaration is invalid',
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }
    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          'A declaration for this employee and year was updated concurrently. Reload and retry.',
      });
    }
    next(error);
  }
};

exports._internals = { parseFinancialYear, csvCell, formatFY, QUARTER_MONTHS };
