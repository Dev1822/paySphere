/**
 * @fileoverview Recognition & Nomination Controller
 * @description Manages nomination categories, peer-to-peer value-based nominations,
 * approval workflows, recognition cycles, and leaderboard analytics. Extends the
 * existing Kudos system with formal structured recognition.
 */
const {
  NominationCategory,
  Nomination,
  RecognitionCycle,
  NominationComment,
} = require('../models/nomination.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

// ============================================================================
// Nomination Categories
// ============================================================================

/**
 * POST /api/nominations/categories
 * Create a new nomination category (admin only).
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, icon, color, pointsPerNomination, maxNominationsPerMonth, requiresManagerApproval } = req.body;

    const category = await NominationCategory.create({
      name,
      description: description || '',
      icon: icon || 'star',
      color: color || '#6366f1',
      pointsPerNomination: pointsPerNomination || 10,
      maxNominationsPerMonth: maxNominationsPerMonth || 3,
      requiresManagerApproval: requiresManagerApproval || false,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'NOMINATION_CATEGORY_CREATED',
      resourceType: 'NominationCategory',
      resourceIds: [category._id],
      details: { name, pointsPerNomination },
      req,
    });

    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/nominations/categories
 * List all active nomination categories.
 */
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await NominationCategory.find(
      { isActive: true },
    ).sort({ name: 1 }).lean();

    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/nominations/categories/:categoryId
 * Update a nomination category.
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { name, description, icon, color, pointsPerNomination, maxNominationsPerMonth, requiresManagerApproval } = req.body;

    const category = await NominationCategory.findOneAndUpdate(
      { _id: categoryId },
      {
        $set: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
          ...(pointsPerNomination !== undefined && { pointsPerNomination }),
          ...(maxNominationsPerMonth !== undefined && { maxNominationsPerMonth }),
          ...(requiresManagerApproval !== undefined && { requiresManagerApproval }),
        },
      },
      { new: true, runValidators: true },
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ category });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Nominations
// ============================================================================

/**
 * POST /api/nominations
 * Submit a peer nomination.
 */
exports.createNomination = async (req, res, next) => {
  try {
    const { categoryId, nomineeId, title, reason, impactDescription, isPublic } = req.body;

    const category = await NominationCategory.findOne(
      { _id: categoryId, isActive: true },
    );
    if (!category) {
      return res.status(404).json({ message: 'Nomination category not found or inactive' });
    }

    // Check nominee exists
    const nominee = await Employee.findOne(
      { _id: nomineeId },
    );
    if (!nominee) {
      return res.status(404).json({ message: 'Nominee not found' });
    }

    // Check nominator hasn't exceeded monthly limit for this category
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyCount = await Nomination.countDocuments(
      {
        categoryId,
        nominatorId: req.userId,
        createdAt: { $gte: startOfMonth },
      },
    );

    if (monthlyCount >= category.maxNominationsPerMonth) {
      return res.status(429).json({
        message: `You have used all ${category.maxNominationsPerMonth} nominations for "${category.name}" this month.`,
      });
    }

    const status = category.requiresManagerApproval ? 'PENDING_APPROVAL' : 'APPROVED';
    const pointsAwarded = status === 'APPROVED' ? category.pointsPerNomination : 0;

    const nomination = await Nomination.create({
      categoryId,
      nomineeId,
      nominatorId: req.userId,
      managerId: nominee.managerId || null,
      title,
      reason,
      impactDescription: impactDescription || '',
      isPublic: isPublic !== false,
      pointsAwarded,
      status,
      cycleId: null
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'NOMINATION_CREATED',
      resourceType: 'Nomination',
      resourceIds: [nomination._id],
      details: { categoryId: String(categoryId), nomineeId, title, status },
      req,
    });

    res.status(201).json({ nomination });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/nominations/feed
 * Public nomination feed for the tenant.
 */
exports.getFeed = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, categoryId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {
      isPublic: true,
      status: { $in: ['APPROVED', 'PENDING_APPROVAL'] },
    };

    if (categoryId) filter.categoryId = categoryId;

    const nominations = await Nomination.find(filter)
      .populate('categoryId', 'name icon color pointsPerNomination')
      .populate('nomineeId', 'fullName department')
      .populate('nominatorId', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Nomination.countDocuments(filter);

    res.status(200).json({
      nominations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/nominations/my-nominations
 * Current user's nominations (given and received).
 */
exports.getMyNominations = async (req, res, next) => {
  try {
    const [given, received] = await Promise.all([
      Nomination.find({ nominatorId: req.userId })
        .populate('categoryId', 'name icon color')
        .populate('nomineeId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Nomination.find({ nomineeId: req.userId })
        .populate('categoryId', 'name icon color')
        .populate('nominatorId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    res.status(200).json({ given, received });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/nominations/:nominationId/approve
 * Manager approval for a nomination.
 */
exports.approveNomination = async (req, res, next) => {
  try {
    const { nominationId } = req.params;
    const { approvalNote } = req.body;

    const nomination = await Nomination.findOne(
      { _id: nominationId, status: 'PENDING_APPROVAL' },
    );
    if (!nomination) {
      return res.status(404).json({ message: 'Pending nomination not found' });
    }

    const category = await NominationCategory.findById(nomination.categoryId);
    nomination.status = 'APPROVED';
    nomination.approvedBy = req.userId;
    nomination.approvedAt = new Date();
    nomination.approvalNote = approvalNote || '';
    nomination.pointsAwarded = category ? category.pointsPerNomination : 0;
    await nomination.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'NOMINATION_APPROVED',
      resourceType: 'Nomination',
      resourceIds: [nomination._id],
      details: { pointsAwarded: nomination.pointsAwarded },
      req,
    });

    res.status(200).json({ nomination });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/nominations/:nominationId/reject
 * Manager rejection for a nomination.
 */
exports.rejectNomination = async (req, res, next) => {
  try {
    const { nominationId } = req.params;
    const { reason } = req.body;

    const nomination = await Nomination.findOne(
      { _id: nominationId, status: 'PENDING_APPROVAL' },
    );
    if (!nomination) {
      return res.status(404).json({ message: 'Pending nomination not found' });
    }

    nomination.status = 'REJECTED';
    nomination.rejectedBy = req.userId;
    nomination.rejectedAt = new Date();
    nomination.approvalNote = reason || '';
    await nomination.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'NOMINATION_REJECTED',
      resourceType: 'Nomination',
      resourceIds: [nomination._id],
      details: { reason },
      req,
    });

    res.status(200).json({ nomination });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Nomination Comments
// ============================================================================

/**
 * POST /api/nominations/:nominationId/comments
 * Add a comment to a nomination.
 */
exports.addComment = async (req, res, next) => {
  try {
    const { nominationId } = req.params;
    const { content, isManagerComment } = req.body;

    const nomination = await Nomination.findOne(
      { _id: nominationId },
    );
    if (!nomination) {
      return res.status(404).json({ message: 'Nomination not found' });
    }

    const comment = await NominationComment.create({
      nominationId,
      authorId: req.userId,
      content,
      isManagerComment: isManagerComment || false
    });

    await Nomination.findByIdAndUpdate(nominationId, {
      $inc: { commentCount: 1 },
    });

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/nominations/:nominationId/comments
 * List comments for a nomination.
 */
exports.getComments = async (req, res, next) => {
  try {
    const { nominationId } = req.params;

    const comments = await NominationComment.find(
      { nominationId },
    )
      .populate('authorId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ comments });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Recognition Cycles
// ============================================================================

/**
 * POST /api/nominations/cycles
 * Create a new recognition cycle (monthly).
 */
exports.createCycle = async (req, res, next) => {
  try {
    const { title, month, year } = req.body;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const cycle = await RecognitionCycle.create({
      title: title || `Recognition Cycle - ${startDate.toLocaleString('en-US', { month: 'long' })} ${year}`,
      month,
      year,
      startDate,
      endDate,
      status: 'DRAFT'
    });

    res.status(201).json({ cycle });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'A cycle for this month/year already exists' });
    }
    next(error);
  }
};

/**
 * PATCH /api/nominations/cycles/:cycleId/finalize
 * Close a cycle and compute final totals.
 */
exports.finalizeCycle = async (req, res, next) => {
  try {
    const { cycleId } = req.params;

    const cycle = await RecognitionCycle.findOne(
      { _id: cycleId, status: { $ne: 'FINALIZED' } },
    );
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found or already finalized' });
    }

    const [totalNominations, totalPoints] = await Promise.all([
      Nomination.countDocuments(
        { cycleId: cycle._id, status: 'APPROVED' },
      ),
      Nomination.aggregate([
        { $match: { tenantId: cycle.tenantId, cycleId: cycle._id, status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
      ]),
    ]);

    cycle.totalNominations = totalNominations;
    cycle.totalPointsAwarded = totalPoints[0]?.total || 0;
    cycle.status = 'FINALIZED';
    cycle.finalizedBy = req.userId;
    cycle.finalizedAt = new Date();
    await cycle.save();

    res.status(200).json({ cycle });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Leaderboard & Analytics
// ============================================================================

/**
 * GET /api/nominations/leaderboard
 * Top nominees by points and nomination count.
 */
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { month, year, limit: queryLimit } = req.query;
    const topLimit = Math.min(Number(queryLimit) || 10, 50);

    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    }

    const leaderboard = await Nomination.aggregate([
      {
        $match: {
          status: 'APPROVED',
          ...dateFilter
        },
      },
      {
        $group: {
          _id: '$nomineeId',
          totalPoints: { $sum: '$pointsAwarded' },
          nominationCount: { $sum: 1 },
          categories: { $addToSet: '$categoryId' },
        },
      },
      { $sort: { totalPoints: -1, nominationCount: -1 } },
      { $limit: topLimit },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          employeeName: '$employee.fullName',
          department: '$employee.department',
          totalPoints: 1,
          nominationCount: 1,
          categoryCount: { $size: '$categories' },
        },
      },
    ]);

    res.status(200).json({ leaderboard });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/nominations/dashboard
 * Aggregated dashboard metrics for the recognition program.
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalNominations,
      monthNominations,
      pendingApprovals,
      totalCategories,
      topNominee,
      recentNominations,
    ] = await Promise.all([
      Nomination.countDocuments({ status: 'APPROVED' }),
      Nomination.countDocuments(
        { status: 'APPROVED', createdAt: { $gte: startOfMonth } },
      ),
      Nomination.countDocuments(
        { status: 'PENDING_APPROVAL' },
      ),
      NominationCategory.countDocuments({ isActive: true }),
      Nomination.aggregate([
        {
          $match: {
            status: 'APPROVED',
            createdAt: { $gte: startOfMonth }
          },
        },
        {
          $group: {
            _id: '$nomineeId',
            totalPoints: { $sum: '$pointsAwarded' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalPoints: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'employees',
            localField: '_id',
            foreignField: '_id',
            as: 'employee',
          },
        },
        { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      ]),
      Nomination.find({ isPublic: true })
        .populate('categoryId', 'name icon color')
        .populate('nomineeId', 'fullName')
        .populate('nominatorId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    res.status(200).json({
      totalNominations,
      monthNominations,
      pendingApprovals,
      totalCategories,
      topNominee: topNominee[0] || null,
      recentNominations,
    });
  } catch (error) {
    next(error);
  }
};
