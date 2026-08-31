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
            {
                residentState: req.body.residentState.toUpperCase(),
                workState: req.body.workState.toUpperCase()
            },
            {
                ...req.body,
                residentState: req.body.residentState.toUpperCase(),
                workState: req.body.workState.toUpperCase()
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Reciprocity agreement saved', agreement });
    } catch (error) { next(error); }
};

exports.updateEmployeeProfile = async (req, res, next) => {
    try {
        const { employeeId, residentState, primaryWorkState, hasReciprocityExemption, exemptionFormUrl } = req.body;

        const profile = await StateTaxProfile.findOneAndUpdate(
            {
                employeeId
            },
            {
                employeeId,
                residentState: residentState.toUpperCase(),
                primaryWorkState: primaryWorkState.toUpperCase(),
                hasReciprocityExemption,
                exemptionFormUrl,
                exemptionFormUploaded: !!exemptionFormUrl
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'State tax profile updated', profile });
    } catch (error) { next(error); }
};

exports.evaluateTaxLiability = async (req, res, next) => {
    try {
        const { employeeId, grossPay, daysWorkedInWorkState } = req.body;

        const profile = await StateTaxProfile.findOne({
            employeeId
        });
        if (!profile) return res.status(404).json({ message: 'State tax profile not found for employee.' });

        // 1. Check Reciprocity
        const agreement = await ReciprocityAgreement.findOne({
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
        const jurisdiction = await LocalTaxJurisdiction.findOne({
            stateCode: profile.primaryWorkState
        });
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
        const agreements = await ReciprocityAgreement.find({}).sort({ residentState: 1 });
        const jurisdictions = await LocalTaxJurisdiction.find({});
        const profiles = await StateTaxProfile.find({})
            .populate('employeeId', 'fullName')
            .limit(100);

        res.status(200).json({ agreements, jurisdictions, profiles });
    } catch (error) { next(error); }
};