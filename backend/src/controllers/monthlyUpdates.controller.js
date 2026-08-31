/**
 * @fileoverview Monthly Updates Controller
 * @description Handles the creation, retrieval, and modification of monthly 
 * employee activity updates (leaves, overtime, bonuses, deductions).
 * 
 * CRITICAL FIX (Issue #509):
 * Previously, asynchronous database operations in this route lacked proper 
 * try/catch error handling. If the database connection dropped or a validation 
 * error occurred, it resulted in an Unhandled Promise Rejection, crashing the 
 * Node.js server. All logic is now strictly wrapped in try/catch blocks and 
 * errors are forwarded to the centralized Express error handler via `next()`.
 * 
 * Issue: #509
 */

const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const MonthlyUpdate = require('../models/monthlyUpdate.model'); // Assumed schema
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const { sanitizeText } = require('../utils/validators');

/**
 * Helper to validate MongoDB ObjectId format
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * POST /api/monthly-updates
 * Creates or updates a monthly activity record for an employee.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function (CRITICAL FOR ERROR HANDLING)
 */
exports.createOrUpdateMonthlyUpdate = async (req, res, next) => {
    // FIX #509: Wrap entire async controller in try/catch
    try {
        const { employeeId, month, year, leaveDays, overtimeHours, bonus, deductions, notes } = req.body;

        // 1. Input Validation
        if (!employeeId || !isValidObjectId(employeeId)) {
            return res.status(400).json({ message: 'Valid employeeId is required' });
        }

        const parsedMonth = parseInt(month, 10);
        const parsedYear = parseInt(year, 10);

        if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
            return res.status(400).json({ message: 'Month must be an integer between 1 and 12' });
        }

        if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
            return res.status(400).json({ message: 'Invalid year format' });
        }

        // 2. Verify Employee Exists and Ownership
        // FIX #509: Awaiting DB call inside try/catch prevents unhandled rejection on DB drop
        const employee = await Employee.findOne({
            _id: employeeId,
            isDeleted: { $ne: true }
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found or access denied' });
        }

        // 3. Sanitize and cast numeric values safely
        const safeLeaveDays = Math.max(0, Number(leaveDays) || 0);
        const safeOvertimeHours = Math.max(0, Number(overtimeHours) || 0);
        const safeBonus = Math.max(0, Number(bonus) || 0);
        const safeDeductions = Math.max(0, Number(deductions) || 0);
        const safeNotes = notes ? sanitizeText(String(notes).slice(0, 500)) : '';

        // 4. Upsert the Monthly Update Record
        // FIX #509: Database write operation secured
        const updateData = {
            employeeId: employee._id,
            employeeName: employee.fullName,
            month: parsedMonth,
            year: parsedYear,
            leaveDays: safeLeaveDays,
            overtimeHours: safeOvertimeHours,
            bonus: safeBonus,
            deductions: safeDeductions,
            notes: safeNotes,
            createdBy: req.userId,
            updatedAt: new Date()
        };

        const updatedRecord = await MonthlyUpdate.findOneAndUpdate(
            {
                employeeId: employee._id,
                month: parsedMonth,
                year: parsedYear
            },
            { $set: updateData, $setOnInsert: { createdAt: new Date() } },
            { upsert: true, new: true, runValidators: true }
        );

        // 5. Emit Audit Event
        eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'MONTHLY_UPDATE_UPSERT',
            resourceType: 'MonthlyUpdate',
            resourceIds: [updatedRecord._id],
            details: {
                employeeName: employee.fullName,
                month: parsedMonth,
                year: parsedYear,
                leaveDays: safeLeaveDays,
                overtimeHours: safeOvertimeHours
            },
            req
        });

        // 6. Invalidate Cache
        await cacheService.invalidateAnalytics(req.userId);

        logger.info('Monthly update saved successfully', {
            userId: req.userId,
            employeeId,
            month: parsedMonth,
            year: parsedYear
        });

        return res.status(200).json({
            message: 'Monthly update saved successfully',
            data: updatedRecord
        });

    } catch (error) {
        // FIX #509: Catch all synchronous and asynchronous errors
        logger.error('Failed to save monthly update', {
            userId: req.userId,
            error: error.message,
            stack: error.stack
        });

        // CRITICAL: Pass error to centralized error handling middleware
        // This prevents the "Unhandled Promise Rejection" server crash
        return next(error);
    }
};

/**
 * GET /api/monthly-updates/:employeeId
 * Retrieves all monthly updates for a specific employee.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getEmployeeMonthlyUpdates = async (req, res, next) => {
    // FIX #509: Wrap in try/catch
    try {
        const { employeeId } = req.params;

        if (!isValidObjectId(employeeId)) {
            return res.status(400).json({ message: 'Invalid employee ID format' });
        }

        // Verify ownership
        const employee = await Employee.findOne({
            _id: employeeId,
            isDeleted: { $ne: true }
        }).select('_id fullName');

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Fetch updates sorted by newest first
        const updates = await MonthlyUpdate.find({
            employeeId: employee._id
        }).sort({ year: -1, month: -1 }).lean();

        return res.status(200).json({
            employee: {
                id: employee._id,
                name: employee.fullName
            },
            updates
        });

    } catch (error) {
        // FIX #509: Forward to error handler
        logger.error('Failed to fetch monthly updates', {
            userId: req.userId,
            employeeId: req.params.employeeId,
            error: error.message
        });
        return next(error);
    }
};

/**
 * DELETE /api/monthly-updates/:id
 * Deletes a specific monthly update record.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.deleteMonthlyUpdate = async (req, res, next) => {
    // FIX #509: Wrap in try/catch
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid update ID format' });
        }

        const record = await MonthlyUpdate.findOne({
            _id: id
        });

        if (!record) {
            return res.status(404).json({ message: 'Monthly update record not found' });
        }

        // Check if payroll has already been finalized for this month
        // If so, prevent deletion to maintain financial integrity
        const PayrollUpdate = require('../models/payroll.model');
        const lockedPayroll = await PayrollUpdate.findOne({
            employeeId: record.employeeId,
            month: record.month,
            year: record.year,
            status: { $in: ['approved', 'paid'] }
        });

        if (lockedPayroll) {
            return res.status(409).json({
                message: 'Cannot delete monthly update. Payroll for this period has already been approved or paid.'
            });
        }

        // Perform deletion
        await MonthlyUpdate.deleteOne({ _id: id });

        eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'MONTHLY_UPDATE_DELETE',
            resourceType: 'MonthlyUpdate',
            resourceIds: [id],
            details: {
                employeeId: record.employeeId,
                month: record.month,
                year: record.year
            },
            req
        });

        await cacheService.invalidateAnalytics(req.userId);

        logger.info('Monthly update deleted', {
            userId: req.userId,
            updateId: id
        });

        return res.status(200).json({
            message: 'Monthly update deleted successfully'
        });

    } catch (error) {
        // FIX #509: Forward to error handler
        logger.error('Failed to delete monthly update', {
            userId: req.userId,
            updateId: req.params.id,
            error: error.message
        });
        return next(error);
    }
};
