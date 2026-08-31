/**
 * @fileoverview Data Privacy Controller
 * @description Manages PII masking rules, consent workflows, erasure requests, and audit logs.
 * Issue: #1870
 */
const mongoose = require('mongoose');
const { PrivacyConsent, PIIMaskingRule, DataErasureRequest, DataAuditLog } = require('../models/dataPrivacy.model');
const DataPrivacyPolicy = require('../models/dataPrivacyPolicy.model');
const Employee = require('../models/employee.model'); // Assuming exists
const { applyDynamicMasking, executeSafeErasure } = require('../utils/piiMaskingEngine.utils');
const { requestUnmaskedPII } = require('../services/dataPrivacy.service');
const logger = require('../utils/logger');

exports.createMaskingRule = async (req, res, next) => {
    try {
        const rule = await PIIMaskingRule.findOneAndUpdate(
            {
                fieldName: req.body.fieldName
            },
            {
                ...req.body
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Masking rule saved', rule });
    } catch (error) { next(error); }
};

exports.recordConsent = async (req, res, next) => {
    try {
        const { employeeId, consentType, isGranted, consentVersion } = req.body;

        const updateData = {
            employeeId,
            consentType,
            isGranted,
            consentVersion,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        };

        if (isGranted) {
            updateData.grantedAt = new Date();
            updateData.revokedAt = null;
        } else {
            updateData.revokedAt = new Date();
        }

        const consent = await PrivacyConsent.findOneAndUpdate(
            {
                employeeId,
                consentType
            },
            updateData,
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Consent recorded', consent });
    } catch (error) { next(error); }
};

exports.requestErasure = async (req, res, next) => {
    try {
        const { employeeId, requestType } = req.body;

        const request = await DataErasureRequest.create({
            employeeId,
            requestType,
            requestedBy: req.userId,

            // Default to true until compliance officer reviews
            hasLegalHold: true
        });

        res.status(201).json({ message: 'Erasure request submitted', request });
    } catch (error) { next(error); }
};

exports.processErasure = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { requestId, approve } = req.body;
        const request = await DataErasureRequest.findById(requestId).session(session);
        if (!request) throw new Error('Request not found');

        if (!approve) {
            request.status = 'Rejected (Legal Hold)';
            await request.save({ session });
            await session.commitTransaction();
            return res.status(200).json({ message: 'Request rejected due to legal hold.' });
        }

        // Execute Safe Erasure
        const employee = await Employee.findById(request.employeeId).session(session);
        if (!employee) throw new Error('Employee not found');

        const anonymizedData = executeSafeErasure(employee.toObject());

        // Update employee record with anonymized data
        await Employee.findByIdAndUpdate(request.employeeId, anonymizedData, { session });

        request.status = 'Completed';
        request.anonymizedAt = new Date();
        request.processedBy = req.userId;
        await request.save({ session });

        // Log the erasure
        await DataAuditLog.create([{
            userId: req.userId,
            userRole: 'ComplianceAdmin',
            action: 'Executed Erasure',
            targetEmployeeId: request.employeeId,
            fieldsAccessed: ['firstName', 'lastName', 'ssn', 'homeAddress'],
            ipAddress: req.ip,
            wasMasked: false
        }], { session });

        await session.commitTransaction();
        logger.info(`[Privacy] Executed GDPR erasure for employee ${request.employeeId}`);
        res.status(200).json({ message: 'PII successfully anonymized. Financial records preserved.' });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getMaskedEmployeeData = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const userRoles = req.userRoles || ['StandardUser'];
        const userRole = userRoles[0] || 'StandardUser';

        const employee = await Employee.findOne({
            _id: employeeId
        })
            .setOptions({
            userRole
        });

        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Log the access in DataAuditLog
        await DataAuditLog.create({
            userId: req.userId,
            userRole,
            action: 'Viewed PII',
            targetEmployeeId: employeeId,
            fieldsAccessed: ['bankAccount', 'ssn'],
            ipAddress: req.ip,
            wasMasked: true
        });

        res.status(200).json({ data: employee, wasMasked: true });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const rules = await PIIMaskingRule.find({}).sort({ fieldName: 1 });
        const pendingErasure = await DataErasureRequest.find({
            status: 'Pending Review'
        })
            .populate('employeeId', 'fullName');
        const recentLogs = await DataAuditLog.find({})
            .populate('userId', 'fullName')
            .sort({ createdAt: -1 }).limit(50);

        res.status(200).json({ rules, pendingErasure, recentLogs });
    } catch (error) { next(error); }
};

exports.getPolicies = async (req, res, next) => {
    try {
        const policies = await DataPrivacyPolicy.find({});
        res.json({ policies });
    } catch (error) { next(error); }
};

exports.createOrUpdatePolicy = async (req, res, next) => {
    try {
        const { rules, isActive } = req.body;
        const policy = await DataPrivacyPolicy.findOneAndUpdate(
            {},
            { $set: { rules: rules || [], isActive: isActive !== false } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(200).json({ message: 'Privacy policy saved successfully', policy });
    } catch (error) { next(error); }
};

exports.revealPII = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { fields, reason } = req.body;
        const userRoles = req.userRoles || ['StandardUser'];
        const userRole = userRoles[0] || 'StandardUser';

        if (!Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({ error: 'fields must be a non-empty array' });
        }
        if (!reason) {
            return res.status(400).json({ error: 'reason is required for viewing unmasked PII values' });
        }

        const unmasked = await requestUnmaskedPII({
            userId: req.userId,
            employeeId,
            fields,
            reason,
            userRole,
            req
        });

        res.json({ data: unmasked });
    } catch (error) { next(error); }
};
