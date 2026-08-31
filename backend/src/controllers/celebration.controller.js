/**
 * @fileoverview Celebration Controller
 * @description Provides API endpoints for the frontend dashboard to fetch 
 * active celebrations and allow colleagues to react to them.
 * Issue: #1286
 */
const { Celebration } = require('../models/celebration.model');

/**
 * GET /api/celebrations/today
 * Fetches today's birthdays and work anniversaries for the tenant's dashboard.
 */
exports.getTodaysCelebrations = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const celebrations = await Celebration.find({
            eventDate: { $gte: today, $lt: tomorrow }
        })
            .populate('employeeId', 'fullName profilePicture department')
            .sort({ type: 1, createdAt: -1 });

        res.status(200).json({ celebrations });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/celebrations/upcoming
 * Fetches celebrations for the next 7 days to show in a sidebar widget.
 */
exports.getUpcomingCelebrations = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const celebrations = await Celebration.find({
            eventDate: { $gte: today, $lt: nextWeek }
        })
            .populate('employeeId', 'fullName profilePicture')
            .sort({ eventDate: 1 });

        res.status(200).json({ celebrations });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/celebrations/:id/react
 * Allows a user to "react" (like/celebrate) to a colleague's milestone.
 */
exports.reactToCelebration = async (req, res, next) => {
    try {
        const celebration = await Celebration.findOne({
            _id: req.params.id
        });

        if (!celebration) {
            return res.status(404).json({ message: 'Celebration event not found.' });
        }

        celebration.reactionCount += 1;
        await celebration.save();

        res.status(200).json({ message: 'Reaction added', reactionCount: celebration.reactionCount });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/celebrations/trigger-manual
 * Admin endpoint to manually trigger the cron job for testing or catch-up.
 */
exports.triggerManual = async (req, res, next) => {
    try {
        const { processDailyCelebrations } = require('../services/celebrationCron.service');
        const result = await processDailyCelebrations(req.tenantId);
        res.status(200).json({ message: 'Manual trigger executed successfully', result });
    } catch (error) {
        next(error);
    }
};
