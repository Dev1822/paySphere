/**
 * @fileoverview Employee Shift Preference & Availability Schemas
 * @description Manages employee availability windows, shift swap requests,
 * preference rankings, and manager approval workflows for workforce scheduling.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

// ============================================================================
// Availability Template — defines standard availability patterns
// ============================================================================

const timeSlotSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number, // 0=Sunday, 6=Saturday
      required: true,
      min: 0,
      max: 6,
    },
    startTime: { type: String, required: true }, // "HH:MM" 24h format
    endTime: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false },
);

const availabilityTemplateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    slots: { type: [timeSlotSchema], required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

availabilityTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });
availabilityTemplateSchema.plugin(auditTrailPlugin);
const AvailabilityTemplate = mongoose.model(
  'AvailabilityTemplate',
  availabilityTemplateSchema,
);

// ============================================================================
// Employee Preference — individual employee shift preferences
// ============================================================================

const shiftPreferenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** The week this preference applies to (Monday date). */
    weekStartDate: { type: Date, required: true },
    /** Preferred shifts ranked by priority (1 = most preferred). */
    preferences: [
      {
        shiftType: { type: String, required: true }, // "Morning", "Evening", "Night", etc.
        shiftDate: { type: Date, required: true },
        priority: { type: Number, required: true, min: 1, max: 10 },
        notes: { type: String, default: '', maxlength: 200 },
      },
    ],
    /** Blackout dates — days the employee cannot work. */
    blackoutDates: [{ type: Date }],
    /** Minimum hours the employee wants to work this week. */
    minHours: { type: Number, default: 0, min: 0, max: 80 },
    /** Maximum hours the employee wants to work this week. */
    maxHours: { type: Number, default: 40, min: 0, max: 80 },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Reviewed', 'Approved', 'Rejected'],
      default: 'Draft',
      index: true,
    },
    submittedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

shiftPreferenceSchema.index(
  { tenantId: 1, employeeId: 1, weekStartDate: 1 },
  { unique: true },
);
shiftPreferenceSchema.index({ tenantId: 1, status: 1, weekStartDate: 1 });
shiftPreferenceSchema.plugin(auditTrailPlugin);
const ShiftPreference = mongoose.model(
  'ShiftPreference',
  shiftPreferenceSchema,
);

// ============================================================================
// Shift Swap Request — employee-initiated shift swaps
// ============================================================================

const shiftSwapRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    /** The shift the requester wants to give up. */
    originalShift: {
      shiftType: { type: String, required: true },
      shiftDate: { type: Date, required: true },
    },
    /** The shift the requester wants in exchange (null = any available). */
    desiredShift: {
      shiftType: { type: String, default: null },
      shiftDate: { type: Date, default: null },
    },
    /** The employee who accepts the swap (null if open to anyone). */
    acceptorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    /** When the swap becomes effective. */
    effectiveDate: { type: Date, required: true },
    reason: { type: String, default: '', maxlength: 300 },
    status: {
      type: String,
      enum: ['Open', 'Matched', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Open',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '', maxlength: 300 },
    /** Auto-notify eligible employees when posted. */
    notifyEligibleEmployees: { type: Boolean, default: true },
  },
  { timestamps: true },
);

shiftSwapRequestSchema.index({ tenantId: 1, status: 1, effectiveDate: 1 });
shiftSwapRequestSchema.index({ tenantId: 1, requesterId: 1, status: 1 });
shiftSwapRequestSchema.plugin(auditTrailPlugin);
const ShiftSwapRequest = mongoose.model(
  'ShiftSwapRequest',
  shiftSwapRequestSchema,
);

// ============================================================================
// Shift Assignment — final roster assignment record
// ============================================================================

const shiftAssignmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    shiftType: { type: String, required: true },
    shiftDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    /** Whether this assignment was auto-generated from preferences. */
    autoAssigned: { type: Boolean, default: false },
    /** Whether this matches the employee's stated preference. */
    preferenceMatch: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Assigned', 'Confirmed', 'Swapped', 'Cancelled'],
      default: 'Assigned',
      index: true,
    },
    /** Reference to the preference that drove this assignment. */
    preferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftPreference',
      default: null,
    },
    /** Reference to a swap request, if this assignment came from a swap. */
    swapRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftSwapRequest',
      default: null,
    },
    notes: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
);

shiftAssignmentSchema.index({ tenantId: 1, shiftDate: 1, shiftType: 1 });
shiftAssignmentSchema.index({ tenantId: 1, employeeId: 1, shiftDate: 1 });
shiftAssignmentSchema.plugin(auditTrailPlugin);
const ShiftAssignment = mongoose.model(
  'ShiftAssignment',
  shiftAssignmentSchema,
);

module.exports = {
  AvailabilityTemplate,
  ShiftPreference,
  ShiftSwapRequest,
  ShiftAssignment,
};
