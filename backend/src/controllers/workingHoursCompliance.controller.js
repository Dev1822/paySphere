/**
 * @fileoverview Working hours compliance (#1702).
 *
 * The controller flattens the attendance ledger into the day series the engine
 * wants, and resolves the one figure the engine deliberately does not compute:
 * the ordinary hourly rate.
 *
 * That rate is section 59's, and it is not the salary divided by anything
 * obvious. It includes allowances and excludes bonus and overtime itself, which
 * is a question about the *components* of the package — so it comes from the
 * salary structure and not from `monthlySalary`, and the components that count
 * are named here rather than in the engine, which has no business knowing what
 * a tenant calls things.
 *
 * Everything that decides whether an hour was lawful is in
 * `utils/workingHoursCompliance.js`.
 */

const mongoose = require('mongoose');

const {
  WorkingHoursLimits,
  WorkingHoursAssessment,
} = require('../models/workingHoursAssessment.model');
const Attendance = require('../models/attendance.model');
const Employee = require('../models/employee.model');
const SalaryStructure = require('../models/salaryStructure.model');
const PayrollUpdate = require('../models/payroll.model');
const { PAYROLL_STATUS } = require('../config/payrollStatus');
const { COMPONENT_TYPE } = require('../config/salaryComponents');
const {
  resolveStructureOnDate,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const {
  FACTORIES_ACT_LIMITS,
  FINDING,
  SEVERITY,
  assessPeriod,
} = require('../utils/workingHoursCompliance');
const eventBus = require('../services/event.service');

/**
 * Days in a standard month and hours in a standard day.
 *
 * Twenty-six is the divisor the gratuity formula, the settlement calculator and
 * the statutory bonus controller already use; eight is the normal working day
 * the overtime premium is measured beyond. Together they turn a monthly figure
 * into the hourly one section 59 doubles.
 */
const WORKING_DAYS_PER_MONTH = 26;
const NORMAL_WORKING_HOURS = 8;

/**
 * Components excluded from the section 59 ordinary rate.
 *
 * "Ordinary rate of wages" means the basic wages plus such allowances as the
 * worker is for the time being entitled to, and excludes a bonus and the
 * overtime premium itself. Counting overtime toward the rate would compound —
 * this month's overtime raising next month's rate — and counting a bonus would
 * let a closed year's profit inflate an hourly rate.
 */
const NOT_ORDINARY_WAGES = /bonus|ex.?gratia|overtime|^ot$/i;

/**
 * The section 59 ordinary hourly rate for an employee.
 *
 * @param {Array<object>} structures
 * @param {Date} onDate
 * @param {number} fallback the employee's `monthlySalary`
 * @returns {number}
 */
function ordinaryHourlyRate(structures, onDate, fallback) {
  const structure = resolveStructureOnDate(structures, onDate);

  const monthly = structure
    ? computeComponentAmounts(structure)
        .components.filter(
          (component) =>
            component.type === COMPONENT_TYPE.EARNING &&
            !NOT_ORDINARY_WAGES.test(component.label || component.code || ''),
        )
        .reduce((sum, component) => sum + (Number(component.amount) || 0), 0)
    : Number(fallback) || 0;

  return monthly / (WORKING_DAYS_PER_MONTH * NORMAL_WORKING_HOURS);
}

/**
 * The period being assessed, as whole months.
 *
 * Whole months because the attendance ledger is stored per month per employee,
 * and a period that started mid-month would need half a document — which is a
 * lot of complication for a report nobody runs on the 14th.
 *
 * @param {object} query
 * @returns {{fromMonth: number, fromYear: number, toMonth: number, toYear: number, periodStart: Date, periodEnd: Date}}
 */
function resolvePeriod(query) {
  const now = new Date();

  const toYear = Number(query.toYear) || now.getUTCFullYear();
  const toMonth = Number(query.toMonth) || now.getUTCMonth() + 1;

  // Defaults to the quarter ending in the requested month, because the section
  // 65(3)(iv) overtime ceiling is quarterly and a one-month window cannot see
  // it at all.
  const fromYear =
    Number(query.fromYear) || (toMonth >= 3 ? toYear : toYear - 1);
  const fromMonth =
    Number(query.fromMonth) || (toMonth >= 3 ? toMonth - 2 : toMonth + 10);

  return {
    fromMonth,
    fromYear,
    toMonth,
    toYear,
    periodStart: new Date(Date.UTC(fromYear, fromMonth - 1, 1)),
    periodEnd: new Date(Date.UTC(toYear, toMonth, 0, 23, 59, 59, 999)),
  };
}

/**
 * The limits for an establishment, falling back to the tenant default and then
 * to the Act.
 *
 * @param {string} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveEstablishmentLimits(tenantId, establishment) {
  const rows = await WorkingHoursLimits.find({
    tenantId,
    establishment: { $in: [establishment || '', ''] },
  }).lean();

  // The named establishment's own row wins over the tenant-wide default.
  const specific = rows.find((row) => row.establishment === establishment);
  const fallback = rows.find((row) => row.establishment === '');

  const chosen = specific || fallback;
  if (!chosen) return { ...FACTORIES_ACT_LIMITS };

  return {
    ...FACTORIES_ACT_LIMITS,
    maxDailyHours: chosen.maxDailyHours,
    maxWeeklyHours: chosen.maxWeeklyHours,
    maxSpreadOverHours: chosen.maxSpreadOverHours,
    maxContinuousHours: chosen.maxContinuousHours,
    minIntervalMinutes: chosen.minIntervalMinutes,
    maxWeeklyHoursWithOvertime: chosen.maxWeeklyHoursWithOvertime,
    maxQuarterlyOvertimeHours: chosen.maxQuarterlyOvertimeHours,
    maxConsecutiveDays: chosen.maxConsecutiveDays,
    overtimeMultiplier: chosen.overtimeMultiplier,
    weekStartsOn: chosen.weekStartsOn,
    nightHoursExempt: chosen.nightHoursExempt,
  };
}

/**
 * The workforce with its day series, in the shape the engine wants.
 *
 * @param {string} tenantId
 * @param {object} period
 * @param {object} limits
 * @returns {Promise<Array<object>>}
 */
async function assembleWorkforce(tenantId, period, limits) {
  const fromKey = period.fromYear * 12 + period.fromMonth;
  const toKey = period.toYear * 12 + period.toMonth;

  const [employees, attendance] = await Promise.all([
    Employee.find(
      { tenantId, isActive: true },
      'fullName role monthlySalary gender',
    ).lean(),
    Attendance.find({ tenantId }, 'employeeId year month days').lean(),
  ]);

  if (!employees.length) return [];

  const employeeIds = employees.map((e) => e._id);

  const [structures, payrollRows] = await Promise.all([
    SalaryStructure.find(
      { tenantId, employeeId: { $in: employeeIds } },
      'employeeId effectiveFrom grossMonthly components',
    ).lean(),
    PayrollUpdate.find(
      {
        tenantId,
        employeeId: { $in: employeeIds },
        status: { $in: [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID] },
      },
      'employeeId month year overtimePay',
    ).lean(),
  ]);

  const structuresByEmployee = new Map();
  for (const structure of structures) {
    const id = String(structure.employeeId);
    if (!structuresByEmployee.has(id)) structuresByEmployee.set(id, []);
    structuresByEmployee.get(id).push(structure);
  }

  const daysByEmployee = new Map();
  for (const row of attendance) {
    const key = Number(row.year) * 12 + Number(row.month);
    if (key < fromKey || key > toKey) continue;

    const id = String(row.employeeId);
    if (!daysByEmployee.has(id)) daysByEmployee.set(id, []);

    for (const day of row.days || []) {
      daysByEmployee.get(id).push({
        date: new Date(Date.UTC(row.year, row.month - 1, day.day)),
        sessions: day.sessions || [],
        overtimeHours: Number(day.overtimeHours) || 0,
      });
    }
  }

  const overtimePaidByEmployee = new Map();
  for (const row of payrollRows) {
    const key = Number(row.year) * 12 + Number(row.month);
    if (key < fromKey || key > toKey) continue;

    const id = String(row.employeeId);
    overtimePaidByEmployee.set(
      id,
      (overtimePaidByEmployee.get(id) || 0) + (Number(row.overtimePay) || 0),
    );
  }

  return employees
    .filter(
      (employee) => (daysByEmployee.get(String(employee._id)) || []).length,
    )
    .map((employee) => {
      const id = String(employee._id);

      // Section 66 restricts night working for women, absent a state exemption.
      // Applied from declared gender and only where it has been declared — the
      // field is optional and free text (#1347), so an employee who has not
      // declared is not assessed against a restriction that may not apply to
      // them. Under-reporting here is the right failure: the alternative is
      // asserting a breach on the strength of a guess about somebody's gender.
      const nightHoursRestricted = /^(female|woman|f)$/i.test(
        String(employee.gender || '').trim(),
      );

      return {
        employee: {
          employeeId: employee._id,
          name: employee.fullName || '',
          designation: employee.role || '',
          ordinaryHourlyRate: ordinaryHourlyRate(
            structuresByEmployee.get(id) || [],
            period.periodEnd,
            employee.monthlySalary,
          ),
          overtimePaid: overtimePaidByEmployee.get(id) || 0,
          nightHoursRestricted,
          nightHoursExempt: Boolean(limits.nightHoursExempt),
        },
        days: daysByEmployee.get(id) || [],
      };
    });
}

/**
 * GET /api/working-hours/limits
 */
exports.getLimits = async (req, res, next) => {
  try {
    const limits = await WorkingHoursLimits.find({ tenantId: req.tenantId })
      .sort({ establishment: 1 })
      .lean();

    return res.json({ limits, statutoryDefaults: FACTORIES_ACT_LIMITS });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/working-hours/limits
 *
 * Upserted on (tenant, establishment). The empty establishment is the
 * tenant-wide default that every unnamed site falls back to.
 */
exports.updateLimits = async (req, res, next) => {
  try {
    const establishment = String(req.body.establishment || '').trim();

    const numeric = [
      'maxDailyHours',
      'maxWeeklyHours',
      'maxSpreadOverHours',
      'maxContinuousHours',
      'minIntervalMinutes',
      'maxWeeklyHoursWithOvertime',
      'maxQuarterlyOvertimeHours',
      'maxConsecutiveDays',
      'overtimeMultiplier',
      'weekStartsOn',
    ];

    const update = {
      tenantId: req.tenantId,
      establishment,
      statute: req.body.statute || 'Factories Act, 1948',
      nightHoursExempt: Boolean(req.body.nightHoursExempt),
      nightHoursExemptionRef: req.body.nightHoursExemptionRef || '',
      nightHoursExemptionConditions:
        req.body.nightHoursExemptionConditions || '',
      updatedBy: req.userId,
    };

    for (const field of numeric) {
      if (typeof req.body[field] !== 'undefined') {
        update[field] = Number(req.body[field]);
      }
    }

    // A limit more generous than the statute is not an error — the Shops and
    // Establishments Acts genuinely allow ten and a half hours in some states —
    // but the overtime multiplier is a floor rather than a ceiling, and setting
    // it below two would under-pay every overtime hour by whatever the shortfall
    // is. Refused rather than recorded.
    if (
      typeof update.overtimeMultiplier !== 'undefined' &&
      update.overtimeMultiplier < FACTORIES_ACT_LIMITS.overtimeMultiplier
    ) {
      return res.status(422).json({
        message: `Section 59 sets the overtime rate at twice the ordinary rate. ${update.overtimeMultiplier} would under-pay every overtime hour.`,
      });
    }

    const limits = await WorkingHoursLimits.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WORKING_HOURS_LIMITS_UPDATED',
      resourceType: 'WorkingHoursLimits',
      resourceIds: [limits._id],
      details: {
        establishment: limits.establishment || '(default)',
        statute: limits.statute,
        weekStartsOn: limits.weekStartsOn,
        nightHoursExempt: limits.nightHoursExempt,
      },
      req,
    });

    return res.json({ limits });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

/**
 * Run an assessment without writing.
 *
 * @param {import('express').Request} req
 * @returns {Promise<object>}
 */
async function runAssessment(req) {
  const source = { ...req.query, ...req.body };
  const period = resolvePeriod(source);
  const establishment = String(source.establishment || '').trim();

  const limits = await resolveEstablishmentLimits(req.tenantId, establishment);
  const employees = await assembleWorkforce(req.tenantId, period, limits);

  const result = assessPeriod({
    employees,
    limits,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  return { period, establishment, limits, result };
}

/**
 * GET /api/working-hours/assessment
 *
 * Writes nothing. Four of the six limits cannot be checked at the point of
 * entry — the weekly total is not knowable on Tuesday and the quarterly
 * overtime ceiling is not knowable in week three — so this is run over a period,
 * repeatedly, as the attendance for it settles.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const { period, establishment, limits, result } = await runAssessment(req);

    return res.json({
      preview: true,
      establishment,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      limits,
      result,
      sections: Object.values(FINDING),
      severities: Object.values(SEVERITY),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/working-hours/assessments
 *
 * Upserted on (tenant, establishment, period start) so re-running a period
 * corrects it rather than producing a second one.
 *
 * The day-by-day detail is deliberately not stored. It is reconstructable from
 * the attendance ledger, it is the largest part of the result by an order of
 * magnitude, and what is worth keeping is the findings and what they were
 * measured against.
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const { period, establishment, limits, result } = await runAssessment(req);

    const assessment = await WorkingHoursAssessment.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        establishment,
        periodStart: period.periodStart,
      },
      {
        $set: {
          tenantId: req.tenantId,
          establishment,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          limits,

          assessedCount: result.assessedCount,
          breachCount: result.breachCount,
          overtimeShortfall: result.overtimeShortfall,
          compliant: result.compliant,

          bySection: result.bySection,
          findings: result.findings,

          employees: result.employees.map((employee) => ({
            employeeId: employee.employeeId,
            name: employee.name,
            designation: employee.designation,
            daysWorked: employee.daysWorked,
            hoursWorked: employee.hoursWorked,
            overtimeHours: employee.overtimeHours,
            overtimeEntitlement: employee.overtime.entitlement,
            overtimePaid: employee.overtime.paid,
            overtimeShortfall: employee.overtime.shortfall,
            breachCount: employee.breachCount,
          })),

          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WORKING_HOURS_ASSESSMENT_COMMITTED',
      resourceType: 'WorkingHoursAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: assessment.establishment || '(default)',
        periodStart: assessment.periodStart,
        breachCount: assessment.breachCount,
        overtimeShortfall: assessment.overtimeShortfall,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/working-hours/assessments
 *
 * Without the findings or the per-employee rows. A quarter's assessment for a
 * five-hundred-person tenant is a few thousand embedded documents and the
 * history panel needs none of them.
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }

    const assessments = await WorkingHoursAssessment.find(
      filter,
      '-findings -employees',
    )
      .sort({ periodStart: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 60))
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/working-hours/assessments/:id
 */
exports.getAssessment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assessment id' });
    }

    const assessment = await WorkingHoursAssessment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    return res.json({ assessment });
  } catch (error) {
    return next(error);
  }
};
