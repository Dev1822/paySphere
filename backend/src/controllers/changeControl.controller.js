/**
 * @fileoverview Change Control Controller
 * @description Manages SOX-compliant change requests, approvals, and audit trails.
 * Issue: #1734
 */
const mongoose = require('mongoose');
const { PayrollChangeRequest, ApprovalWorkflow, ControlAuditLog } = require('../models/changeControl.model');
const Employee = require('../models/employee.model');
const User = require('../models/user.model'); // Assuming standard User model exists
const { scoreChangeRisk, validateSegregationOfDuties, generateAuditSnapshot } = require('../utils/changeControlEngine.utils');
const logger = require('../utils/logger');

exports.requestChange = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { employeeId, changeType, fieldName, beforeValue, afterValue, reason, assignedApproverId } = req.body;

        const risk = scoreChangeRisk(changeType, beforeValue, afterValue);

        const request = await PayrollChangeRequest.create([{
            tenantId: req.tenantId, employeeId, changeType, fieldName,
            beforeValue, afterValue, riskScore: risk.riskScore, reason,
            requestedBy: req.userId
        }], { session });

        // Create Workflow Stage 1
        const workflow = await ApprovalWorkflow.create([{
            tenantId: req.tenantId, requestId: request[0]._id,
            assignedTo: assignedApproverId, stage: 1
        }], { session });

        // Audit Log: Created
        const maker = await User.findById(req.userId);
        await ControlAuditLog.create([{
            tenantId: req.tenantId, requestId: request[0]._id, action: 'Created',
            userId: req.userId, userRole: maker.role || 'Payroll Admin',
            snapshot: generateAuditSnapshot(request[0], workflow[0]),
            ipAddress: req.ip
        }], { session });

        await session.commitTransaction();
        res.status(201).json({ message: 'Change request submitted for approval', request: request[0], risk });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.approveChange = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { requestId, comments } = req.body;

        const request = await PayrollChangeRequest.findById(requestId).session(session);
        if (!request || request.status !== 'Pending') throw new Error('Request not found or already processed.');

        const workflow = await ApprovalWorkflow.findOne({ requestId, status: 'Pending Review' }).session(session);
        if (!workflow) throw new Error('No pending approval workflow found.');

        // SOX Guardrail: Check Segregation of Duties
        const maker = await User.findById(request.requestedBy);
        const checker = await User.findById(req.userId);

        const sodCheck = validateSegregationOfDuties(
            { id: maker._id, role: maker.role },
            { id: checker._id, role: checker.role }
        );

        if (!sodCheck.isCompliant) {
            await session.abortTransaction();
            return res.status(403).json({ message: sodCheck.reason });
        }

        // Approve
        workflow.status = 'Approved';
        workflow.comments = comments;
        workflow.actionedAt = new Date();
        workflow.actionedBy = req.userId;
        await workflow.save({ session });

        request.status = 'Approved';
        await request.save({ session });

        // Audit Log: Approved
        await ControlAuditLog.create([{
            tenantId: req.tenantId, requestId, action: 'Approved',
            userId: req.userId, userRole: checker.role || 'Manager',
            snapshot: generateAuditSnapshot(request, workflow),
            ipAddress: req.ip
        }], { session });

        // TODO: In a real system, trigger an event to apply this change to the Employee/Payroll models
        logger.info(`[SOX] Change ${request._id} approved by ${checker.email}`);

        await session.commitTransaction();
        res.status(200).json({ message: 'Change approved and applied.', request });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.rejectChange = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { requestId, comments } = req.body;

        const request = await PayrollChangeRequest.findById(requestId).session(session);
        const workflow = await ApprovalWorkflow.findOne({ requestId, status: 'Pending Review' }).session(session);

        if (!request || !workflow) throw new Error('Request or workflow not found.');

        workflow.status = 'Rejected';
        workflow.comments = comments;
        workflow.actionedAt = new Date();
        workflow.actionedBy = req.userId;
        await workflow.save({ session });

        request.status = 'Rejected';
        await request.save({ session });

        const checker = await User.findById(req.userId);
        await ControlAuditLog.create([{
            tenantId: req.tenantId, requestId, action: 'Rejected',
            userId: req.userId, userRole: checker.role || 'Manager',
            snapshot: generateAuditSnapshot(request, workflow),
            ipAddress: req.ip
        }], { session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Change request rejected.', request });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getAuditTrail = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const logs = await ControlAuditLog.find({ requestId, tenantId: req.tenantId })
            .populate('userId', 'fullName email role')
            .sort({ createdAt: 1 });

        res.status(200).json({ logs });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        // Fetch requests assigned to the current user for approval
        const myApprovals = await ApprovalWorkflow.find({ assignedTo: req.userId, status: 'Pending Review', tenantId: req.tenantId })
            .populate({
                path: 'requestId',
                populate: { path: 'employeeId', select: 'fullName department' }
            });

        const recentHistory = await PayrollChangeRequest.find({ tenantId: req.tenantId })
            .populate('employeeId', 'fullName')
            .populate('requestedBy', 'fullName')
            .sort({ createdAt: -1 }).limit(20);

        res.status(200).json({ myApprovals, recentHistory });
    } catch (error) { next(error); }
};
