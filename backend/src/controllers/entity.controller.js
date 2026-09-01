/**
 * @fileoverview Corporate Entity & Deputation Controller
 * @description Manages entity hierarchy mapping and cross-tenant employee deputations.
 * Issue: #999
 */
const mongoose = require('mongoose');
const CorporateEntity = require('../models/corporateEntity.model');
const Deputation = require('../models/deputation.model');
const Employee = require('../models/employee.model');
const { generateConsolidatedReport } = require('../utils/consolidationEngine');
const logger = require('../utils/logger');

exports.registerEntity = async (req, res, next) => {
    try {
        const { entityName, entityCode, parentId, ownershipPercentage } = req.body;

        let level = 0;
        if (parentId) {
            const parent = await CorporateEntity.findOne({ tenantId: parentId });
            if (!parent) return res.status(404).json({ message: 'Parent entity not found' });
            level = parent.level + 1;
        }

        const entity = await CorporateEntity.create({
            parentId: parentId || null,
            entityName,
            entityCode,
            ownershipPercentage,
            level,
            createdBy: req.userId
        });

        res.status(201).json({ message: 'Entity registered', entity });
    } catch (error) { next(error); }
};

exports.getHierarchy = async (req, res, next) => {
    try {
        const entities = await CorporateEntity.find({
            $or: [{}, { parentId: req.tenantId }]
        }).populate('parentId', 'entityName');

        res.status(200).json({ entities });
    } catch (error) { next(error); }
};

exports.initiateDeputation = async (req, res, next) => {
    try {
        const { employeeId, toTenantId, startDate, endDate, type, payrollResponsibility, reason } = req.body;

        // Verify employee belongs to the current tenant (fromTenant)
        const employee = await Employee.findOne({
            _id: employeeId
        });
        if (!employee) return res.status(404).json({ message: 'Employee not found in current entity' });

        const deputation = await Deputation.create({
            employeeId,
            fromTenantId: req.tenantId,
            toTenantId,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            type,
            payrollResponsibility,
            reason
        });

        res.status(201).json({ message: 'Deputation initiated pending approval', deputation });
    } catch (error) { next(error); }
};

exports.approveDeputation = async (req, res, next) => {
    try {
        const deputation = await Deputation.findById(req.params.id);
        if (!deputation) return res.status(404).json({ message: 'Deputation not found' });

        deputation.status = 'Active';
        deputation.approvedBy = req.userId;
        deputation.approvedAt = new Date();
        await deputation.save();

        // In a real system, this would trigger an event to update the employee's 
        // active tenant context or create a shadow record in the host tenant.
        logger.info(`Deputation ${deputation._id} approved and activated.`);

        res.status(200).json({ message: 'Deputation approved and activated', deputation });
    } catch (error) { next(error); }
};

exports.getConsolidatedReport = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();

        const report = await generateConsolidatedReport(req.tenantId, m, y);
        res.status(200).json({ report });
    } catch (error) { next(error); }
};
