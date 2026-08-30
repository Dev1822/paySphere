/**
 * @fileoverview Multi-State Tax & Reciprocity Schemas
 * @description Tracks employee work-state histories, reciprocal agreements, and local tax jurisdictions.
 * Issue: #1731
 */
const mongoose = require('mongoose');

/**
 * ReciprocityAgreement Schema
 * Defines states that have reciprocal tax agreements (e.g., live in NJ, work in NY).
 */
const reciprocityAgreementSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    residentState: { type: String, required: true, uppercase: true }, // Employee lives here
    workState: { type: String, required: true, uppercase: true },     // Employee works here

    requiresExemptionForm: { type: Boolean, default: true }, // e.g., NJ-165, REC-1
    exemptionFormName: { type: String, default: '' },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

reciprocityAgreementSchema.index({ tenantId: 1, residentState: 1, workState: 1 }, { unique: true });
const ReciprocityAgreement = mongoose.model('ReciprocityAgreement', reciprocityAgreementSchema);

/**
 * StateTaxProfile Schema
 * Tracks an employee's physical work locations and residency for tax purposes.
 */
const stateTaxProfileSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },

    residentState: { type: String, required: true, uppercase: true },
    primaryWorkState: { type: String, required: true, uppercase: true },

    // Non-resident tracking
    workStateHistory: [{
        state: { type: String, uppercase: true },
        startDate: { type: Date },
        endDate: { type: Date },
        daysWorked: { type: Number, default: 0 }
    }],

    // Reciprocity Exemptions
    hasReciprocityExemption: { type: Boolean, default: false },
    exemptionFormUploaded: { type: Boolean, default: false },
    exemptionFormUrl: { type: String, default: '' }
}, { timestamps: true });

const StateTaxProfile = mongoose.model('StateTaxProfile', stateTaxProfileSchema);

/**
 * LocalTaxJurisdiction Schema
 * Tracks city, county, or school district specific income taxes (e.g., NYC, Philly).
 */
const localTaxJurisdictionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true },
    jurisdictionName: { type: String, required: true }, // e.g., 'New York City', 'Philadelphia'

    residentTaxRate: { type: Number, default: 0, min: 0, max: 1 },
    nonResidentTaxRate: { type: Number, default: 0, min: 0, max: 1 },

    appliesToAllState: { type: Boolean, default: false }
}, { timestamps: true });

const LocalTaxJurisdiction = mongoose.model('LocalTaxJurisdiction', localTaxJurisdictionSchema);

module.exports = { ReciprocityAgreement, StateTaxProfile, LocalTaxJurisdiction };
