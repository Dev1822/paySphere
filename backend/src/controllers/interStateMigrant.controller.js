/**
 * @fileoverview Inter-State Migrant Workmen Act, 1979 (#1826).
 *
 * The controller's one interesting decision is what it declines to guess.
 *
 * Section 13(1)(b) needs the rate of *a local workman doing the same or similar
 * work*. The payroll roll holds a rate for every employee, so it is tempting to
 * pick the median of everybody sharing the migrant's designation and call that
 * the comparator. `suggestComparator` does compute that figure — and returns it
 * marked `suggested`, never written to the workman, because "same or similar
 * work" is a finding about what people actually do rather than about what their
 * designation string says. A site where the local fitters are on machine
 * maintenance and the migrants are on structural erection has two populations
 * with one designation, and a median across them would understate the parity
 * gap by exactly the amount that matters.
 *
 * So the comparator is recorded by a person, and where nobody has recorded one
 * the assessment says only the section 13(1)(a) floor was tested. An absent
 * comparator is reported as absent rather than as zero — see
 * `bindingWageRate`'s `comparatorRecorded`.
 *
 * The other decision is that the **return journey accrual** is a write of its
 * own rather than a side effect of recruiting. It is owed from recruitment and
 * the establishment has to say it has provided for it; inferring the accrual
 * from the existence of a recruitment record would make the finding
 * unfalsifiable, which is the opposite of what a register is for.
 *
 * Everything that decides a rate, an allowance or an exposure is in
 * `utils/interStateMigrant.js`.
 */

const mongoose = require('mongoose');

const {
  MigrantRules,
  MigrantWorkman,
  MigrantFacilityRegister,
  MigrantAssessment,
} = require('../models/interStateMigrant.model');
const Employee = require('../models/employee.model');
const {
  MIGRANT_RULES,
  FACILITY,
  JOURNEY_LEG,
  assessEstablishment,
} = require('../utils/interStateMigrant');
const eventBus = require('../services/event.service');

/**
 * The rules for an establishment.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId, establishment) {
  const stored = await MigrantRules.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  if (!stored) return { ...MIGRANT_RULES };

  return {
    ...MIGRANT_RULES,
    ...stored,
    requiredFacilities:
      Array.isArray(stored.requiredFacilities) &&
      stored.requiredFacilities.length
        ? stored.requiredFacilities
        : Object.values(FACILITY),
  };
}

/**
 * The period being assessed, defaulting to the current financial year.
 *
 * A financial year rather than a month: the section 4 threshold is worded on
 * "any day in the preceding twelve months", and the displacement allowance is a
 * once-per-recruitment event that a monthly window would keep re-reporting or
 * lose entirely depending on which month it fell in.
 *
 * @param {object} query
 * @returns {{periodStart: Date, periodEnd: Date, financialYear: number}}
 */
function resolvePeriod(query) {
  const now = new Date();

  const financialYear =
    Number(query?.financialYear) ||
    (now.getUTCMonth() + 1 >= 4
      ? now.getUTCFullYear()
      : now.getUTCFullYear() - 1);

  return {
    financialYear,
    periodStart: new Date(Date.UTC(financialYear, 3, 1)),
    periodEnd: new Date(Date.UTC(financialYear + 1, 2, 31)),
  };
}

/**
 * A workman row in the shape the engine reads.
 *
 * @param {object} row
 * @param {Date} asAt
 * @returns {object}
 */
function toEngineWorkman(row, asAt) {
  const legOf = (leg) =>
    (row.journeyLegs || []).find((entry) => entry.leg === leg) || null;

  const outward = legOf(JOURNEY_LEG.OUTWARD);
  const back = legOf(JOURNEY_LEG.RETURN);

  return {
    workmanId: row._id,
    name: row.name,
    trade: row.trade,
    homeState: row.homeState,
    hostState: row.hostState,

    rates: {
      homeStateRate: row.homeStateRate,
      hostStateRate: row.hostStateRate,
      // Passed through as-is, including null. The engine distinguishes an
      // absent comparator from a recorded zero and a `|| 0` here would erase
      // the distinction before it ever reached the code that draws it.
      localComparableRate: row.localComparableRate,
    },

    paidDailyRate: row.paidDailyRate,
    daysWorked: row.daysWorked,
    monthlyWages: row.monthlyWages,

    displacementPaid: row.displacementPaid,
    displacementRecovered: row.displacementRecovered,

    outwardFare: outward?.fare,
    outwardJourneyDays: outward?.journeyDays,
    outwardPaid: outward?.paid,
    returnFare: back?.fare,
    returnJourneyDays: back?.journeyDays,
    returnPaid: back?.paid,
    returnAccrued: row.returnAccrued,
    journeyWagesPaid: row.journeyWagesPaid,

    passbookIssuedOn: row.passbookIssuedOn,
    passbookUpdatedOn: row.passbookUpdatedOn,
    rateChangedOn: row.rateChangedOn,
    asAt,
  };
}

/**
 * The highest migrant headcount on any day in the period.
 *
 * Sections 4 and 8 are worded on "any day", so a site that ran twelve migrants
 * in March and two today is inside the Act — and the count that matters is the
 * peak rather than the closing number. Computed from the recruitment and
 * release dates rather than from the roll size, which would answer "today".
 *
 * @param {Array<object>} rows
 * @param {object} period
 * @returns {number}
 */
function migrantPeak(rows, period) {
  const events = [];

  for (const row of rows) {
    const from = row.recruitedOn
      ? new Date(row.recruitedOn)
      : period.periodStart;
    const to = row.releasedOn ? new Date(row.releasedOn) : period.periodEnd;

    if (to < period.periodStart || from > period.periodEnd) continue;

    events.push({
      at: from < period.periodStart ? period.periodStart : from,
      delta: 1,
    });
    events.push({
      at: to > period.periodEnd ? period.periodEnd : to,
      delta: -1,
    });
  }

  // A release on the same day as a recruitment should not net to nothing: the
  // Act counts a workman employed on that day, so the +1 is applied first.
  events.sort((a, b) => a.at - b.at || b.delta - a.delta);

  let running = 0;
  let peak = 0;

  for (const event of events) {
    running += event.delta;
    if (running > peak) peak = running;
  }

  return peak;
}

/**
 * Run the assessment for a period without writing anything.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
async function buildAssessment({ tenantId, establishment, query }) {
  const period = resolvePeriod(query || {});
  const rules = await resolveRules(tenantId, establishment);
  const asAt = query?.asAt ? new Date(query.asAt) : period.periodEnd;

  const rows = await MigrantWorkman.find({
    tenantId,
    establishment: establishment || '',
    recruitedOn: { $lte: period.periodEnd },
    $or: [{ releasedOn: null }, { releasedOn: { $gte: period.periodStart } }],
  }).lean();

  const facilities = await MigrantFacilityRegister.find({
    tenantId,
    establishment: establishment || '',
  }).lean();

  const registration = await MigrantRules.findOne({
    tenantId,
    establishment: establishment || '',
  })
    .select('registeredUnderSection4')
    .lean();

  const result = assessEstablishment({
    workmen: rows.map((row) => toEngineWorkman(row, asAt)),
    applicability: {
      migrantPeak: migrantPeak(rows, period),
      registered: registration?.registeredUnderSection4 === true,
      contractors: [],
    },
    facilities,
    rules,
  });

  return { period, establishment, rules, result };
}

/**
 * The median rate of employees sharing a trade, as a *suggestion*.
 *
 * Deliberately not written anywhere. See this file's header: "same or similar
 * work" is a finding about what people do, and a designation string is not that
 * finding. Offering the number is useful; recording it as the comparator would
 * put an unexamined median under a statutory entitlement.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} trade
 * @param {number} daysPerMonth
 * @returns {Promise<object|null>}
 */
async function suggestComparator(tenantId, trade, daysPerMonth) {
  if (!trade) return null;

  const peers = await Employee.find({
    tenantId,
    designation: new RegExp(
      `^${trade.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    ),
  })
    .select('salary')
    .lean();

  const monthly = peers
    .map((peer) => Number(peer?.salary?.basic ?? peer?.salary ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!monthly.length) return null;

  const middle = Math.floor(monthly.length / 2);
  const median =
    monthly.length % 2 === 0
      ? (monthly[middle - 1] + monthly[middle]) / 2
      : monthly[middle];

  return {
    trade,
    peerCount: monthly.length,
    medianMonthly: Math.round(median * 100) / 100,
    medianDaily: Math.round((median / (daysPerMonth || 26)) * 100) / 100,
    suggested: true,
  };
}

/**
 * GET /api/migrant-workmen/rules
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
 * PUT /api/migrant-workmen/rules
 */
exports.updateRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const update = {};
    const numeric = [
      'registrationThreshold',
      'licensingThreshold',
      'displacementPercent',
      'displacementFloor',
      'passbookRefreshDays',
      'daysPerMonth',
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

    if (req.body.journeyWagesPayable !== undefined) {
      update.journeyWagesPayable = req.body.journeyWagesPayable === true;
    }

    if (req.body.registeredUnderSection4 !== undefined) {
      update.registeredUnderSection4 =
        req.body.registeredUnderSection4 === true;
    }

    if (Array.isArray(req.body.requiredFacilities)) {
      // Only the facilities section 16 names. An unrecognised entry would sit
      // in the array and never be assessed, which reads as a silent no-op.
      update.requiredFacilities = req.body.requiredFacilities.filter((entry) =>
        Object.prototype.hasOwnProperty.call(FACILITY, entry),
      );
    }

    const rules = await MigrantRules.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MIGRANT_RULES_UPDATED',
      resourceType: 'MigrantRules',
      resourceIds: [rules._id],
      details: {
        establishment: establishment || '(default)',
        registrationThreshold: rules.registrationThreshold,
        displacementPercent: rules.displacementPercent,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/migrant-workmen/workmen
 */
exports.listWorkmen = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };

    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }
    if (typeof req.query.trade === 'string' && req.query.trade.trim()) {
      filter.trade = req.query.trade.trim();
    }

    const workmen = await MigrantWorkman.find(filter)
      .sort({ recruitedOn: -1 })
      .limit(500)
      .lean();

    return res.json({ workmen });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/migrant-workmen/workmen
 *
 * Audited. Recruitment across a state boundary is what brings the Act into
 * play at all, and it is the moment the displacement allowance and both
 * journey legs become owed.
 */
exports.createWorkman = async (req, res, next) => {
  try {
    const { name, homeState, hostState, recruitedOn } = req.body;

    if (!name || !homeState || !hostState) {
      return res.status(400).json({
        message: 'A name, a home state and a host state are required',
      });
    }

    if (String(homeState).trim() === String(hostState).trim()) {
      // Not a migrant workman under section 2(1)(e), and recording one here
      // would put a person outside the Act into every assessment it produces.
      return res.status(400).json({
        message:
          'The home and host states are the same, so section 2(1)(e) is not met',
      });
    }

    const workman = await MigrantWorkman.create({
      tenantId: req.tenantId,
      establishment:
        typeof req.body.establishment === 'string'
          ? req.body.establishment.trim()
          : '',
      name: String(name).trim(),
      trade: typeof req.body.trade === 'string' ? req.body.trade.trim() : '',
      homeState: String(homeState).trim(),
      hostState: String(hostState).trim(),
      contractorId: mongoose.isValidObjectId(req.body.contractorId)
        ? req.body.contractorId
        : undefined,
      recruitedOn: recruitedOn ? new Date(recruitedOn) : new Date(),
      homeStateRate: Number(req.body.homeStateRate) || 0,
      hostStateRate: Number(req.body.hostStateRate) || 0,
      localComparableRate:
        req.body.localComparableRate === undefined ||
        req.body.localComparableRate === null
          ? null
          : Number(req.body.localComparableRate),
      localComparableTrade:
        typeof req.body.localComparableTrade === 'string'
          ? req.body.localComparableTrade.trim()
          : '',
      paidDailyRate: Number(req.body.paidDailyRate) || 0,
      daysWorked: Number(req.body.daysWorked) || 0,
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MIGRANT_WORKMAN_RECRUITED',
      resourceType: 'MigrantWorkman',
      resourceIds: [workman._id],
      details: {
        name: workman.name,
        homeState: workman.homeState,
        hostState: workman.hostState,
        recruitedOn: workman.recruitedOn,
      },
      req,
    });

    return res.status(201).json({ workman });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/migrant-workmen/workmen/:id/comparator
 *
 * Its own endpoint, and audited, because this one number decides whether the
 * establishment is measured against a notified schedule or against the person
 * standing next to the workman — and lowering it makes a section 13(1)(b)
 * breach disappear without a rupee changing hands.
 */
exports.recordComparator = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid workman id' });
    }

    const rate =
      req.body.localComparableRate === null
        ? null
        : Number(req.body.localComparableRate);

    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
      return res
        .status(400)
        .json({ message: 'localComparableRate must be a number or null' });
    }

    const before = await MigrantWorkman.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!before) return res.status(404).json({ message: 'Workman not found' });

    const workman = await MigrantWorkman.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        $set: {
          localComparableRate: rate,
          localComparableTrade:
            typeof req.body.localComparableTrade === 'string'
              ? req.body.localComparableTrade.trim()
              : before.localComparableTrade,
        },
      },
      { new: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MIGRANT_COMPARATOR_RECORDED',
      resourceType: 'MigrantWorkman',
      resourceIds: [workman._id],
      details: {
        name: workman.name,
        from: before.localComparableRate,
        to: workman.localComparableRate,
        trade: workman.localComparableTrade,
      },
      req,
    });

    return res.json({ workman });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/migrant-workmen/workmen/:id/comparator-suggestion
 */
exports.getComparatorSuggestion = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid workman id' });
    }

    const workman = await MigrantWorkman.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!workman) return res.status(404).json({ message: 'Workman not found' });

    const rules = await resolveRules(req.tenantId, workman.establishment);

    return res.json({
      suggestion: await suggestComparator(
        req.tenantId,
        workman.localComparableTrade || workman.trade,
        rules.daysPerMonth,
      ),
      // Stated in the payload rather than only in the docs, because a caller
      // reading a median off an endpoint will otherwise treat it as an answer.
      note: 'A median across a designation is not a section 13(1)(b) comparator. "Same or similar work" is a finding about what people do, and it has to be recorded by a person.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/migrant-workmen/workmen/:id/allowances
 *
 * Records what was actually paid under sections 14 and 15.
 */
exports.recordAllowances = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid workman id' });
    }

    const update = {};

    for (const field of [
      'displacementPaid',
      'displacementRecovered',
      'journeyWagesPaid',
    ]) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ message: `${field} must be a number` });
        }
        update[field] = value;
      }
    }

    if (req.body.displacementPaidOn) {
      update.displacementPaidOn = new Date(req.body.displacementPaidOn);
    }

    if (Array.isArray(req.body.journeyLegs)) {
      update.journeyLegs = req.body.journeyLegs
        .filter((leg) =>
          Object.prototype.hasOwnProperty.call(JOURNEY_LEG, leg?.leg),
        )
        .map((leg) => ({
          leg: leg.leg,
          fare: Math.max(0, Number(leg.fare) || 0),
          journeyDays: Math.max(0, Number(leg.journeyDays) || 0),
          paid: Math.max(0, Number(leg.paid) || 0),
          paidOn: leg.paidOn ? new Date(leg.paidOn) : undefined,
        }));
    }

    const workman = await MigrantWorkman.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: update },
      { new: true },
    );

    if (!workman) return res.status(404).json({ message: 'Workman not found' });

    // Audited only where it happened. A recovery against a payment section 14
    // makes non-refundable is the one write in this controller that takes money
    // back from a workman, and it should never be a quiet field update.
    if (Number(update.displacementRecovered) > 0) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'MIGRANT_DISPLACEMENT_RECOVERED',
        resourceType: 'MigrantWorkman',
        resourceIds: [workman._id],
        details: {
          name: workman.name,
          recovered: workman.displacementRecovered,
        },
        req,
      });
    }

    return res.json({ workman });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/migrant-workmen/workmen/:id/return-accrual
 *
 * Its own write, deliberately. The return fare is owed from recruitment, and
 * inferring the accrual from the existence of a recruitment record would make
 * the finding unfalsifiable — every workman would look provided for.
 */
exports.accrueReturnJourney = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid workman id' });
    }

    const fare = Number(req.body.returnFare);
    const journeyDays = Number(req.body.returnJourneyDays);

    const workman = await MigrantWorkman.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!workman) return res.status(404).json({ message: 'Workman not found' });

    const legs = (workman.journeyLegs || []).filter(
      (leg) => leg.leg !== JOURNEY_LEG.RETURN,
    );

    const outward = (workman.journeyLegs || []).find(
      (leg) => leg.leg === JOURNEY_LEG.OUTWARD,
    );

    legs.push({
      leg: JOURNEY_LEG.RETURN,
      // Symmetric with the outward leg where nothing was stated, which is the
      // engine's presumption too.
      fare: Number.isFinite(fare) && fare >= 0 ? fare : outward?.fare || 0,
      journeyDays:
        Number.isFinite(journeyDays) && journeyDays >= 0
          ? journeyDays
          : outward?.journeyDays || 0,
      paid: 0,
    });

    workman.journeyLegs = legs;
    workman.returnAccrued = true;
    await workman.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MIGRANT_RETURN_JOURNEY_ACCRUED',
      resourceType: 'MigrantWorkman',
      resourceIds: [workman._id],
      details: {
        name: workman.name,
        returnFare: legs[legs.length - 1].fare,
      },
      req,
    });

    return res.json({ workman });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/migrant-workmen/facilities
 */
exports.listFacilities = async (req, res, next) => {
  try {
    const facilities = await MigrantFacilityRegister.find({
      tenantId: req.tenantId,
      establishment:
        typeof req.query.establishment === 'string'
          ? req.query.establishment.trim()
          : '',
    }).lean();

    return res.json({ facilities });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/migrant-workmen/facilities
 */
exports.recordFacility = async (req, res, next) => {
  try {
    const { facility } = req.body;

    if (!Object.prototype.hasOwnProperty.call(FACILITY, facility)) {
      return res.status(400).json({
        message: `facility must be one of ${Object.keys(FACILITY).join(', ')}`,
      });
    }

    const substituteCost = Number(req.body.substituteCost);

    const record = await MigrantFacilityRegister.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        establishment:
          typeof req.body.establishment === 'string'
            ? req.body.establishment.trim()
            : '',
        facility,
      },
      {
        $set: {
          provided: req.body.provided === true,
          substituteCost:
            Number.isFinite(substituteCost) && substituteCost >= 0
              ? substituteCost
              : 0,
          notes:
            typeof req.body.notes === 'string' ? req.body.notes.trim() : '',
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.json({ facility: record });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/migrant-workmen/assessment
 *
 * Writes nothing. The parity position is a standing one and the roll moves
 * under it.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const establishment =
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '';

    return res.json(
      await buildAssessment({
        tenantId: req.tenantId,
        establishment,
        query: req.query,
      }),
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/migrant-workmen/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await MigrantAssessment.find({ tenantId: req.tenantId })
      .sort({ periodStart: -1 })
      .limit(50)
      .select('-findings -workmen')
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/migrant-workmen/assessments
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const { period, rules, result } = await buildAssessment({
      tenantId: req.tenantId,
      establishment,
      query: req.body,
    });

    const assessment = await MigrantAssessment.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        establishment,
        periodStart: period.periodStart,
      },
      {
        $set: {
          periodEnd: period.periodEnd,
          rules,
          applicable: result.applicable,
          migrantPeak: result.applicability.migrantPeak,
          registered: result.applicability.registered,
          workmanCount: result.workmanCount,
          wageArrears: result.wageArrears,
          parityOnlyCount: result.parityOnlyCount,
          displacementDue: result.displacementDue,
          displacementShortfall: result.displacementShortfall,
          journeyDue: result.journeyDue,
          journeyOutstanding: result.journeyOutstanding,
          facilityExposure: result.facilityExposure,
          outstanding: result.outstanding,
          summary: result.summary,
          findings: result.findings,
          workmen: result.workmen.map((row) => ({
            workmanId: row.workmanId,
            name: row.name,
            trade: row.trade,
            homeState: row.homeState,
            hostState: row.hostState,
            bindingRate: row.parity.binding.rate,
            bindingBasis: row.parity.binding.basis,
            statutoryFloor: row.parity.binding.floor,
            paidDailyRate: row.parity.paidDailyRate,
            floorGap: row.parity.floorGap,
            parityGap: row.parity.parityGap,
            wageArrears: row.parity.arrears,
            displacementDue: row.displacement.due,
            displacementShortfall: row.displacement.shortfall,
            journeyDue: row.journey.due,
            journeyOutstanding: row.journey.outstanding,
            returnAccrued: row.journey.legs[1]?.accrued === true,
            passbookIssued: row.passbook.issued,
            passbookStale: row.passbook.stale,
            outstanding: row.outstanding,
          })),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MIGRANT_ASSESSMENT_COMMITTED',
      resourceType: 'MigrantAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: establishment || '(default)',
        financialYear: period.financialYear,
        wageArrears: assessment.wageArrears,
        parityOnlyCount: assessment.parityOnlyCount,
        outstanding: assessment.outstanding,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};

// Exported for the controller's own suite: the peak is the only non-trivial
// derivation here and it is easier to test directly than through four writes.
exports._migrantPeak = migrantPeak;
