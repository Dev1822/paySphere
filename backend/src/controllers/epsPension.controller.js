/**
 * @fileoverview Employees' Pension Scheme, 1995 (#1769).
 *
 * The controller has one problem the other statutory engines do not: the input
 * the formula needs is not in the database, and cannot be derived from what is.
 *
 * Paragraph 11(1) wants sixty contributory months of pay. `salaryStructure.js`
 * records what an employee is paid *now* and revises in place, so it has no
 * history. `payroll.model.js` records what was paid in a month, which is closer
 * — but a payroll row is `baseSalary` plus overtime plus a bonus, and pensionable
 * pay is basic and dearness allowance only, and a month with no payroll row is
 * ambiguous between "not employed" and "employed, unpaid" in a way that decides
 * whether the averaging window reaches further back.
 *
 * So `EpsWageMonth` is a real collection rather than a view, and this file's
 * `backfillWageHistory` is the migration path: it derives what it can from the
 * payroll ledger, marks what it derived, and leaves the months it cannot resolve
 * explicitly unresolved rather than guessing them contributory. Guessing them
 * contributory would average in a zero and understate the pension; guessing them
 * non-contributory would extend the window and overstate it. Both are wrong for
 * life, so neither is done silently.
 *
 * Everything that computes a pension is in `utils/epsPension.js`.
 */

const mongoose = require('mongoose');

const {
  EpsAssumptions,
  EpsWageMonth,
  EpsValuation,
} = require('../models/epsPension.model');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const SalaryStructure = require('../models/salaryStructure.model');
const { COMPONENT_TYPE } = require('../config/salaryComponents');
const {
  resolveStructureOnDate,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const {
  EPS_ASSUMPTIONS,
  computePension,
  projectToSuperannuation,
  valueScheme,
  splitEmployerContribution,
} = require('../utils/epsPension');
const eventBus = require('../services/event.service');

const MS_PER_YEAR = 365.25 * 86400000;

/**
 * Components that make up pensionable pay.
 *
 * Basic and dearness allowance, and nothing else. This is narrower than the ESI
 * definition and narrower than the section 59 ordinary rate, and the narrowness
 * is the point — house rent allowance and conveyance are outside it, and
 * including them would raise the pensionable salary of every member below the
 * ceiling for the rest of their life.
 */
const PENSIONABLE_COMPONENTS = /basic|dearness|^da$|^basic pay$/i;

/**
 * The assumptions for an establishment.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveAssumptionSet(tenantId, establishment) {
  const stored = await EpsAssumptions.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  return { ...EPS_ASSUMPTIONS, ...(stored || {}) };
}

/**
 * Pensionable pay for a month, from the salary structure in force then.
 *
 * From the structure rather than from `payroll.baseSalary`, because
 * `baseSalary` is the whole monthly figure and pensionable pay is two components
 * of it. Falling back to the payroll figure would inflate the pension for every
 * member whose package has a house rent allowance in it, which is most of them.
 *
 * @param {Array<object>} structures
 * @param {Date} onDate
 * @param {object} payroll
 * @returns {{wage: number, derived: boolean}}
 */
function pensionablePayForMonth(structures, onDate, payroll) {
  const structure = resolveStructureOnDate(structures, onDate);

  if (structure) {
    const wage = computeComponentAmounts(structure)
      .components.filter(
        (component) =>
          component.type === COMPONENT_TYPE.EARNING &&
          PENSIONABLE_COMPONENTS.test(component.label || component.code || ''),
      )
      .reduce((sum, component) => sum + (Number(component.amount) || 0), 0);

    if (wage > 0) return { wage, derived: false };
  }

  // No structure covering the month. The payroll's base salary is the best
  // available figure and it is an over-statement, so it is marked as derived
  // and the valuation reports how many months rest on it.
  return { wage: Number(payroll?.baseSalary) || 0, derived: true };
}

/**
 * The wage history for a set of employees, newest first.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {Array<mongoose.Types.ObjectId>} employeeIds
 * @param {number} months
 * @returns {Promise<Map<string, Array<object>>>}
 */
async function loadWageHistory(tenantId, employeeIds, months) {
  const rows = await EpsWageMonth.find({
    tenantId,
    employeeId: { $in: employeeIds },
  })
    .sort({ year: -1, month: -1 })
    .lean();

  const byEmployee = new Map();

  for (const row of rows) {
    const key = String(row.employeeId);
    if (!byEmployee.has(key)) byEmployee.set(key, []);

    const bucket = byEmployee.get(key);

    // Take more than the averaging span, because non-contributory months are
    // skipped and the window has to be able to reach past them.
    if (bucket.length < months * 2) {
      bucket.push({
        month: row.month,
        year: row.year,
        wage: row.wage,
        contributory: row.contributory,
      });
    }
  }

  return byEmployee;
}

/**
 * GET /api/eps/assumptions
 */
exports.getAssumptions = async (req, res, next) => {
  try {
    const establishment =
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '';

    return res.json({
      assumptions: await resolveAssumptionSet(req.tenantId, establishment),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/eps/assumptions
 *
 * Audited because these move the pension of every member at once, and because
 * the wage ceiling in particular is the figure the whole capping question turns
 * on — raising it changes the pensionable salary of everybody above the old one.
 */
exports.updateAssumptions = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const update = {};
    const numeric = [
      'wageCeiling',
      'contributionPercent',
      'averagingMonths',
      'formulaDivisor',
      'minimumEligibleServiceYears',
      'serviceBonusThresholdYears',
      'serviceBonusYears',
      'minimumMonthlyPension',
      'superannuationAge',
      'earlyPensionMinAge',
      'earlyPensionReductionPercent',
      'deferredPensionIncreasePercent',
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

    const before = await EpsAssumptions.findOne({
      establishment
    }).lean();

    const assumptions = await EpsAssumptions.findOneAndUpdate(
      {
        establishment
      },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPS_ASSUMPTIONS_UPDATED',
      resourceType: 'EpsAssumptions',
      resourceIds: [assumptions._id],
      details: {
        establishment: establishment || '(default)',
        wageCeilingBefore: before?.wageCeiling ?? EPS_ASSUMPTIONS.wageCeiling,
        wageCeilingAfter: assumptions.wageCeiling,
        minimumPensionAfter: assumptions.minimumMonthlyPension,
      },
      req,
    });

    return res.json({ assumptions });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/eps/wage-history/backfill
 *
 * Builds the sixty-month history from the payroll ledger.
 *
 * The one decision it refuses to make is the ambiguous month. A month with no
 * payroll row is either "not employed" or "employed and unpaid", and the two
 * produce opposite results: the first extends the averaging window past it, the
 * second averages a zero into it. Guessing costs the member for life in one
 * direction and costs the fund in the other, so months before the joining date
 * are simply not written, and months inside employment with no payroll row are
 * written as non-contributory with the reason recorded — which is the reading
 * that matches what a gap in a payroll ledger usually means, stated openly
 * rather than assumed.
 */
exports.backfillWageHistory = async (req, res, next) => {
  try {
    const months = Math.min(Number(req.body?.months) || 60, 120);

    const employees = await Employee.find({})
      .select('fullName dateOfJoining lastWorkingDay')
      .lean();

    if (employees.length === 0) {
      return res.json({ written: 0, employees: 0 });
    }

    const employeeIds = employees.map((employee) => employee._id);

    const now = new Date();
    const window = [];
    for (let index = 0; index < months; index += 1) {
      const cursor = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1),
      );
      window.push({
        month: cursor.getUTCMonth() + 1,
        year: cursor.getUTCFullYear(),
        start: cursor,
      });
    }

    const [payrolls, structures] = await Promise.all([
      PayrollUpdate.find({
        employeeId: { $in: employeeIds },
        $or: window.map((entry) => ({ month: entry.month, year: entry.year }))
      }).lean(),
      SalaryStructure.find({
        employeeId: { $in: employeeIds }
      }).lean(),
    ]);

    const payrollBy = new Map(
      payrolls.map((row) => [
        `${row.employeeId}:${row.year}-${row.month}`,
        row,
      ]),
    );

    const structuresBy = new Map();
    for (const structure of structures) {
      const key = String(structure.employeeId);
      if (!structuresBy.has(key)) structuresBy.set(key, []);
      structuresBy.get(key).push(structure);
    }

    const operations = [];
    let derivedCount = 0;

    for (const employee of employees) {
      const joined = employee.dateOfJoining
        ? new Date(employee.dateOfJoining)
        : null;
      const left = employee.lastWorkingDay
        ? new Date(employee.lastWorkingDay)
        : null;

      for (const entry of window) {
        // Outside the employment. Not written at all — a month before somebody
        // joined is not a non-contributory month, it is not their month.
        if (joined && entry.start < joined) continue;
        if (left && entry.start > left) continue;

        const payroll = payrollBy.get(
          `${employee._id}:${entry.year}-${entry.month}`,
        );

        if (!payroll) {
          operations.push({
            updateOne: {
              filter: {
                employeeId: employee._id,
                month: entry.month,
                year: entry.year
              },
              update: {
                $setOnInsert: {
                  wage: 0,
                  contributory: false,
                  nonContributoryReason:
                    'No payroll row for the month — treated as non-contributory rather than as zero pay',
                },
              },
              upsert: true,
            },
          });
          continue;
        }

        const { wage, derived } = pensionablePayForMonth(
          structuresBy.get(String(employee._id)) || [],
          entry.start,
          payroll,
        );

        if (derived) derivedCount += 1;

        operations.push({
          updateOne: {
            filter: {
              employeeId: employee._id,
              month: entry.month,
              year: entry.year
            },
            update: {
              $set: {
                wage,
                contributory: wage > 0,
                nonContributoryReason:
                  wage > 0 ? '' : 'Payroll row present with no pensionable pay',
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (operations.length > 0) {
      await EpsWageMonth.bulkWrite(operations);
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPS_WAGE_HISTORY_BACKFILLED',
      resourceType: 'EpsWageMonth',
      details: {
        months,
        employees: employees.length,
        written: operations.length,
        derivedFromBaseSalary: derivedCount,
      },
      req,
    });

    return res.json({
      written: operations.length,
      employees: employees.length,
      /**
       * Months where no salary structure covered the period, so the payroll's
       * base salary stood in. It is an over-statement, and the count is
       * returned so somebody can decide whether the valuation is usable.
       */
      derivedFromBaseSalary: derivedCount,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Value the scheme as at a date.
 *
 * A plain function rather than a handler that the commit path calls, because
 * the preview and the committed valuation must not be able to drift: there is
 * exactly one way to compute this, and two entry points into it.
 *
 * @param {object} params
 * @param {mongoose.Types.ObjectId} params.tenantId
 * @param {string} params.establishment
 * @param {Date} params.asAt
 * @returns {Promise<{asAt: Date, establishment: string, assumptions: object, result: object}>}
 */
async function buildValuation({ tenantId, establishment, asAt }) {
  const assumptions = await resolveAssumptionSet(tenantId, establishment);

  const employeeFilter = { tenantId };
  if (establishment) employeeFilter.department = establishment;

  const employees = await Employee.find(employeeFilter)
    .select('fullName dateOfBirth dateOfJoining lastWorkingDay monthlySalary')
    .lean();

  if (employees.length === 0) {
    return {
      asAt,
      establishment,
      assumptions,
      result: valueScheme([], { assumptions }),
    };
  }

  const history = await loadWageHistory(
    tenantId,
    employees.map((employee) => employee._id),
    assumptions.averagingMonths,
  );

  const members = employees
    .map((employee) => {
      const wageHistory = history.get(String(employee._id)) || [];
      if (wageHistory.length === 0) return null;

      const joined = employee.dateOfJoining
        ? new Date(employee.dateOfJoining)
        : null;
      const until = employee.lastWorkingDay
        ? new Date(employee.lastWorkingDay)
        : asAt;

      const serviceMonths = joined
        ? Math.max(
            0,
            (until.getUTCFullYear() - joined.getUTCFullYear()) * 12 +
              (until.getUTCMonth() - joined.getUTCMonth()),
          )
        : wageHistory.filter((entry) => entry.contributory).length;

      const age = employee.dateOfBirth
        ? Math.floor(
            (asAt.getTime() - new Date(employee.dateOfBirth).getTime()) /
              MS_PER_YEAR,
          )
        : undefined;

      return {
        member: { memberId: employee._id, name: employee.fullName },
        wageHistory,
        serviceMonths,
        ageAtDrawing: age,
        ageNow: age,
      };
    })
    .filter(Boolean);

  const result = valueScheme(members, { assumptions });

  return { asAt, establishment, assumptions, result };
}

/**
 * GET /api/eps/preview
 *
 * Values the scheme without writing anything.
 */
exports.previewValuation = async (req, res, next) => {
  try {
    return res.json(
      await buildValuation({
        establishment:
          typeof req.query.establishment === 'string'
            ? req.query.establishment.trim()
            : '',

        asAt: req.query.asAt ? new Date(req.query.asAt) : new Date()
      }),
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/eps/valuations
 *
 * Commits the valuation for a date.
 */
exports.commitValuation = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const asAt = req.body?.asAt ? new Date(req.body.asAt) : new Date();
    const valuationDate = new Date(
      Date.UTC(asAt.getUTCFullYear(), asAt.getUTCMonth(), 1),
    );

    // The same function the preview calls, so the committed figures and the
    // previewed ones cannot drift.
    const { assumptions, result } = await buildValuation({
      establishment,
      asAt
    });

    const valuation = await EpsValuation.findOneAndUpdate(
      {
        establishment,
        valuationDate
      },
      {
        $set: {
          assumptions,
          memberCount: result.memberCount,
          pensionerCount: result.pensionerCount,
          withdrawalCount: result.withdrawalCount,
          monthlyPensionTotal: result.monthlyPensionTotal,
          annualPensionTotal: result.annualPensionTotal,
          affectedByCapOrder: result.affectedByCapOrder,
          summary: result.summary,
          findings: result.findings.map((entry) => {
            const {
              code,
              paragraph,
              severity,
              message,
              memberId,
              memberName,
              ...context
            } = entry;

            return {
              code,
              paragraph,
              severity,
              message,
              memberId,
              memberName,
              context,
            };
          }),
          members: result.members.map((member) => ({
            memberId: member.memberId,
            memberName: member.memberName,
            outcome: member.outcome,
            pensionableSalary: member.pensionableSalary,
            averageThenCap: member.averageThenCap || 0,
            monthsUsed: member.monthsUsed || 0,
            windowMonths: member.windowMonths || 0,
            eligibleYears: member.eligibleYears,
            pensionableYears: member.pensionableYears,
            serviceBonusApplied: Boolean(member.serviceBonusApplied),
            formulaPension: member.formulaPension || 0,
            pastServiceBenefit: member.pastServiceBenefit || 0,
            ageAdjustmentPercent: member.ageAdjustmentPercent || 0,
            monthlyPension: member.monthlyPension,
            annualPension: member.annualPension || 0,
            withdrawalBenefit: member.withdrawalBenefit || 0,
            withdrawalFactor: member.withdrawalFactor || 0,
          })),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EPS_VALUATION_COMMITTED',
      resourceType: 'EpsValuation',
      resourceIds: [valuation._id],
      details: {
        establishment: establishment || '(default)',
        valuationDate,
        memberCount: valuation.memberCount,
        monthlyPensionTotal: valuation.monthlyPensionTotal,
        affectedByCapOrder: valuation.affectedByCapOrder,
      },
      req,
    });

    return res.status(201).json({ valuation });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/eps/valuations
 */
exports.listValuations = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }

    const valuations = await EpsValuation.find(filter, '-findings -members')
      .sort({ valuationDate: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 60))
      .lean();

    return res.json({ valuations });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/eps/members/:employeeId
 *
 * One member's statement: the pension now, the projection to fifty-eight, and
 * the sixty months the pensionable salary was taken over.
 *
 * The months are returned because this is the endpoint a member's query lands
 * on, and "why is my pensionable salary ₹14,500 when I earned ₹40,000" is
 * answerable only by showing the window and the capping.
 */
exports.getMemberStatement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const employee = await Employee.findOne({
      _id: req.params.employeeId
    })
      .select('fullName dateOfBirth dateOfJoining lastWorkingDay')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const assumptions = await resolveAssumptionSet(req.tenantId, '');
    const history = await loadWageHistory(
      req.tenantId,
      [employee._id],
      assumptions.averagingMonths,
    );

    const wageHistory = history.get(String(employee._id)) || [];
    const now = new Date();

    const joined = employee.dateOfJoining
      ? new Date(employee.dateOfJoining)
      : null;
    const until = employee.lastWorkingDay
      ? new Date(employee.lastWorkingDay)
      : now;

    const serviceMonths = joined
      ? Math.max(
          0,
          (until.getUTCFullYear() - joined.getUTCFullYear()) * 12 +
            (until.getUTCMonth() - joined.getUTCMonth()),
        )
      : wageHistory.filter((entry) => entry.contributory).length;

    const age = employee.dateOfBirth
      ? Math.floor(
          (now.getTime() - new Date(employee.dateOfBirth).getTime()) /
            MS_PER_YEAR,
        )
      : undefined;

    const member = { memberId: employee._id, name: employee.fullName };

    const current = computePension({
      member,
      wageHistory,
      serviceMonths,
      ageAtDrawing: age,
      assumptions,
    });

    const projection = projectToSuperannuation({
      member,
      wageHistory,
      serviceMonths,
      ageNow: age,
      assumptions,
    });

    const monthly = splitEmployerContribution({
      monthlyWage: wageHistory[0]?.wage || 0,
      assumptions,
    });

    return res.json({
      employee: { _id: employee._id, fullName: employee.fullName },
      assumptions,
      current,
      projection,
      monthlyDiversion: monthly,
      /** Newest first, and capped in the response so the page can show both. */
      wageHistory: wageHistory
        .slice(0, assumptions.averagingMonths * 2)
        .map((entry) => ({
          ...entry,
          cappedWage: Math.min(entry.wage, assumptions.wageCeiling),
        })),
    });
  } catch (error) {
    return next(error);
  }
};

exports.buildValuation = buildValuation;
exports.resolveAssumptionSet = resolveAssumptionSet;
exports.pensionablePayForMonth = pensionablePayForMonth;
exports.PENSIONABLE_COMPONENTS = PENSIONABLE_COMPONENTS;
