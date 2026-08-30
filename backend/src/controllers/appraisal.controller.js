/**
 * @fileoverview Appraisal Controller
 * @description Manages the lifecycle of performance reviews, goal tracking, and scoring.
 * Issue: #983
 */
const {
  AppraisalCycle,
  AppraisalGoal,
  AppraisalReview,
} = require('../models/appraisal.model');
const Employee = require('../models/employee.model');
const {
  calculateFinalScore,
  suggestIncrement,
} = require('../utils/appraisalScorer');
const {
  DEFAULT_DISTRIBUTION,
  applyZScoreNormalization,
  applyForcedDistribution,
  buildDistributionReport,
  calibrateIncrementBudget,
} = require('../utils/appraisalNormalizer');
const User = require('../models/user.model');
const eventBus = require('../services/event.service');
const { tenantFilter } = require('../utils/tenantScope');
const lifecycleEventService = require('../services/lifecycleEvent.service');

/**
 * Load a cycle and the finalised reviews that make up its calibration cohort.
 *
 * Only finalised reviews take part. A cycle half-way through manager review
 * would otherwise be calibrated against whoever happened to have submitted so
 * far, and every band would move again the moment another manager finished.
 *
 * @param {object} req
 * @param {string} cycleId
 * @returns {Promise<object>}
 */
async function loadCalibrationCohort(req, cycleId) {
  // Scoped (#1010): the id comes from the URL, so an unscoped lookup would let
  // a caller at one company calibrate another company's cycle.
  const cycle = await AppraisalCycle.findOne(
    tenantFilter(req, { _id: cycleId }),
  );

  if (!cycle) {
    return { ok: false, status: 404, message: 'Appraisal cycle not found' };
  }

  const reviews = await AppraisalReview.find(
    tenantFilter(req, { cycleId: cycle._id, status: 'Finalized' }),
  );

  return { ok: true, cycle, reviews };
}

/**
 * The distribution a cycle is calibrated against.
 *
 * A cycle already calibrated keeps the spread it was calibrated against;
 * anything else uses the current default.
 *
 * @param {object} cycle
 * @returns {object[]}
 */
function distributionFor(cycle) {
  const stored = cycle?.targetDistribution;

  return Array.isArray(stored) && stored.length
    ? stored.map((band) => (band.toObject ? band.toObject() : band))
    : DEFAULT_DISTRIBUTION;
}

/**
 * Attach each review's monthly salary, which the budget fit prices from.
 *
 * One query for the whole cohort rather than one per review: a 400-person
 * cycle would otherwise issue 400 round trips to price a single preview.
 *
 * @param {object[]} assignments
 * @param {object[]} reviews
 * @param {object} req
 * @returns {Promise<object[]>}
 */
async function attachSalaries(assignments, reviews, req) {
  const employeeIds = reviews
    .map((review) => review.employeeId)
    .filter(Boolean);

  const employees = await Employee.find(
    tenantFilter(req, { _id: { $in: employeeIds } }),
  ).select('fullName monthlySalary');

  const byEmployeeId = new Map(employees.map((emp) => [String(emp._id), emp]));
  const employeeByReview = new Map(
    reviews.map((review) => [String(review._id), String(review.employeeId)]),
  );

  return assignments.map((entry) => {
    const employeeId = employeeByReview.get(String(entry.reviewId));
    const employee = employeeId ? byEmployeeId.get(employeeId) : null;

    return {
      ...entry,
      employeeId: employeeId || entry.employeeId || null,
      employeeName: employee?.fullName || null,
      monthlySalary: Number(employee?.monthlySalary) || 0,
    };
  });
}

/**
 * Run the whole calibration pipeline over a cohort, writing nothing.
 *
 * Shared by the preview and the commit so the two cannot drift: a preview that
 * computes its bands differently from the endpoint that saves them is worse
 * than no preview at all.
 *
 * @param {object} req
 * @param {object} cycle
 * @param {object[]} reviews
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function runCalibration(req, cycle, reviews, options = {}) {
  const distribution = options.distribution || distributionFor(cycle);

  const normalization = applyZScoreNormalization(reviews, {
    maxShift: options.maxShift,
    scaleCorrection: options.scaleCorrection,
  });

  const forced = applyForcedDistribution(normalization.reviews, distribution);
  const priced = await attachSalaries(forced.assignments, reviews, req);
  const budget = calibrateIncrementBudget(priced, {
    totalBudget: options.totalBudget,
  });

  return {
    distribution,
    normalization,
    forced,
    budget,
    report: buildDistributionReport(forced.assignments, distribution),
  };
}

/**
 * POST /api/appraisals/cycles
 * HR creates a new appraisal cycle (e.g., "H1 2026").
 */
exports.createCycle = async (req, res, next) => {
  try {
    const { name, startDate, endDate } = req.body;
    const cycle = await AppraisalCycle.create({
      tenantId: req.tenantId,
      name,
      startDate,
      endDate,
      createdBy: req.userId,
    });
    res.status(201).json({ message: 'Appraisal cycle created', cycle });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/appraisals/goals
 * Manager or Employee adds/updates goals for a specific cycle.
 */
exports.upsertGoals = async (req, res, next) => {
  try {
    const { cycleId, employeeId, goals } = req.body; // goals is an array of {title, weightage, etc.}

    // Validate total weightage equals 100
    const totalWeight = goals.reduce((sum, g) => sum + Number(g.weightage), 0);
    if (totalWeight !== 100) {
      return res.status(400).json({
        message: `Total goal weightage must equal 100%. Currently: ${totalWeight}%`,
      });
    }

    // Delete existing goals for this employee/cycle and replace (simplest upsert strategy)
    await AppraisalGoal.deleteMany({
      tenantId: req.tenantId,
      cycleId,
      employeeId,
    });

    const newGoals = goals.map((g) => ({
      tenantId: req.tenantId,
      cycleId,
      employeeId,
      title: g.title,
      description: g.description,
      weightage: g.weightage,
      targetMetric: g.targetMetric,
    }));

    await AppraisalGoal.insertMany(newGoals);

    // Ensure a review document exists in Draft state
    await AppraisalReview.findOneAndUpdate(
      { tenantId: req.tenantId, cycleId, employeeId },
      {
        $setOnInsert: {
          tenantId: req.tenantId,
          cycleId,
          employeeId,
          managerId: req.userId,
          status: 'Draft',
        },
      },
      { upsert: true, new: true },
    );

    res.status(200).json({ message: 'Goals updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/appraisals/reviews/:id/self-review
 * Employee submits their self-review ratings and remarks.
 */
exports.submitSelfReview = async (req, res, next) => {
  try {
    // Scoped (#1010). `findById` on a `:id` from the URL let a caller at
    // one company address another company's review.
    const review = await AppraisalReview.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (
      !review ||
      (review.status !== 'Draft' && review.status !== 'Self-Review')
    ) {
      return res
        .status(400)
        .json({ message: 'Review is not in a state to accept self-reviews' });
    }

    const { goalRatings } = req.body; // Array of { goalId, selfAchievement, selfRemarks }

    if (!Array.isArray(goalRatings)) {
      return res.status(400).json({ message: 'goalRatings must be an array' });
    }

    for (const rating of goalRatings) {
      // The goal ids come from the request body, not from the review, so
      // they are as untrusted as the `:id` above — and this one is a
      // *write*. Unscoped, it let a caller edit the achievement figures
      // on any goal in the database by id, in any company, without ever
      // touching a review they were not entitled to.
      //
      // Scoped to the review as well as the tenant: a goal belonging to
      // this company but to a different employee or a different cycle is
      // still not this review's to rate.
      await AppraisalGoal.findOneAndUpdate(
        tenantFilter(req, {
          _id: rating.goalId,
          cycleId: review.cycleId,
          employeeId: review.employeeId,
        }),
        {
          selfAchievement: rating.selfAchievement,
          selfRemarks: rating.selfRemarks,
        },
      );
    }

    review.status = 'Manager-Review';
    await review.save();

    res.status(200).json({ message: 'Self-review submitted to manager' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/appraisals/reviews/:id/manager-review
 * Manager submits final ratings, qualitative feedback, and finalizes the review.
 */
exports.submitManagerReview = async (req, res, next) => {
  try {
    // Scoped (#1010), for the same reason as the self-review above. This
    // one carries more: the manager's rating drives `finalScore` and the
    // recommended increment percentage.
    const review = await AppraisalReview.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!review || review.status !== 'Manager-Review') {
      return res
        .status(400)
        .json({ message: 'Review is not pending manager review' });
    }

    const { goalRatings, managerOverallRating, managerQualitativeFeedback } =
      req.body;

    if (!Array.isArray(goalRatings)) {
      return res.status(400).json({ message: 'goalRatings must be an array' });
    }

    // Update manager's rating for each goal
    for (const rating of goalRatings) {
      await AppraisalGoal.findOneAndUpdate(
        tenantFilter(req, {
          _id: rating.goalId,
          cycleId: review.cycleId,
          employeeId: review.employeeId,
        }),
        {
          managerAchievement: rating.managerAchievement,
          managerRemarks: rating.managerRemarks,
        },
      );
    }

    // Fetch updated goals to calculate final score
    const goals = await AppraisalGoal.find(
      tenantFilter(req, {
        cycleId: review.cycleId,
        employeeId: review.employeeId,
      }),
    );

    const finalScore = calculateFinalScore(goals, managerOverallRating);
    const recommendedIncrement = suggestIncrement(finalScore);

    review.managerOverallRating = managerOverallRating;
    review.managerQualitativeFeedback = managerQualitativeFeedback;
    review.finalScore = finalScore;
    review.recommendedIncrementPercent = recommendedIncrement;
    review.status = 'Finalized';
    review.finalizedAt = new Date();

    await review.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRAISAL_FINALIZED',
      resourceType: 'AppraisalReview',
      resourceIds: [review._id],
      details: {
        employeeId: review.employeeId,
        finalScore,
        recommendedIncrement,
      },
      req,
    });

    await lifecycleEventService.recordEvent({
      employeeId: review.employeeId,
      tenantId: review.tenantId,
      eventType: 'APPRAISAL_COMPLETED',
      category: 'Performance',
      recordedBy: req.userId,
      newValues: {
        finalScore,
        recommendedIncrement,
        managerRating: managerOverallRating,
      },
      sourceId: review._id,
    });

    res.status(200).json({ message: 'Appraisal finalized', review });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appraisals/my-review?cycleId=xxx
 * Employee or Manager fetches the review document and associated goals.
 */
exports.getMyReview = async (req, res, next) => {
  try {
    const { cycleId } = req.query;
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const review = await AppraisalReview.findOne({
      tenantId: req.tenantId,
      cycleId,
      employeeId: employee._id,
    }).populate('managerId', 'fullName');

    const goals = await AppraisalGoal.find({
      tenantId: req.tenantId,
      cycleId,
      employeeId: employee._id,
    });

    res.status(200).json({ review, goals });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appraisals/cycles/:id/distribution
 * The cycle's rating spread against target, and each manager's leniency.
 *
 * The read HR needs before a calibration meeting: which managers rate above
 * the company and by how much, and how far the cycle sits from its target
 * spread. None of it exists today.
 */
exports.getCycleDistribution = async (req, res, next) => {
  try {
    const cohort = await loadCalibrationCohort(req, req.params.id);
    if (!cohort.ok) {
      return res.status(cohort.status).json({ message: cohort.message });
    }

    const { cycle, reviews } = cohort;
    const distribution = distributionFor(cycle);

    // Reported on the scores as they stand — before any normalisation — because
    // that is the thing being diagnosed.
    const current = reviews.map((review) => ({
      reviewId: String(review._id),
      employeeId: review.employeeId ? String(review.employeeId) : null,
      originalScore: Number(review.finalScore) || 0,
      normalizedScore:
        review.normalizedScore === null ? undefined : review.normalizedScore,
      band: review.calibrationBand || undefined,
    }));

    const statistics = applyZScoreNormalization(reviews).statistics;

    res.status(200).json({
      cycle: {
        id: String(cycle._id),
        name: cycle.name,
        status: cycle.status,
        calibratedAt: cycle.calibratedAt,
        incrementBudget: cycle.incrementBudget,
      },
      cohortSize: reviews.length,
      statistics,
      distribution: buildDistributionReport(current, distribution),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/appraisals/cycles/:id/normalize
 * Model the calibration without persisting any of it.
 *
 * Deliberately a preview. Moving somebody's rating is the most contested thing
 * this module does, and it should be possible to see the whole cohort's
 * outcome — and what it costs — before anything is committed.
 */
exports.previewCalibration = async (req, res, next) => {
  try {
    const cohort = await loadCalibrationCohort(req, req.params.id);
    if (!cohort.ok) {
      return res.status(cohort.status).json({ message: cohort.message });
    }

    const { cycle, reviews } = cohort;

    if (!reviews.length) {
      return res.status(400).json({
        message: 'This cycle has no finalized reviews to calibrate',
      });
    }

    const result = await runCalibration(req, cycle, reviews, {
      maxShift: req.body?.maxShift,
      scaleCorrection: req.body?.scaleCorrection,
      totalBudget: req.body?.totalBudget ?? cycle.incrementBudget,
    });

    res.status(200).json({
      message: 'Calibration preview generated. Nothing has been saved.',
      cohortSize: reviews.length,
      normalizationApplied: result.normalization.applied,
      normalizationSkippedReason: result.normalization.reason,
      statistics: result.normalization.statistics,
      distribution: result.report,
      movedCount: result.forced.movedCount,
      budget: {
        totalBudget: result.budget.totalBudget,
        requestedCost: result.budget.requestedCost,
        approvedCost: result.budget.approvedCost,
        scaled: result.budget.scaled,
        scalingFactor: result.budget.scalingFactor,
        reason: result.budget.reason,
      },
      assignments: result.budget.assignments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/appraisals/cycles/:id/calibrate
 * Persist the normalised scores, bands and approved increments.
 */
exports.calibrateCycle = async (req, res, next) => {
  try {
    const cohort = await loadCalibrationCohort(req, req.params.id);
    if (!cohort.ok) {
      return res.status(cohort.status).json({ message: cohort.message });
    }

    const { cycle, reviews } = cohort;

    if (!reviews.length) {
      return res.status(400).json({
        message: 'This cycle has no finalized reviews to calibrate',
      });
    }

    // Calibrating twice would re-normalise scores that have already been
    // normalised — the second pass is fed the corrected figures and corrects
    // them again. `recalibrate: true` is the explicit way to redo it.
    if (cycle.calibratedAt && req.body?.recalibrate !== true) {
      return res.status(409).json({
        message:
          'This cycle has already been calibrated. Pass recalibrate: true to run it again.',
        calibratedAt: cycle.calibratedAt,
      });
    }

    const result = await runCalibration(req, cycle, reviews, {
      maxShift: req.body?.maxShift,
      scaleCorrection: req.body?.scaleCorrection,
      totalBudget: req.body?.totalBudget ?? cycle.incrementBudget,
      distribution:
        Array.isArray(req.body?.distribution) && req.body.distribution.length
          ? req.body.distribution
          : undefined,
    });

    const byReviewId = new Map(
      result.budget.assignments.map((entry) => [String(entry.reviewId), entry]),
    );

    const now = new Date();

    // One write per review, and each one scoped by tenant as well as by id.
    // `finalScore` is deliberately not touched: overwriting it would destroy
    // the only record of what the manager actually assessed, and an employee
    // asking why their rating moved could not be shown both numbers.
    const operations = reviews
      .map((review) => {
        const outcome = byReviewId.get(String(review._id));
        if (!outcome) return null;

        return {
          updateOne: {
            filter: tenantFilter(req, { _id: review._id }),
            update: {
              $set: {
                normalizedScore: outcome.normalizedScore,
                calibrationBand: outcome.band,
                approvedIncrementPercent: outcome.approvedIncrementPercent,
                calibratedAt: now,
                calibratedBy: req.userId,
              },
            },
          },
        };
      })
      .filter(Boolean);

    if (operations.length) {
      await AppraisalReview.bulkWrite(operations);
    }

    cycle.targetDistribution = result.distribution;
    cycle.incrementBudget = result.budget.totalBudget;
    cycle.calibratedAt = now;
    cycle.calibratedBy = req.userId;
    await cycle.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRAISAL_CYCLE_CALIBRATED',
      resourceType: 'AppraisalCycle',
      resourceIds: [cycle._id],
      details: {
        cycleName: cycle.name,
        cohortSize: reviews.length,
        normalizationApplied: result.normalization.applied,
        movedCount: result.forced.movedCount,
        requestedCost: result.budget.requestedCost,
        approvedCost: result.budget.approvedCost,
        budgetScaled: result.budget.scaled,
      },
      req,
    });

    res.status(200).json({
      message: 'Cycle calibrated',
      cohortSize: reviews.length,
      updatedCount: operations.length,
      distribution: result.report,
      movedCount: result.forced.movedCount,
      budget: {
        totalBudget: result.budget.totalBudget,
        requestedCost: result.budget.requestedCost,
        approvedCost: result.budget.approvedCost,
        scaled: result.budget.scaled,
      },
    });
  } catch (error) {
    next(error);
  }
};
