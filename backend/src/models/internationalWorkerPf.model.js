/**
 * EPF International Workers — status, certificates and IW-1 (#1971).
 *
 * Four collections, and the reason for each is that the existing EPF path
 * cannot hold the object.
 *
 * `InternationalWorkerStatus` is a **determination on the paragraph 83
 * definition**, not a flag on the employee record. It carries the limb it was
 * determined under and the dates it runs between, because the definition reaches
 * a foreign national in India *and* an Indian employee on deputation to an
 * agreement country — and a nationality field answers the second one wrongly in
 * the direction that costs money. It is dated because status starts and ends,
 * and the contribution basis follows it month by month.
 *
 * `CertificateOfCoverage` is a period, not a document. `documentVault.routes.js`
 * will store the PDF perfectly well; what it will not do is notice that the
 * period on it ended last month, and that is the only thing about a COC with a
 * payroll consequence. The day after `validTo` the worker attaches at full pay
 * with no ceiling, and the under-remittance compounds monthly until somebody
 * opens the file.
 *
 * `InternationalWorkerContribution` stores the basis actually used for a month
 * **and the figure the domestic ceiling would have produced**. Both, because the
 * difference is roughly forty times and a single stored number gives a reviewer
 * no way to tell an intended full-pay basis from a bug.
 *
 * `IwOneReturn` is keyed on a month rather than on a worker. IW-1 is a return
 * about international workers and is owed for a month in which the establishment
 * employed none — which is exactly the month a worker-driven schedule would show
 * as clean.
 */

const mongoose = require('mongoose');

const {
  IW_RULES,
  LIMB,
  STATUS,
  NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
  WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT,
} = require('../utils/internationalWorkerPf');

// --- Status -----------------------------------------------------------------

const internationalWorkerStatusSchema = new mongoose.Schema(
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

    /**
     * Which limb of paragraph 83(2)(f) the employee falls under.
     *
     * Required rather than inferred. Both limbs are real and they behave
     * differently downstream — only one of them can hold a certificate issued by
     * the other country — and inferring either from nationality is how an Indian
     * employee on deputation to Germany gets treated as a domestic member.
     */
    limb: { type: String, enum: Object.values(LIMB), required: true },

    /** The other country. Decides which agreement, if any, applies. */
    countryCode: { type: String, default: '', trim: true, uppercase: true },

    /**
     * The period the status runs for.
     *
     * Dated because the status starts and ends, and the contribution basis
     * follows it month by month. A single boolean would make every historical
     * month unanswerable.
     */
    from: { type: Date, required: true },
    to: { type: Date, default: null },

    /**
     * When somebody actually made the determination.
     *
     * Distinct from `from`. A deputation recorded in the assignment module with
     * no determination against it is a finding, and only this field can tell the
     * two apart.
     */
    determinedOn: { type: Date, default: null },
    ground: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

internationalWorkerStatusSchema.index(
  { tenantId: 1, employeeId: 1, from: 1 },
  { unique: true },
);

// --- Certificates of Coverage -----------------------------------------------

const certificateOfCoverageSchema = new mongoose.Schema(
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

    /** The country whose authority issued it. */
    countryCode: { type: String, required: true, trim: true, uppercase: true },

    certificateNumber: { type: String, default: '', trim: true },

    /**
     * The period. The point of the whole collection.
     *
     * Indexed on `validTo` because the query that matters is "which certificates
     * lapse in the next ninety days", and it runs on a schedule rather than when
     * somebody opens a record.
     */
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true, index: true },

    /** Where an extension has been applied for, so the countdown can say so. */
    extensionAppliedOn: { type: Date, default: null },

    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentVaultEntry',
    },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

certificateOfCoverageSchema.index(
  { tenantId: 1, employeeId: 1, validFrom: 1 },
  { unique: true },
);

// --- Contributions ----------------------------------------------------------

const internationalWorkerContributionSchema = new mongoose.Schema(
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

    /** The last day of the month the contribution is for. */
    forMonthEnding: { type: Date, required: true },

    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.UNDETERMINED,
    },

    /**
     * The three components of full pay, kept apart.
     *
     * Separated because the two that a domestic payroll never sees — pay made
     * outside India and pay in a foreign currency — are exactly the two that get
     * left out, and a single total cannot show that they were included.
     */
    paidInIndia: { type: Number, default: 0, min: 0 },
    paidOutsideIndia: { type: Number, default: 0, min: 0 },
    paidInForeignCurrency: { type: Number, default: 0, min: 0 },

    /** The basis actually used. Full pay for an International Worker. */
    basis: { type: Number, required: true, min: 0 },

    /**
     * What the domestic ceiling would have produced.
     *
     * Stored rather than derived on read. It is the field that lets a reviewer
     * tell an intended full-pay basis from a bug, and it is the amount #1875
     * charges section 7Q interest and section 14B damages on where it turns out
     * to be what was actually remitted.
     */
    ceilingWouldHaveBeen: { type: Number, default: 0, min: 0 },

    employeeShare: { type: Number, default: 0, min: 0 },
    employerShare: { type: Number, default: 0, min: 0 },
    employerToPension: { type: Number, default: 0, min: 0 },

    /** What went on the ECR, where that is known. */
    remitted: { type: Number, default: null },

    /**
     * Paragraph 83, stored on the row.
     *
     * A default field rather than a comment. This is the record a payroll
     * engineer reads when a figure looks forty times too large, and the sentence
     * is what stops them "fixing" it back to the ceiling.
     */
    ceilingNote: {
      type: String,
      default: NO_WAGE_CEILING_FOR_INTERNATIONAL_WORKERS,
    },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

internationalWorkerContributionSchema.index(
  { tenantId: 1, employeeId: 1, forMonthEnding: 1 },
  { unique: true },
);

// --- IW-1 -------------------------------------------------------------------

const iwOneReturnSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    /**
     * The month the return is for.
     *
     * The return is keyed on this rather than on any worker, because IW-1 is
     * owed for a month in which the establishment employed no international
     * workers at all.
     */
    forMonthEnding: { type: Date, required: true },
    dueOn: { type: Date, required: true },

    workerCount: { type: Number, default: 0, min: 0 },
    totalContribution: { type: Number, default: 0, min: 0 },

    filedOn: { type: Date },
    acknowledgement: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

iwOneReturnSchema.index(
  { tenantId: 1, establishment: 1, forMonthEnding: 1 },
  { unique: true },
);

/**
 * The two rules a report or a validator most often needs, exposed so it does
 * not have to import the engine.
 */
internationalWorkerContributionSchema.statics.DOMESTIC_WAGE_CEILING =
  IW_RULES.domesticWageCeiling;
internationalWorkerContributionSchema.statics.CEILING_APPLIES_TO_IW = false;
certificateOfCoverageSchema.statics.NOTICE_DAYS =
  IW_RULES.certificateNoticeDays;
internationalWorkerStatusSchema.statics.WITHDRAWAL_NOTE =
  WITHDRAWAL_IS_NOT_AVAILABLE_ON_UNEMPLOYMENT;

const InternationalWorkerStatus = mongoose.model(
  'InternationalWorkerStatus',
  internationalWorkerStatusSchema,
);
const CertificateOfCoverage = mongoose.model(
  'CertificateOfCoverage',
  certificateOfCoverageSchema,
);
const InternationalWorkerContribution = mongoose.model(
  'InternationalWorkerContribution',
  internationalWorkerContributionSchema,
);
const IwOneReturn = mongoose.model('IwOneReturn', iwOneReturnSchema);

module.exports = {
  InternationalWorkerStatus,
  CertificateOfCoverage,
  InternationalWorkerContribution,
  IwOneReturn,
};
