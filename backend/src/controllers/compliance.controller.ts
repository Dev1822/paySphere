/**
 * Statutory compliance: Form 16 and Form 24Q.
 *
 * TypeScript migration of compliance.controller.js.
 * The runtime behavior is intentionally preserved while the Express API
 * boundary, query parameters, request bodies, model results and worker
 * messages are explicitly typed.
 */

import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Worker } from 'node:worker_threads';
import path from 'node:path';

const { aggregateFYData } = require('../utils/complianceAggregator') as {
  aggregateFYData: (
    tenantId: string,
    financialYear: number,
  ) => Promise<FinancialYearEmployee[]>;
};

const ComplianceConfig =
  require('../models/complianceConfig.model') as ComplianceConfigModel;
const EmployeeTaxDeclaration =
  require('../models/employeeTaxDeclaration.model') as EmployeeTaxDeclarationModel;
const Employee = require('../models/employee.model') as EmployeeModel;
const logger = require('../utils/logger') as Logger;
const eventBus = require('../services/event.service') as EventBus;

const PDF_TIMEOUT_MS = 45_000;

const QUARTER_MONTHS = {
  Q1: [4, 5, 6],
  Q2: [7, 8, 9],
  Q3: [10, 11, 12],
  Q4: [1, 2, 3],
} as const;

type Quarter = keyof typeof QUARTER_MONTHS;

type AuthenticatedRequest = Request & {
  userId?: string;
  tenantId?: string;
};

type FinancialYearQuery = {
  fy?: string | string[];
};

type EmployeeQuery = FinancialYearQuery & {
  employeeId?: string | string[];
};

type Form24QQuery = FinancialYearQuery & {
  quarter?: string | string[];
};

type DeclarationBody = {
  financialYear?: unknown;
  regime?: unknown;
  pan?: unknown;
  status?: unknown;
  declarations?: unknown;
};

type ComplianceConfigBody = {
  companyName?: unknown;
  tan?: unknown;
  pan?: unknown;
  address?: unknown;
  deductorType?: unknown;
  responsiblePerson?: {
    name?: unknown;
    designation?: unknown;
    pan?: unknown;
  };
};

type ComplianceConfig = {
  _id: mongoose.Types.ObjectId | string;
  tenantId: string;
  companyName?: string;
  tan: string;
  pan: string;
  address?: string;
  deductorType?: string;
  responsiblePerson?: {
    name?: string;
    designation?: string;
    pan?: string;
  };
};

type PayrollRecord = {
  month: number;
  baseSalary?: number | string;
  bonus?: number | string;
  overtimePay?: number | string;
  arrearsPayout?: number | string;
};

type FinancialYearEmployee = {
  employeeId: string;
  employeeName?: string;
  pan?: string;
  department?: string;
  regime?: string;
  payrolls?: PayrollRecord[];
  perquisites?: number;
  standardDeduction?: number;
  professionalTax?: number;
  netTaxableIncome?: number;
  totalTDS?: number;
};

type DeclarationRecord = {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  employeeId: string;
  financialYear: number;
  regime?: string;
  pan?: string;
  status?: string;
  declarations?: Record<string, number>;
  verifiedBy?: string;
  verifiedAt?: Date;
};

type EmployeeRecord = {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  fullName: string;
};

type MongooseQuery<T> = {
  lean: () => Promise<T>;
  sort: (value: Record<string, 1 | -1>) => MongooseQuery<T>;
  then: <TResult1 = T, TResult2 = never>(
    onfulfilled?:
      ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?:
      ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) => Promise<TResult1 | TResult2>;
};

type ComplianceConfigModel = {
  findOne: (
    filter: Record<string, unknown>,
  ) => MongooseQuery<ComplianceConfig | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<ComplianceConfig>;
};

type EmployeeTaxDeclarationModel = {
  DECLARATION_STATUS: {
    VERIFIED: string;
  };
  find: (filter: Record<string, unknown>) => MongooseQuery<DeclarationRecord[]>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<DeclarationRecord>;
};

type EmployeeModel = {
  findOne: (
    filter: Record<string, unknown>,
  ) => MongooseQuery<EmployeeRecord | null>;
};

type Logger = {
  info: (message: string, metadata?: Record<string, unknown>) => void;
};

type AuditEvent = {
  userId?: string;
  action: string;
  resourceType: string;
  resourceIds?: string[];
  details?: Record<string, unknown>;
  req: Request;
};

type EventBus = {
  emit: (event: 'AUDIT_LOG', payload: AuditEvent) => void;
};

type PdfWorkerSuccess = {
  success: true;
  pdfData: string | Uint8Array | ArrayBuffer;
};

type PdfWorkerFailure = {
  success: false;
  error?: string;
};

type PdfWorkerResult = PdfWorkerSuccess | PdfWorkerFailure;

type Form16WorkerMessage = {
  type: 'GENERATE_FORM_16';
  payload: {
    employee: FinancialYearEmployee;
    employer: ComplianceConfig;
    fyStartYear: number;
  };
};

type ValidationErrorLike = Error & {
  name?: string;
  errors?: Record<string, { message: string }>;
  code?: number;
};

type FinancialYearResult =
  { ok: true; fyStartYear: number } | { ok: false; message: string };

type CsvRow = Array<string | number | undefined>;

function queryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function bodyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseFinancialYear(raw: unknown): FinancialYearResult {
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

function formatFY(fyStartYear: number): string {
  return `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const cleaned = text.replace(/[\r\n]+/g, ' ');
  const guarded = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;

  return `"${guarded.replace(/"/g, '""')}"`;
}

function sendValidationError(
  res: Response,
  message: string,
): Response<{ message: string }> {
  return res.status(400).json({ message });
}

function requireTenant(req: AuthenticatedRequest): string {
  if (!req.tenantId) {
    const error = new Error('Tenant context is required');
    (error as ValidationErrorLike).code = 401;
    throw error;
  }

  return req.tenantId;
}

export async function generateForm16(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  let pdfWorker: Worker | null = null;

  try {
    const employeeId = req.params.employeeId as string;

    if (
      !employeeId ||
      typeof employeeId !== 'string' ||
      !mongoose.Types.ObjectId.isValid(employeeId)
    ) {
      return sendValidationError(res, 'Invalid employee ID');
    }

    const fy = parseFinancialYear(
      queryValue(req.query.fy as FinancialYearQuery['fy']),
    );
    if (!fy.ok) return sendValidationError(res, (fy as any).message);

    const tenantId = requireTenant(req);

    const config = await ComplianceConfig.findOne({ tenantId }).lean();

    if (!config) {
      return res.status(400).json({
        message:
          'Company compliance details (TAN/PAN) are not set. Add them under Settings before generating Form 16.',
      });
    }

    const fyData = await aggregateFYData(tenantId, fy.fyStartYear);
    const empData = fyData.find(
      (employee) => employee.employeeId === employeeId,
    );

    if (!empData) {
      return res.status(404).json({
        message: `No approved or paid payroll found for this employee in FY ${formatFY(fy.fyStartYear)}.`,
      });
    }

    pdfWorker = new Worker(path.join(__dirname, '../workers/pdf.worker.js'));

    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (respond: () => void): void => {
      if (settled) return;
      settled = true;

      if (timer) clearTimeout(timer);

      void pdfWorker?.terminate().catch(() => undefined);
      respond();
    };

    timer = setTimeout(
      () => finish(() => next(new Error('Form 16 generation timed out'))),
      PDF_TIMEOUT_MS,
    );

    pdfWorker.on('message', (result: PdfWorkerResult) => {
      finish(() => {
        if (!result.success) {
          return next(
            new Error(
              `Failed to generate Form 16: ${(result as PdfWorkerFailure).error || 'unknown error'}`,
            ),
          );
        }

        eventBus.emit('AUDIT_LOG', {
          userId: req.userId,
          action: 'COMPLIANCE_FORM16_GENERATE',
          resourceType: 'Employee',
          resourceIds: [employeeId as string],
          details: {
            employeeName: empData.employeeName,
            financialYear: fy.fyStartYear,
          },
          req,
        });

        const safeName = String(empData.employeeName || 'employee').replace(
          /[^A-Za-z0-9_-]/g,
          '_',
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=Form16_${safeName}_${formatFY(fy.fyStartYear)}.pdf`,
        );

        res.send(Buffer.from(result.pdfData as any));
      });
    });

    pdfWorker.on('error', (error: Error) => finish(() => next(error)));

    const message: Form16WorkerMessage = {
      type: 'GENERATE_FORM_16',
      payload: {
        employee: empData,
        employer: config,
        fyStartYear: fy.fyStartYear,
      },
    };

    pdfWorker.postMessage(message);
  } catch (error) {
    void pdfWorker?.terminate().catch(() => undefined);
    next(error);
  }
}

export async function generateForm24Q(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const query = req.query as Form24QQuery;
    const fy = parseFinancialYear(queryValue(query.fy));

    if (!fy.ok) return sendValidationError(res, (fy as any).message);

    const quarterValue = queryValue(query.quarter) || 'Q4';
    const quarter = quarterValue.toUpperCase() as Quarter;
    const months = QUARTER_MONTHS[quarter];

    if (!months) {
      return sendValidationError(res, 'Invalid quarter. Use Q1, Q2, Q3 or Q4.');
    }

    const tenantId = requireTenant(req);

    const config = await ComplianceConfig.findOne({ tenantId }).lean();

    if (!config) {
      return res.status(400).json({
        message:
          'Company compliance details (TAN/PAN) are not set. Add them under Settings before exporting Form 24Q.',
      });
    }

    const fyData = await aggregateFYData(tenantId, fy.fyStartYear);

    const rows: CsvRow[] = fyData
      .map((employee): CsvRow | null => {
        const inQuarter = (employee.payrolls || []).filter((payroll) =>
          months.includes(payroll.month as never),
        );

        if (inQuarter.length === 0) return null;

        const quarterGross = inQuarter.reduce(
          (sum, payroll) =>
            sum +
            (Number(payroll.baseSalary) || 0) +
            (Number(payroll.bonus) || 0) +
            (Number(payroll.overtimePay) || 0) +
            (Number(payroll.arrearsPayout) || 0),
          0,
        );

        return [
          csvCell(config.tan),
          csvCell(employee.pan),
          csvCell(employee.employeeName),
          csvCell(employee.department),
          csvCell(employee.regime),
          Math.round(quarterGross),
          employee.perquisites,
          0,
          employee.standardDeduction,
          employee.professionalTax,
          employee.netTaxableIncome,
          employee.totalTDS,
        ];
      })
      .filter((row): row is CsvRow => row !== null);

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
      ...rows.map((row) => row.join(',')),
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
      tenantId,
      financialYear: fy.fyStartYear,
      quarter,
      employeeCount: rows.length,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Form24Q_${quarter}_FY${formatFY(fy.fyStartYear)}.csv`,
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}

export async function getComplianceConfig(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const tenantId = requireTenant(req);
    const config = await ComplianceConfig.findOne({ tenantId }).lean();

    return res.status(200).json({ config: config || null });
  } catch (error) {
    next(error);
  }
}

export async function upsertComplianceConfig(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const tenantId = requireTenant(req);
    const body = (req.body || {}) as ComplianceConfigBody;

    const update: Record<string, unknown> = {
      companyName: bodyString(body.companyName),
      tan: bodyString(body.tan).toUpperCase(),
      pan: bodyString(body.pan).toUpperCase(),
      address: bodyString(body.address),
      updatedBy: req.userId,
    };

    if (body.deductorType) {
      update.deductorType = bodyString(body.deductorType);
    }

    if (body.responsiblePerson) {
      update.responsiblePerson = {
        name: bodyString(body.responsiblePerson.name),
        designation: bodyString(body.responsiblePerson.designation),
        pan: bodyString(body.responsiblePerson.pan).toUpperCase(),
      };
    }

    const config = await ComplianceConfig.findOneAndUpdate(
      { tenantId },
      {
        $set: update,
        $setOnInsert: { tenantId },
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
      action: 'COMPLIANCE_CONFIG_UPDATE',
      resourceType: 'ComplianceConfig',
      resourceIds: [String(config._id)],
      details: { tan: config.tan },
      req,
    });

    return res
      .status(200)
      .json({ message: 'Compliance details saved', config });
  } catch (error) {
    const validationError = error as ValidationErrorLike;

    if (validationError.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Compliance details are invalid',
        errors: Object.values(validationError.errors || {}).map(
          (item) => item.message,
        ),
      });
    }

    next(error);
  }
}

export async function getTaxDeclarations(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const query = req.query as EmployeeQuery;
    const fy = parseFinancialYear(queryValue(query.fy));

    if (!fy.ok) return sendValidationError(res, (fy as any).message);

    const tenantId = requireTenant(req);
    const filter: Record<string, unknown> = {
      tenantId,
      financialYear: fy.fyStartYear,
    };

    const employeeId = queryValue(query.employeeId);

    if (employeeId) {
      if (!mongoose.Types.ObjectId.isValid(employeeId as string)) {
        return sendValidationError(res, 'Invalid employee ID');
      }

      filter.employeeId = employeeId;
    }

    const declarations = await EmployeeTaxDeclaration.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      financialYear: fy.fyStartYear,
      count: declarations.length,
      declarations,
    });
  } catch (error) {
    next(error);
  }
}

export async function upsertTaxDeclaration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const employeeId = req.params.employeeId as string;

    if (
      !employeeId ||
      typeof employeeId !== 'string' ||
      !mongoose.Types.ObjectId.isValid(employeeId)
    ) {
      return sendValidationError(res, 'Invalid employee ID');
    }

    const body = (req.body || {}) as DeclarationBody;
    const query = req.query as FinancialYearQuery;
    const fy = parseFinancialYear(body.financialYear ?? queryValue(query.fy));

    if (!fy.ok) return sendValidationError(res, (fy as any).message);

    const tenantId = requireTenant(req);

    const employee = await Employee.findOne({
      _id: employeeId as string,
      tenantId,
    }).lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const update: Record<string, unknown> = {
      updatedBy: req.userId,
    };

    if (body.regime) {
      update.regime = bodyString(body.regime).toLowerCase();
    }

    if (body.pan !== undefined) {
      update.pan = bodyString(body.pan).toUpperCase();
    }

    if (body.status) {
      update.status = bodyString(body.status).toLowerCase();
    }

    if (
      body.declarations &&
      typeof body.declarations === 'object' &&
      !Array.isArray(body.declarations)
    ) {
      const declarations = body.declarations as Record<string, unknown>;

      const allowed = [
        'section80C',
        'section80D',
        'section80CCD1B',
        'section80G',
        'section80TTA',
        'houseRentPaid',
        'homeLoanInterest',
        'otherIncome',
      ] as const;

      update.declarations = allowed.reduce<Record<string, number>>(
        (result, key) => {
          result[key] = Math.max(0, Number(declarations[key]) || 0);
          return result;
        },
        {},
      );
    }

    if (
      typeof update.status === 'string' &&
      update.status === EmployeeTaxDeclaration.DECLARATION_STATUS.VERIFIED
    ) {
      update.verifiedBy = req.userId;
      update.verifiedAt = new Date();
    }

    const declaration = await EmployeeTaxDeclaration.findOneAndUpdate(
      {
        tenantId,
        employeeId,
        financialYear: fy.fyStartYear,
      },
      {
        $set: update,
        $setOnInsert: {
          tenantId,
          employeeId,
          financialYear: fy.fyStartYear,
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
      resourceIds: [String(declaration._id)],
      details: {
        employeeName: employee.fullName,
        financialYear: fy.fyStartYear,
        regime: declaration.regime,
      },
      req,
    });

    return res.status(200).json({
      message: 'Declaration saved',
      declaration,
    });
  } catch (error) {
    const validationError = error as ValidationErrorLike;

    if (validationError.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Declaration is invalid',
        errors: Object.values(validationError.errors || {}).map(
          (item) => item.message,
        ),
      });
    }

    if (validationError.code === 11000) {
      return res.status(409).json({
        message:
          'A declaration for this employee and year was updated concurrently. Reload and retry.',
      });
    }

    next(error);
  }
}

export const _internals = {
  parseFinancialYear,
  csvCell,
  formatFY,
  QUARTER_MONTHS,
};
