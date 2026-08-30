/**
 * @fileoverview Helpdesk & Ticketing Hub Controller
 * @description Manages ticket categories, SLA policies, structured tickets with
 * message threads, assignment routing, SLA monitoring, and dashboard analytics.
 */
const {
  TicketCategory,
  SLAPolicy,
  Ticket,
  TicketComment,
} = require('../models/ticketHub.model');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

const MS_PER_HOUR = 1000 * 60 * 60;

// ============================================================================
// Categories
// ============================================================================

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, icon, color, defaultPriority } = req.body;

    const category = await TicketCategory.create({
      tenantId: req.tenantId,
      name,
      description: description || '',
      icon: icon || 'headphones',
      color: color || '#6366f1',
      defaultPriority: defaultPriority || 'MEDIUM',
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TICKET_CATEGORY_CREATED',
      resourceType: 'TicketCategory',
      resourceIds: [category._id],
      details: { name },
      req,
    });

    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await TicketCategory.find(
      tenantFilter(req, { isActive: true }),
    ).sort({ name: 1 }).lean();
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SLA Policies
// ============================================================================

exports.createSLAPolicy = async (req, res, next) => {
  try {
    const { name, priority, firstResponseHours, resolutionHours, escalationAfterHours, escalationContact, businessHoursOnly } = req.body;

    const policy = await SLAPolicy.create({
      tenantId: req.tenantId,
      name,
      priority,
      firstResponseHours,
      resolutionHours,
      escalationAfterHours,
      escalationContact: escalationContact || '',
      businessHoursOnly: businessHoursOnly !== false,
    });

    res.status(201).json({ policy });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'An SLA policy for this priority already exists' });
    }
    next(error);
  }
};

exports.getSLAPolicies = async (req, res, next) => {
  try {
    const policies = await SLAPolicy.find(
      tenantFilter(req, { isActive: true }),
    ).sort({ priority: 1 }).lean();
    res.status(200).json({ policies });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Tickets
// ============================================================================

exports.createTicket = async (req, res, next) => {
  try {
    const { categoryId, subject, description, priority, tags, assigneeId, assigneeName, team } = req.body;

    const category = await TicketCategory.findOne(
      tenantFilter(req, { _id: categoryId, isActive: true }),
    );
    if (!category) {
      return res.status(404).json({ message: 'Ticket category not found' });
    }

    // Generate ticket number
    const count = await Ticket.countDocuments(tenantFilter(req, {}));
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Resolve SLA
    const ticketPriority = priority || category.defaultPriority;
    const sla = await SLAPolicy.findOne(
      tenantFilter(req, { priority: ticketPriority, isActive: true }),
    );

    const now = new Date();
    const firstResponseDueAt = sla
      ? new Date(now.getTime() + sla.firstResponseHours * MS_PER_HOUR)
      : null;
    const resolutionDueAt = sla
      ? new Date(now.getTime() + sla.resolutionHours * MS_PER_HOUR)
      : null;

    const ticket = await Ticket.create({
      tenantId: req.tenantId,
      ticketNumber,
      categoryId,
      subject,
      description,
      priority: ticketPriority,
      requesterId: req.userId,
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || '',
      team: team || 'General',
      slaPolicyId: sla?._id || null,
      firstResponseDueAt,
      resolutionDueAt,
      tags: tags || [],
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TICKET_CREATED',
      resourceType: 'Ticket',
      resourceIds: [ticket._id],
      details: { ticketNumber, subject, priority: ticketPriority, categoryId: String(categoryId) },
      req,
    });

    res.status(201).json({ ticket });
  } catch (error) {
    next(error);
  }
};

exports.getTickets = async (req, res, next) => {
  try {
    const { status, priority, assigneeId, categoryId, page = 1, limit = 20 } = req.query;
    const filter = tenantFilter(req, {});

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assigneeId) filter.assigneeId = assigneeId;
    if (categoryId) filter.categoryId = categoryId;

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('categoryId', 'name icon color')
        .populate('requesterId', 'fullName department')
        .populate('assigneeId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    res.status(200).json({
      tickets,
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

exports.getTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findOne(
      tenantFilter(req, { _id: ticketId }),
    )
      .populate('categoryId', 'name icon color')
      .populate('requesterId', 'fullName department email')
      .populate('assigneeId', 'name email')
      .lean();

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const comments = await TicketComment.find(
      tenantFilter(req, { ticketId }),
    )
      .populate('authorId', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    // Compute SLA status
    const now = new Date();
    let slaStatus = 'N/A';
    if (ticket.resolutionDueAt && !ticket.resolvedAt) {
      const remaining = ticket.resolutionDueAt.getTime() - now.getTime();
      if (remaining < 0) slaStatus = 'BREACHED';
      else if (remaining < 2 * MS_PER_HOUR) slaStatus = 'AT_RISK';
      else slaStatus = 'ON_TRACK';
    } else if (ticket.resolvedAt) {
      slaStatus = 'MET';
    }

    res.status(200).json({ ticket, comments, slaStatus });
  } catch (error) {
    next(error);
  }
};

exports.updateTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { status, priority, assigneeId, assigneeName, team, resolutionNote, tags } = req.body;

    const ticket = await Ticket.findOne(tenantFilter(req, { _id: ticketId }));
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (status) {
      const previousStatus = ticket.status;
      ticket.status = status;

      if (status === 'IN_PROGRESS' && !ticket.firstResponseAt) {
        ticket.firstResponseAt = new Date();
      }
      if (status === 'RESOLVED') {
        ticket.resolvedAt = new Date();
        ticket.resolutionNote = resolutionNote || '';
      }
      if (status === 'CLOSED') {
        ticket.closedAt = new Date();
        ticket.closedBy = req.userId;
      }
      if (status === 'REOPENED') {
        ticket.reopenCount += 1;
        ticket.lastReopenedAt = new Date();
        ticket.resolvedAt = null;
        ticket.closedAt = null;
      }

      // Log status change as system event
      await TicketComment.create({
        tenantId: req.tenantId,
        ticketId: ticket._id,
        authorId: req.userId,
        authorType: 'SYSTEM',
        authorName: 'System',
        content: `Status changed from ${previousStatus} to ${status}`,
        isSystemEvent: true,
      });
    }

    if (priority) ticket.priority = priority;
    if (assigneeId !== undefined) ticket.assigneeId = assigneeId;
    if (assigneeName !== undefined) ticket.assigneeName = assigneeName;
    if (team !== undefined) ticket.team = team;
    if (tags !== undefined) ticket.tags = tags;

    await ticket.save();

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { content, authorType, isInternal } = req.body;

    const ticket = await Ticket.findOne(tenantFilter(req, { _id: ticketId }));
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const comment = await TicketComment.create({
      tenantId: req.tenantId,
      ticketId,
      authorId: req.userId,
      authorType: authorType || 'HR',
      authorName: req.body.authorName || '',
      content,
      isInternal: isInternal || false,
    });

    // Auto-set first response time if not set
    if (!ticket.firstResponseAt && authorType !== 'EMPLOYEE') {
      ticket.firstResponseAt = new Date();
      await ticket.save();
    }

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
};

exports.assignTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { assigneeId, assigneeName, team } = req.body;

    const ticket = await Ticket.findOne(tenantFilter(req, { _id: ticketId }));
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.assigneeId = assigneeId;
    ticket.assigneeName = assigneeName || '';
    if (team) ticket.team = team;

    if (ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
      ticket.firstResponseAt = new Date();
    }

    await ticket.save();

    await TicketComment.create({
      tenantId: req.tenantId,
      ticketId: ticket._id,
      authorId: req.userId,
      authorType: 'SYSTEM',
      authorName: 'System',
      content: `Ticket assigned to ${assigneeName || 'unknown'}`,
      isSystemEvent: true,
    });

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Dashboard
// ============================================================================

exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      breachedTickets,
      ticketsByPriority,
      ticketsByCategory,
      recentTickets,
      avgResolutionTime,
    ] = await Promise.all([
      Ticket.countDocuments(tenantFilter(req, {})),
      Ticket.countDocuments(tenantFilter(req, { status: 'OPEN' })),
      Ticket.countDocuments(tenantFilter(req, { status: 'IN_PROGRESS' })),
      Ticket.countDocuments(tenantFilter(req, { status: { $in: ['RESOLVED', 'CLOSED'] } })),
      Ticket.countDocuments(
        tenantFilter(req, {
          resolutionDueAt: { $lt: now },
          status: { $nin: ['RESOLVED', 'CLOSED'] },
        }),
      ),
      Ticket.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $lookup: { from: 'ticketcategories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, count: 1, name: '$category.name', color: '$category.color' } },
      ]),
      Ticket.find(tenantFilter(req, {}))
        .populate('categoryId', 'name icon color')
        .populate('requesterId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      // Average resolution time (hours) for resolved tickets in last 30 days
      Ticket.aggregate([
        {
          $match: {
            tenantId: req.tenantId,
            status: { $in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { $gte: new Date(Date.now() - 30 * 86400000) },
          },
        },
        {
          $project: {
            resolutionHours: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, MS_PER_HOUR],
            },
          },
        },
        { $group: { _id: null, avgHours: { $avg: '$resolutionHours' } } },
      ]),
    ]);

    res.status(200).json({
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      breachedTickets,
      ticketsByPriority: ticketsByPriority.reduce((acc, p) => { acc[p._id] = p.count; return acc; }, {}),
      ticketsByCategory,
      recentTickets,
      avgResolutionHours: avgResolutionTime[0]?.avgHours
        ? Math.round(avgResolutionTime[0].avgHours * 10) / 10
        : 0,
    });
  } catch (error) {
    next(error);
  }
};
