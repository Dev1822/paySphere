/**
 * @fileoverview Gratuity actuarial assumptions and valuations (#1344).
 *
 * The controller is deliberately thin. Everything that decides a number lives
 * in `utils/gratuityValuation.js`, which touches no database — so the parts an
 * auditor would question are testable without one, and this file is left with
 * the three jobs it should have: fetch the workforce, scope it to the tenant,
 * and decide what gets persisted.
 *
 * The one piece of real judgement here is which employees go into a valuation.
 * A defined benefit obligation is measured over the people still accruing a
 * benefit, so leavers are out — their gratuity has stopped being an obligation
 * and become a payment, which is `settlement.js`'s business. Getting that
 * wrong double-counts every exit in the year.
 */

const mongoose = require('mongoose');

const {
  GratuityAssumption,
  GratuityValuation,
} = require('../models/gratuityValuation.model');
const Employee = require('../models/employee.model');
const {
  DEFAULT_ASSUMPTIONS,
  buildValuationReport,
  computeEmployeeObligation,
  normaliseAssumptions,
} = require('../utils/gratuityValuation');
const eventBus = require('../services/event.service');

/**
 * A caller-supplied reporting date, falling back to today.
 *
 * @param {string|undefined} raw
 * @returns {Date}
 */
function resolveValuationDate(raw) {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * The workforce a valuation is measured over.
 *
 * Active employees only, and only the fields the engine reads. Projecting the
 * query rather than pulling whole documents matters more here than in a typical
 * list endpoint: this runs over the entire headcount, and the engine has no use
 * for addresses, bank details or the exit block.
 *
 * @param {string} tenantId
 * @returns {Promise<Array<object>>}
 */
async function activeWorkforce(tenantId) {
  const rows = await Employee.find(
    { tenantId, isActive: true },
    'fullName department joiningDate dateOfBirth monthlySalary',
  ).lean();

  return rows.map((row) => ({
    employeeId: row._id,
    name: row.fullName,
    department: row.department,
    joiningDate: row.joiningDate,
    dateOfBirth: row.dateOfBirth,
    monthlySalary: row.monthlySalary,
  }));
}

/**
 * The tenant's current assumptions, creating the default set on first read.
 *
 * Upsert rather than "return the defaults if absent": the assumptions are a
 * disclosed judgement, and the first valuation a tenant runs should be run
 * against a row somebody can then edit, not against constants that appear to
 * have come from nowhere.
 *
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
async function loadAssumptions(tenantId) {
  return GratuityAssumption.findOneAndUpdate(
    { tenantId },
    { $setOnInsert: { tenantId, assumptions: { ...DEFAULT_ASSUMPTIONS } } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

/**
 * Strip a stored assumption sub-document down to the plain object the engine
 * expects.
 *
 * Mongoose hands back a document with its own machinery attached, and spreading
 * that into `normaliseAssumptions` would carry `$__`, `_doc` and friends into
 * the snapshot that gets written back. Harmless until somebody diffs two
 * valuations and finds the noise.
 *
 * @param {object|null|undefined} stored
 * @returns {object}
 */
function plainAssumptions(stored) {
  const source = stored || {};

  return Object.keys(DEFAULT_ASSUMPTIONS).reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});
}

/**
 * The most recent committed valuation strictly before a date.
 *
 * Strictly before, because re-running the same reporting date must roll forward
 * from the *prior* year and not from the row it is about to replace. Rolling
 * forward from itself produces an opening balance equal to the closing one and
 * an actuarial gain that exactly cancels the service cost — a plausible-looking
 * table of numbers that means nothing.
 *
 * @param {string} tenantId
 * @param {Date} valuationDate
 * @returns {Promise<object|null>}
 */
async function priorValuation(tenantId, valuationDate) {
  return GratuityValuation.findOne({
    tenantId,
    valuationDate: { $lt: valuationDate },
  })
    .sort({ valuationDate: -1 })
    .lean();
}

/**
 * Assemble the `prior` block the engine's roll-forward needs.
 *
 * @param {object|null} previous
 * @returns {object}
 */
function priorBlock(previous) {
  if (!previous) return {};

  return {
    definedBenefitObligation: previous.definedBenefitObligation,
    currentServiceCost: previous.currentServiceCost,
    discountRate: previous.assumptions?.discountRate,
    assumptions: plainAssumptions(previous.assumptions),
  };
}

/**
 * GET /api/gratuity/assumptions
 */
exports.getAssumptions = async (req, res, next) => {
  try {
    const record = await loadAssumptions(req.tenantId);

    return res.json({
      assumptions: record.assumptions,
      basisNote: record.basisNote || '',
      defaults: DEFAULT_ASSUMPTIONS,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/gratuity/assumptions
 *
 * Validated through the engine's own `normaliseAssumptions` before it reaches
 * Mongoose. The schema has the same bounds on it, but a schema violation
 * surfaces as a ValidationError naming a path, and a discount rate of -1 is
 * better reported as what it is: a number that would make the valuation divide
 * by zero.
 */
exports.updateAssumptions = async (req, res, next) => {
  try {
    let assumptions;

    try {
      assumptions = normaliseAssumptions(
        plainAssumptions(req.body.assumptions),
      );
    } catch (error) {
      if (error instanceof RangeError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }

    const record = await GratuityAssumption.findOneAndUpdate(
      {},
      {
        $set: {
          assumptions,
          basisNote: req.body.basisNote || '',
          updatedBy: req.userId
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
      action: 'GRATUITY_ASSUMPTIONS_UPDATED',
      resourceType: 'GratuityAssumption',
      resourceIds: [record._id],
      details: { assumptions },
      req,
    });

    return res.json({
      message: 'Assumptions saved',
      assumptions: record.assumptions,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/gratuity/preview
 *
 * Runs the valuation and persists nothing.
 *
 * This is the endpoint finance actually uses, and it is the reason the
 * assumptions are overridable per call: "what does the provision look like if
 * the discount rate lands at 6.9%" is a question asked several times before
 * anybody commits to an answer, and each attempt must not leave a row behind.
 */
exports.previewValuation = async (req, res, next) => {
  try {
    const stored = await loadAssumptions(req.tenantId);
    const valuationDate = resolveValuationDate(req.body.valuationDate);

    let assumptions;
    try {
      assumptions = normaliseAssumptions({
        ...plainAssumptions(stored.assumptions),
        ...plainAssumptions(req.body.assumptions),
      });
    } catch (error) {
      if (error instanceof RangeError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }

    const workforce = await activeWorkforce(req.tenantId);

    if (workforce.length === 0) {
      return res.status(400).json({
        message:
          'No active employees to value. A gratuity obligation is measured over the people still accruing one.',
      });
    }

    const previous = await priorValuation(req.tenantId, valuationDate);

    const report = buildValuationReport(workforce, {
      valuationDate,
      assumptions,
      prior: priorBlock(previous),
      benefitsPaid: Number(req.body.benefitsPaid) || 0,
      pastServiceCost: Number(req.body.pastServiceCost) || 0,
      openingPlanAssets: Number(req.body.openingPlanAssets) || 0,
      contributions: Number(req.body.contributions) || 0,
      actualClosingPlanAssets:
        req.body.actualClosingPlanAssets === undefined
          ? undefined
          : Number(req.body.actualClosingPlanAssets),
    });

    return res.json({
      preview: true,
      priorValuationDate: previous ? previous.valuationDate : null,
      report,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/gratuity/valuations
 *
 * Commits a valuation as at a reporting date.
 *
 * Upsert on (tenant, valuationDate) rather than insert: re-running March
 * because the headcount extract was wrong should correct March, not produce a
 * second March that disagrees with the first.
 */
exports.commitValuation = async (req, res, next) => {
  try {
    const stored = await loadAssumptions(req.tenantId);
    const valuationDate = resolveValuationDate(req.body.valuationDate);

    let assumptions;
    try {
      assumptions = normaliseAssumptions({
        ...plainAssumptions(stored.assumptions),
        ...plainAssumptions(req.body.assumptions),
      });
    } catch (error) {
      if (error instanceof RangeError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }

    const workforce = await activeWorkforce(req.tenantId);

    if (workforce.length === 0) {
      return res.status(400).json({
        message:
          'No active employees to value. A gratuity obligation is measured over the people still accruing one.',
      });
    }

    const previous = await priorValuation(req.tenantId, valuationDate);

    const report = buildValuationReport(workforce, {
      valuationDate,
      assumptions,
      prior: priorBlock(previous),
      benefitsPaid: Number(req.body.benefitsPaid) || 0,
      pastServiceCost: Number(req.body.pastServiceCost) || 0,
      openingPlanAssets: Number(req.body.openingPlanAssets) || 0,
      contributions: Number(req.body.contributions) || 0,
      actualClosingPlanAssets:
        req.body.actualClosingPlanAssets === undefined
          ? undefined
          : Number(req.body.actualClosingPlanAssets),
    });

    const valuation = await GratuityValuation.findOneAndUpdate(
      {
        valuationDate
      },
      {
        $set: {
          valuationDate,
          periodLabel: req.body.periodLabel || '',
          assumptions: report.assumptions,
          basisNote: req.body.basisNote || stored.basisNote || '',
          headcountValued: report.headcountValued,
          headcountSkipped: report.headcountSkipped,
          recordsWithAssumedAge: report.recordsWithAssumedAge,
          definedBenefitObligation: report.definedBenefitObligation,
          currentServiceCost: report.currentServiceCost,
          vestedObligation: report.vestedObligation,
          unvestedObligation: report.unvestedObligation,
          expenseForPeriod: report.expenseForPeriod,
          rollForward: report.rollForward,

          fundedStatus: {
            ...report.fundedStatus,
            openingPlanAssets: Number(req.body.openingPlanAssets) || 0,
            contributions: Number(req.body.contributions) || 0,
          },

          sensitivities: report.sensitivities,
          schedule: report.schedule,
          skipped: report.skipped,
          createdBy: req.userId
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
      action: 'GRATUITY_VALUATION_COMMITTED',
      resourceType: 'GratuityValuation',
      resourceIds: [valuation._id],
      details: {
        valuationDate,
        definedBenefitObligation: valuation.definedBenefitObligation,
        headcountValued: valuation.headcountValued,
      },
      req,
    });

    return res.status(201).json({ message: 'Valuation committed', valuation });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/gratuity/valuations
 *
 * The schedule is excluded. It is one row per employee and the history list is
 * a page of headline figures — sending ten years of full schedules to render a
 * table of ten numbers is the difference between a fast page and a slow one.
 */
exports.listValuations = async (req, res, next) => {
  try {
    const valuations = await GratuityValuation.find({})
      .select('-schedule -skipped')
      .sort({ valuationDate: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 100))
      .lean();

    return res.json({ count: valuations.length, valuations });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/gratuity/valuations/:id
 */
exports.getValuation = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid valuation id' });
    }

    // Scoped by tenant in the query rather than checked after the fetch: a
    // findById followed by a comparison is the shape #1010 found leaking rows
    // across tenants, because the comparison is easy to forget and nothing
    // fails when it is.
    const valuation = await GratuityValuation.findOne({
      _id: req.params.id
    }).lean();

    if (!valuation) {
      return res.status(404).json({ message: 'Valuation not found' });
    }

    return res.json({ valuation });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/gratuity/employees/:employeeId
 *
 * One employee's contribution to the obligation, computed live.
 *
 * Live rather than read off the last committed schedule, because the question
 * this answers is "what is this person carrying today" — usually asked when
 * somebody is about to leave and finance wants to know what the provision
 * release looks like.
 */
exports.getEmployeeObligation = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const employee = await Employee.findOne({
      _id: req.params.employeeId
    })
      .select('fullName department joiningDate dateOfBirth monthlySalary')
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const stored = await loadAssumptions(req.tenantId);
    const assumptions = normaliseAssumptions(
      plainAssumptions(stored.assumptions),
    );
    const valuationDate = resolveValuationDate(req.query.asOf);

    const obligation = computeEmployeeObligation(
      {
        employeeId: employee._id,
        name: employee.fullName,
        department: employee.department,
        joiningDate: employee.joiningDate,
        dateOfBirth: employee.dateOfBirth,
        monthlySalary: employee.monthlySalary,
      },
      valuationDate,
      assumptions,
    );

    if (!obligation) {
      return res.status(422).json({
        message:
          'This employee cannot be valued — a joining date and a monthly salary are both required',
      });
    }

    return res.json({ valuationDate, assumptions, obligation });
  } catch (error) {
    return next(error);
  }
};
