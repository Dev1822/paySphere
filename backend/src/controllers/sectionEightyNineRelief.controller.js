/**
 * @fileoverview Section 89(1) relief on salary arrears (#1969).
 *
 * Three decisions carry this controller.
 *
 * **It computes the relief and does not apply it.** Section 192(2A) makes the
 * employer's authority conditional on the employee furnishing particulars in
 * Form 10E, and since AY 2015-16 the relief is disallowed outright without one.
 * So every response carries `reliefComputed` and `reliefApplicable` as separate
 * numbers, and `applyRelief` refuses where the form is not on file. A payroll
 * that reduced the deduction on the strength of the computed figure alone has
 * short-deducted, and the section 201(1A) interest is the employer's.
 *
 * **It refuses rather than approximates.** A relation year with no rate table
 * on file, no recorded regime or no assessed income comes back as a gap with
 * its reason. The tempting alternative — price it at the current year's rates —
 * collapses the two rate environments the whole relief is the difference
 * between, and produces a number the employee signs a return with.
 *
 * **It owns nothing in the arrear.** It reads the amount, the period it relates
 * to and the date of receipt, and writes nothing back. It does not recompute an
 * arrear, does not reopen a closed payroll period and does not file Form 10E —
 * the employee furnishes that, and this records the furnishing.
 *
 * Everything that decides a rate, an allocation or a relief is in
 * `utils/sectionEightyNineRelief.js`.
 */

const mongoose = require('mongoose');

const {
  TaxRateTable,
  AssessedYear,
  ArrearReliefClaim,
  FormTenEFurnishing,
} = require('../models/sectionEightyNineRelief.model');
const {
  RELIEF_RULES,
  REGIME,
  GAP,
  GAP_REASON,
  RELIEF_IS_CONDITIONAL,
  financialYearOf,
  assessmentYearOf,
  yearLabel,
  allocateArrear,
  formTenE,
  assessArrear,
  assessEmployee,
} = require('../utils/sectionEightyNineRelief');
const eventBus = require('../services/event.service');

/**
 * @param {*} value
 * @returns {Date|null}
 */
function readDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Load the rate tables and the employee's assessed years once, for a set of
 * claims.
 *
 * Loaded together rather than per claim because the relation years of two
 * arrears overlap almost entirely, and the tables are the same for everybody.
 *
 * @param {object} input
 * @returns {Promise<{rateTables: Array<object>, assessedYears: Array<object>}>}
 */
async function loadBasis({ tenantId, employeeId }) {
  const [rateTables, assessedYears] = await Promise.all([
    TaxRateTable.find({ tenantId }).lean(),
    AssessedYear.find({ tenantId, employeeId })
      .sort({ financialYear: 1 })
      .lean(),
  ]);

  return { rateTables, assessedYears };
}

/**
 * Attach each claim's Form 10E furnishing, where there is one.
 *
 * @param {object} input
 * @returns {Promise<Map<string, object>>}
 */
async function loadFurnishings({ tenantId, claimIds }) {
  const rows = await FormTenEFurnishing.find({
    tenantId,
    claimId: { $in: claimIds },
  }).lean();

  return new Map(rows.map((row) => [String(row.claimId), row]));
}

/**
 * GET /api/section-89-relief/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      rules: RELIEF_RULES,
      regimes: REGIME,
      gaps: GAP_REASON,
      conditional: RELIEF_IS_CONDITIONAL,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/section-89-relief/rate-tables
 *
 * The module's real asset, and the thing whose absence is the most common
 * reason a relief cannot be computed. Listed with the years that are covered so
 * a gap is visible before somebody hits it.
 */
exports.listRateTables = async (req, res, next) => {
  try {
    const tables = await TaxRateTable.find({})
      .sort({ assessmentYear: -1, regime: 1 })
      .lean();

    const years = [
      ...new Set(tables.map((table) => table.assessmentYear)),
    ].sort();

    return res.json({
      tables,
      assessmentYearsCovered: years,
      note: 'A relation year with no table here is refused rather than priced at the current year’s rates. Relief is the difference between two rate environments, and substituting one for the other produces a figure nobody can defend.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/section-89-relief/rate-tables
 */
exports.recordRateTable = async (req, res, next) => {
  try {
    const assessmentYear = Number(req.body.assessmentYear);
    if (!Number.isInteger(assessmentYear) || assessmentYear < 1990) {
      return res
        .status(400)
        .json({ message: 'assessmentYear must be a four-digit year' });
    }

    if (!Object.values(REGIME).includes(req.body.regime)) {
      return res
        .status(400)
        .json({
          message: `regime must be one of ${Object.values(REGIME).join(', ')}`,
        });
    }

    const slabs = Array.isArray(req.body.slabs) ? req.body.slabs : [];
    if (!slabs.length) {
      return res.status(400).json({ message: 'At least one slab is required' });
    }

    // A slab set with a hole in it silently taxes the income in the hole at
    // nil, which is a rate table that looks complete and is not.
    const sorted = [...slabs].sort((a, b) => Number(a.from) - Number(b.from));
    for (let index = 1; index < sorted.length; index += 1) {
      if (Number(sorted[index].from) !== Number(sorted[index - 1].upto)) {
        return res.status(400).json({
          message: `Slabs must be contiguous. ${sorted[index - 1].upto} does not meet ${sorted[index].from}.`,
        });
      }
    }

    const table = await TaxRateTable.findOneAndUpdate(
      {
        assessmentYear,
        regime: req.body.regime
      },
      {
        $set: {
          slabs: sorted,
          rebateIncomeLimit: Number(req.body.rebateIncomeLimit) || 0,
          rebateCap: Number(req.body.rebateCap) || 0,
          surcharge: Array.isArray(req.body.surcharge)
            ? req.body.surcharge
            : [],
          cessRate: Number.isFinite(Number(req.body.cessRate))
            ? Number(req.body.cessRate)
            : RELIEF_RULES.defaultCessRate,
          source: String(req.body.source || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'RELIEF_RATE_TABLE_RECORDED',
      resourceType: 'TaxRateTable',
      resourceIds: [table._id],
      details: {
        assessmentYear,
        regime: req.body.regime,
        // Named because every relief computed against a relation year in this
        // year moves when this table moves.
        slabCount: sorted.length,
        source: table.source,
      },
      req,
    });

    return res.status(201).json({ table });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/section-89-relief/assessed-years
 */
exports.listAssessedYears = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const years = await AssessedYear.find({
      employeeId: req.query.employeeId
    })
      .sort({ financialYear: -1 })
      .lean();

    return res.json({
      years: years.map((row) => ({
        ...row,
        label: yearLabel(row.financialYear),
      })),
      note: 'Total income as assessed, not as the employer computed it. An employee with income the employer never saw has a different marginal rate, and inferring the figure from Form 16 understates the relation-year tax and overstates the relief.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/section-89-relief/assessed-years
 *
 * The regime is required and never defaulted — see the model. Assuming today's
 * basis for a past year produces relief an assessing officer withdraws.
 */
exports.recordAssessedYear = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const financialYear = Number(req.body.financialYear);
    if (!Number.isInteger(financialYear) || financialYear < 1990) {
      return res
        .status(400)
        .json({ message: 'financialYear must be a four-digit year' });
    }

    if (!Object.values(REGIME).includes(req.body.regime)) {
      return res.status(400).json({
        message:
          'regime must be recorded. The relation-year term is computed on the basis the employee was actually assessed on, and there is no safe default for it.',
      });
    }

    const totalIncome = Number(req.body.totalIncome);
    if (!Number.isFinite(totalIncome) || totalIncome < 0) {
      return res
        .status(400)
        .json({ message: 'totalIncome must be a non-negative number' });
    }

    const year = await AssessedYear.findOneAndUpdate(
      {
        employeeId: req.body.employeeId,
        financialYear
      },
      {
        $set: {
          totalIncome,
          regime: req.body.regime,
          evidence: String(req.body.evidence || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'RELIEF_ASSESSED_YEAR_RECORDED',
      resourceType: 'AssessedYear',
      resourceIds: [year._id],
      details: {
        employeeId: req.body.employeeId,
        financialYear,
        regime: req.body.regime,
        totalIncome,
      },
      req,
    });

    return res.status(201).json({ year });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/section-89-relief/claims
 *
 * The allocation is derived from the revision's own dates unless one is
 * supplied. Supplying one is the right answer for an arrear that is not
 * proportional to time; deriving it is the right answer for a backdated
 * revision, and the module cannot tell which this is from the dates alone.
 */
exports.recordClaim = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const paidOn = readDate(req.body.paidOn);
    const relatesFrom = readDate(req.body.relatesFrom);
    const relatesTo = readDate(req.body.relatesTo);

    if (!paidOn || !relatesFrom || !relatesTo) {
      return res.status(400).json({
        message: 'paidOn, relatesFrom and relatesTo must all be valid dates',
      });
    }

    if (relatesTo < relatesFrom) {
      return res
        .status(400)
        .json({ message: 'relatesTo cannot precede relatesFrom' });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ message: 'amount must be a positive number' });
    }

    if (!Object.values(REGIME).includes(req.body.regime)) {
      return res
        .status(400)
        .json({ message: 'regime must be recorded for the year of receipt' });
    }

    const allocation = allocateArrear({
      total: amount,
      relatesFrom,
      relatesTo,
      explicit: req.body.allocation,
    });

    const claim = await ArrearReliefClaim.create({
      employeeId: req.body.employeeId,
      amount,
      paidOn,
      relatesFrom,
      relatesTo,

      allocation: allocation.map((row) => ({
        financialYear: row.financialYear,
        amount: row.amount,
        basis: row.basis,
      })),

      regime: req.body.regime,

      totalIncomeExcludingArrears:
        Number(req.body.totalIncomeExcludingArrears) || 0,

      returnFiledOn: readDate(req.body.returnFiledOn),

      arrearRunId: mongoose.isValidObjectId(req.body.arrearRunId)
        ? req.body.arrearRunId
        : undefined,

      recordedBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'RELIEF_CLAIM_RECORDED',
      resourceType: 'ArrearReliefClaim',
      resourceIds: [claim._id],
      details: {
        employeeId: req.body.employeeId,
        amount,
        receiptYear: financialYearOf(paidOn),
        relationYears: allocation.map((row) => row.financialYear),
        allocationBasis: allocation[0]?.basis || 'NONE',
      },
      req,
    });

    return res.status(201).json({
      claim,
      conditional: RELIEF_IS_CONDITIONAL,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/section-89-relief/claims/:id/form-10e
 *
 * Records the employee's furnishing. It does not file anything — the employee
 * files, and this is the employer's record that they did, which is what section
 * 192(2A) makes the authority turn on.
 */
exports.recordFurnishing = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const claim = await ArrearReliefClaim.findOne({
      _id: req.params.id
    });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const furnishedOn = readDate(req.body.furnishedOn);
    if (!furnishedOn) {
      return res
        .status(400)
        .json({ message: 'furnishedOn must be a valid date' });
    }

    const assessmentYear = assessmentYearOf(financialYearOf(claim.paidOn));

    const furnishing = await FormTenEFurnishing.findOneAndUpdate(
      {
        claimId: claim._id
      },
      {
        $set: {
          employeeId: claim.employeeId,
          furnishedOn,
          assessmentYear,
          acknowledgement: String(req.body.acknowledgement || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'RELIEF_FORM_10E_FURNISHED',
      resourceType: 'FormTenEFurnishing',
      resourceIds: [furnishing._id],
      details: {
        claimId: claim._id,
        employeeId: claim.employeeId,
        furnishedOn,
        assessmentYear,
        // Audited because this date is what decides whether the relief stands.
        returnFiledOn: claim.returnFiledOn || null,
      },
      req,
    });

    return res.status(201).json({ furnishing });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/section-89-relief/claims/:id/apply
 *
 * Refuses where Form 10E is not on file. This is the whole of section 192(2A)
 * and the one place the module says no.
 */
exports.applyRelief = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const claim = await ArrearReliefClaim.findOne({
      _id: req.params.id
    });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const { rateTables, assessedYears } = await loadBasis({
      employeeId: claim.employeeId
    });
    const furnishings = await loadFurnishings({
      claimIds: [claim._id]
    });

    const assessment = assessArrear({
      arrear: {
        amount: claim.amount,
        paidOn: claim.paidOn,
        relatesFrom: claim.relatesFrom,
        relatesTo: claim.relatesTo,
        allocation: claim.allocation,
        regime: claim.regime,
        totalIncomeExcludingArrears: claim.totalIncomeExcludingArrears,
      },
      assessedYears,
      rateTables,
      furnishing: furnishings.get(String(claim._id)) || null,
      applied: claim.applied,
      returnFiledOn: claim.returnFiledOn,
    });

    if (!assessment.authority.mayApply) {
      return res.status(409).json({
        message: assessment.authority.reason,
        reliefComputed: assessment.reliefComputed,
        reliefApplicable: 0,
        conditional: RELIEF_IS_CONDITIONAL,
      });
    }

    claim.applied = true;
    claim.appliedOn = new Date();
    await claim.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'RELIEF_APPLIED_TO_TDS',
      resourceType: 'ArrearReliefClaim',
      resourceIds: [claim._id],
      details: {
        employeeId: claim.employeeId,
        relief: assessment.reliefApplicable,
        assessmentYear: assessmentYearOf(financialYearOf(claim.paidOn)),
        formFurnishedOn: assessment.authority.furnishedOn,
      },
      req,
    });

    return res.json({ claim, assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/section-89-relief/claims/:id/form-10e
 *
 * Annexure I and Table A, built from the same computation as the screen. A form
 * that is re-derived can disagree with the figure the employee was shown, and
 * only one of the two is on the return.
 */
exports.getFormTenE = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid claim id' });
    }

    const claim = await ArrearReliefClaim.findOne({
      _id: req.params.id
    }).lean();
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const { rateTables, assessedYears } = await loadBasis({
      employeeId: claim.employeeId
    });

    const assessment = assessArrear({
      arrear: claim,
      assessedYears,
      rateTables,
    });

    return res.json({
      form: formTenE(assessment.relief),
      // An incomplete form is offered, and says so. Withholding it would leave
      // the employee with nothing to work from; presenting it as complete would
      // put a zero where the module has not computed a figure.
      complete: assessment.form10E.complete,
      conditional: RELIEF_IS_CONDITIONAL,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/section-89-relief/position
 *
 * One employee's complete position: every arrear, its relief, whether it may be
 * given, and the gaps stopping the ones that cannot be computed.
 */
exports.getPosition = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const employeeId = req.query.employeeId;

    const claims = await ArrearReliefClaim.find({
      employeeId
    })
      .sort({ paidOn: -1 })
      .lean();

    const { rateTables, assessedYears } = await loadBasis({
      employeeId
    });
    const furnishings = await loadFurnishings({
      claimIds: claims.map((claim) => claim._id)
    });

    const result = assessEmployee({
      arrears: claims.map((claim) => ({
        ...claim,
        furnishing: furnishings.get(String(claim._id)) || null,
        applied: claim.applied,
        returnFiledOn: claim.returnFiledOn,
      })),
      assessedYears,
      rateTables,
      asAt: new Date(),
    });

    return res.json({
      employeeId,
      result,
      // Returned alongside so the page can say *which* year is missing rather
      // than that something is.
      assessmentYearsCovered: [
        ...new Set(rateTables.map((table) => table.assessmentYear)),
      ].sort(),
      conditional: RELIEF_IS_CONDITIONAL,
    });
  } catch (error) {
    return next(error);
  }
};
