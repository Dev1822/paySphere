/**
 * @fileoverview Industrial Employment (Standing Orders) Act, 1946 (#2029).
 *
 * Four decisions carry this controller.
 *
 * **It raises applicability from the headcount itself.** `syncHeadcount` reads
 * the establishment's strength, appends it to the history, and — where it is the
 * first crossing of the state's threshold — writes `applicableFrom` **dated from
 * that day**. The six-month clock starts on an ordinary hire that
 * `employee.controller.js` makes without knowing it has started anything, and
 * dating it from now would turn six months that have been running since March
 * into six months starting today.
 *
 * **It never unsets `applicableFrom`.** The proviso to section 1(3) keeps the
 * Act applying however far strength later falls, so the write is one-way. This
 * is the single line in the module that a well-meaning "recompute from current
 * state" refactor would break, and it is why applicability is stored rather than
 * derived on read.
 *
 * **It reports the Model Standing Orders as governing, never "none".** Section
 * 12A means an uncertified establishment is bound by a real set of terms it has
 * probably not read, and a screen saying "no standing orders" is wrong in the
 * direction that matters. `getPosition` and the queue both return an instrument
 * for every applicable establishment.
 *
 * **It records the dispatch date, not the certificate date.** `recordCertification`
 * takes `authenticatedCopiesSentOn` under section 5(3) and refuses to compute an
 * operation date without it. `certifiedOn` is stored and deliberately not used
 * for the section 7 arithmetic — it is routinely weeks earlier, and using it
 * would bring the orders into force before they bind anybody.
 *
 * Everything that decides a threshold, a window or an instrument is in
 * `utils/standingOrders.js`.
 */

const mongoose = require('mongoose');

const {
  StandingOrdersEstablishment,
  CertifiedStandingOrders,
  StandingOrdersModification,
} = require('../models/standingOrders.model');
const Employee = require('../models/employee.model');
const {
  SCHEDULE_MATTERS,
  ORDERS_STATE,
  INSTRUMENT,
  MODIFICATION_VERDICT,
  STATE_RULES,
  ONCE_APPLICABLE_ALWAYS_APPLICABLE,
  UNCERTIFIED_IS_NOT_UNREGULATED,
  MODIFICATION_BAR_IS_UNILATERAL,
  OPERATION_LAGS_CERTIFICATION,
  resolveRules,
  assessModification,
  assessEstablishment,
  instrumentForMatter,
} = require('../utils/standingOrders');
const eventBus = require('../services/event.service');

function readDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The engine's view of a stored establishment and its sets.
 *
 * `current` is the highest revision and `previous` the one below it — not "the
 * one in force" and "the one before". Which of the two is actually governing is
 * the engine's question, and answering it here would put the section 7 lag in
 * two places.
 *
 * @param {object} establishment
 * @param {Array<object>} sets
 * @returns {object}
 */
function shapeEstablishment(establishment, sets) {
  const ordered = [...(sets || [])].sort((a, b) => b.revision - a.revision);

  return {
    name: establishment.establishment,
    state: establishment.state,
    headcountHistory: establishment.headcountHistory || [],
    draftSubmittedOn: establishment.draftSubmittedOn,
    current: ordered[0] || null,
    previous: ordered[1] || null,
  };
}

/**
 * GET /api/standing-orders/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      states: STATE_RULES,
      schedule: SCHEDULE_MATTERS,
      ordersStates: ORDERS_STATE,
      instruments: INSTRUMENT,
      modificationVerdicts: MODIFICATION_VERDICT,
      notes: {
        onceApplicableAlwaysApplicable: ONCE_APPLICABLE_ALWAYS_APPLICABLE,
        uncertifiedIsNotUnregulated: UNCERTIFIED_IS_NOT_UNREGULATED,
        modificationBarIsUnilateral: MODIFICATION_BAR_IS_UNILATERAL,
        operationLagsCertification: OPERATION_LAGS_CERTIFICATION,
      },
      note: 'The applicability threshold is 100 in the central sphere and 50 in several states. A state not listed here has no rules on file rather than default ones — defaulting to 100 would tell an employer with 60 workmen in a 50-threshold state that no obligation had started.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/standing-orders/establishments
 */
exports.recordEstablishment = async (req, res, next) => {
  try {
    const establishment = String(req.body.establishment || '').trim();
    if (!establishment) {
      return res.status(400).json({ message: 'establishment is required' });
    }

    const state = String(req.body.state || '')
      .trim()
      .toUpperCase();
    const rules = resolveRules(state);
    if (!state) {
      return res.status(400).json({ message: 'state is required' });
    }

    const row = await StandingOrdersEstablishment.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      {
        $set: {
          state,
          draftSubmittedOn: readDate(req.body.draftSubmittedOn),
          certifyingOfficer: String(req.body.certifyingOfficer || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'STANDING_ORDERS_ESTABLISHMENT_RECORDED',
      resourceType: 'StandingOrdersEstablishment',
      resourceIds: [row._id],
      details: {
        establishment,
        state,
        // Named because it is the figure everything hangs off and it differs by
        // a factor of two between states.
        applicabilityThreshold: rules ? rules.applicabilityThreshold : null,
        draftSubmittedOn: row.draftSubmittedOn,
      },
      req,
    });

    return res.status(201).json({
      establishment: row,
      rules,
      note: rules
        ? null
        : `No rules are on file for ${state}. Applicability, the six-month window and the section 10 bar cannot be computed until they are, and defaulting the threshold would tell you the Act does not apply when it may.`,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/standing-orders/establishments/:id/headcount
 *
 * Appends today's strength to the history and, where it is the first crossing,
 * dates applicability from it. The write to `applicableFrom` is one-way: see the
 * header on why a recompute would take an establishment out of the Act by
 * attrition.
 */
exports.syncHeadcount = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid establishment id' });
    }

    const row = await StandingOrdersEstablishment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!row) {
      return res.status(404).json({ message: 'Establishment not found' });
    }

    const rules = resolveRules(row.state);
    if (!rules) {
      return res.status(400).json({
        message: `No rules are on file for ${row.state}, so there is no threshold to compare a strength against.`,
      });
    }

    const on = readDate(req.body.on) || new Date();
    const supplied = req.body.workmen;
    const workmen =
      supplied === undefined || supplied === null
        ? await Employee.countDocuments({
            tenantId: req.tenantId,
            isActive: true,
          })
        : Number(supplied);

    if (!Number.isFinite(workmen) || workmen < 0) {
      return res.status(400).json({ message: 'workmen must be a number' });
    }

    row.headcountHistory.push({
      on,
      workmen,
      note: String(req.body.note || '').trim(),
    });

    const wasApplicable = Boolean(row.applicableFrom);
    const position = assessEstablishment(shapeEstablishment(row, []), {
      asOf: new Date(),
    });

    // One-way. An establishment that has fallen below the threshold keeps the
    // date it first crossed — the proviso to section 1(3) — and nothing here
    // clears it.
    if (!wasApplicable && position.applicability.applicable === true) {
      row.applicableFrom = position.applicability.applicableFrom;
    }

    row.lastKnownState = position.submission ? position.submission.state : null;
    row.lastKnownInstrument = position.governing.instrument;
    await row.save();

    const becameApplicable = !wasApplicable && Boolean(row.applicableFrom);

    if (becameApplicable) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'STANDING_ORDERS_APPLICABILITY_DETERMINED',
        resourceType: 'StandingOrdersEstablishment',
        resourceIds: [row._id],
        details: {
          establishment: row.establishment,
          state: row.state,
          // The crossing date rather than today's, because the whole finding is
          // that six months may already have been running.
          applicableFrom: row.applicableFrom,
          strengthAtCrossing: position.applicability.strengthAtCrossing,
          threshold: rules.applicabilityThreshold,
          submissionDueBy: position.submission
            ? position.submission.dueBy
            : null,
        },
        req,
      });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'STANDING_ORDERS_HEADCOUNT_SYNCED',
      resourceType: 'StandingOrdersEstablishment',
      resourceIds: [row._id],
      details: {
        establishment: row.establishment,
        on,
        workmen,
        // Audited because a strength recorded below the threshold on an
        // applicable establishment is the case somebody will later read as
        // "the Act stopped applying", and the record has to show it did not.
        stillApplicable: Boolean(row.applicableFrom),
      },
      req,
    });

    return res.json({
      establishment: row,
      position,
      becameApplicable,
      note: becameApplicable
        ? `The Act became applicable on ${row.applicableFrom.toISOString().slice(0, 10)}, when strength first reached the threshold. The section 3(1) six months run from that date, not from today.`
        : null,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/standing-orders/establishments/:id/certifications
 *
 * Records a certified set. `authenticatedCopiesSentOn` is what section 7 runs
 * from; `certifiedOn` is stored and never used for the arithmetic.
 */
exports.recordCertification = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid establishment id' });
    }

    const row = await StandingOrdersEstablishment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!row) {
      return res.status(404).json({ message: 'Establishment not found' });
    }

    const coveredMatters = Array.isArray(req.body.coveredMatters)
      ? req.body.coveredMatters
          .map((matter) => String(matter).trim().toUpperCase())
          .filter((matter) => SCHEDULE_MATTERS[matter])
      : [];

    const unknown = (req.body.coveredMatters || [])
      .map((matter) => String(matter).trim().toUpperCase())
      .filter((matter) => !SCHEDULE_MATTERS[matter]);
    if (unknown.length > 0) {
      return res.status(400).json({
        message: `Not Schedule matters: ${unknown.join(', ')}. A matter that is not in the Schedule cannot be covered by standing orders certified under this Act.`,
        matters: Object.keys(SCHEDULE_MATTERS),
      });
    }

    const highest = await CertifiedStandingOrders.findOne({
      tenantId: req.tenantId,
      establishmentId: row._id,
    })
      .sort({ revision: -1 })
      .lean();

    const set = await CertifiedStandingOrders.create({
      tenantId: req.tenantId,
      establishmentId: row._id,
      revision: highest ? highest.revision + 1 : 1,
      certifiedOn: readDate(req.body.certifiedOn),
      authenticatedCopiesSentOn: readDate(req.body.authenticatedCopiesSentOn),
      appealPreferred: Boolean(req.body.appealPreferred),
      appellateAuthority: String(req.body.appellateAuthority || '').trim(),
      appellateDecisionSentOn: readDate(req.body.appellateDecisionSentOn),
      coveredMatters,
      documentRef: String(req.body.documentRef || '').trim(),
      recordedBy: req.userId,
    });

    const sets = await CertifiedStandingOrders.find({
      tenantId: req.tenantId,
      establishmentId: row._id,
    }).lean();

    const position = assessEstablishment(shapeEstablishment(row, sets), {
      asOf: new Date(),
    });
    row.lastKnownState = position.orders ? position.orders.state : null;
    row.lastKnownInstrument = position.governing.instrument;
    await row.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'STANDING_ORDERS_CERTIFIED',
      resourceType: 'CertifiedStandingOrders',
      resourceIds: [set._id],
      details: {
        establishment: row.establishment,
        revision: set.revision,
        // Both dates, because the distance between them is what a reviewer
        // needs: section 7 runs from the dispatch and not from the certificate,
        // and using the wrong one brings the orders into force weeks early.
        certifiedOn: set.certifiedOn,
        authenticatedCopiesSentOn: set.authenticatedCopiesSentOn,
        appealPreferred: set.appealPreferred,
        operativeFrom: position.orders ? position.orders.operativeFrom : null,
        // The gaps, because a set silent on a Schedule matter leaves that
        // matter on the Model orders and nothing on screen says so.
        scheduleGaps: position.schedule
          ? position.schedule.gaps.map((gap) => gap.key)
          : [],
      },
      req,
    });

    return res.status(201).json({
      certifiedStandingOrders: set,
      position,
      note: set.authenticatedCopiesSentOn
        ? null
        : 'No date of dispatch is recorded, so the section 7 operation date cannot be computed. The certificate date is not a substitute — it is routinely weeks earlier, and the orders do not bind anybody until thirty days after authenticated copies were sent.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/standing-orders/establishments/:id/modifications
 *
 * Records a proposed modification and returns the section 10 position. Records
 * it whatever the verdict — a modification barred unilaterally is a thing the
 * employer proposed, and refusing to store it would lose the record of what was
 * proposed and when.
 */
exports.proposeModification = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid establishment id' });
    }

    const description = String(req.body.description || '').trim();
    if (!description) {
      return res.status(400).json({ message: 'description is required' });
    }

    const row = await StandingOrdersEstablishment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!row) {
      return res.status(404).json({ message: 'Establishment not found' });
    }

    const sets = await CertifiedStandingOrders.find({
      tenantId: req.tenantId,
      establishmentId: row._id,
    }).lean();

    const proposedOn = readDate(req.body.proposedOn) || new Date();
    const position = assessEstablishment(shapeEstablishment(row, sets), {
      asOf: new Date(),
      modificationProposedOn: proposedOn,
    });

    const agreement = {
      party: String((req.body.agreement || {}).party || '').trim(),
      reference: String((req.body.agreement || {}).reference || '').trim(),
      agreedOn: readDate((req.body.agreement || {}).agreedOn),
    };

    const verdict = assessModification({
      operativeFrom:
        position.governing.instrument === INSTRUMENT.CERTIFIED ||
        position.governing.instrument === INSTRUMENT.PREVIOUS_CERTIFIED
          ? position.governing.operativeFrom
          : null,
      proposedOn,
      agreement,
      rules: resolveRules(row.state),
    });

    const matters = Array.isArray(req.body.matters)
      ? req.body.matters
          .map((matter) => String(matter).trim().toUpperCase())
          .filter((matter) => SCHEDULE_MATTERS[matter])
      : [];

    const modification = await StandingOrdersModification.create({
      tenantId: req.tenantId,
      establishmentId: row._id,
      ordersId: sets.length
        ? sets.sort((a, b) => b.revision - a.revision)[0]._id
        : null,
      description,
      matters,
      proposedOn,
      agreement,
      applicationMadeOn: readDate(req.body.applicationMadeOn),
      lastKnownVerdict: verdict.verdict,
      recordedBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'STANDING_ORDERS_MODIFICATION_PROPOSED',
      resourceType: 'StandingOrdersModification',
      resourceIds: [modification._id],
      details: {
        establishment: row.establishment,
        proposedOn,
        matters,
        verdict: verdict.verdict,
        barLiftsOn: verdict.barLiftsOn,
        // The reference rather than a boolean, because section 10(1) excepts a
        // modification *agreed*, and an agreement with nothing to point at is
        // the claim this record exists to keep distinguishable from the
        // document.
        agreementReference: agreement.reference || null,
        agreementParty: agreement.party || null,
      },
      req,
    });

    return res.status(201).json({ modification, verdict, position });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/standing-orders/queue
 *
 * Ordered by how soon something has to happen. Overdue drafts first — the
 * six months have run and section 13(1) is already engaged — then the ones still
 * inside the window by days remaining, then everything else.
 */
exports.getQueue = async (req, res, next) => {
  try {
    const rows = await StandingOrdersEstablishment.find({
      tenantId: req.tenantId,
    }).lean();
    const ids = rows.map((row) => row._id);

    const sets = await CertifiedStandingOrders.find({
      tenantId: req.tenantId,
      establishmentId: { $in: ids },
    }).lean();

    const byEstablishment = new Map();
    for (const set of sets) {
      const key = String(set.establishmentId);
      if (!byEstablishment.has(key)) byEstablishment.set(key, []);
      byEstablishment.get(key).push(set);
    }

    const asOf = readDate(req.query.asOf) || new Date();

    const positions = rows.map((row) =>
      assessEstablishment(
        shapeEstablishment(row, byEstablishment.get(String(row._id)) || []),
        { asOf },
      ),
    );

    const rank = {
      [ORDERS_STATE.DRAFT_OVERDUE]: 0,
      [ORDERS_STATE.DRAFT_DUE]: 1,
      [ORDERS_STATE.APPEALED]: 2,
      [ORDERS_STATE.UNDER_CERTIFICATION]: 3,
      [ORDERS_STATE.DRAFT_SUBMITTED]: 4,
      [ORDERS_STATE.CERTIFIED_NOT_YET_OPERATIVE]: 5,
      [ORDERS_STATE.OPERATIVE]: 6,
    };

    const ordered = positions.sort((a, b) => {
      const aState = a.submission ? a.submission.state : null;
      const bState = b.submission ? b.submission.state : null;
      const byRank = (rank[aState] ?? 99) - (rank[bState] ?? 99);
      if (byRank !== 0) return byRank;

      const aDays = a.submission ? a.submission.daysRemaining : null;
      const bDays = b.submission ? b.submission.daysRemaining : null;
      if (aDays === null || aDays === undefined) return 1;
      if (bDays === null || bDays === undefined) return -1;
      return aDays - bDays;
    });

    return res.json({
      asOf,
      queue: ordered,
      // Counted separately, because "how many establishments have certified
      // standing orders" and "how many are governed by the Model orders" are
      // the same question asked from opposite ends, and only the second one
      // tells an employer they are bound by terms they have not read.
      onModelOrders: ordered.filter(
        (row) => row.governing.instrument === INSTRUMENT.MODEL,
      ).length,
      notes: {
        uncertifiedIsNotUnregulated: UNCERTIFIED_IS_NOT_UNREGULATED,
        onceApplicableAlwaysApplicable: ONCE_APPLICABLE_ALWAYS_APPLICABLE,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/standing-orders/establishments/:id
 *
 * Optionally `?matter=SHIFT_WORKING` — the question #1828 and #1973 each need
 * answered, and the reason they should stop carrying their own boolean.
 */
exports.getPosition = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid establishment id' });
    }

    const row = await StandingOrdersEstablishment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!row) {
      return res.status(404).json({ message: 'Establishment not found' });
    }

    const [sets, modifications] = await Promise.all([
      CertifiedStandingOrders.find({
        tenantId: req.tenantId,
        establishmentId: row._id,
      })
        .sort({ revision: -1 })
        .lean(),
      StandingOrdersModification.find({
        tenantId: req.tenantId,
        establishmentId: row._id,
      })
        .sort({ proposedOn: -1 })
        .lean(),
    ]);

    const position = assessEstablishment(shapeEstablishment(row, sets), {
      asOf: readDate(req.query.asOf) || new Date(),
    });

    const matter = req.query.matter
      ? instrumentForMatter(position, req.query.matter)
      : null;

    return res.json({
      establishment: row,
      certifiedStandingOrders: sets,
      modifications,
      position,
      matter,
    });
  } catch (error) {
    return next(error);
  }
};
