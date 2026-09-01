/**
 * @fileoverview Employee Survey & Pulse Check Controller
 * @description Manages survey creation, response collection, pulse check campaigns,
 * analytics aggregation, and engagement dashboard.
 */
const {
  Survey,
  SurveyResponse,
  PulseCheck,
  PulseCheckResponse,
} = require('../models/survey.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

// ============================================================================
// Surveys
// ============================================================================

exports.createSurvey = async (req, res, next) => {
  try {
    const { title, description, type, questions, isAnonymous, targetDepartments, targetAll, startDate, endDate } = req.body;

    const survey = await Survey.create({
      title,
      description: description || '',
      type: type || 'PULSE',
      questions: questions || [],
      isAnonymous: isAnonymous !== false,
      targetDepartments: targetDepartments || [],
      targetAll: targetAll !== false,
      status: 'DRAFT',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SURVEY_CREATED',
      resourceType: 'Survey',
      resourceIds: [survey._id],
      details: { title, type: survey.type, questionCount: survey.questions.length },
      req,
    });

    res.status(201).json({ survey });
  } catch (error) {
    next(error);
  }
};

exports.getSurveys = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const surveys = await Survey.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ surveys });
  } catch (error) {
    next(error);
  }
};

exports.getSurvey = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const survey = await Survey.findOne({ _id: surveyId })
      .populate('createdBy', 'name email')
      .lean();

    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    res.status(200).json({ survey });
  } catch (error) {
    next(error);
  }
};

exports.publishSurvey = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const survey = await Survey.findOne({ _id: surveyId });
    if (!survey) return res.status(404).json({ message: 'Survey not found' });

    if (survey.questions.length === 0) {
      return res.status(400).json({ message: 'Cannot publish a survey with no questions' });
    }

    survey.status = 'ACTIVE';
    survey.startDate = new Date();
    await survey.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SURVEY_PUBLISHED',
      resourceType: 'Survey',
      resourceIds: [survey._id],
      details: { title: survey.title },
      req,
    });

    res.status(200).json({ survey });
  } catch (error) {
    next(error);
  }
};

exports.closeSurvey = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const survey = await Survey.findOne({ _id: surveyId });
    if (!survey) return res.status(404).json({ message: 'Survey not found' });

    survey.status = 'CLOSED';
    survey.endDate = new Date();
    await survey.save();

    res.status(200).json({ survey });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Survey Responses
// ============================================================================

exports.submitSurveyResponse = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const { answers, completionTime } = req.body;

    const survey = await Survey.findOne({ _id: surveyId, status: 'ACTIVE' });
    if (!survey) return res.status(404).json({ message: 'Active survey not found' });

    // Check for duplicate response (unless anonymous)
    if (!survey.isAnonymous) {
      const existing = await SurveyResponse.findOne(
        { surveyId, respondentId: req.userId },
      );
      if (existing) {
        return res.status(409).json({ message: 'You have already responded to this survey' });
      }
    }

    // Enrich answers with question metadata
    const enrichedAnswers = (answers || []).map((a) => {
      const question = survey.questions.id(a.questionId);
      return {
        questionId: a.questionId,
        questionText: question?.questionText || '',
        questionType: question?.questionType || '',
        value: a.value,
        textValue: a.textValue || '',
      };
    });

    const response = await SurveyResponse.create({
      surveyId,
      respondentId: survey.isAnonymous ? null : req.userId,
      isAnonymous: survey.isAnonymous,
      answers: enrichedAnswers,
      department: req.body.department || '',
      completionTime: completionTime || 0
    });

    // Update survey counters
    await Survey.findByIdAndUpdate(surveyId, {
      $inc: { responseCount: 1 },
    });

    res.status(201).json({ message: 'Response submitted successfully', responseId: response._id });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'You have already responded to this survey' });
    }
    next(error);
  }
};

exports.getSurveyAnalytics = async (req, res, next) => {
  try {
    const { surveyId } = req.params;

    const [survey, responses] = await Promise.all([
      Survey.findOne({ _id: surveyId }).lean(),
      SurveyResponse.find({ surveyId }).lean(),
    ]);

    if (!survey) return res.status(404).json({ message: 'Survey not found' });

    // Aggregate responses by question
    const questionAnalytics = survey.questions.map((question) => {
      const questionResponses = responses
        .map((r) => r.answers.find((a) => String(a.questionId) === String(question._id)))
        .filter(Boolean);

      const numericValues = questionResponses
        .map((a) => Number(a.value))
        .filter((v) => !Number.isNaN(v));

      const avg = numericValues.length > 0
        ? Math.round((numericValues.reduce((s, v) => s + v, 0) / numericValues.length) * 100) / 100
        : 0;

      const distribution = {};
      numericValues.forEach((v) => {
        distribution[v] = (distribution[v] || 0) + 1;
      });

      const textResponses = questionResponses
        .filter((a) => a.textValue)
        .map((a) => a.textValue);

      return {
        questionId: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        totalResponses: questionResponses.length,
        avg,
        distribution,
        textResponses: textResponses.slice(0, 20),
      };
    });

    // Department breakdown
    const deptBreakdown = {};
    responses.forEach((r) => {
      if (r.department) {
        deptBreakdown[r.department] = (deptBreakdown[r.department] || 0) + 1;
      }
    });

    res.status(200).json({
      survey,
      totalResponses: responses.length,
      questionAnalytics,
      departmentBreakdown: deptBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Pulse Checks
// ============================================================================

exports.createPulseCheck = async (req, res, next) => {
  try {
    const { title, question, questionType, endDate } = req.body;

    const pulse = await PulseCheck.create({
      title,
      question,
      questionType: questionType || 'EMOJI_1_5',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PULSE_CHECK_CREATED',
      resourceType: 'PulseCheck',
      resourceIds: [pulse._id],
      details: { title, question },
      req,
    });

    res.status(201).json({ pulse });
  } catch (error) {
    next(error);
  }
};

exports.getPulseChecks = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const pulses = await PulseCheck.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ pulses });
  } catch (error) {
    next(error);
  }
};

exports.respondToPulse = async (req, res, next) => {
  try {
    const { pulseCheckId } = req.params;
    const { value, emoji } = req.body;

    const pulse = await PulseCheck.findOne(
      { _id: pulseCheckId, status: 'ACTIVE' },
    );
    if (!pulse) return res.status(404).json({ message: 'Active pulse check not found' });

    const response = await PulseCheckResponse.findOneAndUpdate(
      { pulseCheckId, respondentId: req.userId },
      {
        $set: {
          value,
          emoji: emoji || '',
          department: req.body.department || '',
          respondedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // Recalculate avg score
    const allResponses = await PulseCheckResponse.find(
      { pulseCheckId },
    );
    const avgScore = allResponses.length > 0
      ? Math.round((allResponses.reduce((s, r) => s + r.value, 0) / allResponses.length) * 100) / 100
      : 0;

    // Determine sentiment
    const maxScore = pulse.questionType === 'EMOJI_1_5' ? 5 : pulse.questionType === 'YES_NO' ? 1 : 10;
    const sentimentRatio = avgScore / maxScore;
    const sentiment = sentimentRatio >= 0.7 ? 'POSITIVE' : sentimentRatio >= 0.4 ? 'NEUTRAL' : 'NEGATIVE';

    await PulseCheck.findByIdAndUpdate(pulseCheckId, {
      $inc: { responseCount: 1 },
      $set: { avgScore, sentiment },
    });

    res.status(201).json({ message: 'Response recorded', response });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ message: 'Response updated' });
    }
    next(error);
  }
};

exports.getPulseAnalytics = async (req, res, next) => {
  try {
    const { pulseCheckId } = req.params;

    const [pulse, responses] = await Promise.all([
      PulseCheck.findOne({ _id: pulseCheckId }).lean(),
      PulseCheckResponse.find({ pulseCheckId }).lean(),
    ]);

    if (!pulse) return res.status(404).json({ message: 'Pulse check not found' });

    // Distribution
    const distribution = {};
    responses.forEach((r) => {
      distribution[r.value] = (distribution[r.value] || 0) + 1;
    });

    // Department breakdown
    const deptBreakdown = {};
    responses.forEach((r) => {
      if (r.department) {
        if (!deptBreakdown[r.department]) deptBreakdown[r.department] = { count: 0, total: 0 };
        deptBreakdown[r.department].count += 1;
        deptBreakdown[r.department].total += r.value;
      }
    });

    const deptAverages = Object.entries(deptBreakdown).map(([dept, data]) => ({
      department: dept,
      count: data.count,
      avg: Math.round((data.total / data.count) * 100) / 100,
    }));

    res.status(200).json({
      pulse,
      totalResponses: responses.length,
      avgScore: pulse.avgScore,
      sentiment: pulse.sentiment,
      distribution,
      departmentAverages: deptAverages,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Dashboard
// ============================================================================

exports.getDashboard = async (req, res, next) => {
  try {
    const [
      totalSurveys,
      activeSurveys,
      totalPulseChecks,
      activePulseChecks,
      totalResponses,
      recentSurveys,
      recentPulses,
    ] = await Promise.all([
      Survey.countDocuments({}),
      Survey.countDocuments({ status: 'ACTIVE' }),
      PulseCheck.countDocuments({}),
      PulseCheck.countDocuments({ status: 'ACTIVE' }),
      SurveyResponse.countDocuments({}),
      Survey.find({})
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      PulseCheck.find({})
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    res.status(200).json({
      totalSurveys,
      activeSurveys,
      totalPulseChecks,
      activePulseChecks,
      totalResponses,
      recentSurveys,
      recentPulses,
    });
  } catch (error) {
    next(error);
  }
};
