/**
 * @fileoverview Payment of Wages Act, 1936 (#1767).
 *
 * The controller's real job is assembly, and it is harder than it looks,
 * because the deduction set the engine needs does not exist anywhere as a set.
 *
 * `payroll.model.js` carries `deductions` as a single scalar, `customDeductions`
 * as an array of names and amounts, `leaveDeduction` as its own column and
 * `loanRecoveries` as a third shape entirely. Four representations, written by
 * four engines that never had to agree with each other, and section 7(3) is a
 * rule about their sum — so the first thing this does is flatten them into one
 * list with a section 7(2) clause attached to each row.
 *
 * The flattening is where the classification has to be conservative. A row that
 * cannot be placed in a clause is reported as an unauthorised deduction, which
 * is a breach, so guessing generously would hide the exact thing the module
 * exists to find. `classifyDeduction` therefore falls to UNAUTHORISED rather
 * than to a plausible clause, and this file gives it the best labels it can
 * instead of widening the guess.
 *
 * Everything that decides whether a deduction is lawful is in
 * `utils/paymentOfWages.js`.
 */

const mongoose = require('mongoose');

const {
  WageDeductionRules,
  WageDeductionRegister,
  DeferredDeduction,
} = require('../models/wageDeductionRegister.model');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const Attendance = require('../models/attendance.model');
const {
  PAYMENT_OF_WAGES_LIMITS,
  DEDUCTION_KIND,
  SEVERITY,
  assessRegister,
} = require('../utils/paymentOfWages');
const eventBus = require('../services/event.service');

/**
 * The rules for an establishment, falling back to the Act's own figures.
 *
 * Not upserted on read. A read that wrote a document would mean the first
 * person to open the page had created the establishment's rule set, which is a
 * decision rather than a page view.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId, establishment) {
  const stored = await WageDeductionRules.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  return {
    ...PAYMENT_OF_WAGES_LIMITS,
    employedHeadcount: 0,
    approvedActs: [],
    finePurpose: '',
    weeklyOffDays: [0],
    holidays: [],
    ...(stored || {}),
  };
}

/**
 * The wage period, as a calendar month.
 *
 * A calendar month because `payroll.model.js` is keyed on `{month, year}` and a
 * period that started on the 16th would need half a payroll row. Section 4
 * permits shorter periods and the engine checks the length it is given, so the
 * constraint is the ledger's rather than the Act's — noted here so that a later
 * fortnightly payroll knows which of the two to change.
 *
 * @param {object} query
 * @returns {{month: number, year: number, periodStart: Date, periodEnd: Date}}
 */
function resolvePeriod(query) {
  const now = new Date();

  const year = Number(query.year) || now.getUTCFullYear();
  const month = Number(query.month) || now.getUTCMonth() + 1;

  return {
    month,
    year,
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    periodEnd: new Date(Date.UTC(year, month, 0)),
  };
}

/**
 * Days in the wage period, for the section 9 proportion.
 *
 * The calendar length, not the working days. Section 9(2) sets the deduction in
 * the same proportion as the absence bears to the wage period, and the wage
 * period is a calendar month — using working days would make a day of absence
 * in a month with four Sundays worth more than one in a month with five, which
 * is not what proportion means here.
 *
 * @param {number} month
 * @param {number} year
 * @returns {number}
 */
function daysInPeriod(month, year) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Flatten one payroll row into the deduction list the engine wants.
 *
 * The four shapes, in the order they matter:
 *
 *   `leaveDeduction`   — a section 7(2)(b) absence, and the only one that comes
 *                        out of the base rather than counting toward the
 *                        ceiling, so it must be labelled such that
 *                        `classifyDeduction` places it there.
 *   `loanRecoveries[]` — each instalment as its own row, because the abatement
 *                        needs to defer an identifiable instalment and a single
 *                        `loanRecoveryTotal` cannot be carried forward against
 *                        any particular loan.
 *   `customDeductions[]` — names a human typed. This is where the unauthorised
 *                        deductions live, and the labels are passed through
 *                        unchanged rather than normalised, because normalising
 *                        them is guessing.
 *   `deductions`       — the scalar. Whatever it holds beyond the three above
 *                        is a residue nothing can account for, and it is
 *                        reported as such rather than dropped.
 *
 * @param {object} payroll
 * @returns {Array<object>}
 */
function flattenDeductions(payroll) {
  const rows = [];

  const leaveDeduction = Number(payroll.leaveDeduction) || 0;
  if (leaveDeduction > 0) {
    rows.push({
      label: 'Loss of pay',
      kind: 'ABSENCE',
      amount: leaveDeduction,
    });
  }

  for (const recovery of payroll.loanRecoveries || []) {
    const amount = Number(recovery?.amount) || 0;
    if (amount <= 0) continue;

    rows.push({
      label: `Loan instalment${recovery.loanId ? ` (${recovery.loanId})` : ''}`,
      kind: 'LOAN_RECOVERY',
      amount,
      loanId: recovery.loanId,
    });
  }

  for (const custom of payroll.customDeductions || []) {
    const amount = Number(custom?.amount) || 0;
    if (amount <= 0) continue;

    rows.push({ label: custom.name || '', amount });
  }

  // The residue. `deductions` is meant to be the total, so anything it holds
  // above the itemised rows arrived without an itemisation — which is precisely
  // an unlabelled deduction from wages, and section 7(2) has no clause for it.
  const itemised = rows.reduce((sum, row) => sum + row.amount, 0);
  const scalar = Number(payroll.deductions) || 0;
  const residue = Math.round((scalar - itemised) * 100) / 100;

  if (residue > 0.01) {
    rows.push({
      label: 'Unitemised deduction',
      amount: residue,
    });
  }

  return rows;
}

/**
 * Assemble the establishment's wage period.
 *
 * @param {object} req
 * @param {object} period
 * @param {object} rules
 * @returns {Promise<Array<object>>} rows in `assessWagePeriod` shape
 */
async function assembleRegister(req, period, rules) {
  const tenantId = req.tenantId;
  const establishment =
    typeof req.query.establishment === 'string'
      ? req.query.establishment.trim()
      : '';

  const employeeFilter = { tenantId };
  if (establishment) employeeFilter.department = establishment;

  const employees = await Employee.find(employeeFilter)
    .select('fullName monthlySalary dateOfBirth lastWorkingDay')
    .lean();

  if (employees.length === 0) return [];

  const employeeIds = employees.map((employee) => employee._id);

  const [payrolls, attendance] = await Promise.all([
    PayrollUpdate.find({
      tenantId,
      employeeId: { $in: employeeIds },
      month: period.month,
      year: period.year,
    }).lean(),
    Attendance.find({
      tenantId,
      employeeId: { $in: employeeIds },
      month: period.month,
      year: period.year,
    })
      .select('employeeId records days')
      .lean(),
  ]);

  const payrollByEmployee = new Map(
    payrolls.map((payroll) => [String(payroll.employeeId), payroll]),
  );
  const attendanceByEmployee = new Map(
    attendance.map((entry) => [String(entry.employeeId), entry]),
  );

  const periodDays = daysInPeriod(period.month, period.year);
  const rows = [];

  for (const employee of employees) {
    const payroll = payrollByEmployee.get(String(employee._id));

    // No payroll row for the month means no wages were paid, and a register of
    // deductions from wages that were not paid is empty rather than compliant.
    if (!payroll) continue;

    const grossWages =
      (Number(payroll.baseSalary) || 0) +
      (Number(payroll.overtimePay) || 0) +
      (Number(payroll.bonus) || 0);

    const attendanceRow = attendanceByEmployee.get(String(employee._id));
    const absentDays =
      Number(payroll.leaveDays) ||
      (attendanceRow?.records || []).filter(
        (record) => record?.status === 'absent',
      ).length;

    // Section 8(3) needs an age, and only an age. Reading the whole date of
    // birth into the register would put a birth date in a compliance document
    // that has no use for one.
    const age = employee.dateOfBirth
      ? Math.floor(
          (period.periodEnd.getTime() -
            new Date(employee.dateOfBirth).getTime()) /
            (365.25 * 86400000),
        )
      : undefined;

    // Section 5(4) only applies where the employment ended, and it has to have
    // ended *in* this period — a person who left in March is not owed a
    // two-working-day settlement out of the June register.
    const lastWorkingDay = employee.lastWorkingDay
      ? new Date(employee.lastWorkingDay)
      : null;
    const terminatedInPeriod =
      lastWorkingDay &&
      lastWorkingDay >= period.periodStart &&
      lastWorkingDay <= period.periodEnd
        ? lastWorkingDay
        : undefined;

    rows.push({
      employee: {
        employeeId: employee._id,
        name: employee.fullName,
        monthlyWage: Number(employee.monthlySalary) || grossWages,
        age,
        terminatedOn: terminatedInPeriod,
      },
      grossWages,
      deductions: flattenDeductions(payroll),
      fines: (payroll.customDeductions || [])
        .filter((custom) => /fine|penalt/i.test(custom?.name || ''))
        .map((custom) => ({
          amount: Number(custom.amount) || 0,
          act: custom.name,
        })),
      absence: { periodDays, absentDays },
      approvedActs: rules.approvedActs,
      payment: {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        paidOn: payroll.updatedAt || payroll.createdAt,
        headcount: rules.employedHeadcount || employees.length,
        weeklyOffDays: rules.weeklyOffDays,
        holidays: rules.holidays,
      },
    });
  }

  return rows;
}

/**
 * Run the assessment for a period without writing anything.
 *
 * @param {object} req
 * @returns {Promise<object>}
 */
async function runAssessment(req) {
  const period = resolvePeriod(req.query);
  const establishment =
    typeof req.query.establishment === 'string'
      ? req.query.establishment.trim()
      : '';

  const rules = await resolveRules(req.tenantId, establishment);
  const rows = await assembleRegister(req, period, rules);
  const result = assessRegister(rows, { limits: rules });

  return { period, establishment, rules, result };
}

/**
 * GET /api/wage-deductions/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '';

    return res.json({ rules: await resolveRules(req.tenantId, establishment) });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/wage-deductions/rules
 *
 * Audited, and the reason is the applicability ceiling. Raising it brings
 * employees into the Act and makes findings appear; lowering it makes every
 * existing finding for those employees disappear, and nothing else in the
 * product would record that somebody had done it.
 */
exports.updateRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const update = {};
    const numeric = [
      'maxDeductionPercent',
      'maxDeductionPercentWithCoOperative',
      'maxFinePercent',
      'fineRecoveryWindowDays',
      'applicabilityWageCeiling',
      'employedHeadcount',
    ];

    for (const key of numeric) {
      if (req.body[key] !== undefined) {
        const value = Number(req.body[key]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ message: `${key} must be a number` });
        }
        update[key] = value;
      }
    }

    if (Array.isArray(req.body.approvedActs)) {
      update.approvedActs = req.body.approvedActs
        .map((act) => String(act).trim())
        .filter(Boolean);
    }

    if (Array.isArray(req.body.weeklyOffDays)) {
      update.weeklyOffDays = req.body.weeklyOffDays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    }

    if (Array.isArray(req.body.holidays)) {
      update.holidays = req.body.holidays
        .map((day) => String(day).slice(0, 10))
        .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day));
    }

    if (typeof req.body.finePurpose === 'string') {
      update.finePurpose = req.body.finePurpose.trim();
    }

    const before = await WageDeductionRules.findOne({
      tenantId: req.tenantId,
      establishment,
    }).lean();

    const rules = await WageDeductionRules.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WAGE_DEDUCTION_RULES_UPDATED',
      resourceType: 'WageDeductionRules',
      resourceIds: [rules._id],
      details: {
        establishment: establishment || '(default)',
        // Both sides, because the point of auditing this is the change and not
        // the resting value.
        applicabilityWageCeilingBefore:
          before?.applicabilityWageCeiling ??
          PAYMENT_OF_WAGES_LIMITS.applicabilityWageCeiling,
        applicabilityWageCeilingAfter: rules.applicabilityWageCeiling,
        maxDeductionPercentAfter: rules.maxDeductionPercent,
        approvedActCount: rules.approvedActs.length,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/wage-deductions/assessment
 *
 * Writes nothing, and is meant to be run repeatedly. Deductions are added to a
 * payroll row up to the moment it is approved, so the answer moves until then.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const { period, establishment, rules, result } = await runAssessment(req);

    return res.json({
      period: {
        month: period.month,
        year: period.year,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      },
      establishment,
      rules,
      result,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/wage-deductions/registers
 *
 * Commits the register for a period, and — the part that is not bookkeeping —
 * writes the deferred balances the abatement created.
 *
 * Without that write the abatement would be a write-off. The loan instalment
 * that gave way to the section 7(3) ceiling is still owed, and the register is
 * the only thing that knows it was deferred rather than collected.
 */
exports.commitRegister = async (req, res, next) => {
  try {
    const query = { ...req.query, ...req.body };
    const period = resolvePeriod(query);
    const establishment =
      typeof query.establishment === 'string' ? query.establishment.trim() : '';

    const rules = await resolveRules(req.tenantId, establishment);
    const rows = await assembleRegister(
      { ...req, query: { ...query, establishment } },
      period,
      rules,
    );
    const result = assessRegister(rows, { limits: rules });

    const register = await WageDeductionRegister.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        establishment,
        periodStart: period.periodStart,
      },
      {
        $set: {
          periodEnd: period.periodEnd,
          rules,
          finePurpose: rules.finePurpose,
          employeeCount: result.employeeCount,
          coveredCount: result.coveredCount,
          breachCount: result.breachCount,
          totalWages: result.totalWages,
          totalDeducted: result.totalDeducted,
          totalAbated: result.totalAbated,
          totalCarryForward: result.totalCarryForward,
          totalFinesRealised: result.totalFinesRealised,
          summary: result.summary,
          findings: result.findings.map((entry) => {
            const {
              code,
              section,
              severity,
              message,
              employeeId,
              employeeName,
              ...context
            } = entry;
            return {
              code,
              section,
              severity,
              message,
              employeeId,
              employeeName,
              context,
            };
          }),
          employees: result.employees.map((employee) => ({
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            covered: employee.covered,
            grossWages: employee.grossWages,
            earnedWages: employee.earnedWages || 0,
            netWages: employee.netWages,
            deductions: (employee.deductions || []).map((entry) => ({
              label: entry.label,
              kind: entry.kind,
              clause: entry.clause,
              amount: entry.amount,
              payable: entry.payable,
              carryForward: entry.carryForward,
            })),
            totalDeducted: employee.totals.deducted,
            totalAttempted: employee.totals.attempted || 0,
            ceilingAmount: employee.totals.ceiling,
            ceilingPercent: employee.totals.ceilingPercent,
            ceilingRaised: Boolean(employee.totals.ceilingRaised),
            deductionPercent: employee.totals.deductionPercent || 0,
            abated: employee.totals.abated || 0,
            carryForward: employee.totals.carryForward || 0,
            finesRecoverable: employee.totals.finesRecoverable || 0,
            finesDisallowed: employee.totals.finesDisallowed || 0,
            dueOn: employee.dueOn,
            daysLate: employee.daysLate || 0,
          })),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // Re-committing a period replaces its deferrals rather than adding a second
    // set. A register corrected twice would otherwise carry the same instalment
    // forward twice, and the employee would be recovered from twice.
    await DeferredDeduction.deleteMany({
      tenantId: req.tenantId,
      deferredFromPeriodStart: period.periodStart,
      status: 'outstanding',
    });

    const deferrals = [];

    for (const employee of result.employees) {
      for (const entry of employee.deductions || []) {
        if (!entry.carryForward || entry.carryForward <= 0) continue;

        deferrals.push({
          tenantId: req.tenantId,
          employeeId: employee.employeeId,
          label: entry.label,
          kind: entry.kind || DEDUCTION_KIND.UNAUTHORISED,
          deferredFromPeriodStart: period.periodStart,
          amount: entry.carryForward,
        });
      }
    }

    if (deferrals.length > 0) {
      await DeferredDeduction.insertMany(deferrals);
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WAGE_DEDUCTION_REGISTER_COMMITTED',
      resourceType: 'WageDeductionRegister',
      resourceIds: [register._id],
      details: {
        establishment: establishment || '(default)',
        periodStart: register.periodStart,
        breachCount: register.breachCount,
        totalCarryForward: register.totalCarryForward,
        deferralCount: deferrals.length,
      },
      req,
    });

    return res.status(201).json({ register, deferralCount: deferrals.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/wage-deductions/registers
 *
 * Without the findings or the per-employee rows — a month's register for a
 * five-hundred-person tenant is a few thousand embedded documents and the
 * history panel needs none of them.
 */
exports.listRegisters = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }

    const registers = await WageDeductionRegister.find(
      filter,
      '-findings -employees',
    )
      .sort({ periodStart: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 60))
      .lean();

    return res.json({ registers });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/wage-deductions/registers/:id
 */
exports.getRegister = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid register id' });
    }

    const register = await WageDeductionRegister.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!register) {
      return res.status(404).json({ message: 'Register not found' });
    }

    return res.json({ register });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/wage-deductions/deferred
 *
 * What the ceiling pushed into later periods and has not yet recovered.
 *
 * Worth reading on its own rather than only inside a register, because a
 * balance that keeps being deferred is the signal: an employee whose deductions
 * exceed the ceiling every month is not having a bad month, they are being
 * recovered from faster than the Act allows, and the deferral is the only place
 * that shows it.
 */
exports.listDeferred = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId, status: 'outstanding' };

    if (mongoose.isValidObjectId(req.query.employeeId)) {
      filter.employeeId = req.query.employeeId;
    }

    const deferred = await DeferredDeduction.find(filter)
      .populate('employeeId', 'fullName')
      .sort({ deferredFromPeriodStart: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 500))
      .lean();

    const total = deferred.reduce(
      (sum, entry) => sum + (entry.amount - (entry.recovered || 0)),
      0,
    );

    return res.json({
      deferred,
      outstandingTotal: Math.round((total + Number.EPSILON) * 100) / 100,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/wage-deductions/deferred/:id/write-off
 *
 * A deferred balance that will not be recovered.
 *
 * Separate from deleting the row, and audited, because a write-off is the
 * employer forgiving a debt and the two look identical in a balance that simply
 * stops appearing.
 */
exports.writeOffDeferred = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid deferral id' });
    }

    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ message: 'A reason is required' });
    }

    const deferral = await DeferredDeduction.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, status: 'outstanding' },
      { $set: { status: 'written_off', writeOffReason: reason } },
      { new: true },
    );

    if (!deferral) {
      return res
        .status(404)
        .json({ message: 'Outstanding deferral not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WAGE_DEDUCTION_DEFERRAL_WRITTEN_OFF',
      resourceType: 'DeferredDeduction',
      resourceIds: [deferral._id],
      details: {
        employeeId: deferral.employeeId,
        amount: deferral.amount,
        recovered: deferral.recovered,
        reason,
      },
      req,
    });

    return res.json({ deferral });
  } catch (error) {
    return next(error);
  }
};

// Exported for the route mounting test and for reuse by the payroll run, which
// needs the same flattening to apply the ceiling before it writes a payslip.
exports.flattenDeductions = flattenDeductions;
exports.resolveRules = resolveRules;
exports.SEVERITY = SEVERITY;
