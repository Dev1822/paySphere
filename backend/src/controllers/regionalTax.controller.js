/**
 * @fileoverview Regional Tax Controller
 * @description Manages multi-jurisdiction tax configurations, nexus tracking, 
 * and remote worker tax liability reporting.
 * Issue: #1086
 */
const TaxJurisdiction = require('../models/taxJurisdiction.model');
const StateTaxRules = require('../models/stateTaxRules.model');
const Employee = require('../models/employee.model');
const { calculateRegionalTax, getActiveStateRules, checkTaxNexus } = require('../utils/taxEngine.utils');
const logger = require('../utils/logger');

exports.upsertJurisdiction = async (req, res, next) => {
    try {
        const { stateCode, stateName, country, hasNexus, registrationNumber } = req.body;

        const jurisdiction = await TaxJurisdiction.findOneAndUpdate(
            {
                stateCode: stateCode.toUpperCase()
            },
            {
                stateName, country, hasNexus, registrationNumber,
                nexusEstablishedDate: hasNexus ? new Date() : null
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Jurisdiction saved', jurisdiction });
    } catch (error) { next(error); }
};

exports.saveTaxRules = async (req, res, next) => {
    try {
        const { jurisdictionId, standardDeduction, brackets, flatTaxRate, surchargeRate, professionalTax } = req.body;

        // Deactivate previous rules for this jurisdiction
        await StateTaxRules.updateMany(
            {
                jurisdictionId,
                effectiveTo: null
            },
            { $set: { effectiveTo: new Date() } }
        );

        const rules = await StateTaxRules.create({
            jurisdictionId,
            standardDeduction,
            brackets: brackets || [],
            flatTaxRate: flatTaxRate || 0,
            surchargeRate: surchargeRate || 0,
            professionalTax: professionalTax || 0,
            effectiveFrom: new Date()
        });

        res.status(201).json({ message: 'Tax rules updated', rules });
    } catch (error) { next(error); }
};

exports.getJurisdictions = async (req, res, next) => {
    try {
        const jurisdictions = await TaxJurisdiction.find({}).sort({ stateName: 1 });
        res.status(200).json({ jurisdictions });
    } catch (error) { next(error); }
};

exports.getRemoteWorkerReport = async (req, res, next) => {
    try {
        // Fetch all active employees with a declared work location/state
        const employees = await Employee.find({
            isActive: true,
            isDeleted: { $ne: true },
            'address.state': { $exists: true, $ne: '' }
        }).select('fullName department monthlySalary address.state');

        const report = [];
        const nexusAlerts = [];

        for (const emp of employees) {
            const stateCode = emp.address.state;
            const nexusCheck = await checkTaxNexus(req.tenantId, stateCode);

            if (!nexusCheck.hasNexus) {
                nexusAlerts.push({ employee: emp.fullName, state: stateCode, message: nexusCheck.alertMessage });
            }

            const rules = await getActiveStateRules(req.tenantId, stateCode);
            const annualGross = (emp.monthlySalary || 0) * 12;

            let annualStateTax = 0;
            if (rules) {
                annualStateTax = calculateRegionalTax(annualGross, rules);
            }

            report.push({
                employeeId: emp._id,
                fullName: emp.fullName,
                department: emp.department,
                stateCode,
                annualGross,
                annualStateTax,
                hasRules: !!rules,
                hasNexus: nexusCheck.hasNexus
            });
        }

        res.status(200).json({ report, nexusAlerts });
    } catch (error) { next(error); }
};

exports.syncTaxSlabs = async (req, res, next) => {
    try {
        const taxSyncService = require('../services/taxSync.service');
        const result = await taxSyncService.syncRegionalTaxSlabs(req.tenantId, 'OnDemand');
        if (!result.success) {
            return res.status(500).json({ message: 'Tax sync failed. Check system logs.' });
        }
        res.status(200).json({ message: 'Tax slab sync complete', updatedCount: result.updatedCount });
    } catch (error) { next(error); }
};

exports.getSyncLogs = async (req, res, next) => {
    try {
        const { TaxSyncLog } = require('../models/regionalTax.model');
        const logs = await TaxSyncLog.find({}).sort({ createdAt: -1 });
        res.status(200).json({ logs });
    } catch (error) { next(error); }
};
