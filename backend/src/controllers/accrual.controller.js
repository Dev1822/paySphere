/**
 * @fileoverview Accrual Controller
 * Issue: #1938
 */
const { AccrualPolicy, PTOLiabilityLedger, MonthEndAccrualBatch } = require('../models/payrollAccrual.model');
const { calculateDailyCutoff, valuePTOLiability, generateVarianceTrueUp, generateASC710JournalEntries } = require('../utils/payrollAccrualEngine.utils');

exports.configurePolicy = async (req, res, next) => {
    try {
        const policy = await AccrualPolicy.findOneAndUpdate(
            {},
            {
                ...req.body
            },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Accrual policy configured', policy });
    } catch (error) { next(error); }
};

exports.runMonthEndBatch = async (req, res, next) => {
    try {
        const { periodMonth, periodYear, employeeData } = req.body;
        // employeeData: [{ employeeId, ptoHours, hourlyRate, cutoffDays, dailyWageRate }]

        const policy = await AccrualPolicy.findOne({});
        if (!policy) return res.status(400).json({ message: 'Accrual policy not configured.' });

        let totalCutoff = 0;
        let totalPTO = 0;

        for (const emp of employeeData) {
            const cutoff = calculateDailyCutoff(emp.cutoffDays, emp.dailyWageRate);
            const ptoVal = valuePTOLiability(emp.ptoHours, emp.hourlyRate, policy.includeBurden, policy.burdenPercentage);

            totalCutoff += cutoff;
            totalPTO += ptoVal;

            // Get previous month PTO liability for variance
            const prevMonth = periodMonth === 1 ? 12 : periodMonth - 1;
            const prevYear = periodMonth === 1 ? periodYear - 1 : periodYear;
            const prevLedger = await PTOLiabilityLedger.findOne({
                employeeId: emp.employeeId,
                periodMonth: prevMonth,
                periodYear: prevYear
            });

            const prevLiability = prevLedger ? prevLedger.totalLiabilityValue : 0;
            const variance = generateVarianceTrueUp(ptoVal, prevLiability);

            await PTOLiabilityLedger.findOneAndUpdate(
                {
                    employeeId: emp.employeeId,
                    periodMonth,
                    periodYear
                },
                { ptoHoursBalance: emp.ptoHours, hourlyRate: emp.hourlyRate, burdenRate: policy.burdenPercentage, totalLiabilityValue: ptoVal },
                { upsert: true }
            );
        }

        const batch = await MonthEndAccrualBatch.findOneAndUpdate(
            {
                periodMonth,
                periodYear
            },
            { totalCutoffWages: totalCutoff, totalPTOLiability: totalPTO, varianceAdjustment: totalPTO }, // Simplified variance
            { upsert: true, new: true }
        );

        const journals = generateASC710JournalEntries(totalCutoff, totalPTO, generateVarianceTrueUp(totalPTO, 0));

        res.status(201).json({ message: 'Month-end batch generated', batch, journals });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const policy = await AccrualPolicy.findOne({});
        const batches = await MonthEndAccrualBatch.find({}).sort({ periodYear: -1, periodMonth: -1 }).limit(12);
        res.status(200).json({ policy, batches });
    } catch (error) { next(error); }
};
