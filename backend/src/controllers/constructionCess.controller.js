/**
 * @fileoverview BOCW Welfare Cess Act, 1996 (#1827).
 *
 * The controller's two interesting decisions are both about numbers it declines
 * to derive.
 *
 * **It will not compute the cost of construction from the ledger.** The vendor
 * ledger holds what was billed on a project, and summing it looks like the cost
 * of construction. It is not: section 3's base is the cost of the work, which
 * includes materials the establishment bought directly, excludes land the
 * ledger has no view of, and excludes compensation paid under the Employees'
 * Compensation Act that sits in an entirely different collection. A sum of
 * bills would be wrong in three directions at once and would arrive with the
 * authority of having been computed. So the project cost is **stated**, and
 * `billedToDate` is offered next to it as a cross-check that is explicitly not
 * the base.
 *
 * **It will not derive the ninety days from attendance.** Section 12 counts
 * construction work across *every* employer in the preceding twelve months.
 * Deriving it from this establishment's attendance ledger would under-report
 * eligibility for precisely the itinerant worker the Board's registration
 * exists to protect, and would do so silently — every such worker would simply
 * appear ineligible. So days are recorded per employer, with the days worked
 * here flagged, and a worker whose recorded days are all from here is reported
 * as "nobody has asked" rather than as ineligible.
 *
 * Everything that decides a base, a rate, an interest figure or an eligibility
 * is in `utils/constructionCess.js`.
 */

const mongoose = require('mongoose');

const {
  CessRules,
  ConstructionProject,
  CessBill,
  CessBeneficiary,
  CessAssessment,
} = require('../models/constructionCess.model');
const {
  CESS_RULES,
  EXCLUSION,
  assessProject,
  assessEstablishment,
} = require('../utils/constructionCess');
const eventBus = require('../services/event.service');

/**
 * The rules for an establishment.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {string} establishment
 * @returns {Promise<object>}
 */
async function resolveRules(tenantId, establishment) {
  const stored = await CessRules.findOne({
    tenantId,
    establishment: establishment || '',
  }).lean();

  return stored ? { ...CESS_RULES, ...stored } : { ...CESS_RULES };
}

/**
 * The period being assessed, defaulting to the current financial year.
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
 * A project and its bills, in the shape the engine reads.
 *
 * @param {object} project
 * @param {Array<object>} bills
 * @param {Date} asAt
 * @returns {object}
 */
function toEngineProject(project, bills, asAt) {
  return {
    projectId: project._id,
    name: project.name,
    totalProjectCost: project.totalProjectCost,
    exclusions: project.exclusions,
    cessPaid: project.cessPaid,
    completedOn: project.completedOn,
    assessedOn: project.assessedOn,
    asAt,
    bills: bills.map((bill) => ({
      billId: bill._id,
      contractorName: bill.contractorName,
      billedOn: bill.billedOn,
      amount: bill.amount,
      cessDeducted: bill.cessDeducted,
    })),
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
  const asAt = query?.asAt ? new Date(query.asAt) : new Date();

  const projects = await ConstructionProject.find({
    tenantId,
    establishment: establishment || '',
    $or: [
      { completedOn: null },
      { completedOn: { $gte: period.periodStart } },
      // A job completed before the period is still here where its cess is
      // outstanding: section 8 interest keeps running, and dropping it from the
      // year's assessment would make an ageing liability disappear from the one
      // view that shows it.
      { assessedOn: { $gte: period.periodStart } },
    ],
  }).lean();

  const bills = await CessBill.find({
    tenantId,
    projectId: { $in: projects.map((project) => project._id) },
  }).lean();

  const billsByProject = new Map();
  for (const bill of bills) {
    const key = String(bill.projectId);
    if (!billsByProject.has(key)) billsByProject.set(key, []);
    billsByProject.get(key).push(bill);
  }

  const workers = await CessBeneficiary.find({
    tenantId,
    establishment: establishment || '',
  }).lean();

  const result = assessEstablishment({
    projects: projects.map((project) =>
      toEngineProject(
        project,
        billsByProject.get(String(project._id)) || [],
        asAt,
      ),
    ),
    workers: workers.map((worker) => ({
      workerId: worker._id,
      name: worker.name,
      dateOfBirth: worker.dateOfBirth,
      daysByEmployer: worker.daysByEmployer,
      registeredOn: worker.registeredOn,
      asAt,
    })),
    applicability: {
      buildingWorkers: projects.reduce(
        (sum, project) => sum + (project.buildingWorkers || 0),
        0,
      ),
      registered: rules.registeredUnderSection7 === true,
    },
    rules,
  });

  return { period, establishment, rules, result };
}

/**
 * GET /api/construction-cess/rules
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
 * PUT /api/construction-cess/rules
 */
exports.updateRules = async (req, res, next) => {
  try {
    const establishment =
      typeof req.body.establishment === 'string'
        ? req.body.establishment.trim()
        : '';

    const update = {};
    const numeric = [
      'cessRatePercent',
      'minRatePercent',
      'maxRatePercent',
      'advanceDeductionPercent',
      'paymentWindowDays',
      'interestPercentPerMonth',
      'penaltyCeilingPercent',
      'applicabilityWorkers',
      'beneficiaryMinAge',
      'beneficiaryMaxAge',
      'beneficiaryQualifyingDays',
      'beneficiaryLookbackMonths',
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

    if (req.body.registeredUnderSection7 !== undefined) {
      update.registeredUnderSection7 =
        req.body.registeredUnderSection7 === true;
    }
    if (typeof req.body.section7RegistrationNumber === 'string') {
      update.section7RegistrationNumber =
        req.body.section7RegistrationNumber.trim();
    }

    const rules = await CessRules.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      { $set: { ...update, updatedBy: req.userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CESS_RULES_UPDATED',
      resourceType: 'CessRules',
      resourceIds: [rules._id],
      details: {
        establishment: establishment || '(default)',
        cessRatePercent: rules.cessRatePercent,
        interestPercentPerMonth: rules.interestPercentPerMonth,
      },
      req,
    });

    return res.json({ rules });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/construction-cess/projects
 */
exports.listProjects = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (typeof req.query.establishment === 'string') {
      filter.establishment = req.query.establishment.trim();
    }

    const projects = await ConstructionProject.find(filter)
      .sort({ startedOn: -1 })
      .limit(200)
      .lean();

    return res.json({ projects });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/construction-cess/projects
 */
exports.createProject = async (req, res, next) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ message: 'A project name is required' });
    }

    const totalProjectCost = Number(req.body.totalProjectCost);
    if (!Number.isFinite(totalProjectCost) || totalProjectCost < 0) {
      return res
        .status(400)
        .json({ message: 'totalProjectCost must be a number' });
    }

    const project = await ConstructionProject.create({
      tenantId: req.tenantId,
      establishment:
        typeof req.body.establishment === 'string'
          ? req.body.establishment.trim()
          : '',
      name: String(req.body.name).trim(),
      welfareBoardState:
        typeof req.body.welfareBoardState === 'string'
          ? req.body.welfareBoardState.trim()
          : '',
      site: typeof req.body.site === 'string' ? req.body.site.trim() : '',
      totalProjectCost,
      exclusions: sanitiseExclusions(req.body.exclusions),
      startedOn: req.body.startedOn ? new Date(req.body.startedOn) : new Date(),
      buildingWorkers: Math.max(0, Number(req.body.buildingWorkers) || 0),
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CESS_PROJECT_REGISTERED',
      resourceType: 'ConstructionProject',
      resourceIds: [project._id],
      details: {
        name: project.name,
        totalProjectCost: project.totalProjectCost,
        welfareBoardState: project.welfareBoardState,
      },
      req,
    });

    return res.status(201).json({ project });
  } catch (error) {
    return next(error);
  }
};

/**
 * Only the kinds section 3 names.
 *
 * An unrecognised kind would sit in the array and never be excluded, which
 * reads as a silent no-op — the establishment would believe it had taken the
 * land out and be assessed on a base that still contains it.
 *
 * @param {*} raw
 * @returns {Array<object>}
 */
function sanitiseExclusions(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry) => Object.hasOwn(EXCLUSION, entry?.kind))
    .map((entry) => ({
      kind: entry.kind,
      amount: Math.max(0, Number(entry.amount) || 0),
      note: typeof entry.note === 'string' ? entry.note.trim() : '',
    }));
}

/**
 * PUT /api/construction-cess/projects/:id/cost
 *
 * Audited, and separately from the rest of the project. The cost of
 * construction and its exclusions are the entire base of the levy: moving the
 * land line by a crore moves the cess by a lakh, and it is the line an
 * assessment order argues about.
 */
exports.updateProjectCost = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const before = await ConstructionProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!before) return res.status(404).json({ message: 'Project not found' });

    const update = {};

    if (req.body.totalProjectCost !== undefined) {
      const value = Number(req.body.totalProjectCost);
      if (!Number.isFinite(value) || value < 0) {
        return res
          .status(400)
          .json({ message: 'totalProjectCost must be a number' });
      }
      update.totalProjectCost = value;
    }

    if (req.body.exclusions !== undefined) {
      update.exclusions = sanitiseExclusions(req.body.exclusions);
    }

    const project = await ConstructionProject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: update },
      { new: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CESS_PROJECT_COST_REVISED',
      resourceType: 'ConstructionProject',
      resourceIds: [project._id],
      details: {
        name: project.name,
        costFrom: before.totalProjectCost,
        costTo: project.totalProjectCost,
        excludedFrom: (before.exclusions || []).reduce(
          (sum, row) => sum + (row.amount || 0),
          0,
        ),
        excludedTo: (project.exclusions || []).reduce(
          (sum, row) => sum + (row.amount || 0),
          0,
        ),
      },
      req,
    });

    return res.json({ project });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/construction-cess/projects/:id
 *
 * The project's cess position, with the ledger cross-check beside it.
 */
exports.getProject = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const project = await ConstructionProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const bills = await CessBill.find({
      tenantId: req.tenantId,
      projectId: project._id,
    })
      .sort({ billedOn: -1 })
      .lean();

    const rules = await resolveRules(req.tenantId, project.establishment);

    const assessment = assessProject(
      toEngineProject(project, bills, new Date()),
      rules,
    );

    const billedToDate = bills.reduce(
      (sum, bill) => sum + (bill.amount || 0),
      0,
    );

    return res.json({
      project,
      bills,
      assessment,
      /**
       * A cross-check, explicitly not the base.
       *
       * Summing the contractor bills looks like the cost of construction and is
       * not: it misses materials bought directly, includes nothing about the
       * land, and knows nothing of the compensation section 3 excludes. Offered
       * so a large divergence is visible, and labelled so nobody assesses on it.
       */
      ledgerCrossCheck: {
        billedToDate: Math.round(billedToDate * 100) / 100,
        statedCost: project.totalProjectCost,
        note: 'The sum of contractor bills is not the cost of construction under section 3. It excludes directly purchased materials and says nothing about the land.',
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/construction-cess/projects/:id/bills
 *
 * Records a contractor bill and the cess actually withheld from it.
 */
exports.recordBill = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const project = await ConstructionProject.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'amount must be a number' });
    }

    const cessDeducted = Number(req.body.cessDeducted);

    const bill = await CessBill.create({
      tenantId: req.tenantId,
      projectId: project._id,
      vendorId: mongoose.isValidObjectId(req.body.vendorId)
        ? req.body.vendorId
        : undefined,
      contractorName:
        typeof req.body.contractorName === 'string'
          ? req.body.contractorName.trim()
          : '',
      billNumber:
        typeof req.body.billNumber === 'string'
          ? req.body.billNumber.trim()
          : '',
      billedOn: req.body.billedOn ? new Date(req.body.billedOn) : new Date(),
      amount,
      // Recorded rather than computed. A bill paid gross is the failure the
      // register exists to catch, and defaulting to the correct deduction would
      // assert that it happened.
      cessDeducted:
        Number.isFinite(cessDeducted) && cessDeducted >= 0 ? cessDeducted : 0,
      remittedOn: req.body.remittedOn
        ? new Date(req.body.remittedOn)
        : undefined,
      recordedBy: req.userId,
    });

    return res.status(201).json({ bill });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/construction-cess/projects/:id/assessment-order
 *
 * Records the Board's section 5 assessment. Audited: it starts the rule 5
 * payment window, and therefore the section 8 interest clock.
 */
exports.recordAssessmentOrder = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const project = await ConstructionProject.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        $set: {
          assessedOn: req.body.assessedOn
            ? new Date(req.body.assessedOn)
            : new Date(),
          assessmentOrderNumber:
            typeof req.body.assessmentOrderNumber === 'string'
              ? req.body.assessmentOrderNumber.trim()
              : '',
          ...(req.body.completedOn
            ? { completedOn: new Date(req.body.completedOn) }
            : {}),
        },
      },
      { new: true },
    );

    if (!project) return res.status(404).json({ message: 'Project not found' });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CESS_ASSESSMENT_ORDER_RECORDED',
      resourceType: 'ConstructionProject',
      resourceIds: [project._id],
      details: {
        name: project.name,
        assessedOn: project.assessedOn,
        assessmentOrderNumber: project.assessmentOrderNumber,
      },
      req,
    });

    return res.json({ project });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/construction-cess/beneficiaries
 */
exports.listBeneficiaries = async (req, res, next) => {
  try {
    const beneficiaries = await CessBeneficiary.find({
      tenantId: req.tenantId,
      establishment:
        typeof req.query.establishment === 'string'
          ? req.query.establishment.trim()
          : '',
    })
      .sort({ name: 1 })
      .limit(500)
      .lean();

    return res.json({ beneficiaries });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/construction-cess/beneficiaries
 *
 * Records a worker's days, per employer.
 *
 * The `thisEstablishment` flag is what keeps the register honest: days worked
 * elsewhere are taken on the worker's statement, and a worker whose recorded
 * days are all from here is reported as un-asked rather than as ineligible.
 */
exports.recordBeneficiary = async (req, res, next) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ message: 'A name is required' });
    }

    const daysByEmployer = Array.isArray(req.body.daysByEmployer)
      ? req.body.daysByEmployer.map((row) => ({
          employer:
            typeof row?.employer === 'string' ? row.employer.trim() : '',
          days: Math.max(0, Number(row?.days) || 0),
          thisEstablishment: row?.thisEstablishment === true,
          fromDate: row?.fromDate ? new Date(row.fromDate) : undefined,
          toDate: row?.toDate ? new Date(row.toDate) : undefined,
        }))
      : [];

    const beneficiary = await CessBeneficiary.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        establishment:
          typeof req.body.establishment === 'string'
            ? req.body.establishment.trim()
            : '',
        name: String(req.body.name).trim(),
      },
      {
        $set: {
          dateOfBirth: req.body.dateOfBirth
            ? new Date(req.body.dateOfBirth)
            : undefined,
          trade:
            typeof req.body.trade === 'string' ? req.body.trade.trim() : '',
          daysByEmployer,
          ...(req.body.registeredOn
            ? { registeredOn: new Date(req.body.registeredOn) }
            : {}),
          ...(typeof req.body.boardRegistrationNumber === 'string'
            ? {
                boardRegistrationNumber:
                  req.body.boardRegistrationNumber.trim(),
              }
            : {}),
          ...(req.body.renewalDueOn
            ? { renewalDueOn: new Date(req.body.renewalDueOn) }
            : {}),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    if (req.body.registeredOn) {
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'CESS_BENEFICIARY_REGISTERED',
        resourceType: 'CessBeneficiary',
        resourceIds: [beneficiary._id],
        details: {
          name: beneficiary.name,
          registeredOn: beneficiary.registeredOn,
          boardRegistrationNumber: beneficiary.boardRegistrationNumber,
        },
        req,
      });
    }

    return res.json({ beneficiary });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/construction-cess/assessment
 *
 * Writes nothing.
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
 * GET /api/construction-cess/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await CessAssessment.find({ tenantId: req.tenantId })
      .sort({ periodStart: -1 })
      .limit(50)
      .select('-findings -projects')
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/construction-cess/assessments
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

    const assessment = await CessAssessment.findOneAndUpdate(
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
          buildingWorkers: result.applicability.buildingWorkers,
          registered: result.applicability.registered,
          projectCount: result.projectCount,
          totalProjectCost: result.totalProjectCost,
          excluded: result.excluded,
          base: result.base,
          assessed: result.assessed,
          advanceDeducted: result.advanceDeducted,
          cessPaid: result.cessPaid,
          outstanding: result.outstanding,
          interest: result.interest,
          payable: result.payable,
          penaltyCeiling: result.penaltyCeiling,
          refundDue: result.refundDue,
          beneficiaryCount: result.beneficiaryCount,
          eligibleCount: result.eligibleCount,
          registeredCount: result.registeredCount,
          qualifiedElsewhereCount: result.qualifiedElsewhereCount,
          summary: result.summary,
          findings: result.findings,
          projects: result.projects.map((row) => ({
            projectId: row.projectId,
            name: row.name,
            totalProjectCost: row.cost.totalProjectCost,
            excluded: row.cost.excluded,
            base: row.cost.base,
            rate: row.rate,
            assessed: row.assessed,
            advanceDeducted: row.advance.deducted,
            cessPaid: row.cessPaid,
            outstanding: row.outstanding,
            interest: row.interest.interest,
            interestMonths: row.interest.months,
            penaltyCeiling: row.penaltyCeiling,
            payable: row.payable,
            status: row.status,
            dueOn: row.dueOn,
          })),
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    // The cached status on each project, so the list view does not have to
    // re-run the engine to colour a column.
    await Promise.all(
      result.projects.map((row) =>
        ConstructionProject.updateOne(
          { _id: row.projectId, tenantId: req.tenantId },
          { $set: { status: row.status } },
        ),
      ),
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CESS_ASSESSMENT_COMMITTED',
      resourceType: 'CessAssessment',
      resourceIds: [assessment._id],
      details: {
        establishment: establishment || '(default)',
        financialYear: period.financialYear,
        base: assessment.base,
        assessed: assessment.assessed,
        payable: assessment.payable,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};
