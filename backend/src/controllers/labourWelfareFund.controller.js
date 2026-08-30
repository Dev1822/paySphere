/**
 * @fileoverview Labour Welfare Fund (#1701).
 *
 * The controller assembles the workforce with the three facts the engine needs
 * and the employee record does not obviously carry: which state the employee
 * works in, whether they are employed in a managerial or supervisory capacity,
 * and whether they were on the rolls on the last day of the contribution
 * period.
 *
 * The last of those is why joining and leaving dates are read rather than
 * `isActive`. LWF does not pro-rate and liability is decided on the period end,
 * so an employee who left in November is not liable for a half-year closing in
 * December — and `isActive: false` cannot say *when* they stopped being active,
 * which is the only thing that matters here.
 *
 * Everything that decides a number is in `utils/labourWelfareFund.js`.
 */

const mongoose = require('mongoose');

const {
  LabourWelfareFundRule,
  LabourWelfareFundContribution,
} = require('../models/labourWelfareFund.model');
const Employee = require('../models/employee.model');
const {
  PERIODICITY,
  assessPeriod,
  assessState,
  collectionCalendar,
} = require('../utils/labourWelfareFund');
const eventBus = require('../services/event.service');

/**
 * The rule in force for each state on a date.
 *
 * The rules collection is append-only, so this picks the latest `effectiveFrom`
 * that is not in the future relative to the period — a revision notified in
 * March with effect from January applies to the January–June half-year, and
 * must not be applied to the half-year before it.
 *
 * @param {string} tenantId
 * @param {Date} asOf
 * @returns {Promise<Array<object>>}
 */
async function rulesInForce(tenantId, asOf) {
  const rules = await LabourWelfareFundRule.find({
    tenantId,
    effectiveFrom: { $lte: asOf },
  })
    .sort({ state: 1, effectiveFrom: -1 })
    .lean();

  const latestByState = new Map();

  for (const rule of rules) {
    // Sorted descending within a state, so the first one seen is the latest.
    if (!latestByState.has(rule.state)) latestByState.set(rule.state, rule);
  }

  return [...latestByState.values()];
}

/**
 * The workforce in the shape the engine wants.
 *
 * `isActive` is deliberately not filtered on. A leaver is still relevant — they
 * may have been on the rolls at the period end of a period that has only just
 * closed — and filtering them out would silently under-remit for exactly the
 * period they were liable in.
 *
 * @param {string} tenantId
 * @returns {Promise<Array<object>>}
 */
async function assembleWorkforce(tenantId) {
  const employees = await Employee.find(
    { tenantId },
    'fullName role monthlySalary joiningDate exitDetails statutoryClassification jobLevel',
  ).lean();

  return employees.map((employee) => {
    const classification = employee.statutoryClassification || {};

    // "Managerial or supervisory capacity" is a fact about the job, and the
    // directory has no field that states it. `jobLevel` and the designation are
    // what a tenant has, and matching on them is a heuristic — which is why the
    // exclusion also requires the wage test and why every exclusion is reported
    // with its reason rather than applied silently.
    const designation = `${employee.role || ''} ${employee.jobLevel || ''}`;
    const managerial = /manager|supervisor|head|director|lead|chief/i.test(
      designation,
    );

    return {
      employeeId: employee._id,
      name: employee.fullName || '',
      designation: employee.role || '',
      state: (classification.state || '').toUpperCase(),
      wages: Number(employee.monthlySalary) || 0,
      managerial,
      joinedOn: employee.joiningDate || null,
      leftOn:
        employee.exitDetails && employee.exitDetails.lastWorkingDay
          ? employee.exitDetails.lastWorkingDay
          : null,
    };
  });
}

/**
 * GET /api/labour-welfare-fund/rules
 */
exports.listRules = async (req, res, next) => {
  try {
    const rules = await LabourWelfareFundRule.find({ tenantId: req.tenantId })
      .sort({ state: 1, effectiveFrom: -1 })
      .lean();

    return res.json({ rules, periodicities: Object.values(PERIODICITY) });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/labour-welfare-fund/rules
 *
 * Creates rather than upserts. A state revising its amounts is a new rule with
 * a new effective date, and the old one stays on file so a contribution for a
 * closed period can be reproduced against the amounts that were in force then.
 */
exports.createRule = async (req, res, next) => {
  try {
    const effectiveFrom = new Date(req.body.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      return res
        .status(400)
        .json({ message: 'effectiveFrom must be a valid date' });
    }

    const months = Array.isArray(req.body.contributionMonths)
      ? [...new Set(req.body.contributionMonths.map(Number))].filter(
          (month) => Number.isInteger(month) && month >= 1 && month <= 12,
        )
      : [];

    if (!months.length) {
      return res.status(400).json({
        message:
          'contributionMonths must name at least one month the state collects in',
      });
    }

    const slabs = Array.isArray(req.body.slabs)
      ? req.body.slabs.map((slab) => ({
          upTo:
            slab.upTo === null || typeof slab.upTo === 'undefined'
              ? null
              : Number(slab.upTo),
          employee: Number(slab.employee) || 0,
          employer: Number(slab.employer) || 0,
        }))
      : [];

    if (!slabs.length) {
      return res
        .status(400)
        .json({ message: 'a rule needs at least one wage slab' });
    }

    // A rule whose slabs all have a ceiling leaves the highest earners with no
    // applicable slab, and the engine would report every one of them as an
    // exclusion. Almost always a transcription slip rather than the intent, and
    // much cheaper to refuse here than to explain later.
    if (!slabs.some((slab) => slab.upTo === null)) {
      return res.status(422).json({
        message:
          'the top slab must be open-ended (upTo: null), otherwise employees above the highest ceiling contribute nothing',
      });
    }

    const rule = await LabourWelfareFundRule.create({
      tenantId: req.tenantId,
      state: String(req.body.state || '').toUpperCase(),
      enactment: req.body.enactment || '',
      effectiveFrom,
      periodicity: req.body.periodicity,
      contributionMonths: months,
      slabs,
      establishmentThreshold: Number(req.body.establishmentThreshold) || 0,
      managerialWageThreshold: Number(req.body.managerialWageThreshold) || 0,
      remittanceDueDays: Number(req.body.remittanceDueDays) || 15,
      lateInterestRate: Number(req.body.lateInterestRate) || 0,
      notes: req.body.notes || '',
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LWF_RULE_ADDED',
      resourceType: 'LabourWelfareFundRule',
      resourceIds: [rule._id],
      details: {
        state: rule.state,
        periodicity: rule.periodicity,
        effectiveFrom: rule.effectiveFrom,
      },
      req,
    });

    return res.status(201).json({ rule });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

/**
 * GET /api/labour-welfare-fund/preview
 *
 * Writes nothing. The register is opened before the payroll run to see what is
 * due, which is the point — LWF is missed because nobody schedules it, not
 * because anybody computes it wrongly.
 */
exports.previewPeriod = async (req, res, next) => {
  try {
    const now = new Date();
    const month = Number(req.query.month) || now.getUTCMonth() + 1;
    const year = Number(req.query.year) || now.getUTCFullYear();

    const asOf = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [rules, employees] = await Promise.all([
      rulesInForce(req.tenantId, asOf),
      assembleWorkforce(req.tenantId),
    ]);

    const result = assessPeriod({
      rules,
      employees,
      month,
      year,
      asAt: req.query.asAt ? new Date(req.query.asAt) : undefined,
    });

    return res.json({ preview: true, result });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/labour-welfare-fund/calendar
 *
 * What is coming, per state, for a year.
 *
 * A separate endpoint from the preview because they answer different questions:
 * the preview says what is due *this* month, and the calendar says when the next
 * one lands. A half-yearly deduction nobody scheduled is one that gets
 * reconciled after the payroll run rather than made in it, which is how LWF goes
 * wrong in practice.
 */
exports.getCalendar = async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getUTCFullYear();

    const rules = await rulesInForce(
      req.tenantId,
      new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    );

    const entries = rules
      .flatMap((rule) => collectionCalendar(rule, year))
      .sort((a, b) => a.dueBy - b.dueBy);

    return res.json({ year, entries });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/labour-welfare-fund/contributions
 *
 * Commits one state's contribution for a collection month. Upserted on
 * (tenant, state, year, month) so re-running December corrects December rather
 * than producing a second liability for the same period.
 */
exports.commitContribution = async (req, res, next) => {
  try {
    const state = String(req.body.state || '').toUpperCase();
    const month = Number(req.body.month);
    const year = Number(req.body.year);

    if (!state) return res.status(400).json({ message: 'state is required' });
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'month must be 1-12' });
    }
    if (!Number.isInteger(year)) {
      return res.status(400).json({ message: 'year must be a calendar year' });
    }

    const asOf = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [rules, employees] = await Promise.all([
      rulesInForce(req.tenantId, asOf),
      assembleWorkforce(req.tenantId),
    ]);

    const rule = rules.find((r) => r.state === state);
    if (!rule) {
      return res.status(404).json({
        message: `No labour welfare fund rule on record for ${state} as at ${asOf
          .toISOString()
          .slice(0, 10)}`,
      });
    }

    const result = assessState({
      rule,
      employees: employees.filter((employee) => employee.state === state),
      month,
      year,
      paidOn: req.body.paidOn,
      asAt: req.body.asAt,
    });

    if (!result.collects) {
      return res.status(422).json({
        message: `${state} does not collect in month ${month} — ${result.reason}`,
      });
    }

    const contribution = await LabourWelfareFundContribution.findOneAndUpdate(
      { tenantId: req.tenantId, state, year, month },
      {
        $set: {
          tenantId: req.tenantId,
          state,
          month,
          year,

          periodStart: result.period.periodStart,
          periodEnd: result.period.periodEnd,
          periodLabel: result.period.label,
          periodicity: result.period.periodicity,

          headcountAtPeriodEnd: result.headcountAtPeriodEnd,
          liableCount: result.liableCount,
          excludedCount: result.excludedCount,

          employeeTotal: result.employeeTotal,
          employerTotal: result.employerTotal,
          total: result.total,

          lines: result.lines,
          exclusions: result.exclusions,

          dueBy: result.remittance.dueBy,
          paidOn: result.remittance.paidOn,
          challanReference: req.body.challanReference || '',
          daysLate: result.remittance.daysLate,
          interest: result.remittance.interest,

          ruleId: rule._id,
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LWF_CONTRIBUTION_COMMITTED',
      resourceType: 'LabourWelfareFundContribution',
      resourceIds: [contribution._id],
      details: {
        state,
        period: contribution.periodLabel,
        total: contribution.total,
        liableCount: contribution.liableCount,
      },
      req,
    });

    return res.status(201).json({ contribution });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/labour-welfare-fund/contributions
 *
 * Without the per-employee lines. A year of contributions across six states on
 * a five-hundred-person tenant is several thousand embedded documents and the
 * list view needs none of them.
 */
exports.listContributions = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.state) filter.state = String(req.query.state).toUpperCase();
    if (req.query.outstanding === 'true') filter.paidOn = null;

    const contributions = await LabourWelfareFundContribution.find(
      filter,
      '-lines -exclusions',
    )
      .sort({ year: -1, month: -1, state: 1 })
      .limit(Math.min(Number(req.query.limit) || 60, 200))
      .lean();

    const outstanding = contributions.filter((c) => !c.paidOn);

    return res.json({
      contributions,
      summary: {
        total: contributions.length,
        outstanding: outstanding.length,
        outstandingAmount: outstanding.reduce((sum, c) => sum + c.total, 0),
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/labour-welfare-fund/contributions/:id/remittance
 *
 * Records the challan. The lateness is recomputed here rather than carried,
 * because until a payment date exists the interest on the register is an
 * estimate measured to today and it moves every day the contribution sits
 * unpaid.
 */
exports.recordRemittance = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid contribution id' });
    }

    const paidOn = req.body.paidOn ? new Date(req.body.paidOn) : new Date();
    if (Number.isNaN(paidOn.getTime())) {
      return res.status(400).json({ message: 'paidOn must be a valid date' });
    }

    const contribution = await LabourWelfareFundContribution.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    const rule = contribution.ruleId
      ? await LabourWelfareFundRule.findById(contribution.ruleId).lean()
      : null;

    const overdueMs = paidOn.getTime() - contribution.dueBy.getTime();
    const daysLate = overdueMs > 0 ? Math.floor(overdueMs / 86400000) : 0;

    const rate = rule ? Number(rule.lateInterestRate) || 0 : 0;

    contribution.paidOn = paidOn;
    contribution.challanReference = req.body.challanReference || '';
    contribution.daysLate = daysLate;
    contribution.interest =
      daysLate > 0 && rate > 0
        ? Math.round(((contribution.total * rate * daysLate) / 365) * 100) / 100
        : 0;

    await contribution.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LWF_REMITTANCE_RECORDED',
      resourceType: 'LabourWelfareFundContribution',
      resourceIds: [contribution._id],
      details: {
        state: contribution.state,
        period: contribution.periodLabel,
        paidOn: contribution.paidOn,
        daysLate: contribution.daysLate,
      },
      req,
    });

    return res.json({ contribution });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/labour-welfare-fund/contributions/:id/register
 *
 * The per-employee register as CSV. Each state prescribes its own form; the
 * common ground is the employee list with wages and amounts, which is what
 * every one of them asks for.
 */
exports.exportRegister = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid contribution id' });
    }

    const contribution = await LabourWelfareFundContribution.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    const header = [
      'Employee',
      'Designation',
      'State',
      'Wages',
      'Slab up to',
      'Employee contribution',
      'Employer contribution',
      'Total',
    ];

    // Quoted and doubled: a designation containing a comma would otherwise
    // shift every column after it.
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const rows = contribution.lines.map((line) =>
      [
        line.name,
        line.designation,
        line.state,
        line.wages,
        line.slabUpTo === null ? 'and above' : line.slabUpTo,
        line.employeeShare,
        line.employerShare,
        line.total,
      ]
        .map(escape)
        .join(','),
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LWF_REGISTER_EXPORTED',
      resourceType: 'LabourWelfareFundContribution',
      resourceIds: [contribution._id],
      details: { state: contribution.state, period: contribution.periodLabel },
      req,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lwf-${contribution.state.toLowerCase()}-${contribution.year}-${String(
        contribution.month,
      ).padStart(2, '0')}.csv"`,
    );

    return res.send([header.map(escape).join(','), ...rows].join('\n'));
  } catch (error) {
    return next(error);
  }
};
