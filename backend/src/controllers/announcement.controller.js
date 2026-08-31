const Announcement = require('../models/announcement.model');
const { sanitizeText } = require('../utils/validators');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

exports.createAnnouncement = async (req, res, next) => {
  try {
    const { title, content, category, priority, isPinned } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Announcement title is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Announcement content is required' });
    }

    const announcement = await Announcement.create({
      title: sanitizeText(title),

      // HTML rich text content
      content,

      category: category || 'general',
      priority: priority || 'medium',
      isPinned: Boolean(isPinned),
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'User',
      resourceIds: [announcement._id],
      details: { title: announcement.title, category: announcement.category },
      req
    });

    return res.status(201).json({
      message: 'Announcement published successfully',
      announcement,
    });
  } catch (error) {
    logger.error('Failed to create announcement', { userId: req.userId, error: error.message });
    next(error);
  }
};

exports.getAnnouncements = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      filter.title = new RegExp(search.trim(), 'i');
    }

    const announcements = await Announcement.find(filter)
      .populate('createdBy', 'fullName email avatar')
      .sort({ isPinned: -1, createdAt: -1 });

    return res.status(200).json({ announcements });
  } catch (error) {
    logger.error('Failed to fetch announcements', { userId: req.userId, error: error.message });
    next(error);
  }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findOneAndDelete({
      _id: id
    });

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    return res.status(200).json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete announcement', { userId: req.userId, error: error.message });
    next(error);
  }
};
