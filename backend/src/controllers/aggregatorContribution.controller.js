/**
 * @fileoverview Code on Social Security, 2020, section 114 (#1829).
 *
 * The controller keeps two things apart that everything else in this product
 * would naturally join.
 *
 * **Turnover is stated, never derived.** There is no query that produces an
 * aggregator's turnover: the payout ledger holds what went out to workers,
 * which is a cost rather than revenue, and the invoice collections hold client
 * billing that is a different business. Deriving a turnover figure from either
 * would put a number under a statutory levy that is not the number the levy is
 * on. So the record is written by whoever holds the accounts, and the module
 * reports what it was given.
 *
 * **The worker register is keyed on the person, not the engagement.** This is
 * the harder discipline, because every other roll in the tree is keyed on a
 * relationship with this employer. A gig worker engaged by three platforms is
 * one beneficiary with one ninety-day clock, and each platform owes its own
 * contribution on its own turnover — so `recordWorker` merges engagements onto
 * a person and `listWorkers` returns people. An establishment that keyed this
 * on its own engagements would report every multi-platform worker as short of
 * the threshold, which is the commonest case in gig work rather than an edge
 * one.
 *
 * The controller also never writes a gig worker into `Employee`. Section 2(35)
 * puts them outside the employment relationship, and a reference into that
 * collection is the first place every headcount in the tree would silently
 * start including them — the failure #1771 spent a module avoiding.
 *
 * Everything that decides a rate, a limb or an eligibility is in
 * `utils/aggregatorContribution.js`.
 */

const mongoose = require('mongoose');

const {
  AggregatorRules,
  AggregatorTurnover,
  GigWorker,
  AggregatorAssessment,
} = require('../models/aggregatorContribution.model');
const {
  AGGREGATOR_RULES,
  AGGREGATOR_CATEGORY,
  assessAggregator,
} = require('../utils/aggregatorContribution');
const eventBus = require('../services/event.service');

/**
 * The rules for a tenant.
 *
 * Tenant-wide rather than per platform: the band and the ceiling come from the
 * Code, and a tenant operating two platforms is under one notification.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId) {
  const stored = await AggregatorRules.findOne({ tenantId }).lean();

  if (!stored) return { ...AGGREGATOR_RULES };

  return {
    ...AGGREGATOR_RULES,
    ...stored,
    // Stored as a Map; the engine reads a plain object.
    categoryRates: stored.categoryRates
      ? Object.fromEntries(stored.categoryRates)
      : {},
  };
}

/**
 * @param {object} query
 * @returns {number}
 */
function resolveFinancialYear(query) {
  const now = new Date();

  return (
    Number(query?.financialYear) ||
    (now.getUTCMonth() + 1 >= 4
      ? now.getUTCFullYear()
      : now.getUTCFullYear() - 1)
  );
}

/**
 * Only the categories the Seventh Schedule names.
 *
 * An unrecognised entry is dropped rather than kept, so it surfaces as
 * unattributed turnover — which is exactly what it is. Keeping it would let a
 * category with no notified rate silently contribute nothing while appearing to
 * have been accounted for.
 *
 * @param {*} raw
 * @returns {Array<object>}
 */
function sanitiseCategories(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry) => Object.hasOwn(AGGREGATOR_CATEGORY, entry?.category))
    .map((entry) => ({
      category: entry.category,
      turnover: Math.max(0, Number(entry.turnover) || 0),
      note: typeof entry.note === 'string' ? entry.note.trim() : '',
    }));
}

/**
 * Run the assessment for a platform and year without writing anything.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
async function buildAssessment({ tenantId, name, query }) {
  const financialYear = resolveFinancialYear(query);
  const rules = await resolveRules(tenantId);

  const turnover = await AggregatorTurnover.findOne({
    tenantId,
    name,
    financialYear,
  }).lean();

  const workers = await GigWorker.find({ tenantId }).lean();

  const result = assessAggregator({
    aggregator: {
      name,
      totalTurnover: turnover?.totalTurnover,
      byCategory: turnover?.byCategory,
      workerPayouts: turnover?.workerPayouts,
      deposited: turnover?.deposited,
      turnoverFinalised: turnover?.turnoverFinalised,
    },
    workers: workers.map((worker) => ({
      workerId: worker._id,
      name: worker.name,
      engagements: worker.engagements,
      registeredOn: worker.registeredOn,
    })),
    rules,
  });

  return { financialYear, name, rules, turnover: turnover || null, result };
}

/**
 * GET /api/aggregator-contribution/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({ rules: await resolveRules(req.tenantId) });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/aggregator-contribution/rules
 */
exports.updateRules = async (req, res, next) => {
  try {
    const update = {};
    const numeric = [
      'minRatePercent',
      'maxRatePercent',
      'defaultRatePercent',
      'payoutCeilingPercent',
      'registrationQualifyingDays',
      'lookbackMonths',
      'attributionTolerancePercent',
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

    if (req.body.categoryRates && typeof req.body.categoryRates === 'object') {
      const rates = {};
      for (const [category, rate] of Object.entries(req.body.categoryRates)) {
        // Only the Seventh Schedule's entries. An unrecognised key would sit in
        // the map and never be read, which reads as a silent no-op.
        if (!Object.hasOwn(AGGREGATOR_CATEGORY, category)) continue;

        const value = Number(rate);
        if (Number.isFinite(value) && value >= 0) rates[category] = value;
      }
      update.categoryRates = rates;
    }

    const rules = await AggregatorRules.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'AGGREGATOR_RULES_UPDATED',
      resourceType: 'AggregatorRules',
      resourceIds: [rules._id],
      details: {
        defaultRatePercent: rules.defaultRatePercent,
        payoutCeilingPercent: rules.payoutCeilingPercent,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/aggregator-contribution/turnover
 */
exports.listTurnover = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.financialYear) {
      filter.financialYear = resolveFinancialYear(req.query);
    }

    const turnover = await AggregatorTurnover.find(filter)
      .sort({ financialYear: -1, name: 1 })
      .lean();

    return res.json({ turnover });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/aggregator-contribution/turnover
 *
 * Audited, and behind its own permission. This is the base of the levy, it is
 * stated rather than derived from anything the product holds, and there is no
 * payroll figure anywhere to check it against — the same shape of authority as
 * MANAGE_COMPLIANCE, and for the same reason.
 */
exports.recordTurnover = async (req, res, next) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ message: 'A platform name is required' });
    }

    const financialYear = resolveFinancialYear(req.body);
    const name = String(req.body.name).trim();

    const before = await AggregatorTurnover.findOne({
      tenantId: req.tenantId,
      name,
      financialYear,
    }).lean();

    if (before?.turnoverFinalised && req.body.turnoverFinalised !== false) {
      // Once finalised the figure has been used to compute an assessed
      // contribution. Reopening it is a deliberate act rather than an edit.
      return res.status(409).json({
        message:
          'Turnover for this year has been finalised. Reopen it explicitly before revising.',
      });
    }

    const update = {};

    for (const field of ['totalTurnover', 'workerPayouts', 'deposited']) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ message: `${field} must be a number` });
        }
        update[field] = value;
      }
    }

    if (req.body.byCategory !== undefined) {
      update.byCategory = sanitiseCategories(req.body.byCategory);
    }

    if (req.body.turnoverFinalised !== undefined) {
      update.turnoverFinalised = req.body.turnoverFinalised === true;
      update.finalisedOn = update.turnoverFinalised ? new Date() : null;
    }

    const turnover = await AggregatorTurnover.findOneAndUpdate(
      { tenantId: req.tenantId, name, financialYear },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'AGGREGATOR_TURNOVER_RECORDED',
      resourceType: 'AggregatorTurnover',
      resourceIds: [turnover._id],
      details: {
        name: turnover.name,
        financialYear,
        from: before?.totalTurnover ?? null,
        to: turnover.totalTurnover,
        workerPayouts: turnover.workerPayouts,
      },
      req,
    });

    if (update.turnoverFinalised === true) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'AGGREGATOR_TURNOVER_FINALISED',
        resourceType: 'AggregatorTurnover',
        resourceIds: [turnover._id],
        details: {
          name: turnover.name,
          financialYear,
          totalTurnover: turnover.totalTurnover,
        },
        req,
      });
    }

    return res.json({ turnover });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/aggregator-contribution/workers
 *
 * Returns people, not engagements. See this file's header.
 */
exports.listWorkers = async (req, res, next) => {
  try {
    const workers = await GigWorker.find({ tenantId: req.tenantId })
      .sort({ name: 1 })
      .limit(1000)
      .lean();

    return res.json({ workers });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/aggregator-contribution/workers
 *
 * Merges engagements onto a person.
 *
 * Engagements on platforms the tenant does not own are recorded on the worker's
 * own statement, which is how the Code's registration works — and they are the
 * days that carry most multi-platform workers over the ninety. An
 * establishment counting only its own engagements would report them all as
 * short of the threshold.
 */
exports.recordWorker = async (req, res, next) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ message: 'A name is required' });
    }

    const engagements = Array.isArray(req.body.engagements)
      ? req.body.engagements.map((row) => ({
          aggregator:
            typeof row?.aggregator === 'string' ? row.aggregator.trim() : '',
          ownPlatform: row?.ownPlatform === true,
          days: Math.max(0, Number(row?.days) || 0),
          fromDate: row?.fromDate ? new Date(row.fromDate) : undefined,
          toDate: row?.toDate ? new Date(row.toDate) : undefined,
          payouts: Math.max(0, Number(row?.payouts) || 0),
        }))
      : [];

    const worker = await GigWorker.findOneAndUpdate(
      { tenantId: req.tenantId, name: String(req.body.name).trim() },
      {
        $set: {
          contactReference:
            typeof req.body.contactReference === 'string'
              ? req.body.contactReference.trim()
              : '',
          engagements,
          ...(req.body.registeredOn
            ? { registeredOn: new Date(req.body.registeredOn) }
            : {}),
          ...(typeof req.body.registrationNumber === 'string'
            ? { registrationNumber: req.body.registrationNumber.trim() }
            : {}),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    if (req.body.registeredOn) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'GIG_WORKER_REGISTERED',
        resourceType: 'GigWorker',
        resourceIds: [worker._id],
        details: {
          name: worker.name,
          registeredOn: worker.registeredOn,
          aggregatorCount: new Set(
            (worker.engagements || []).map((row) => row.aggregator),
          ).size,
        },
        req,
      });
    }

    return res.json({ worker });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/aggregator-contribution/assessment
 *
 * Writes nothing.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const name =
      typeof req.query.name === 'string' ? req.query.name.trim() : '';

    if (!name) {
      return res.status(400).json({ message: 'A platform name is required' });
    }

    return res.json(
      await buildAssessment({
        tenantId: req.tenantId,
        name,
        query: req.query,
      }),
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/aggregator-contribution/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await AggregatorAssessment.find({
      tenantId: req.tenantId,
    })
      .sort({ financialYear: -1, name: 1 })
      .limit(50)
      .select('-findings')
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/aggregator-contribution/assessments
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
      return res.status(400).json({ message: 'A platform name is required' });
    }

    const { financialYear, rules, result } = await buildAssessment({
      tenantId: req.tenantId,
      name,
      query: req.body,
    });

    const { contribution, accrual } = result;

    const assessment = await AggregatorAssessment.findOneAndUpdate(
      { tenantId: req.tenantId, name, financialYear },
      {
        $set: {
          rules,
          totalTurnover: contribution.attribution.totalTurnover,
          attributedTurnover: contribution.attribution.attributed,
          unattributedTurnover: contribution.attribution.unattributed,
          turnoverLimb: contribution.turnoverLimb,
          workerPayouts: contribution.workerPayouts,
          payoutCeiling: contribution.payoutCeiling,
          capped: contribution.capped,
          bindingLimb: contribution.bindingLimb,
          headroom: contribution.headroom,
          payable: contribution.payable,
          deposited: accrual.deposited,
          shortfall: accrual.shortfall,
          excess: accrual.excess,
          turnoverFinalised: accrual.turnoverFinalised,
          provisional: accrual.provisional,
          workerCount: result.workerCount,
          qualifyingCount: result.qualifyingCount,
          registeredCount: result.registeredCount,
          multiAggregatorCount: result.multiAggregatorCount,
          summary: result.summary,
          findings: result.findings,
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'AGGREGATOR_ASSESSMENT_COMMITTED',
      resourceType: 'AggregatorAssessment',
      resourceIds: [assessment._id],
      details: {
        name,
        financialYear,
        // Both limbs in the audit line, for the same reason they are both in
        // the record: which one bound is the fact worth recovering later.
        turnoverLimb: assessment.turnoverLimb,
        payoutCeiling: assessment.payoutCeiling,
        bindingLimb: assessment.bindingLimb,
        payable: assessment.payable,
        provisional: assessment.provisional,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};
