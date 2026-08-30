/**
 * @fileoverview Health Challenge Controller
 * @description Manages wellness challenges, participation, daily check-ins,
 * leaderboard computation, reward allocation, and challenge analytics.
 */

const mongoose = require('mongoose');
const {
  HealthChallenge,
  ChallengeParticipation,
  DailyCheckIn,
  ChallengeTeam,
} = require('../models/healthChallenge.model');
const Employee = require('../models/employee.model');
const {
  computeStreaks,
  computeLeaderboard,
  totalChallengeDays,
  allocateRewards,
  computeChallengeProgress,
} = require('../utils/healthChallengeEngine');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');

// ============================================================================
// Challenge CRUD
// ============================================================================

exports.createChallenge = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      goalValue,
      goalUnit,
      trackingMethod,
      startDate,
      endDate,
      maxParticipants,
      rewards,
      mode,
      teamSize,
      leaderboardVisible,
      reminderEnabled,
    } = req.body;

    if (
      !title ||
      !category ||
      !goalValue ||
      !goalUnit ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        message:
          'title, category, goalValue, goalUnit, startDate, and endDate are required',
      });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return res
        .status(400)
        .json({ message: 'endDate must be after startDate' });
    }

    const challenge = await HealthChallenge.create({
      tenantId: req.tenantId,
      title,
      description,
      category,
      goalValue,
      goalUnit,
      trackingMethod: trackingMethod || 'SelfReport',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxParticipants: maxParticipants || 0,
      rewards: rewards || {},
      mode: mode || 'Individual',
      teamSize: teamSize || 4,
      leaderboardVisible: leaderboardVisible !== false,
      reminderEnabled: reminderEnabled !== false,
      createdBy: req.userId,
    });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'HEALTH_CHALLENGE_CREATED',
      resourceType: 'HealthChallenge',
      resourceIds: [challenge._id],
      details: { title, category, goalValue, goalUnit, startDate, endDate },
      req,
    });

    return res.status(201).json({ message: 'Challenge created', challenge });
  } catch (error) {
    return next(error);
  }
};

exports.getChallenges = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.isActive === 'true') filter.isActive = true;
    if (req.query.isOpen === 'true') filter.isOpen = true;

    const challenges = await HealthChallenge.find(filter)
      .populate('createdBy', 'fullName')
      .sort({ startDate: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ challenges });
  } catch (error) {
    return next(error);
  }
};

exports.getChallengeById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const challenge = await HealthChallenge.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate('createdBy', 'fullName')
      .lean();

    if (!challenge)
      return res.status(404).json({ message: 'Challenge not found' });

    // Get participation stats
    const [participantCount, totalCheckIns] = await Promise.all([
      ChallengeParticipation.countDocuments({
        tenantId: req.tenantId,
        challengeId: challenge._id,
        status: 'Active',
      }),
      DailyCheckIn.countDocuments({
        tenantId: req.tenantId,
        challengeId: challenge._id,
      }),
    ]);

    const progress = computeChallengeProgress(
      challenge,
      participantCount,
      totalCheckIns,
      0,
    );

    return res.status(200).json({ challenge, progress });
  } catch (error) {
    return next(error);
  }
};

exports.updateChallenge = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const challenge = await HealthChallenge.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!challenge)
      return res.status(404).json({ message: 'Challenge not found' });

    const editable = [
      'title',
      'description',
      'goalValue',
      'goalUnit',
      'maxParticipants',
      'rewards',
      'leaderboardVisible',
      'reminderEnabled',
      'isOpen',
      'isActive',
    ];
    for (const field of editable) {
      if (req.body[field] !== undefined) challenge[field] = req.body[field];
    }

    await challenge.save();
    return res.status(200).json({ message: 'Challenge updated', challenge });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Participation
// ============================================================================

exports.joinChallenge = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const challenge = await HealthChallenge.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!challenge)
      return res.status(404).json({ message: 'Challenge not found' });
    if (!challenge.isOpen)
      return res
        .status(400)
        .json({ message: 'Challenge is not accepting participants' });
    if (!challenge.isActive)
      return res.status(400).json({ message: 'Challenge is no longer active' });

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id fullName department');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    // Check max participants
    if (challenge.maxParticipants > 0) {
      const count = await ChallengeParticipation.countDocuments({
        tenantId: req.tenantId,
        challengeId: challenge._id,
        status: 'Active',
      });
      if (count >= challenge.maxParticipants) {
        return res.status(400).json({ message: 'Challenge is full' });
      }
    }

    // Check duplicate
    const existing = await ChallengeParticipation.findOne({
      tenantId: req.tenantId,
      challengeId: challenge._id,
      employeeId: employee._id,
    });
    if (existing) {
      if (existing.status === 'Active') {
        return res.status(409).json({ message: 'Already participating' });
      }
      // Re-enroll if previously quit
      existing.status = 'Active';
      existing.quitAt = null;
      existing.quitReason = '';
      await existing.save();
      return res
        .status(200)
        .json({ message: 'Re-enrolled in challenge', participation: existing });
    }

    const participation = await ChallengeParticipation.create({
      tenantId: req.tenantId,
      challengeId: challenge._id,
      employeeId: employee._id,
      enrolledAt: new Date(),
      status: 'Active',
    });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'HEALTH_CHALLENGE_JOINED',
      resourceType: 'ChallengeParticipation',
      resourceIds: [participation._id],
      details: { challengeId: challenge._id, employeeId: employee._id },
      req,
    });

    return res.status(201).json({ message: 'Joined challenge', participation });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'Already participating in this challenge' });
    }
    return next(error);
  }
};

exports.leaveChallenge = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const participation = await ChallengeParticipation.findOne({
      tenantId: req.tenantId,
      challengeId: req.params.id,
      employeeId: employee._id,
      status: 'Active',
    });
    if (!participation)
      return res
        .status(404)
        .json({ message: 'Not participating in this challenge' });

    participation.status = 'Quit';
    participation.quitAt = new Date();
    participation.quitReason = req.body.reason || '';
    await participation.save();

    return res.status(200).json({ message: 'Left challenge', participation });
  } catch (error) {
    return next(error);
  }
};

exports.getMyParticipations = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const participations = await ChallengeParticipation.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
    })
      .populate(
        'challengeId',
        'title category goalValue goalUnit startDate endDate',
      )
      .sort({ enrolledAt: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({ participations });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Daily Check-Ins
// ============================================================================

exports.submitCheckIn = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const { checkInDate, value, note, photoUrl } = req.body;

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const challenge = await HealthChallenge.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!challenge)
      return res.status(404).json({ message: 'Challenge not found' });

    // Verify participation
    const participation = await ChallengeParticipation.findOne({
      tenantId: req.tenantId,
      challengeId: challenge._id,
      employeeId: employee._id,
      status: 'Active',
    });
    if (!participation) {
      return res
        .status(400)
        .json({ message: 'You are not participating in this challenge' });
    }

    // Validate date is within challenge period
    const date = checkInDate ? new Date(checkInDate) : new Date();
    if (
      date < new Date(challenge.startDate) ||
      date > new Date(challenge.endDate)
    ) {
      return res
        .status(400)
        .json({ message: 'Check-in date is outside challenge period' });
    }

    if (value === undefined || value < 0) {
      return res
        .status(400)
        .json({ message: 'A non-negative value is required' });
    }

    const goalMet = value >= challenge.goalValue;
    const dateStr = date.toISOString().split('T')[0];

    // Upsert check-in
    let checkIn = await DailyCheckIn.findOne({
      tenantId: req.tenantId,
      challengeId: challenge._id,
      employeeId: employee._id,
      checkInDate: date,
    });

    if (checkIn) {
      checkIn.value = value;
      checkIn.goalMet = goalMet;
      checkIn.note = note || '';
      checkIn.photoUrl = photoUrl || '';
      await checkIn.save();
    } else {
      checkIn = await DailyCheckIn.create({
        tenantId: req.tenantId,
        challengeId: challenge._id,
        employeeId: employee._id,
        checkInDate: date,
        value,
        goalMet,
        note: note || '',
        photoUrl: photoUrl || '',
        deviceSource: req.body.deviceSource || '',
      });
    }

    // Update participation stats
    const allCheckIns = await DailyCheckIn.find({
      tenantId: req.tenantId,
      challengeId: challenge._id,
      employeeId: employee._id,
    }).sort({ checkInDate: 1 });

    const dates = allCheckIns.map((ci) => ci.checkInDate);
    const { currentStreak, longestStreak } = computeStreaks(dates);

    participation.totalValue = allCheckIns.reduce(
      (sum, ci) => sum + (ci.value || 0),
      0,
    );
    participation.daysCompleted = allCheckIns.filter((ci) => ci.goalMet).length;
    participation.averagePerDay =
      allCheckIns.length > 0
        ? Math.round((participation.totalValue / allCheckIns.length) * 100) /
          100
        : 0;
    participation.currentStreak = currentStreak;
    participation.longestStreak = Math.max(
      participation.longestStreak,
      longestStreak,
    );

    // Check if challenge is complete
    const today = new Date();
    if (
      today >= new Date(challenge.endDate) &&
      participation.daysCompleted > 0
    ) {
      const totalDays = totalChallengeDays(
        challenge.startDate,
        challenge.endDate,
      );
      participation.goalMet = participation.daysCompleted >= totalDays * 0.8;
      if (participation.goalMet && participation.status === 'Active') {
        participation.status = 'Completed';
        participation.completedAt = new Date();
      }
    }

    await participation.save();

    return res.status(201).json({
      message: goalMet ? 'Goal met! Great work! 🎯' : 'Check-in recorded',
      checkIn,
      participation: {
        totalValue: participation.totalValue,
        daysCompleted: participation.daysCompleted,
        currentStreak: participation.currentStreak,
        longestStreak: participation.longestStreak,
        averagePerDay: participation.averagePerDay,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'Already checked in for this date' });
    }
    return next(error);
  }
};

exports.getMyCheckIns = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const filter = {
      tenantId: req.tenantId,
      challengeId: req.params.id,
      employeeId: employee._id,
    };
    if (req.query.from)
      filter.checkInDate = {
        ...filter.checkInDate,
        $gte: new Date(req.query.from),
      };
    if (req.query.to)
      filter.checkInDate = {
        ...filter.checkInDate,
        $lte: new Date(req.query.to),
      };

    const checkIns = await DailyCheckIn.find(filter)
      .sort({ checkInDate: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ checkIns });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Leaderboard
// ============================================================================

exports.getLeaderboard = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const challenge = await HealthChallenge.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!challenge)
      return res.status(404).json({ message: 'Challenge not found' });

    if (!challenge.leaderboardVisible) {
      return res
        .status(403)
        .json({ message: 'Leaderboard is not visible for this challenge' });
    }

    const checkIns = await DailyCheckIn.find({
      tenantId: req.tenantId,
      challengeId: challenge._id,
    }).lean();

    const leaderboard = computeLeaderboard(checkIns, challenge);

    // Enrich with employee names
    const empIds = leaderboard.map((e) => e.employeeId);
    const employees = await Employee.find({ _id: { $in: empIds } })
      .select('_id fullName department')
      .lean();
    const empMap = new Map(employees.map((e) => [String(e._id), e]));

    const enriched = leaderboard.map((entry) => {
      const emp = empMap.get(String(entry.employeeId));
      return {
        ...entry,
        fullName: emp?.fullName || 'Unknown',
        department: emp?.department || '',
      };
    });

    return res
      .status(200)
      .json({ leaderboard: enriched, totalParticipants: enriched.length });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Admin: Rewards & Analytics
// ============================================================================

exports.allocateChallengeRewards = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const challenge = await HealthChallenge.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!challenge)
      return res.status(404).json({ message: 'Challenge not found' });

    const checkIns = await DailyCheckIn.find({
      tenantId: req.tenantId,
      challengeId: challenge._id,
    }).lean();

    const leaderboard = computeLeaderboard(checkIns, challenge);
    const challengeDays = totalChallengeDays(
      challenge.startDate,
      challenge.endDate,
    );
    const allocations = allocateRewards(
      leaderboard,
      challenge.rewards,
      challengeDays,
    );

    // Persist rewards to participation records
    for (const alloc of allocations) {
      await ChallengeParticipation.findOneAndUpdate(
        {
          tenantId: req.tenantId,
          challengeId: challenge._id,
          employeeId: alloc.employeeId,
        },
        {
          $set: {
            rewardEarned: alloc.rewardAmount,
            rank: alloc.rank,
          },
        },
      );
    }

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'HEALTH_CHALLENGE_REWARDS_ALLOCATED',
      resourceType: 'HealthChallenge',
      resourceIds: [challenge._id],
      details: { allocationCount: allocations.length },
      req,
    });

    return res.status(200).json({
      message: `Allocated rewards to ${allocations.length} participants`,
      allocations,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getChallengeAnalytics = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid challenge ID' });
    }

    const challenge = await HealthChallenge.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!challenge)
      return res.status(404).json({ message: 'Challenge not found' });

    const [participantCount, totalCheckIns, checkIns] = await Promise.all([
      ChallengeParticipation.countDocuments({
        tenantId: req.tenantId,
        challengeId: challenge._id,
      }),
      DailyCheckIn.countDocuments({
        tenantId: req.tenantId,
        challengeId: challenge._id,
      }),
      DailyCheckIn.find({
        tenantId: req.tenantId,
        challengeId: challenge._id,
      }).lean(),
    ]);

    const progress = computeChallengeProgress(
      challenge,
      participantCount,
      totalCheckIns,
      0,
    );
    const leaderboard = computeLeaderboard(checkIns, challenge);

    // Daily aggregation
    const dailyData = {};
    for (const ci of checkIns) {
      const dateStr = new Date(ci.checkInDate).toISOString().split('T')[0];
      if (!dailyData[dateStr])
        dailyData[dateStr] = { total: 0, count: 0, goalMet: 0 };
      dailyData[dateStr].total += ci.value || 0;
      dailyData[dateStr].count += 1;
      if (ci.goalMet) dailyData[dateStr].goalMet += 1;
    }

    const dailyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        totalValue: data.total,
        participantCount: data.count,
        goalMetCount: data.goalMet,
        avgValue: data.count > 0 ? Math.round(data.total / data.count) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Category breakdown
    const goalMetRate =
      checkIns.length > 0
        ? Math.round(
            (checkIns.filter((ci) => ci.goalMet).length / checkIns.length) *
              100,
          )
        : 0;

    return res.status(200).json({
      challenge,
      progress,
      analytics: {
        goalMetRate,
        topPerformers: leaderboard.slice(0, 5),
        dailyTrend,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();

    const [activeChallenges, upcomingChallenges, totalParticipants] =
      await Promise.all([
        HealthChallenge.countDocuments({
          tenantId: req.tenantId,
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        }),
        HealthChallenge.countDocuments({
          tenantId: req.tenantId,
          isActive: true,
          startDate: { $gt: now },
        }),
        ChallengeParticipation.countDocuments({
          tenantId: req.tenantId,
          status: 'Active',
        }),
      ]);

    // My active participations
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    }).select('_id');

    let myActiveCount = 0;
    let myTotalCheckIns = 0;
    if (employee) {
      [myActiveCount, myTotalCheckIns] = await Promise.all([
        ChallengeParticipation.countDocuments({
          tenantId: req.tenantId,
          employeeId: employee._id,
          status: 'Active',
        }),
        DailyCheckIn.countDocuments({
          tenantId: req.tenantId,
          employeeId: employee._id,
        }),
      ]);
    }

    return res.status(200).json({
      stats: {
        activeChallenges,
        upcomingChallenges,
        totalParticipants,
        myActiveChallenges: myActiveCount,
        myTotalCheckIns,
      },
    });
  } catch (error) {
    return next(error);
  }
};
