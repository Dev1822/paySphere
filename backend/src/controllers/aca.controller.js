/**
 * @fileoverview ACA Controller
 * @description Manages measurement periods, monthly eligibility ledgers, and 1095-C generation.
 * Issue: #1624
 */
const mongoose = require('mongoose');
const { ACAMeasurementPeriod, MonthlyEligibilityLedger, Form1095CDraft } = require('../models/acaReporting.model');
const Employee = require('../models/employee.model');
const {
    calculateRollingAverage, determineFullTimeStatus,
    checkFPLSafeHarbor, checkRateOfPaySafeHarbor, generateIRSCodes
} = require('../utils/acaMeasurementEngine.utils');
const logger = require('../utils/logger');

exports.createMeasurementPeriod = async (req, res, next) => {
    try {
        const period = await ACAMeasurementPeriod.create({
            ...req.body
        });
        res.status(201).json({ message: 'Measurement period created', period });
    } catch (error) { next(error); }
};

exports.processMonthlyHours = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { month, year, employeeHours } = req.body;
        // employeeHours: [{ employeeId, hoursWorked, employeeContribution, hourlyRate }]

        const ledgers = [];
        const FPL_2026 = 15060; // Mocked Federal Poverty Level

        for (const emp of employeeHours) {
            // Calculate 12-month rolling average (mocked: assume current month represents average for demo)
            const avgWeekly = calculateRollingAverage([emp.hoursWorked]);
            const isFT = determineFullTimeStatus(emp.hoursWorked, avgWeekly);

            let affordability = { isAffordable: false, reason: 'Not Evaluated' };
            let safeHarbor = 'None';

            if (isFT && emp.employeeContribution > 0) {
                // Try Rate of Pay first, then FPL
                const rop = checkRateOfPaySafeHarbor(emp.employeeContribution, emp.hourlyRate || 15);
                if (rop.isAffordable) {
                    affordability = rop; safeHarbor = 'RateOfPay';
                } else {
                    const fpl = checkFPLSafeHarbor(emp.employeeContribution, FPL_2026);
                    affordability = fpl; safeHarbor = 'FPL';
                }
            } else if (isFT && emp.employeeContribution === 0) {
                affordability = { isAffordable: true, reason: 'Zero contribution' };
            }

            const irsCodes = generateIRSCodes({
                isFullTime: isFT,
                isOfferedCoverage: isFT, // Simplified: assume offered if FT
                isAffordable: affordability.isAffordable
            });

            const ledger = await MonthlyEligibilityLedger.findOneAndUpdate(
                {
                    employeeId: emp.employeeId,
                    month,
                    year
                },
                {
                    hoursWorked: emp.hoursWorked, isFullTime: isFT,
                    isOfferedCoverage: isFT, isAffordable: affordability.isAffordable,
                    employeeContribution: emp.employeeContribution || 0,
                    line14Code: irsCodes.line14Code, line16Code: irsCodes.line16Code,
                    safeHarborUsed: safeHarbor
                },
                { upsert: true, new: true, session }
            );

            ledgers.push(ledger);
        }

        await session.commitTransaction();
        res.status(200).json({ message: `Processed ${ledgers.length} monthly ledgers`, ledgers });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.generate1095C = async (req, res, next) => {
    try {
        const { taxYear } = req.body;

        const ledgers = await MonthlyEligibilityLedger.find({
            year: taxYear
        })
            .populate('employeeId', 'fullName ssn');

        if (ledgers.length === 0) {
            return res.status(400).json({ message: 'No eligibility data found for this tax year.' });
        }

        // Mock XML generation
        let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<Form1095CData taxYear="${taxYear}">\n`;
        const fullTimeCount = new Set(ledgers.filter(l => l.isFullTime).map(l => l.employeeId._id.toString())).size;

        ledgers.forEach(l => {
            xmlContent += `  <Employee id="${l.employeeId._id}" name="${l.employeeId.fullName}" ssn="${l.employeeId.ssn || 'XXX-XX-XXXX'}">\n`;
            xmlContent += `    <Line14>${l.line14Code}</Line14>\n`;
            xmlContent += `    <Line16>${l.line16Code}</Line16>\n`;
            xmlContent += `  </Employee>\n`;
        });
        xmlContent += `</Form1095CData>`;

        const draft = await Form1095CDraft.create({
            taxYear,
            totalFormsGenerated: ledgers.length,
            totalFullTimeEmployees: fullTimeCount,
            fileContent: xmlContent,
            fileName: `1095C_${taxYear}_Draft.xml`,
            status: 'Draft',
            generatedBy: req.userId
        });

        logger.info(`[ACA] Generated 1095-C draft for ${taxYear} with ${ledgers.length} records.`);
        res.status(201).json({ message: '1095-C draft generated', draft });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const periods = await ACAMeasurementPeriod.find({}).sort({ lookBackStart: -1 });
        const currentYear = new Date().getFullYear();

        // Aggregate monthly FT counts
        const monthlyStats = await MonthlyEligibilityLedger.aggregate([
            { $match: {
                year: currentYear,
                isFullTime: true
            } },
            { $group: { _id: '$month', ftCount: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const drafts = await Form1095CDraft.find({}).sort({ createdAt: -1 }).limit(5);

        res.status(200).json({ periods, monthlyStats, drafts });
    } catch (error) { next(error); }
};
