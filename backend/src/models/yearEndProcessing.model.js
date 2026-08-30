/**
 * @fileoverview Year-End Processing & W-2 Schemas
 * @description Tracks annual payroll aggregation, W-2 box allocations, and SSA EFW2 magnetic media files.
 * Issue: #1757
 */
const mongoose = require('mongoose');

/**
 * YearEndProcessing Schema
 * Represents a batch job that aggregates annual payroll data for W-2 generation.
 */
const yearEndProcessingSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    taxYear: { type: Number, required: true },

    totalEmployeesProcessed: { type: Number, default: 0 },
    totalWages: { type: Number, default: 0 },
    totalFederalTax: { type: Number, default: 0 },
    totalSocialSecurityWages: { type: Number, default: 0 },
    totalMedicareWages: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Pending', 'Aggregating', 'Completed', 'Failed'],
        default: 'Pending',
        index: true
    },

    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, default: null }
}, { timestamps: true });

yearEndProcessingSchema.index({ tenantId: 1, taxYear: 1 }, { unique: true });
const YearEndProcessing = mongoose.model('YearEndProcessing', yearEndProcessingSchema);

/**
 * W2BoxData Schema
 * Stores the final calculated IRS W-2 box allocations for a specific employee and tax year.
 */
const w2BoxDataSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    processingBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'YearEndProcessing', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    taxYear: { type: Number, required: true },

    // Core W-2 Boxes
    box1_Wages: { type: Number, default: 0 },       // Federal wages (Gross - Pre-tax deductions)
    box2_FederalTax: { type: Number, default: 0 },   // Federal income tax withheld
    box3_SSWages: { type: Number, default: 0 },      // Social Security wages (capped at annual limit)
    box4_SSTax: { type: Number, default: 0 },        // Social Security tax withheld
    box5_MedicareWages: { type: Number, default: 0 },// Medicare wages (no cap)
    box6_MedicareTax: { type: Number, default: 0 },  // Medicare tax withheld
    box7_SSTips: { type: Number, default: 0 },       // Social Security tips
    box8_AllocatedTips: { type: Number, default: 0 },
    box10_DependentCare: { type: Number, default: 0 },
    box11_NonqualifiedPlans: { type: Number, default: 0 },
    box12a_Code: { type: String, default: '' },      // e.g., 'D' for 401k, 'DD' for Health Insurance
    box12a_Amount: { type: Number, default: 0 },
    box14_Other: { type: String, default: '' },
    box15_State: { type: String, default: '' },
    box16_StateWages: { type: Number, default: 0 },
    box17_StateTax: { type: Number, default: 0 },
    box18_LocalWages: { type: Number, default: 0 },
    box19_LocalTax: { type: Number, default: 0 },
    box20_LocalityName: { type: String, default: '' },

    // Audit Flags
    hasDiscrepancy: { type: Boolean, default: false },
    discrepancyNotes: { type: String, default: '' } // e.g., "Box 1 < Box 3 due to 401k"
}, { timestamps: true });

w2BoxDataSchema.index({ tenantId: 1, employeeId: 1, taxYear: 1 }, { unique: true });
const W2BoxData = mongoose.model('W2BoxData', w2BoxDataSchema);

/**
 * MagneticMediaFile Schema
 * Stores the generated SSA EFW2 fixed-width text file.
 */
const magneticMediaFileSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    processingBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'YearEndProcessing', required: true },
    taxYear: { type: Number, required: true },

    fileName: { type: String, required: true },
    fileContent: { type: String, required: true }, // The strict 512-byte EFW2 text

    totalRWRecords: { type: Number, default: 0 },
    totalWagesSubmitted: { type: Number, default: 0 },

    status: { type: String, enum: ['Generated', 'Submitted to SSA', 'Accepted', 'Rejected'], default: 'Generated' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const MagneticMediaFile = mongoose.model('MagneticMediaFile', magneticMediaFileSchema);

module.exports = { YearEndProcessing, W2BoxData, MagneticMediaFile };
