/**
 * @fileoverview Matrix Org Controller
 * @description Manages dual-reporting lines, cost center splits, and allocation audits.
 * Issue: #1292
 */
const { MatrixAllocation, CostCenterJournal } = require('../models/matrixOrg.model');
const Employee = require('../models/employee.model');
const { generateSplitJournals } = require('../utils/costAllocationEngine.utils');

exports.setAllocation = async (req, res, next) => {
    try {
        const { employeeId, administrativeManagerId, operationalManagerId, splits, useTimesheetAllocation } = req.body;

        // Validate splits sum to 100% (if not using timesheet)
        if (!useTimesheetAllocation) {
            const totalWeight = splits.reduce((sum, s) => sum + Number(s.percentageWeight), 0);
            if (Math.abs(totalWeight - 100) > 0.01) {
                return res.status(400).json({ message: `Split percentages must sum to 100%. Current sum: ${totalWeight}%` });
            }
        }

        const allocation = await MatrixAllocation.findOneAndUpdate(
            {
                employeeId
            },
            {
                administrativeManagerId,
                operationalManagerId,
                splits,
                useTimesheetAllocation,
                isActive: true
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Matrix allocation saved', allocation });
    } catch (error) { next(error); }
};

exports.getAllocations = async (req, res, next) => {
    try {
        const allocations = await MatrixAllocation.find({
            isActive: true
        })
            .populate('employeeId', 'fullName department role')
            .populate('administrativeManagerId', 'fullName')
            .populate('operationalManagerId', 'fullName');

        res.status(200).json({ allocations });
    } catch (error) { next(error); }
};

exports.simulateAllocation = async (req, res, next) => {
    try {
        const { employeeId, grossSalary } = req.body;

        // Mock payroll entry for simulation
        const mockPayroll = {
            _id: 'SIMULATION',
            employeeId,
            grossSalary: Number(grossSalary),
            department: 'Simulated'
        };

        const journals = await generateSplitJournals(mockPayroll);
        res.status(200).json({ journals });
    } catch (error) { next(error); }
};

exports.getAuditReport = async (req, res, next) => {
    try {
        const { payrollRunId } = req.query;
        const query = {};
        if (payrollRunId) query.payrollRunId = payrollRunId;

        const journals = await CostCenterJournal.find(query)
            .populate('employeeId', 'fullName')
            .sort({ costCenterName: 1 });

        // Aggregate by Cost Center
        const summary = {};
        journals.forEach(j => {
            if (!summary[j.costCenterCode]) {
                summary[j.costCenterCode] = { name: j.costCenterName, total: 0, count: 0 };
            }
            summary[j.costCenterCode].total += j.grossAmountAllocated;
            summary[j.costCenterCode].count += 1;
        });

        res.status(200).json({ journals, summary });
    } catch (error) { next(error); }
};
