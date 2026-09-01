/**
 * @fileoverview Equity Compensation & ASC 718 Schemas
 * @description Tracks equity grants, vesting events, sell-to-cover liquidations, 
 * and ASC 718 stock-based compensation expense amortization.
 * Issue: #2010
 */
const mongoose = require('mongoose');

/**
 * EquityGrant Schema
 * Represents an initial grant of RSUs, PSUs, or Options to an employee.
 */
const equityGrantSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    grantType: { type: String, required: true }, // e.g., 'RSU', 'PSU'
    grantDate: { type: Date, required: true },
    totalSharesGranted: { type: Number, required: true, min: 0 },

    grantDateFairValue: { type: Number, required: true }, // FMV on grant date (for ASC 718)
    vestingSchedule: { type: String, required: true }, // e.g., 'Standard 4-Year'
    vestingCliffMonths: { type: Number, default: 12 },
    totalVestingMonths: { type: Number, default: 48 },

    sharesVested: { type: Number, default: 0 },
    sharesLiquidated: { type: Number, default: 0 }, // Sold for taxes
    sharesDelivered: { type: Number, default: 0 },   // Net shares to employee

    status: {
        type: String,
        enum: ['Active', 'Fully Vested', 'Cancelled', 'Forfeited'],
        default: 'Active',
        index: true
    }
}, { timestamps: true });

const EquityGrant = mongoose.model('EquityGrant', equityGrantSchema);

/**
 * VestingEvent Schema
 * Tracks individual vesting tranches, sell-to-cover executions, and tax withholdings.
 */
const vestingEventSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    grantId: { type: mongoose.Schema.Types.ObjectId, ref: 'EquityGrant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    vestingDate: { type: Date, required: true },
    sharesVested: { type: Number, required: true },
    fairMarketValue: { type: Number, required: true }, // FMV on vesting date

    // Sell-to-Cover Calculations
    grossProceeds: { type: Number, required: true }, // Shares * FMV
    sharesLiquidated: { type: Number, required: true },
    taxWithholdingAmount: { type: Number, required: true },
    netSharesDelivered: { type: Number, required: true },

    // Payroll Integration
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },
    status: {
        type: String,
        enum: ['Pending', 'Executed', 'Blocked (Blackout)'],
        default: 'Pending',
        index: true
    }
}, { timestamps: true });

const VestingEvent = mongoose.model('VestingEvent', vestingEventSchema);

/**
 * ASC718ExpenseLedger Schema
 * Tracks the monthly amortization of stock-based compensation expense for financial reporting.
 */
const asc718ExpenseLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    grantId: { type: mongoose.Schema.Types.ObjectId, ref: 'EquityGrant', required: true, index: true },

    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    periodYear: { type: Number, required: true },

    totalGrantValue: { type: Number, required: true },
    monthlyAmortization: { type: Number, required: true },
    ytdAmortization: { type: Number, required: true },

    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    glAccountCode: { type: String, default: '6500-Stock-Based-Comp' }
}, { timestamps: true });

asc718ExpenseLedgerSchema.index({ tenantId: 1, grantId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });
const ASC718ExpenseLedger = mongoose.model('ASC718ExpenseLedger', asc718ExpenseLedgerSchema);

/**
 * BlackoutPeriod Schema
 * Tracks SEC-mandated insider trading blackout windows.
 */
const blackoutPeriodSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    blackoutType: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const BlackoutPeriod = mongoose.model('BlackoutPeriod', blackoutPeriodSchema);

module.exports = { EquityGrant, VestingEvent, ASC718ExpenseLedger, BlackoutPeriod };
