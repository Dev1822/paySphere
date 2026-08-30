const PulseSurvey = require('../models/pulseSurvey.model');
const Employee = require('../models/employee.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

// ─── Admin: Survey Lifecycle ─────────────────────────────────────────────────

/**
 * Create a new pulse survey in draft state.
 *
 * The survey starts as `draft` so the admin can review and edit before
 * publishing.  Question validation is handled by the Mongoose schema.
 */
exports.createSurvey = async (req, res, next) => {
  try {
    const { title, description, questions, targetDepartments } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: 'title and at least one question are required',
      });
    }

    for (const q of questions) {
      if (!q.text || !q.type) {
        return res.status(400).json({
          message: 'Each question must have text and type',
        });
      }
    }

    const survey = await PulseSurvey.create({
      title: title.trim(),
      description: description || '',
      questions,
      targetDepartments: Array.isArray(targetDepartments) ? targetDepartments : [],
      createdBy: req.userId,
      tenantId: req.tenantId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SURVEY_CREATE',
      resourceType: 'PulseSurvey',
      resourceIds: [survey._id],
      details: { title: survey.title, questionCount: questions.length },
      req,
    });

    logger.info('Pulse survey created', { userId: req.userId, surveyId: survey._id });

    res.status(201).json({ message: 'Survey created', survey });
  } catch (error) {
    next(error);
  }
};

/**
 * List surveys with optional status filter.
 */
exports.getSurveys = async (req, res, next) => {
  try {
    const filter = tenantFilter(req);
    if (req.query.status) filter.status = req.query.status;

    const surveys = await PulseSurvey.find(filter)
      .sort({ createdAt: -1 })
      .select('-responses');

    // Add response counts
    const summaries = surveys.map((s) => ({
      _id: s._id,
      title: s.title,
      description: s.description,
      status: s.status,
      questionCount: s.questions.length,
      responseCount: s.responses.length,
      publishedAt: s.publishedAt,
      closesAt: s.closesAt,
      createdAt: s.createdAt,
    }));

    res.status(200).json({ surveys: summaries });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single survey by ID with full details (for admin).
 */
exports.getSurveyById = async (req, res, next) => {
  try {
    const survey = await PulseSurvey.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    const totalEmployees = await Employee.countDocuments(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    );

    res.status(200).json({
      survey,
      stats: {
        totalEmployees,
        responseCount: survey.responses.length,
        responseRate: totalEmployees > 0
          ? Math.round((survey.responses.length / totalEmployees) * 100)
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publish a draft survey — sets status to 'active' and records publishedAt.
 */
exports.publishSurvey = async (req, res, next) => {
  try {
    const survey = await PulseSurvey.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    if (survey.status !== 'draft') {
      return res.status(400).json({
        message: `Cannot publish a survey in "${survey.status}" status`,
      });
    }

    survey.status = 'active';
    survey.publishedAt = new Date();
    if (req.body.closesAt) survey.closesAt = new Date(req.body.closesAt);
    await survey.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SURVEY_PUBLISH',
      resourceType: 'PulseSurvey',
      resourceIds: [survey._id],
      details: { title: survey.title },
      req,
    });

    res.status(200).json({ message: 'Survey published', survey });
  } catch (error) {
    next(error);
  }
};

/**
 * Close a survey — no more responses accepted.
 */
exports.closeSurvey = async (req, res, next) => {
  try {
    const survey = await PulseSurvey.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    if (survey.status !== 'active') {
      return res.status(400).json({ message: 'Survey is not active' });
    }

    survey.status = 'closed';
    await survey.save();

    res.status(200).json({ message: 'Survey closed', survey });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a survey (only drafts can be deleted).
 */
exports.deleteSurvey = async (req, res, next) => {
  try {
    const survey = await PulseSurvey.findOneAndDelete(
      tenantFilter(req, { _id: req.params.id, status: 'draft' }),
    );

    if (!survey) {
      return res.status(404).json({ message: 'Draft survey not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SURVEY_DELETE',
      resourceType: 'PulseSurvey',
      resourceIds: [survey._id],
      details: { title: survey.title },
      req,
    });

    res.status(200).json({ message: 'Survey deleted' });
  } catch (error) {
    next(error);
  }
};

// ─── Employee: Respond ───────────────────────────────────────────────────────

/**
 * Get active surveys the current employee is eligible for and has not yet
 * responded to.
 */
exports.getAvailableSurveys = async (req, res, next) => {
  try {
    const employee = await Employee.findOne(
      tenantFilter(req, { createdBy: req.userId }),
    );
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const now = new Date();
    const allActive = await PulseSurvey.find(
      tenantFilter(req, { status: 'active' }),
    ).select('-responses');

    const available = allActive.filter((survey) => {
      // Check department targeting
      if (survey.targetDepartments.length > 0 &&
          !survey.targetDepartments.includes(employee.department)) {
        return false;
      }
      // Check if closed by time
      if (survey.closesAt && survey.closesAt < now) return false;
      // Check if already responded
      const already = survey.responses.some(
        (r) => r.employeeId.toString() === employee._id.toString(),
      );
      return !already;
    });

    res.status(200).json({ surveys: available });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit a response to an active survey.
 *
 * Idempotent — if the employee has already responded, returns the existing
 * response without overwriting.
 */
exports.submitResponse = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'answers array is required' });
    }

    const survey = await PulseSurvey.findOne(
      tenantFilter(req, { _id: surveyId, status: 'active' }),
    );
    if (!survey) {
      return res.status(404).json({ message: 'Active survey not found' });
    }

    const employee = await Employee.findOne(
      tenantFilter(req, { createdBy: req.userId }),
    );
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    // Check department eligibility
    if (survey.targetDepartments.length > 0 &&
        !survey.targetDepartments.includes(employee.department)) {
      return res.status(403).json({ message: 'Survey not available for your department' });
    }

    // Check auto-close
    if (survey.closesAt && survey.closesAt < new Date()) {
      return res.status(400).json({ message: 'Survey has expired' });
    }

    // Idempotent check
    const already = survey.responses.find(
      (r) => r.employeeId.toString() === employee._id.toString(),
    );
    if (already) {
      return res.status(200).json({ message: 'Response already submitted' });
    }

    // Validate answers against questions
    const questionIds = survey.questions.map((q) => q._id.toString());
    for (const ans of answers) {
      if (!ans.questionId || !questionIds.includes(ans.questionId)) {
        return res.status(400).json({
          message: `Invalid questionId: ${ans.questionId}`,
        });
      }
    }

    survey.responses.push({
      employeeId: employee._id,
      answers,
      submittedAt: new Date(),
    });
    await survey.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SURVEY_RESPONSE',
      resourceType: 'PulseSurvey',
      resourceIds: [survey._id],
      details: { surveyTitle: survey.title },
      req,
    });

    res.status(201).json({ message: 'Response submitted' });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Results ──────────────────────────────────────────────────────────

/**
 * Aggregated results for a survey — returns per-question breakdown.
 *
 * For rating questions: average, median, distribution.
 * For multiple_choice / yes_no: vote counts per option.
 */
exports.getSurveyResults = async (req, res, next) => {
  try {
    const survey = await PulseSurvey.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    const results = survey.questions.map((question) => {
      const qAnswers = survey.responses
        .map((r) => r.answers.find((a) => a.questionId?.toString() === question._id.toString()))
        .filter(Boolean);

      const base = {
        questionId: question._id,
        text: question.text,
        type: question.type,
        totalAnswers: qAnswers.length,
      };

      if (question.type === 'rating') {
        const values = qAnswers.map((a) => Number(a.value)).filter((v) => !isNaN(v));
        const sorted = [...values].sort((a, b) => a - b);
        const avg = values.length > 0
          ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
          : 0;
        const median = values.length > 0
          ? sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)]
          : 0;

        // Distribution
        const distribution = {};
        for (let i = 1; i <= (question.maxRating || 5); i++) {
          distribution[i] = values.filter((v) => v === i).length;
        }

        return { ...base, average: avg, median, distribution };
      }

      // Multiple choice / yes_no
      const options = question.type === 'yes_no'
        ? ['Yes', 'No']
        : question.options || [];
      const counts = {};
      for (const opt of options) counts[opt] = 0;

      for (const a of qAnswers) {
        const val = String(a.value);
        if (counts[val] !== undefined) counts[val]++;
      }

      const topOption = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

      return {
        ...base,
        options,
        counts,
        topOption: topOption ? topOption[0] : null,
      };
    });

    const totalEmployees = await Employee.countDocuments(
      tenantFilter(req, { isActive: true, deletedAt: null }),
    );

    res.status(200).json({
      survey: {
        _id: survey._id,
        title: survey.title,
        status: survey.status,
        publishedAt: survey.publishedAt,
      },
      stats: {
        totalEmployees,
        responseCount: survey.responses.length,
        responseRate: totalEmployees > 0
          ? Math.round((survey.responses.length / totalEmployees) * 100)
          : 0,
      },
      results,
    });
  } catch (error) {
    next(error);
  }
};
