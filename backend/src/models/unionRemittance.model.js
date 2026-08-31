/**
 * @fileoverview Union Remittance & MEPP Schemas
 * @description Tracks Collective Bargaining Agreements, Fringe Benefit Funds, 
 * and monthly remittance batches for Taft-Hartley trust funds.
 * Issue: #2009
 */
const mongoose = require('mongoose');

/**
 * UnionContract Schema
 * Represents a specific Collective Bargaining Agreement (CBA) and its hourly fringe rates.
 */
const unionContractSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cbaCode: { type: String, required: true, uppercase: true, trim: true },
    unionName: { type: String, required: true },
    localNumber: { type: String, required: true },

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },

    // Hourly fringe contribution rates mapped to employee classifications
    fringeRates: [{
        classification: { type: String, required: true }, // e.g., 'J', 'A1'
        pensionRate: { type: Number, default: 0 },
        healthWelfareRate: { type: Number, default: 0 },
        annuityRate: { type: Number, default: 0 },
        apprenticeshipRate: { type: Number, default: 0 },
        vacationRate: { type: Number, default: 0 }
    }],

    remittanceDueDay: { type: Number, default: 15, min: 1, max: 31 }, // Day of the following month
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

unionContractSchema.index({ tenantId: 1, cbaCode: 1 }, { unique: true });
const UnionContract = mongoose.model('UnionContract', unionContractSchema);

/**
 * FringeBenefitFund Schema
 * Tracks the specific trust funds where remittances are routed.
 */
const fringeBenefitFundSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cbaCode: { type: String, required: true },
    fundType: { type: String, required: true }, // e.g., 'Pension', 'Health & Welfare'

    trustFundName: { type: String, required: true },
    trustFundId: { type: String, required: true }, // Used in EDGE file
    routingNumber: { type: String, required: true, match: /^[0-9]{9}$/ },
    accountNumber: { type: String, required: true },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const FringeBenefitFund = mongoose.model('FringeBenefitFund', fringeBenefitFundSchema);

/**
 * RemittanceBatch Schema
 * Tracks the monthly remittance calculation and EDGE file generation.
 */
const remittanceBatchSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cbaCode: { type: String, required: true },

    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    periodYear: { type: Number, required: true },

    totalHoursWorked: { type: Number, default: 0 },
    totalFringeContributions: { type: Number, default: 0 },

    edgeFileContent: { type: String, default: '' },
    edgeFileName: { type: String, default: '' },

    status: {
        type: String,
        enum: ['Draft', 'Generated', 'Submitted', 'Delinquent'],
        default: 'Draft',
        index: true
    },

    dueDate: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

remittanceBatchSchema.index({ tenantId: 1, cbaCode: 1, periodYear: 1, periodMonth: 1 }, { unique: true });
const RemittanceBatch = mongoose.model('RemittanceBatch', remittanceBatchSchema);

module.exports = { UnionContract, FringeBenefitFund, RemittanceBatch };
