const ProbationTrackerService = require('../services/probationTracker.service');
const ProbationPolicy = require('../models/probationPolicy.model');
const ProbationTracker = require('../models/probationTracker.model');
const logger = require('../utils/logger');
const { sanitizeText } = require('../utils/validators');

exports.createPolicy = async (req, res, next) => {
  try {
    const {
      name,
      department,
      role,
      durationMonths,
      maxExtensions,
      maxTotalMonths,
      salaryStepUpType,
      salaryStepUpValue,
    } = req.body;

    const policy = await ProbationPolicy.create({
      name: sanitizeText(name),
      department: sanitizeText(department || ''),
      role: sanitizeText(role || ''),
      durationMonths,
      maxExtensions,
      maxTotalMonths,
      salaryStepUpType,
      salaryStepUpValue,
      createdBy: req.userId
    });

    res.status(201).json({ message: 'Probation policy created', policy });
  } catch (err) {
    next(err);
  }
};

exports.getPolicies = async (req, res, next) => {
  try {
    const policies = await ProbationPolicy.find({});
    res.status(200).json({ policies });
  } catch (err) {
    next(err);
  }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const activeTrackers = await ProbationTracker.find({
      status: { $in: ['active', 'extended'] }
    }).populate('employeeId', 'fullName role department');
    const overdueReviews = activeTrackers.filter((t) => new Date() > t.endDate);
    const upcomingExpiries = activeTrackers.filter((t) => {
      const daysUntilExpiry = (t.endDate - new Date()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    });

    res.status(200).json({
      activeCount: activeTrackers.length,
      overdueCount: overdueReviews.length,
      upcomingExpiriesCount: upcomingExpiries.length,
      overdueReviews,
      upcomingExpiries,
    });
  } catch (err) {
    next(err);
  }
};

exports.submitReview = async (req, res, next) => {
  try {
    const { trackerId } = req.params;
    const { recommendation, notes } = req.body;

    const tracker = await ProbationTrackerService.submitReview({
      trackerId,

      // assuming the manager is the logged-in user
      managerId: req.userId,

      recommendation,
      notes: sanitizeText(notes || '')
    });

    res.status(200).json({ message: 'Review submitted', tracker });
  } catch (err) {
    next(err);
  }
};

exports.extendProbation = async (req, res, next) => {
  try {
    const { trackerId } = req.params;
    const { extensionMonths } = req.body;

    const tracker = await ProbationTrackerService.extendProbation({
      trackerId,
      extensionMonths,
      createdBy: req.userId
    });

    res.status(200).json({ message: 'Probation extended', tracker });
  } catch (err) {
    next(err);
  }
};

exports.confirmProbation = async (req, res, next) => {
  try {
    const { trackerId } = req.params;

    const tracker = await ProbationTrackerService.confirmProbation({
      trackerId,
      createdBy: req.userId
    });

    res.status(200).json({ message: 'Probation confirmed', tracker });
  } catch (err) {
    next(err);
  }
};

exports.getEmployeeTracker = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const tracker = await ProbationTracker.findOne({
      employeeId
    })
      .populate('policyId')
      .populate('reviews.managerId', 'fullName');

    if (!tracker) {
      return res.status(404).json({ message: 'Tracker not found' });
    }

    res.status(200).json({ tracker });
  } catch (err) {
    next(err);
  }
};
