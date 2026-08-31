/**
 * @fileoverview Local Tax & Reciprocity Schemas
 * @description Tracks municipal jurisdictions, commuter reciprocity rules, 
 * employee tax certificates, and YTD local wage accumulators.
 * Issue: #2062
 */
const mongoose = require('mongoose');

/**
 * LocalTaxJurisdiction Schema
 * Stores the tax rates and rules for specific municipalities or school districts.
 */
const localTaxJurisdictionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    jurisdictionCode: { type: String, required: true, trim: true }, // e.g., PSD code or FIPS
    jurisdictionName: { type: String, required: true },
    stateCode: { type: String, required: true, uppercase: true },

    taxType: { type: String, required: true }, // e.g., 'EIT', 'SCHOOL_DISTRICT'
    residentRate: { type: Number, required: true, min: 0, max: 1 }, // e.g., 0.01 (1%)
    nonResidentRate: { type: Number, default: 0, min: 0, max: 1 },

    reciprocityFramework: { type: String, default: 'NONE' },
    allowsCommuterCredit: { type: Boolean, default: true },

    annualWageBase: { type: Number, default: 0 }, // 0 means no cap
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

localTaxJurisdictionSchema.index({ tenantId: 1, jurisdictionCode: 1 }, { unique: true });
const LocalTaxJurisdiction = mongoose.model('LocalTaxJurisdiction', localTaxJurisdictionSchema);

/**
 * CommuterTaxRule Schema
 * Defines specific credit rules between two jurisdictions (e.g., Home City A and Work City B).
 */
const commuterTaxRuleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    homeJurisdictionCode: { type: String, required: true },
    workJurisdictionCode: { type: String, required: true },

    creditType: { type: String, enum: ['FULL_CREDIT', 'PARTIAL_CREDIT', 'NO_CREDIT'], required: true },
    maxCreditPercentage: { type: Number, default: 1.0 }, // 1.0 = 100% of work tax credited

    description: { type: String, default: '' }
}, { timestamps: true });

commuterTaxRuleSchema.index({ tenantId: 1, homeJurisdictionCode: 1, workJurisdictionCode: 1 }, { unique: true });
const CommuterTaxRule = mongoose.model('CommuterTaxRule', commuterTaxRuleSchema);

/**
 * EmployeeTaxCertificate Schema
 * Tracks the employee's declared residency and work location for local tax purposes.
 */
const employeeTaxCertificateSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    homeJurisdictionCode: { type: String, required: true },
    workJurisdictionCode: { type: String, required: true },

    schoolDistrictCode: { type: String, default: '' }, // Ohio specific
    exemptionStatus: { type: String, enum: ['Taxable', 'Exempt', 'Pending Review'], default: 'Taxable' },

    certificateDate: { type: Date, required: true }
}, { timestamps: true });

employeeTaxCertificateSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });
const EmployeeTaxCertificate = mongoose.model('EmployeeTaxCertificate', employeeTaxCertificateSchema);

/**
 * LocalTaxLedger Schema
 * Tracks YTD local wages and withholdings per jurisdiction.
 */
const localTaxLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    jurisdictionCode: { type: String, required: true },
    taxYear: { type: Number, required: true },

    ytdGrossWages: { type: Number, default: 0 },
    ytdTaxableWages: { type: Number, default: 0 },
    ytdTaxWithheld: { type: Number, default: 0 },
    ytdCommuterCredit: { type: Number, default: 0 },

    hitWageCap: { type: Boolean, default: false }
}, { timestamps: true });

localTaxLedgerSchema.index({ tenantId: 1, employeeId: 1, jurisdictionCode: 1, taxYear: 1 }, { unique: true });
const LocalTaxLedger = mongoose.model('LocalTaxLedger', localTaxLedgerSchema);

module.exports = { LocalTaxJurisdiction, CommuterTaxRule, EmployeeTaxCertificate, LocalTaxLedger };
