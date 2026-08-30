/**
 * @fileoverview FLSA Overtime & Alternative Workweek Schemas
 * Issue: #1934
 */
const mongoose = require('mongoose');

const stateOvertimeMatrixSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true },
    dailyOTThreshold: { type: Number, default: 8 },
    dailyDoubleTimeThreshold: { type: Number, default: 12 },
    seventhDayPremium: { type: Boolean, default: false },
    seventhDayDoubleTime: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
stateOvertimeMatrixSchema.index({ tenantId: 1, stateCode: 1 }, { unique: true });
const StateOvertimeMatrix = mongoose.model('StateOvertimeMatrix', stateOvertimeMatrixSchema);

const alternativeWorkweekScheduleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    scheduleType: { type: String, enum: ['4/10', '9/80', '3/12'], required: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
const AlternativeWorkweekSchedule = mongoose.model('AlternativeWorkweekSchedule', alternativeWorkweekScheduleSchema);

const dailyTimesheetLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    workDate: { type: Date, required: true },
    regularHours: { type: Number, default: 0 },
    dailyOT15: { type: Number, default: 0 },
    dailyOT20: { type: Number, default: 0 },
    weeklyOT15: { type: Number, default: 0 },
    isSeventhDay: { type: Boolean, default: false },
    awsExceptionApplied: { type: Boolean, default: false }
}, { timestamps: true });
dailyTimesheetLedgerSchema.index({ tenantId: 1, employeeId: 1, workDate: 1 }, { unique: true });
const DailyTimesheetLedger = mongoose.model('DailyTimesheetLedger', dailyTimesheetLedgerSchema);

module.exports = { StateOvertimeMatrix, AlternativeWorkweekSchedule, DailyTimesheetLedger };
