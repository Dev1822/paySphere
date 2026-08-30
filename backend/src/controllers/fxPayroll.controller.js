/**
 * @fileoverview FX Payroll Controller
 * @description Manages multi-currency batches, exchange rate locks, and settlement variances.
 * Issue: #1568
 */
const mongoose = require('mongoose');
const { FXPayrollBatch, ExchangeRateLock, FXVarianceLedger } = require('../models/fxPayroll.model');
const { calculateBaseLiability, isRateExpired, calculateFXVariance } = require('../utils/fxEngine.utils');
const logger = require('../utils/logger');

exports.createBatch = async (req, res, next) => {
    try {
        const { batchName, baseCurrency, invoices } = req.body;
        // invoices: [{ currency, amount }]

        const batch = await FXPayrollBatch.create({
            tenantId: req.tenantId, batchName, baseCurrency: baseCurrency || 'USD', status: 'Draft'
        });

        let totalBaseLiability = 0;

        // Group invoices by currency to create rate locks
        const currencyGroups = {};
        for (const inv of invoices) {
            if (!currencyGroups[inv.currency]) currencyGroups[inv.currency] = 0;
            currencyGroups[inv.currency] += inv.amount;
        }

        for (const [currency, totalForeign] of Object.entries(currencyGroups)) {
            // Mocking an API call to a live FX provider (e.g., Stripe, OpenExchangeRates)
            const mockLiveRate = currency === 'EUR' ? 1.08 : currency === 'GBP' ? 1.26 : 1.00;
            const lockedBase = calculateBaseLiability(totalForeign, mockLiveRate);
            totalBaseLiability += lockedBase;

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48); // 48-hour lock

            await ExchangeRateLock.create({
                tenantId: req.tenantId, batchId: batch._id, foreignCurrency: currency,
                totalForeignAmount: totalForeign, lockedRate: mockLiveRate,
                lockedBaseAmount: lockedBase, lockExpiresAt: expiresAt
            });
        }

        batch.totalBaseLiability = Math.round(totalBaseLiability * 100) / 100;
        batch.status = 'Rate Locked';
        await batch.save();

        res.status(201).json({ message: 'FX Batch created and rates locked', batch });
    } catch (error) { next(error); }
};

exports.confirmWiresSent = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const batch = await FXPayrollBatch.findById(batchId);
        if (!batch) return res.status(404).json({ message: 'Batch not found' });

        const locks = await ExchangeRateLock.find({ batchId, tenantId: req.tenantId });

        // Rate Expiry Guardrail
        for (const lock of locks) {
            if (isRateExpired(lock.lockExpiresAt, new Date())) {
                return res.status(400).json({
                    message: `Rate Expiry Guardrail Triggered: The lock for ${lock.foreignCurrency} has expired. You must recalculate the batch before sending wires.`
                });
            }
        }

        batch.status = 'Wires Sent';
        await batch.save();

        res.status(200).json({ message: 'Wires confirmed as sent. Awaiting settlement.', batch });
    } catch (error) { next(error); }
};

exports.recordSettlement = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { batchId, actualRates } = req.body;
        // actualRates: { 'EUR': 1.09, 'GBP': 1.25 }

        const batch = await FXPayrollBatch.findById(batchId).session(session);
        if (!batch || batch.status !== 'Wires Sent') {
            throw new Error('Batch not found or not in "Wires Sent" state.');
        }

        const locks = await ExchangeRateLock.find({ batchId, tenantId: req.tenantId }).session(session);
        const variances = [];
        let totalVariance = 0;

        for (const lock of locks) {
            const actualRate = actualRates[lock.foreignCurrency] || lock.lockedRate;
            const calc = calculateFXVariance(lock.totalForeignAmount, lock.lockedRate, actualRate);

            if (calc.type !== 'None') {
                await FXVarianceLedger.create([{
                    tenantId: req.tenantId, batchId: batch._id, foreignCurrency: lock.foreignCurrency,
                    foreignAmount: lock.totalForeignAmount, lockedRate: lock.lockedRate,
                    actualSettlementRate: actualRate, lockedBaseAmount: calc.lockedBase,
                    actualBaseAmount: calc.actualBase, varianceAmount: calc.variance, varianceType: calc.type
                }], { session });

                totalVariance += (calc.type === 'Loss' ? calc.variance : -calc.variance);
            }
        }

        batch.status = 'Settled';
        batch.settledAt = new Date();
        await batch.save({ session });

        await session.commitTransaction();
        logger.info(`[FX] Batch ${batchId} settled with total variance: ${totalVariance}`);
        res.status(200).json({ message: 'Settlement recorded and variances logged', totalVariance });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const batches = await FXPayrollBatch.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(20);
        const variances = await FXVarianceLedger.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(50);
        res.status(200).json({ batches, variances });
    } catch (error) { next(error); }
};
