/**
 * @fileoverview Garnishment Controller
 * @description Manages court orders, payroll interceptors, and agency remittances.
 * Issue: #1369
 */
const { GarnishmentOrder, RemittanceLedger } = require('../models/garnishment.model');
const Employee = require('../models/employee.model');
const { calculateDisposableIncome, calculateDeduction, applyPriorityRules } = require('../utils/garnishmentEngine.utils');
const logger = require('../utils/logger');

exports.createOrder = async (req, res, next) => {
    try {
        const { employeeId, type, agencyName, agencyRemittanceEmail, caseNumber, totalAmountOwed, monthlyDeductionAmount, priority, startDate } = req.body;

        const order = await GarnishmentOrder.create({
            employeeId,
            type,
            agencyName,
            agencyRemittanceEmail,
            caseNumber,
            totalAmountOwed,
            monthlyDeductionAmount,
            priority,
            startDate: new Date(startDate)
        });

        res.status(201).json({ message: 'Garnishment order created', order });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Case number already exists.' });
        next(error);
    }
};

exports.getActiveOrders = async (req, res, next) => {
    try {
        const orders = await GarnishmentOrder.find({
            status: 'Active'
        })
            .populate('employeeId', 'fullName department')
            .sort({ priority: 1 });
        res.status(200).json({ orders });
    } catch (error) { next(error); }
};

/**
 * POST /api/garnishments/process-payroll
 * Intercepts payroll to calculate deductions for all active garnishments.
 * Expects an array of payroll entries: [{ employeeId, grossPay, statutoryTaxes }]
 */
exports.processPayrollInterceptor = async (req, res, next) => {
    try {
        const { payrollEntries } = req.body; // Array of { employeeId, grossPay, statutoryTaxes }
        const results = [];

        for (const entry of payrollEntries) {
            const disposableIncome = calculateDisposableIncome(entry.grossPay, entry.statutoryTaxes);

            const activeOrders = await GarnishmentOrder.find({
                employeeId: entry.employeeId,
                status: 'Active'
            });

            if (activeOrders.length === 0) continue;

            const sortedOrders = applyPriorityRules(activeOrders);
            let availableDisposable = disposableIncome;
            const employeeDeductions = [];

            for (const order of sortedOrders) {
                if (availableDisposable <= 0) break; // No more disposable income available

                const calc = calculateDeduction(order, disposableIncome, availableDisposable);

                if (calc.deductionAmount > 0) {
                    employeeDeductions.push({
                        orderId: order._id,
                        caseNumber: order.caseNumber,
                        agencyName: order.agencyName,
                        type: order.type,
                        deductionAmount: calc.deductionAmount,
                        remainingOwed: calc.remainingOwed
                    });

                    availableDisposable -= calc.deductionAmount;
                }
            }

            if (employeeDeductions.length > 0) {
                results.push({
                    employeeId: entry.employeeId,
                    disposableIncome,
                    deductions: employeeDeductions
                });
            }
        }

        res.status(200).json({ message: 'Payroll garnishments calculated', results });
    } catch (error) { next(error); }
};

exports.recordRemittance = async (req, res, next) => {
    try {
        const { orderId, deductionMonth, deductionYear, amountRemitted } = req.body;
        const order = await GarnishmentOrder.findOne({
            _id: orderId
        });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        await RemittanceLedger.create({
            orderId: order._id,
            employeeId: order.employeeId,
            deductionMonth,
            deductionYear,
            amountRemitted,
            processedBy: req.userId
        });

        // Update order totals
        order.amountDeductedToDate += amountRemitted;
        if (order.amountDeductedToDate >= order.totalAmountOwed) {
            order.status = 'Satisfied';
        }
        await order.save();

        res.status(201).json({ message: 'Remittance recorded', order });
    } catch (error) { next(error); }
};

exports.generateRemittanceReport = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const ledger = await RemittanceLedger.find({
            deductionMonth: month,
            deductionYear: year
        })
            .populate('orderId', 'agencyName agencyRemittanceEmail caseNumber type');

        // Group by Agency for bulk payment file generation
        const agencySummary = {};
        ledger.forEach(l => {
            const agency = l.orderId.agencyName;
            if (!agencySummary[agency]) {
                agencySummary[agency] = {
                    agencyName: agency,
                    remittanceEmail: l.orderId.agencyRemittanceEmail,
                    totalAmount: 0,
                    cases: []
                };
            }
            agencySummary[agency].totalAmount += l.amountRemitted;
            agencySummary[agency].cases.push({
                caseNumber: l.orderId.caseNumber,
                employeeId: l.employeeId,
                amount: l.amountRemitted
            });
        });

        res.status(200).json({ report: Object.values(agencySummary) });
    } catch (error) { next(error); }
};
