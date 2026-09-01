/**
 * @fileoverview Phantom Equity Controller
 * @description Manages grants, valuation events, and cash settlement processing.
 * Issue: #1474
 */
const { PhantomGrant, ValuationEvent, CashSettlement } = require('../models/phantomEquity.model');
const Employee = require('../models/employee.model');
const { calculateVestedUnits, calculatePayout, calculateTaxGrossUp } = require('../utils/valuationEngine.utils');
const logger = require('../utils/logger');

exports.createGrant = async (req, res, next) => {
    try {
        const { employeeId, totalUnits, strikePrice, vestingCliffMonths, vestingDurationMonths } = req.body;
        const grant = await PhantomGrant.create({
            employeeId,
            totalUnits,
            strikePrice,
            vestingCliffMonths,
            vestingDurationMonths,
            grantDate: new Date()
        });
        res.status(201).json({ message: 'Phantom grant created', grant });
    } catch (error) { next(error); }
};

exports.recordValuation = async (req, res, next) => {
    try {
        const { eventDate, valuationType, pricePerUnit, notes } = req.body;
        const event = await ValuationEvent.create({
            eventDate: new Date(eventDate),
            valuationType,
            pricePerUnit,
            notes,
            recordedBy: req.userId
        });

        logger.info(`[Equity] New valuation recorded: ${pricePerUnit} per unit.`);
        res.status(201).json({ message: 'Valuation event recorded', event });
    } catch (error) { next(error); }
};

/**
 * POST /api/phantom-equity/trigger-settlement
 * Liquidity Trigger: Automatically flags vested grants for cash settlement 
 * when a new Valuation Event is recorded.
 */
exports.triggerSettlement = async (req, res, next) => {
    try {
        const { valuationEventId, marginalTaxRate } = req.body;
        const valuation = await ValuationEvent.findById(valuationEventId);
        if (!valuation) return res.status(404).json({ message: 'Valuation event not found' });

        // Find all active grants
        const grants = await PhantomGrant.find({
            status: { $in: ['Unvested', 'Vesting', 'Fully Vested'] }
        });

        const settlements = [];

        for (const grant of grants) {
            // 1. Update vesting status based on current date
            const vestedUnits = calculateVestedUnits(
                grant.grantDate, grant.totalUnits, grant.vestingCliffMonths,
                grant.vestingDurationMonths, valuation.eventDate
            );

            grant.vestedUnits = vestedUnits;
            if (vestedUnits >= grant.totalUnits) grant.status = 'Fully Vested';
            else if (vestedUnits > 0) grant.status = 'Vesting';
            await grant.save();

            if (vestedUnits === 0) continue; // Nothing to settle yet

            // 2. Calculate Payout
            const payoutCalc = calculatePayout(vestedUnits, grant.strikePrice, valuation.pricePerUnit);
            if (payoutCalc.grossPayout <= 0) continue; // Underwater grant

            // 3. Calculate Tax Gross-Up
            const taxCalc = calculateTaxGrossUp(payoutCalc.grossPayout, marginalTaxRate || 0.30);

            const settlement = await CashSettlement.create({
                grantId: grant._id,
                valuationEventId: valuation._id,
                unitsSettled: vestedUnits,
                appreciationPerUnit: payoutCalc.appreciationPerUnit,
                grossPayout: payoutCalc.grossPayout,
                ...taxCalc,
                status: 'Calculated'
            });

            settlements.push(settlement);
        }

        res.status(200).json({ message: `Triggered ${settlements.length} settlements`, settlements });
    } catch (error) { next(error); }
};

exports.getMyGrants = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({
            userId: req.userId
        });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const grants = await PhantomGrant.find({
            employeeId: employee._id
        });
        const latestValuation = await ValuationEvent.findOne({}).sort({ eventDate: -1 });

        // Calculate current unrealized value
        const enrichedGrants = grants.map(g => {
            const currentVested = calculateVestedUnits(g.grantDate, g.totalUnits, g.vestingCliffMonths, g.vestingDurationMonths, new Date());
            const currentValue = latestValuation ? calculatePayout(currentVested, g.strikePrice, latestValuation.pricePerUnit).grossPayout : 0;
            return { ...g.toObject(), currentVestedUnits: currentVested, unrealizedValue: currentValue };
        });

        res.status(200).json({ grants: enrichedGrants, latestValuation });
    } catch (error) { next(error); }
};
