/**
 * @fileoverview Apprentices Act, 1961 (#1771).
 *
 * The controller's one interesting decision is what it refuses to do.
 *
 * Section 8 measures the engagement band against **total strength**, including
 * contract and casual workers. The product does not hold that number: `Employee`
 * is the payroll roll, and `contractLabour.js` tracks contractors by deployment
 * rather than by head, so summing it would count a contractor twice across two
 * overlapping deployments and miss one whose deployment record had closed.
 *
 * So the composition is **recorded** rather than counted, and `resolveComposition`
 * only offers a starting figure with the direct employees filled in. Counting the
 * contract workers is somebody walking the site, which is what Rule 7A assumes.
 * Deriving a total-strength figure and presenting it as fact would put a wrong
 * number under a statutory obligation and give it the authority of having been
 * computed.
 *
 * Everything that decides the band, the stipend or the exposure is in
 * `utils/apprenticeshipCompliance.js`.
 */

const mongoose = require('mongoose');

const {
  ApprenticeshipRules,
  EstablishmentStrength,
  Apprentice,
  ApprenticeshipAssessment,
} = require('../models/apprenticeship.model');
const Employee = require('../models/employee.model');
const {
  APPRENTICESHIP_RULES,
  PRESCRIBED_STIPEND,
  REGISTRATION,
  assessEstablishment,
} = require('../utils/apprenticeshipCompliance');
const eventBus = require('../services/event.service');

/**
 * The rules for an establishment.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId, establishment) {
  const stored = await ApprenticeshipRules.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  if (!stored) return { ...APPRENTICESHIP_RULES };

  return {
    ...APPRENTICESHIP_RULES,
    ...stored,
    // Stored as a Map; the engine reads a plain object.
    prescribedStipends: stored.prescribedStipends
      ? Object.fromEntries(stored.prescribedStipends)
      : { ...PRESCRIBED_STIPEND },
  };
}

/**
 * The period being assessed, defaulting to the current financial year.
 *
 * A financial year rather than a month, because the band is a standing position
 * rather than a monthly one and because the NAPS claim is made against a year.
 *
 * @param {object} query
 * @returns {{periodStart: Date, periodEnd: Date, financialYear: number}}
 */
function resolvePeriod(query) {
  const now = new Date();

  const financialYear =
    Number(query.financialYear) ||
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
 * The composition recorded for a period, or a starting point derived from the
 * payroll.
 *
 * The derived figure fills in `directEmployees` and leaves the contract and
 * casual counts at zero, with `recorded: false`. That is deliberately an
 * *incomplete* answer rather than a plausible one — see this file's header.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @param {object} period
 * @returns {Promise<object>}
 */
async function resolveComposition(tenantId, establishment, period) {
  const recorded = await EstablishmentStrength.findOne({
    tenantId,
    establishment: establishment || '',
    // The most recent count inside the period.
    year: { $gte: period.periodStart.getUTCFullYear() },
  })
    .sort({ year: -1, month: -1 })
    .lean();

  if (recorded) {
    return {
      directEmployees: recorded.directEmployees,
      contractWorkers: recorded.contractWorkers,
      casualWorkers: recorded.casualWorkers,
      recorded: true,
      countedFor: { month: recorded.month, year: recorded.year },
    };
  }

  const employeeFilter = { tenantId };
  if (establishment) employeeFilter.department = establishment;

  return {
    directEmployees: await Employee.countDocuments(employeeFilter),
    contractWorkers: 0,
    casualWorkers: 0,
    recorded: false,
    countedFor: null,
  };
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
  const composition = await resolveComposition(tenantId, establishment, period);

  const roll = await Apprentice.find({
    tenantId,
    establishment: establishment || '',
    engagedOn: { $lte: period.periodEnd },
    $or: [{ completedOn: null }, { completedOn: { $gte: period.periodStart } }],
  }).lean();

  const apprentices = roll.map((row) => ({
    apprentice: {
      apprenticeId: row._id,
      name: row.name,
      qualification: row.qualification,
      isFresher: row.isFresher,
      engagedOn: row.engagedOn,
      registeredOn: row.registeredOn,
      currentYear: row.months?.[row.months.length - 1]?.apprenticeshipYear || 1,
    },
    months: (row.months || [])
      .filter((month) => {
        // Only the months inside the period. A second-year apprentice carries
        // months from the previous financial year and those belong to that
        // year's claim, not this one.
        const at = new Date(Date.UTC(month.calendarYear, month.month - 1, 1));
        return at >= period.periodStart && at <= period.periodEnd;
      })
      .map((month) => ({
        month: month.month,
        calendarYear: month.calendarYear,
        year: month.apprenticeshipYear,
        workingDays: month.workingDays,
        daysAttended: month.daysAttended,
        holidays: month.holidays,
        authorisedLeaveDays: month.authorisedLeaveDays,
        stipendPaid: month.stipendPaid,
      })),
  }));

  const result = assessEstablishment({
    composition,
    apprentices,
    asAt: query?.asAt ? new Date(query.asAt) : period.periodEnd,
    rules,
  });

  return { period, establishment, rules, composition, result };
}

/**
 * GET /api/apprenticeships/rules
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
 * PUT /api/apprenticeships/rules
 */
exports.updateRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const update = {};
    const numeric = [
      'applicabilityHeadcount',
      'bandFloorPercent',
      'bandCeilingPercent',
      'fresherSubQuotaPercent',
      'registrationWindowDays',
      'secondYearUpliftPercent',
      'thirdYearUpliftPercent',
      'napsReimbursementPercent',
      'napsMonthlyCeiling',
      'napsMinimumAttendanceDays',
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

    if (
      req.body.prescribedStipends &&
      typeof req.body.prescribedStipends === 'object'
    ) {
      const stipends = {};
      for (const [qualification, amount] of Object.entries(
        req.body.prescribedStipends,
      )) {
        // Only the qualifications Rule 11 names. An unrecognised key would end
        // up in the map and never be read, which reads as a silent no-op.
        if (!Object.hasOwn(PRESCRIBED_STIPEND, qualification)) continue;

        const value = Number(amount);
        if (Number.isFinite(value) && value >= 0) {
          stipends[qualification] = value;
        }
      }
      update.prescribedStipends = stipends;
    }

    const rules = await ApprenticeshipRules.findOneAndUpdate(
      {
        establishment
      },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRENTICESHIP_RULES_UPDATED',
      resourceType: 'ApprenticeshipRules',
      resourceIds: [rules._id],
      details: {
        establishment: establishment || '(default)',
        bandFloorPercent: rules.bandFloorPercent,
        bandCeilingPercent: rules.bandCeilingPercent,
        applicabilityHeadcount: rules.applicabilityHeadcount,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/apprenticeships/strength
 *
 * Records the establishment's composition for a month.
 *
 * Audited, because the total strength is the denominator of the whole
 * obligation: reducing it by ten lowers the floor and can make a shortfall
 * disappear without a single apprentice being engaged.
 */
exports.recordStrength = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const now = new Date();
    const month = Number(req.body.month) || now.getUTCMonth() + 1;
    const year = Number(req.body.year) || now.getUTCFullYear();

    if (month < 1 || month > 12) {
      return res.status(400).json({ message: 'Month must be 1 to 12' });
    }

    const counts = {};
    for (const field of [
      'directEmployees',
      'contractWorkers',
      'casualWorkers',
    ]) {
      const value = Number(req.body[field]);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ message: `${field} must be a number` });
      }
      counts[field] = Math.floor(value);
    }

    const before = await EstablishmentStrength.findOne({
      establishment,
      month,
      year
    }).lean();

    const strength = await EstablishmentStrength.findOneAndUpdate(
      {
        establishment,
        month,
        year
      },
      { $set: { ...counts, countedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const total = (row) =>
      row
        ? (row.directEmployees || 0) +
          (row.contractWorkers || 0) +
          (row.casualWorkers || 0)
        : null;

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRENTICESHIP_STRENGTH_RECORDED',
      resourceType: 'EstablishmentStrength',
      resourceIds: [strength._id],
      details: {
        establishment: establishment || '(default)',
        month,
        year,
        // Both sides: the denominator moving is the point of auditing this.
        totalStrengthBefore: total(before),
        totalStrengthAfter: total(strength),
      },
      req,
    });

    return res.json({ strength });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/apprenticeships/strength
 */
exports.listStrength = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }

    const records = await EstablishmentStrength.find(filter)
      .sort({ year: -1, month: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 60))
      .lean();

    return res.json({ records });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/apprenticeships/apprentices
 */
exports.listApprentices = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }
    if (Object.values(REGISTRATION).includes(req.query.registrationStatus)) {
      filter.registrationStatus = req.query.registrationStatus;
    }

    const apprentices = await Apprentice.find(filter)
      .sort({ engagedOn: -1 })
      .limit(Math.min(Number(req.query.limit) || 200, 500))
      .lean();

    return res.json({ apprentices });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/apprenticeships/apprentices
 */
exports.createApprentice = async (req, res, next) => {
  try {
    if (!req.body?.name || !String(req.body.name).trim()) {
      return res.status(400).json({ message: 'A name is required' });
    }

    if (!Object.hasOwn(PRESCRIBED_STIPEND, req.body?.qualification)) {
      return res.status(400).json({
        message: `Qualification must be one of ${Object.keys(PRESCRIBED_STIPEND).join(', ')}`,
      });
    }

    if (!req.body?.engagedOn) {
      return res
        .status(400)
        .json({ message: 'The date of engagement is required' });
    }

    const apprentice = await Apprentice.create({
      ...req.body,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRENTICE_ENGAGED',
      resourceType: 'Apprentice',
      resourceIds: [apprentice._id],
      details: {
        name: apprentice.name,
        qualification: apprentice.qualification,
        engagedOn: apprentice.engagedOn,
      },
      req,
    });

    return res.status(201).json({ apprentice });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/apprenticeships/apprentices/:id/register
 *
 * Records the portal registration.
 *
 * Its own endpoint rather than a field on the update, and audited, because this
 * is the fact that decides whether the establishment owes provident fund, ESI,
 * bonus and gratuity for the period — the single largest consequence in the
 * module, turning on a date.
 */
exports.registerApprentice = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid apprentice id' });
    }

    const registeredOn = req.body?.registeredOn
      ? new Date(req.body.registeredOn)
      : new Date();

    if (Number.isNaN(registeredOn.getTime())) {
      return res.status(400).json({ message: 'Invalid registration date' });
    }

    const contractNumber = String(req.body?.portalContractNumber || '').trim();
    if (!contractNumber) {
      return res
        .status(400)
        .json({ message: 'The portal contract number is required' });
    }

    const apprentice = await Apprentice.findOneAndUpdate(
      {
        _id: req.params.id
      },
      {
        $set: {
          registeredOn,
          portalContractNumber: contractNumber,
          registrationStatus: REGISTRATION.REGISTERED,
        },
      },
      { new: true },
    );

    if (!apprentice) {
      return res.status(404).json({ message: 'Apprentice not found' });
    }

    const rules = await resolveRules(req.tenantId, apprentice.establishment);
    const dueBy = new Date(
      new Date(apprentice.engagedOn).getTime() +
        rules.registrationWindowDays * 86400000,
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRENTICE_CONTRACT_REGISTERED',
      resourceType: 'Apprentice',
      resourceIds: [apprentice._id],
      details: {
        name: apprentice.name,
        engagedOn: apprentice.engagedOn,
        registeredOn,
        dueBy,
        // Recorded even where it is zero: "registered on time" is a fact worth
        // being able to prove years later.
        daysLate: Math.max(
          0,
          Math.round((registeredOn.getTime() - dueBy.getTime()) / 86400000),
        ),
        portalContractNumber: contractNumber,
      },
      req,
    });

    return res.json({ apprentice });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/apprenticeships/apprentices/:id/months
 *
 * Records the attendance and stipend for a month.
 */
exports.recordMonth = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid apprentice id' });
    }

    const month = Number(req.body?.month);
    const calendarYear = Number(req.body?.calendarYear);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Month must be 1 to 12' });
    }

    if (!Number.isInteger(calendarYear)) {
      return res.status(400).json({ message: 'A calendar year is required' });
    }

    const row = {
      month,
      calendarYear,
      apprenticeshipYear: Math.max(
        1,
        Math.min(3, Number(req.body?.apprenticeshipYear) || 1),
      ),
      workingDays: Math.max(1, Number(req.body?.workingDays) || 26),
      daysAttended: Math.max(0, Number(req.body?.daysAttended) || 0),
      holidays: Math.max(0, Number(req.body?.holidays) || 0),
      authorisedLeaveDays: Math.max(
        0,
        Number(req.body?.authorisedLeaveDays) || 0,
      ),
      stipendPaid: Math.max(0, Number(req.body?.stipendPaid) || 0),
    };

    // Replace the month rather than push it, so re-recording March corrects
    // March instead of producing a second one.
    const updated = await Apprentice.findOneAndUpdate(
      {
        _id: req.params.id
      },
      { $pull: { months: { month, calendarYear } } },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: 'Apprentice not found' });
    }

    const apprentice = await Apprentice.findOneAndUpdate(
      {
        _id: req.params.id
      },
      { $push: { months: row } },
      { new: true },
    );

    return res.json({ apprentice });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/apprenticeships/assessment
 *
 * Writes nothing.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const establishment =
      typeof req.query.establishment === 'string'
        ? req.query.establishment.trim()
        : '';

    const assessment = await buildAssessment({
      establishment,
      query: req.query
    });

    return res.json(assessment);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/apprenticeships/assessments
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const { period, rules, result } = await buildAssessment({
      establishment,
      query: req.body
    });

    const assessment = await ApprenticeshipAssessment.findOneAndUpdate(
      {
        establishment,
        periodStart: period.periodStart
      },
      {
        $set: {
          periodEnd: period.periodEnd,
          rules,
          applicable: result.band.applicable,
          totalStrength: result.band.totalStrength,
          apprenticeCount: result.apprenticeCount,
          bandFloor: result.band.floor,
          bandCeiling: result.band.ceiling,
          shortfall: result.band.shortfall,
          excess: result.band.excess,
          strengthByStatute: result.strength,
          registeredCount: result.registeredCount,
          lapsedCount: result.lapsedCount,
          stipendPaid: result.stipendPaid,
          stipendShortfall: result.stipendShortfall,
          reimbursementReceivable: result.reimbursementReceivable,
          exposure: result.exposure,
          summary: result.summary,
          findings: result.findings.map((entry) => {
            const {
              code,
              section,
              severity,
              message,
              apprenticeId,
              apprenticeName,
              ...context
            } = entry;

            return {
              code,
              section,
              severity,
              message,
              apprenticeId,
              apprenticeName,
              context,
            };
          }),
          apprentices: result.apprentices.map((entry) => ({
            apprenticeId: entry.apprenticeId,
            name: entry.name,
            qualification: entry.qualification,
            isFresher: entry.isFresher,
            registrationStatus: entry.registration.status,
            registrationDueBy: entry.registration.dueBy,
            registrationDaysLate: entry.registration.daysLate,
            stipendPaid: entry.stipendPaid,
            stipendShortfall: entry.stipendShortfall,
            reimbursement: entry.reimbursement,
            exposureTotal: entry.exposure?.total || 0,
            exposureProvidentFund: entry.exposure?.providentFund || 0,
            exposureEsi: entry.exposure?.esi || 0,
            exposureBonus: entry.exposure?.bonus || 0,
            exposureGratuity: entry.exposure?.gratuity || 0,
          })),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // Write the registration status back onto the roll so the list can be
    // filtered on it without re-running the assessment.
    const operations = result.apprentices
      .filter((entry) => entry.apprenticeId)
      .map((entry) => ({
        updateOne: {
          filter: {
            _id: entry.apprenticeId
          },
          update: { $set: { registrationStatus: entry.registration.status } },
        },
      }));

    if (operations.length > 0) {
      await Apprentice.bulkWrite(operations);
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRENTICESHIP_ASSESSMENT_COMMITTED',
      resourceType: 'ApprenticeshipAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: establishment || '(default)',
        periodStart: assessment.periodStart,
        totalStrength: assessment.totalStrength,
        shortfall: assessment.shortfall,
        lapsedCount: assessment.lapsedCount,
        exposure: assessment.exposure,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/apprenticeships/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }

    const assessments = await ApprenticeshipAssessment.find(
      filter,
      '-findings -apprentices',
    )
      .sort({ periodStart: -1 })
      .limit(Math.min(Number(req.query.limit) || 12, 30))
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

exports.buildAssessment = buildAssessment;
exports.resolveRules = resolveRules;
exports.resolveComposition = resolveComposition;
exports.resolvePeriod = resolvePeriod;
