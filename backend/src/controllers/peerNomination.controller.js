/**
 * @fileoverview Peer Nomination & Awards Controller
 * @description Manages award categories, cycles, nominations, voting,
 * review workflows, winner selection, and dashboard analytics.
 */

const mongoose = require('mongoose');
const {
  AwardCategory,
  AwardCycle,
  Nomination,
  Vote,
} = require('../models/peerNomination.model');
const {
  checkNominatorEligibility,
  checkNomineeCapacity,
  checkVoterEligibility,
  computeVotingResults,
  selectWinners,
  computeNominationStats,
  checkWinCooldown,
  formatNominationMessage,
  formatWinnerMessage,
} = require('../utils/peerNominationEngine');
const logger = require('../utils/logger');

// ============================================================================
// Award Category CRUD
// ============================================================================

/**
 * POST /api/peer-nominations/categories
 * Create a new award category.
 */
async function createCategory(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const {
      name,
      description,
      icon,
      rewardAmount,
      extraLeaveDays,
      frequency,
      maxNominationsPerNominator,
      maxNominationsPerNominee,
      allowSelfNomination,
      votingEnabled,
      maxVotesPerVoter,
      requireManagerApproval,
      nominationScope,
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: 'Category name is required' });
    }

    const existing = await AwardCategory.findOne({ tenantId, name });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: 'Award category already exists' });
    }

    const category = await AwardCategory.create({
      tenantId,
      name,
      description,
      icon,
      rewardAmount,
      extraLeaveDays,
      frequency,
      maxNominationsPerNominator,
      maxNominationsPerNominee,
      allowSelfNomination,
      votingEnabled,
      maxVotesPerVoter,
      requireManagerApproval,
      nominationScope,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    logger.error('createCategory error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to create category' });
  }
}

/**
 * GET /api/peer-nominations/categories
 * List all active award categories for a tenant.
 */
async function listCategories(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const categories = await AwardCategory.find({
      tenantId,
      isActive: true,
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: categories, total: categories.length });
  } catch (err) {
    logger.error('listCategories error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to list categories' });
  }
}

/**
 * GET /api/peer-nominations/categories/:categoryId
 * Get a single award category.
 */
async function getCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const category = await AwardCategory.findOne({
      _id: categoryId,
      tenantId: req.user.tenantId,
    });
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, data: category });
  } catch (err) {
    logger.error('getCategory error', err);
    res.status(500).json({ success: false, message: 'Failed to get category' });
  }
}

/**
 * PUT /api/peer-nominations/categories/:categoryId
 * Update an award category.
 */
async function updateCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const allowed = [
      'name',
      'description',
      'icon',
      'rewardAmount',
      'extraLeaveDays',
      'frequency',
      'maxNominationsPerNominator',
      'maxNominationsPerNominee',
      'allowSelfNomination',
      'votingEnabled',
      'maxVotesPerVoter',
      'requireManagerApproval',
      'nominationScope',
      'isActive',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const category = await AwardCategory.findOneAndUpdate(
      { _id: categoryId, tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, data: category });
  } catch (err) {
    logger.error('updateCategory error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to update category' });
  }
}

// ============================================================================
// Award Cycle Management
// ============================================================================

/**
 * POST /api/peer-nominations/cycles
 * Create a new award cycle for a category.
 */
async function createCycle(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const {
      categoryId,
      name,
      startDate,
      endDate,
      votingStartDate,
      votingEndDate,
    } = req.body;

    if (!categoryId || !name || !startDate || !endDate) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'categoryId, name, startDate, endDate are required',
        });
    }

    const category = await AwardCategory.findOne({ _id: categoryId, tenantId });
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: 'Category not found' });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return res
        .status(400)
        .json({ success: false, message: 'endDate must be after startDate' });
    }

    const cycle = await AwardCycle.create({
      tenantId,
      categoryId,
      name,
      startDate,
      endDate,
      votingStartDate,
      votingEndDate,
      status: 'Upcoming',
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: cycle });
  } catch (err) {
    logger.error('createCycle error', err);
    res.status(500).json({ success: false, message: 'Failed to create cycle' });
  }
}

/**
 * GET /api/peer-nominations/cycles
 * List cycles, optionally filtered by categoryId and status.
 */
async function listCycles(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { categoryId, status } = req.query;
    const filter = { tenantId };
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.status = status;

    const cycles = await AwardCycle.find(filter)
      .populate('categoryId', 'name icon')
      .sort({ startDate: -1 });
    res.json({ success: true, data: cycles, total: cycles.length });
  } catch (err) {
    logger.error('listCycles error', err);
    res.status(500).json({ success: false, message: 'Failed to list cycles' });
  }
}

/**
 * PATCH /api/peer-nominations/cycles/:cycleId/status
 * Advance a cycle to the next status phase.
 */
async function advanceCycleStatus(req, res) {
  try {
    const { cycleId } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'Upcoming',
      'Nominating',
      'Voting',
      'Reviewing',
      'Completed',
    ];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
    }

    const cycle = await AwardCycle.findOneAndUpdate(
      { _id: cycleId, tenantId: req.user.tenantId },
      { $set: { status } },
      { new: true },
    );
    if (!cycle) {
      return res
        .status(404)
        .json({ success: false, message: 'Cycle not found' });
    }
    res.json({ success: true, data: cycle });
  } catch (err) {
    logger.error('advanceCycleStatus error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to update cycle status' });
  }
}

// ============================================================================
// Nominations
// ============================================================================

/**
 * POST /api/peer-nominations/nominate
 * Submit a nomination.
 */
async function submitNomination(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const {
      cycleId,
      categoryId,
      nomineeId,
      justification,
      example,
      coreValues,
      isAnonymous,
    } = req.body;
    const nominatorId = req.user.employeeId || req.user._id;

    if (!cycleId || !categoryId || !nomineeId || !justification) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'cycleId, categoryId, nomineeId, justification are required',
        });
    }

    if (justification.length < 20) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Justification must be at least 20 characters',
        });
    }

    const [category, cycle] = await Promise.all([
      AwardCategory.findOne({ _id: categoryId, tenantId }),
      AwardCycle.findOne({ _id: cycleId, tenantId }),
    ]);

    if (!category || !cycle) {
      return res
        .status(404)
        .json({ success: false, message: 'Category or cycle not found' });
    }

    // Check nominator eligibility
    const existingNomCount = await Nomination.countDocuments({
      tenantId,
      cycleId,
      nominatorId,
    });
    const eligibility = checkNominatorEligibility({
      nominatorId,
      nomineeId,
      category,
      cycle,
      existingNominationCount: existingNomCount,
    });
    if (!eligibility.eligible) {
      return res
        .status(403)
        .json({ success: false, message: eligibility.reason });
    }

    // Check nominee capacity
    const existingReceivedCount = await Nomination.countDocuments({
      tenantId,
      cycleId,
      nomineeId,
    });
    const capacity = checkNomineeCapacity(
      existingReceivedCount,
      category.maxNominationsPerNominee,
    );
    if (!capacity.eligible) {
      return res.status(403).json({ success: false, message: capacity.reason });
    }

    // Check for duplicate
    const existing = await Nomination.findOne({
      tenantId,
      cycleId,
      nominatorId,
      nomineeId,
    });
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          message: 'You have already nominated this person for this cycle',
        });
    }

    // Win cooldown check (30 days)
    const recentWins = await Nomination.find({
      tenantId,
      nomineeId,
      status: 'Winner',
    })
      .sort({ awardedAt: -1 })
      .limit(5);
    const cooldown = checkWinCooldown(nomineeId, recentWins, 30);
    if (cooldown.inCooldown) {
      return res.status(403).json({
        success: false,
        message: `Nominee is in cooldown period. Eligible again in ${cooldown.daysUntilEligible} days`,
      });
    }

    const nomination = await Nomination.create({
      tenantId,
      cycleId,
      categoryId,
      nominatorId,
      nomineeId,
      justification,
      example,
      coreValues,
      isAnonymous,
      status: category.requireManagerApproval ? 'Submitted' : 'Approved',
    });

    const message = formatNominationMessage(
      nomination,
      nomineeId,
      category.name,
      category.icon,
    );
    logger.info(message);

    res.status(201).json({
      success: true,
      data: nomination,
      message: category.requireManagerApproval
        ? 'Nomination submitted and pending review'
        : 'Nomination approved',
    });
  } catch (err) {
    logger.error('submitNomination error', err);
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: 'Duplicate nomination' });
    }
    res
      .status(500)
      .json({ success: false, message: 'Failed to submit nomination' });
  }
}

/**
 * GET /api/peer-nominations/nominations
 * List nominations with filters.
 */
async function listNominations(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { cycleId, categoryId, status, nomineeId } = req.query;
    const filter = { tenantId };
    if (cycleId) filter.cycleId = cycleId;
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.status = status;
    if (nomineeId) filter.nomineeId = nomineeId;

    const nominations = await Nomination.find(filter)
      .populate('categoryId', 'name icon rewardAmount')
      .sort({ voteCount: -1, createdAt: -1 });
    res.json({ success: true, data: nominations, total: nominations.length });
  } catch (err) {
    logger.error('listNominations error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to list nominations' });
  }
}

/**
 * PATCH /api/peer-nominations/nominations/:nominationId/review
 * Approve or reject a nomination.
 */
async function reviewNomination(req, res) {
  try {
    const { nominationId } = req.params;
    const { action, reviewNotes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'action must be "approve" or "reject"',
        });
    }

    const nomination = await Nomination.findOne({
      _id: nominationId,
      tenantId: req.user.tenantId,
    });
    if (!nomination) {
      return res
        .status(404)
        .json({ success: false, message: 'Nomination not found' });
    }

    if (
      nomination.status !== 'Submitted' &&
      nomination.status !== 'UnderReview'
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Cannot review nomination in "${nomination.status}" status`,
        });
    }

    nomination.status = action === 'approve' ? 'Approved' : 'Rejected';
    nomination.reviewedBy = req.user._id;
    nomination.reviewedAt = new Date();
    nomination.reviewNotes = reviewNotes || '';
    await nomination.save();

    res.json({
      success: true,
      data: nomination,
      message: `Nomination ${action}d`,
    });
  } catch (err) {
    logger.error('reviewNomination error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to review nomination' });
  }
}

// ============================================================================
// Voting
// ============================================================================

/**
 * POST /api/peer-nominations/vote
 * Cast a vote on a nomination.
 */
async function castVote(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { nominationId, comment } = req.body;
    const voterId = req.user.employeeId || req.user._id;

    if (!nominationId) {
      return res
        .status(400)
        .json({ success: false, message: 'nominationId is required' });
    }

    const nomination = await Nomination.findOne({
      _id: nominationId,
      tenantId,
    }).populate('categoryId');
    if (!nomination) {
      return res
        .status(404)
        .json({ success: false, message: 'Nomination not found' });
    }

    const cycle = await AwardCycle.findOne({
      _id: nomination.cycleId,
      tenantId,
    });
    if (!cycle) {
      return res
        .status(404)
        .json({ success: false, message: 'Cycle not found' });
    }

    const category = nomination.categoryId;
    if (!category.votingEnabled) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Voting is not enabled for this award category',
        });
    }

    const existingVoteCount = await Vote.countDocuments({
      tenantId,
      voterId,
    });
    // We need to count votes in this cycle specifically
    const cycleVoteCount = await Vote.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          voterId: new mongoose.Types.ObjectId(voterId),
        },
      },
      {
        $lookup: {
          from: 'nominations',
          localField: 'nominationId',
          foreignField: '_id',
          as: 'nom',
        },
      },
      { $unwind: '$nom' },
      { $match: { 'nom.cycleId': new mongoose.Types.ObjectId(cycle._id) } },
      { $count: 'count' },
    ]);
    const votesUsed = cycleVoteCount.length > 0 ? cycleVoteCount[0].count : 0;

    const eligibility = checkVoterEligibility({
      voterId,
      nominationId,
      nominatorId: String(nomination.nominatorId),
      nomineeId: String(nomination.nomineeId),
      cycle,
      existingVoteCount: votesUsed,
      maxVotesPerVoter: category.maxVotesPerVoter,
    });
    if (!eligibility.eligible) {
      return res
        .status(403)
        .json({ success: false, message: eligibility.reason });
    }

    const vote = await Vote.create({
      tenantId,
      nominationId,
      voterId,
      comment,
      votedAt: new Date(),
    });

    // Increment vote count on the nomination
    nomination.voteCount = (nomination.voteCount || 0) + 1;
    await nomination.save();

    res
      .status(201)
      .json({ success: true, data: vote, message: 'Vote recorded' });
  } catch (err) {
    logger.error('castVote error', err);
    if (err.code === 11000) {
      return res
        .status(409)
        .json({
          success: false,
          message: 'You have already voted for this nomination',
        });
    }
    res.status(500).json({ success: false, message: 'Failed to cast vote' });
  }
}

/**
 * DELETE /api/peer-nominations/vote/:voteId
 * Remove a vote (unvote).
 */
async function removeVote(req, res) {
  try {
    const { voteId } = req.params;
    const vote = await Vote.findOneAndDelete({
      _id: voteId,
      tenantId: req.user.tenantId,
      voterId: req.user.employeeId || req.user._id,
    });
    if (!vote) {
      return res
        .status(404)
        .json({ success: false, message: 'Vote not found' });
    }

    // Decrement vote count
    await Nomination.findByIdAndUpdate(vote.nominationId, {
      $inc: { voteCount: -1 },
    });

    res.json({ success: true, message: 'Vote removed' });
  } catch (err) {
    logger.error('removeVote error', err);
    res.status(500).json({ success: false, message: 'Failed to remove vote' });
  }
}

// ============================================================================
// Winner Selection & Announcement
// ============================================================================

/**
 * POST /api/peer-nominations/cycles/:cycleId/select-winners
 * Select winners for a completed voting/review cycle.
 */
async function selectCycleWinners(req, res) {
  try {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const { maxWinners = 1, minVotes = 0 } = req.body;

    const cycle = await AwardCycle.findOne({ _id: cycleId, tenantId }).populate(
      'categoryId',
    );
    if (!cycle) {
      return res
        .status(404)
        .json({ success: false, message: 'Cycle not found' });
    }

    if (!['Reviewing', 'Voting'].includes(cycle.status)) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Cycle must be in Reviewing or Voting phase, currently "${cycle.status}"`,
        });
    }

    const nominations = await Nomination.find({
      cycleId,
      tenantId,
      status: { $in: ['Approved', 'Winner'] },
    });

    const votes = await Vote.find({
      tenantId,
      nominationId: { $in: nominations.map((n) => n._id) },
    });

    const ranked = computeVotingResults(nominations, votes);
    const winners = selectWinners(ranked, maxWinners, minVotes);

    // Mark winners
    const winnerNominationIds = new Set(
      winners.map((w) => String(w.nominationId)),
    );
    const category = cycle.categoryId;

    for (const nom of nominations) {
      if (winnerNominationIds.has(String(nom._id))) {
        nom.status = 'Winner';
        nom.isWinner = true;
        nom.awardedAt = new Date();
        nom.rewardAmount = category.rewardAmount || 0;
        nom.extraLeaveDays = category.extraLeaveDays || 0;
      }
    }
    await Nomination.bulkSave(nominations);

    // Update cycle
    cycle.status = 'Completed';
    cycle.winnersAnnounced = true;
    cycle.announcedAt = new Date();
    await cycle.save();

    const result = winners.map((w) => {
      const nom = nominations.find(
        (n) => String(n._id) === String(w.nominationId),
      );
      return {
        ...w,
        rewardAmount: category.rewardAmount,
        extraLeaveDays: category.extraLeaveDays,
        message: formatWinnerMessage(
          w.nomineeId,
          category.name,
          category.icon,
          category.rewardAmount,
          w.voteCount,
        ),
      };
    });

    res.json({
      success: true,
      data: { winners: result, totalWinners: winners.length },
    });
  } catch (err) {
    logger.error('selectCycleWinners error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to select winners' });
  }
}

// ============================================================================
// Analytics & Dashboard
// ============================================================================

/**
 * GET /api/peer-nominations/dashboard
 * Overall dashboard with stats, recent activity, and upcoming cycles.
 */
async function getDashboard(req, res) {
  try {
    const tenantId = req.user.tenantId;

    const [
      categories,
      activeCycles,
      recentNominations,
      totalNominations,
      totalVotes,
      winners,
    ] = await Promise.all([
      AwardCategory.countDocuments({ tenantId, isActive: true }),
      AwardCycle.find({
        tenantId,
        status: { $in: ['Nominating', 'Voting', 'Reviewing'] },
      })
        .populate('categoryId', 'name icon')
        .sort({ endDate: 1 })
        .limit(5),
      Nomination.find({ tenantId })
        .populate('categoryId', 'name icon')
        .sort({ createdAt: -1 })
        .limit(10),
      Nomination.countDocuments({ tenantId }),
      Vote.countDocuments({ tenantId }),
      Nomination.find({ tenantId, status: 'Winner' })
        .populate('categoryId', 'name icon rewardAmount')
        .sort({ awardedAt: -1 })
        .limit(10),
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalCategories: categories,
          activeCycles: activeCycles.length,
          totalNominations,
          totalVotes,
          totalWinners: winners.length,
        },
        activeCycles,
        recentNominations,
        recentWinners: winners,
      },
    });
  } catch (err) {
    logger.error('getDashboard error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to load dashboard' });
  }
}

/**
 * GET /api/peer-nominations/stats/cycle/:cycleId
 * Detailed stats for a specific cycle.
 */
async function getCycleStats(req, res) {
  try {
    const { cycleId } = req.params;
    const tenantId = req.user.tenantId;

    const cycle = await AwardCycle.findOne({ _id: cycleId, tenantId }).populate(
      'categoryId',
    );
    if (!cycle) {
      return res
        .status(404)
        .json({ success: false, message: 'Cycle not found' });
    }

    const nominations = await Nomination.find({ cycleId, tenantId });
    const votes = await Vote.find({
      tenantId,
      nominationId: { $in: nominations.map((n) => n._id) },
    });

    const stats = computeNominationStats(nominations, votes, cycle.categoryId);
    const results = computeVotingResults(nominations, votes);

    res.json({
      success: true,
      data: {
        cycle: { _id: cycle._id, name: cycle.name, status: cycle.status },
        stats,
        rankings: results.slice(0, 20),
      },
    });
  } catch (err) {
    logger.error('getCycleStats error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to load cycle stats' });
  }
}

/**
 * GET /api/peer-nominations/stats/employee/:employeeId
 * Personal nomination stats for an employee.
 */
async function getEmployeeStats(req, res) {
  try {
    const { employeeId } = req.params;
    const tenantId = req.user.tenantId;

    const [nominationsReceived, nominationsGiven, votesCasted, wins] =
      await Promise.all([
        Nomination.countDocuments({ tenantId, nomineeId: employeeId }),
        Nomination.countDocuments({ tenantId, nominatorId: employeeId }),
        Vote.countDocuments({ tenantId, voterId: employeeId }),
        Nomination.find({ tenantId, nomineeId: employeeId, status: 'Winner' })
          .populate('categoryId', 'name icon rewardAmount')
          .sort({ awardedAt: -1 }),
      ]);

    const recentReceived = await Nomination.find({
      tenantId,
      nomineeId: employeeId,
    })
      .populate('categoryId', 'name icon')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentGiven = await Nomination.find({
      tenantId,
      nominatorId: employeeId,
    })
      .populate('categoryId', 'name icon')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        summary: {
          nominationsReceived,
          nominationsGiven,
          votesCasted,
          totalWins: wins.length,
          totalRewards: wins.reduce((sum, w) => sum + (w.rewardAmount || 0), 0),
        },
        wins,
        recentReceived,
        recentGiven,
      },
    });
  } catch (err) {
    logger.error('getEmployeeStats error', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to load employee stats' });
  }
}

module.exports = {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  createCycle,
  listCycles,
  advanceCycleStatus,
  submitNomination,
  listNominations,
  reviewNomination,
  castVote,
  removeVote,
  selectCycleWinners,
  getDashboard,
  getCycleStats,
  getEmployeeStats,
};
