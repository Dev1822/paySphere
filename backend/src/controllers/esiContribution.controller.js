/**
 * @fileoverview Employees' State Insurance Act, 1948 (#1768).
 *
 * The controller's job is the one thing the engine deliberately cannot do:
 * remember. `assessEmployeePeriod` is pure and walks a list of months, so it
 * knows where a contribution period stands only because it was handed every
 * month of it. Persisting that across runs is this file's problem, and
 * `EsiCoverageState` is where it goes.
 *
 * The other half is splitting one wage figure into two. `payroll.model.js`
 * carries `baseSalary`, `overtimePay` and `bonus`, and ESI needs the split
 * because overtime is outside the coverage test and inside the contribution
 * base. Handing the engine a single total would collapse the asymmetry the
 * module exists to represent, so the mapping from payroll columns to the wage
 * shape happens here — where it can be read against the payroll model — rather
 * than in the engine, which has no business knowing what a payroll row looks
 * like.
 *
 * Everything that decides coverage or computes a contribution is in
 * `utils/esiContribution.js`.
 */

const mongoose = require('mongoose');

const {
  EsiRules,
  EsiCoverageState,
  EsiReturn,
} = require('../models/esiContribution.model');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const Attendance = require('../models/attendance.model');
const {
  ESI_RULES,
  COVERAGE,
  contributionPeriodFor,
  benefitPeriodFor,
  assessPeriod,
  computeDelayCharges,
  dueDateFor,
} = require('../utils/esiContribution');
const eventBus = require('../services/event.service');

/** Working days in a month, where attendance has nothing to say. */
const DEFAULT_DAYS_WORKED = 26;

/**
 * The rules for a sub-code, falling back to the notified figures.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} subCode
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId, subCode) {
  const stored = await EsiRules.findOne({
    tenantId,
    subCode: subCode || '',
  }).lean();

  return {
    ...ESI_RULES,
    employedHeadcount: 0,
    employerCode: '',
    ...(stored || {}),
  };
}

/**
 * The months of a contribution period, up to and including a given month.
 *
 * Up to and including, rather than all six, because a period that has not
 * finished has months that have not happened — and a return run in July should
 * not report three months of zero contribution for August, September and
 * October as though the employee had left.
 *
 * @param {object} period
 * @param {number} throughMonth
 * @param {number} throughYear
 * @returns {Array<{month: number, year: number}>}
 */
function monthsOfPeriod(period, throughMonth, throughYear) {
  const months = [];
  const cursor = new Date(period.start.getTime());
  const limit = new Date(Date.UTC(throughYear, throughMonth - 1, 1));

  while (cursor <= period.end && cursor <= limit) {
    months.push({
      month: cursor.getUTCMonth() + 1,
      year: cursor.getUTCFullYear(),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

/**
 * Split a payroll row into the wage shape the engine wants.
 *
 * The split is the point. `coverageWage` reads everything except `overtime` and
 * `contributionWage` reads all of it, so putting overtime pay into
 * `otherAllowances` would quietly make a heavy overtime month push somebody out
 * of the scheme — which is the failure section 2(22) and Rule 2(22) are
 * carefully worded to prevent.
 *
 * `bonus` is dropped rather than placed. An annual bonus is excluded from wages
 * by Rule 2(22) because it is not paid at intervals of less than two months, and
 * `payroll.bonus` is where the product puts an annual bonus. A monthly
 * production incentive would belong in `incentive`, which is why the field
 * exists — but nothing in the payroll row distinguishes the two, so the
 * conservative reading is taken and the difference is left for the salary
 * structure to make.
 *
 * @param {object} payroll
 * @returns {object}
 */
function wagesFromPayroll(payroll) {
  return {
    basic: Number(payroll?.baseSalary) || 0,
    overtime: Number(payroll?.overtimePay) || 0,
  };
}

/**
 * Assemble the establishment for a contribution period.
 *
 * @param {object} params
 * @returns {Promise<{rows: Array<object>, period: object, employees: Array<object>}>}
 */
async function assembleperiod({ tenantId, subCode, month, year, rules }) {
  const period = contributionPeriodFor(new Date(Date.UTC(year, month - 1, 1)));
  const months = monthsOfPeriod(period, month, year);

  const employeeFilter = { tenantId };
  if (subCode) employeeFilter.department = subCode;

  const employees = await Employee.find(employeeFilter)
    .select('fullName monthlySalary dateOfJoining lastWorkingDay')
    .lean();

  if (employees.length === 0) return { rows: [], period, employees };

  const employeeIds = employees.map((employee) => employee._id);

  const [payrolls, attendance, states] = await Promise.all([
    PayrollUpdate.find({
      tenantId,
      employeeId: { $in: employeeIds },
      $or: months.map((entry) => ({ month: entry.month, year: entry.year })),
    }).lean(),
    Attendance.find({
      tenantId,
      employeeId: { $in: employeeIds },
      $or: months.map((entry) => ({ month: entry.month, year: entry.year })),
    })
      .select('employeeId month year presentDays records')
      .lean(),
    EsiCoverageState.find({
      tenantId,
      employeeId: { $in: employeeIds },
    }).lean(),
  ]);

  const key = (employeeId, entry) =>
    `${employeeId}:${entry.year}-${entry.month}`;

  const payrollBy = new Map(
    payrolls.map((row) => [key(row.employeeId, row), row]),
  );
  const attendanceBy = new Map(
    attendance.map((row) => [key(row.employeeId, row), row]),
  );

  // The previous period's state, which is what decides whether somebody above
  // the ceiling is excluded or is entering the scheme fresh. Keyed by employee
  // and taken for the period immediately before this one.
  const previousKey = contributionPeriodFor(
    new Date(period.start.getTime() - 86400000),
  ).key;

  const stateBy = new Map(
    states
      .filter((state) => state.periodKey === previousKey)
      .map((state) => [String(state.employeeId), state]),
  );

  const rows = employees.map((employee) => {
    const carried = stateBy.get(String(employee._id));

    return {
      employee: {
        employeeId: employee._id,
        name: employee.fullName,
        // Rule 50's higher ceiling. Carried on the coverage state rather than
        // on the employee, because it is a fact about the ESI registration.
        disabled: Boolean(carried?.disabled),
        carriedForward: carried
          ? {
              status: carried.status,
              // Deliberately not carried across the boundary: the proviso runs
              // to the end of *that* period, and `assessEmployeePeriod`
              // already nulls it, but a stale value here would defeat that.
              continuedFrom: null,
            }
          : null,
      },
      period,
      months: months.map((entry) => {
        const payroll = payrollBy.get(key(employee._id, entry));
        const attended = attendanceBy.get(key(employee._id, entry));

        if (!payroll) {
          return { ...entry, wages: {}, daysWorked: 0, employed: false };
        }

        const daysWorked =
          Number(attended?.presentDays) ||
          (attended?.records || []).filter(
            (record) => record?.status === 'present',
          ).length ||
          DEFAULT_DAYS_WORKED;

        const monthsSinceEngagement = employee.dateOfJoining
          ? Math.floor(
              (Date.UTC(entry.year, entry.month - 1, 1) -
                new Date(employee.dateOfJoining).getTime()) /
                (30.44 * 86400000),
            )
          : undefined;

        return {
          ...entry,
          wages: wagesFromPayroll(payroll),
          daysWorked,
          monthsSinceEngagement,
          employed: true,
        };
      }),
    };
  });

  return { rows, period, employees };
}

/**
 * Run the assessment for a period without writing anything.
 *
 * @param {object} req
 * @returns {Promise<object>}
 */
async function runAssessment(req) {
  const now = new Date();
  const query = { ...req.query, ...(req.body || {}) };

  const year = Number(query.year) || now.getUTCFullYear();
  const month = Number(query.month) || now.getUTCMonth() + 1;
  const subCode = typeof query.subCode === 'string' ? query.subCode.trim() : '';

  const rules = await resolveRules(req.tenantId, subCode);
  const { rows, period } = await assembleperiod({
    subCode,
    month,
    year,
    rules
  });

  const result = assessPeriod(rows, {
    rules,
    headcount: rules.employedHeadcount || rows.length,
  });

  return {
    month,
    year,
    subCode,
    rules,
    period,
    benefitPeriod: benefitPeriodFor(period),
    result,
  };
}

/**
 * GET /api/esi/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    const subCode =
      typeof req.query.subCode === 'string' ? req.query.subCode.trim() : '';

    return res.json({ rules: await resolveRules(req.tenantId, subCode) });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/esi/rules
 *
 * Audited because the ceiling decides who is in the scheme. Lowering it removes
 * employees from every future return, and the ones removed keep drawing benefit
 * for three months after — so a change made quietly is a change nobody notices
 * until a claim is rejected.
 */
exports.updateRules = async (req, res, next) => {
  try {
    const subCode =
      typeof req.body.subCode === 'string' ? req.body.subCode.trim() : '';

    const update = {};
    const numeric = [
      'wageCeiling',
      'disabledWageCeiling',
      'employeeRatePercent',
      'employerRatePercent',
      'dailyWageFloor',
      'dueDayOfMonth',
      'interestRatePercent',
      'benefitQualifyingDays',
      'employedHeadcount',
    ];

    for (const field of numeric) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ message: `${field} must be a number` });
        }
        update[field] = value;
      }
    }

    if (typeof req.body.employerCode === 'string') {
      update.employerCode = req.body.employerCode.trim();
    }

    const before = await EsiRules.findOne({
      subCode
    }).lean();

    const rules = await EsiRules.findOneAndUpdate(
      {
        subCode
      },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESI_RULES_UPDATED',
      resourceType: 'EsiRules',
      resourceIds: [rules._id],
      details: {
        subCode: subCode || '(default)',
        wageCeilingBefore: before?.wageCeiling ?? ESI_RULES.wageCeiling,
        wageCeilingAfter: rules.wageCeiling,
        employeeRateAfter: rules.employeeRatePercent,
        employerRateAfter: rules.employerRatePercent,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/esi/assessment
 *
 * Writes nothing. Runs the whole contribution period up to the requested month,
 * because a month's coverage is not knowable from that month.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const assessment = await runAssessment(req);
    return res.json(assessment);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/esi/returns
 *
 * Files the month's return, and — the part that is not bookkeeping — writes the
 * coverage state each employee reached.
 *
 * That write is what makes the next month computable. Without it the following
 * run has no way to know that an employee above the ceiling crossed it in July
 * rather than having started the period there, and the two produce opposite
 * answers: continue to September, or contribute nothing.
 */
exports.fileReturn = async (req, res, next) => {
  try {
    const { month, year, subCode, rules, period, result } =
      await runAssessment(req);

    const benefitPeriod = benefitPeriodFor(period);
    const dueOn = dueDateFor(month, year, rules);
    const remittedOn = req.body?.remittedOn
      ? new Date(req.body.remittedOn)
      : null;

    // The lines are this month's, taken out of the whole-period walk.
    const lines = result.employees
      .map((employee) => {
        const row = employee.months.find(
          (entry) => entry.month === month && entry.year === year,
        );
        if (!row) return null;

        return {
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          status: row.status,
          coverageWage: row.coverageWage,
          contributionWage: row.contributionWage,
          ceiling: row.ceiling,
          daysWorked: row.daysWorked,
          employeeContribution: row.employeeContribution,
          employerContribution: row.employerContribution,
          continuedFrom: row.continuedFrom,
        };
      })
      .filter(Boolean)
      .filter((line) => line.status !== COVERAGE.NOT_EMPLOYED);

    const employeeTotal = lines.reduce(
      (sum, line) => sum + line.employeeContribution,
      0,
    );
    const employerTotal = lines.reduce(
      (sum, line) => sum + line.employerContribution,
      0,
    );
    const total = employeeTotal + employerTotal;

    const charges = remittedOn
      ? computeDelayCharges({ amount: total, dueOn, paidOn: remittedOn, rules })
      : { interest: 0, damages: 0, band: null, daysLate: 0 };

    const esiReturn = await EsiReturn.findOneAndUpdate(
      {
        subCode,
        month,
        year
      },
      {
        $set: {
          periodKey: period.key,
          periodLabel: period.label,
          benefitPeriodKey: benefitPeriod.key,
          benefitPeriodLabel: benefitPeriod.label,
          rules,
          employeeCount: lines.length,
          coveredCount: lines.filter(
            (line) => line.status !== COVERAGE.EXCLUDED,
          ).length,
          continuedCount: lines.filter(
            (line) => line.status === COVERAGE.CONTINUED,
          ).length,
          employeeTotal,
          employerTotal,
          total,
          dueOn,
          remittedOn,
          interest: charges.interest,
          damages: charges.damages,
          damagesBand: charges.band || '',
          daysLate: charges.daysLate,
          summary: result.summary,
          findings: result.findings.map((entry) => {
            const {
              code,
              section,
              severity,
              message,
              employeeId,
              employeeName,
              month: findingMonth,
              year: findingYear,
              ...context
            } = entry;

            return {
              code,
              section,
              severity,
              message,
              employeeId,
              employeeName,
              month: findingMonth,
              year: findingYear,
              context,
            };
          }),
          lines,
          filedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // The coverage state. One upsert per employee, and the reason the whole
    // module exists — see this file's header.
    const operations = result.employees.map((employee) => {
      const last = employee.months[employee.months.length - 1];

      return {
        updateOne: {
          filter: {
            employeeId: employee.employeeId,
            periodKey: period.key
          },
          update: {
            $set: {
              periodStart: period.start,
              periodEnd: period.end,
              status: last?.status || COVERAGE.NOT_EMPLOYED,
              continuedFrom: last?.continuedFrom || null,
              qualifyingDays: employee.qualifyingDays,
            },
          },
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await EsiCoverageState.bulkWrite(operations);
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESI_RETURN_FILED',
      resourceType: 'EsiReturn',
      resourceIds: [esiReturn._id],
      details: {
        subCode: subCode || '(default)',
        month,
        year,
        periodKey: period.key,
        total,
        continuedCount: esiReturn.continuedCount,
        daysLate: charges.daysLate,
      },
      req,
    });

    return res.status(201).json({ return: esiReturn });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/esi/returns
 */
exports.listReturns = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.subCode === 'string') {
      filter.subCode = req.query.subCode.trim();
    }

    const returns = await EsiReturn.find(filter, '-findings -lines')
      .sort({ year: -1, month: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 60))
      .lean();

    return res.json({ returns });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/esi/returns/:id
 */
exports.getReturn = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid return id' });
    }

    const esiReturn = await EsiReturn.findOne({
      _id: req.params.id
    }).lean();

    if (!esiReturn) {
      return res.status(404).json({ message: 'Return not found' });
    }

    return res.json({ return: esiReturn });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/esi/coverage
 *
 * The period register: who is in the scheme, who is being carried by the Rule 50
 * proviso and since when, and how the 78-day counts stand.
 *
 * Worth its own endpoint rather than living inside a return, because the
 * question it answers spans the period and a return is one month of it.
 */
exports.getCoverage = async (req, res, next) => {
  try {
    const now = new Date();
    const at = req.query.at ? new Date(req.query.at) : now;
    const period = contributionPeriodFor(at);

    const states = await EsiCoverageState.find({
      periodKey: period.key
    })
      .populate('employeeId', 'fullName')
      .sort({ status: 1 })
      .lean();

    const rules = await resolveRules(req.tenantId, '');

    return res.json({
      period,
      benefitPeriod: benefitPeriodFor(period),
      states,
      continued: states.filter((state) => state.status === COVERAGE.CONTINUED),
      shortOfBenefit: states.filter(
        (state) =>
          state.status !== COVERAGE.EXCLUDED &&
          state.qualifyingDays < rules.benefitQualifyingDays,
      ),
      qualifyingDaysRequired: rules.benefitQualifyingDays,
    });
  } catch (error) {
    return next(error);
  }
};

// Exported for reuse by the payroll run, which needs the same wage split to
// withhold the right employee share before it writes a payslip.
exports.wagesFromPayroll = wagesFromPayroll;
exports.resolveRules = resolveRules;
exports.monthsOfPeriod = monthsOfPeriod;
