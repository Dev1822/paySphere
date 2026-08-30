/**
 * @fileoverview State Tax Controller
 * @description Manages reciprocity agreements, employee tax profiles, and liability evaluation.
 * Issue: #1731
 */
const { ReciprocityAgreement, StateTaxProfile, LocalTaxJurisdiction } = require('../models/stateTaxReciprocity.model');
const Employee = require('../models/employee.model');
const { checkReciprocityGuardrail, evaluateNonResidentThreshold, calculateLocalTax } = require('../utils/multiStateTaxEngine.utils');
const logger = require('../utils/logger');

exports.createAgreement = async (req, res, next) => {
    try {
        const agreement = await ReciprocityAgreement.findOneAndUpdate(
            { tenantId: req.tenantId, residentState: req.body.residentState.toUpperCase(), workState: req.body.workState.toUpperCase() },
            { ...req.body, tenantId: req.tenantId, residentState: req.body.residentState.toUpperCase(), workState: req.body.workState.toUpperCase() },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Reciprocity agreement saved', agreement });
    } catch (error) { next(error); }
};

exports.updateEmployeeProfile = async (req, res, next) => {
    try {
        const { employeeId, residentState, primaryWorkState, hasReciprocityExemption, exemptionFormUrl } = req.body;

        const profile = await StateTaxProfile.findOneAndUpdate(
            { employeeId, tenantId: req.tenantId },
            {
                tenantId: req.tenantId, employeeId, residentState: residentState.toUpperCase(),
                primaryWorkState: primaryWorkState.toUpperCase(), hasReciprocityExemption,
                exemptionFormUrl, exemptionFormUploaded: !!exemptionFormUrl
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'State tax profile updated', profile });
    } catch (error) { next(error); }
};

exports.evaluateTaxLiability = async (req, res, next) => {
    try {
        const { employeeId, grossPay, daysWorkedInWorkState } = req.body;

        const profile = await StateTaxProfile.findOne({ employeeId, tenantId: req.tenantId });
        if (!profile) return res.status(404).json({ message: 'State tax profile not found for employee.' });

        // 1. Check Reciprocity
        const agreement = await ReciprocityAgreement.findOne({
            tenantId: req.tenantId,
            residentState: profile.residentState,
            workState: profile.primaryWorkState,
            isActive: true
        });

        const reciprocity = checkReciprocityGuardrail(agreement, profile.exemptionFormUploaded);

        // 2. Evaluate Non-Resident Threshold (if no reciprocity)
        let nonResidentLiability = { isLiable: false, reason: 'N/A' };
        if (!reciprocity.applyReciprocity && profile.residentState !== profile.primaryWorkState) {
            nonResidentLiability = evaluateNonResidentThreshold(daysWorkedInWorkState || 0, 183, false);
        }

        // 3. Calculate Local Tax (Mocked: fetch first matching jurisdiction for work state)
        const jurisdiction = await LocalTaxJurisdiction.findOne({ tenantId: req.tenantId, stateCode: profile.primaryWorkState });
        const localTax = calculateLocalTax(grossPay, jurisdiction, profile.residentState === profile.primaryWorkState);

        const result = {
            residentState: profile.residentState,
            workState: profile.primaryWorkState,
            reciprocity,
            nonResidentLiability,
            localTax: {
                jurisdiction: jurisdiction?.jurisdictionName || 'None',
                amount: localTax
            }
        };

        res.status(200).json({ message: 'Tax liability evaluated', result });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const agreements = await ReciprocityAgreement.find({ tenantId: req.tenantId }).sort({ residentState: 1 });
        const jurisdictions = await LocalTaxJurisdiction.find({ tenantId: req.tenantId });
        const profiles = await StateTaxProfile.find({ tenantId: req.tenantId })
            .populate('employeeId', 'fullName')
            .limit(100);

        res.status(200).json({ agreements, jurisdictions, profiles });
    } catch (error) { next(error); }
};