/**
 * Child and Adolescent Labour Act, 1986 — the register and the findings
 * (#1877).
 *
 * Three collections, and the shape of the last one is the point.
 *
 * `AgeRecord` holds the date of birth **and what it rests on**. Section 10
 * makes the age determinable — where it is in question the certificate of the
 * prescribed medical authority settles it — so a date with nothing behind it is
 * the first thing an inspection asks about. Its own collection rather than a
 * field on `Employee` because the people this Act reaches are frequently not on
 * the payroll at all: they are on a contractor's register under #1700 or a
 * migrant contractor's under #1826, and both of those hold persons who work on
 * the site without being employees here.
 *
 * `YoungPersonRegister` is the section 11 register. It is not the attendance
 * ledger and cannot be derived from it: the ledger records whether somebody
 * came in, and the register's subject is who these people are — name, date of
 * birth, the nature of the work, the hours and the intervals.
 *
 * `EmploymentFinding` has **no amount field, and that is deliberate**. Section
 * 14's punishment is imprisonment and a fine on conviction; it is a criminal
 * penalty and not a liability that accrues. A rupee column here would be summed
 * into a compliance provision by the first report that read it, and the
 * resulting line would state in a number that employing a child has a price.
 * The engine's `assertNoAmounts` holds the same property on the computed side.
 */

const mongoose = require('mongoose');

const {
  CLASSIFICATION,
  AGE_BASIS,
  CHILD_EXCEPTION,
  HAZARDOUS_SCHEDULE,
  FINDING,
  SEVERITY,
} = require('../utils/adolescentEmployment');

// --- Age --------------------------------------------------------------------

const ageRecordSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /**
     * Who this is, and where they came from.
     *
     * `subjectType` rather than a hard reference to `Employee`, because the
     * people this Act reaches are often on a contractor's or a migrant
     * contractor's register instead of the payroll — and a schema that could
     * only point at `Employee` would quietly exclude exactly them.
     */
    subjectType: {
      type: String,
      enum: ['EMPLOYEE', 'CONTRACT_WORKER', 'MIGRANT_WORKER', 'APPRENTICE'],
      default: 'EMPLOYEE',
    },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },

    dateOfBirth: { type: Date, required: true },

    /**
     * What the date rests on.
     *
     * Not metadata. A self-declared date on a person who looks fifteen is the
     * record an inspection opens with, and section 10 says what settles it.
     */
    ageBasis: {
      type: String,
      enum: Object.values(AGE_BASIS),
      default: AGE_BASIS.SELF_DECLARED,
    },
    ageDocumentReference: { type: String, default: '', trim: true },

    /** Section 10 certificate, where one has been obtained. */
    medicalCertificateOn: { type: Date },
    medicalAuthority: { type: String, default: '', trim: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

ageRecordSchema.index(
  { tenantId: 1, subjectType: 1, subjectId: 1 },
  { unique: true },
);

/**
 * Deliberately not a stored `classification`.
 *
 * Somebody engaged lawfully as an adolescent turns eighteen during their
 * employment and the section 7 limits fall away on that day. A stored field
 * would be right on the day it was written and wrong from the next birthday,
 * and nothing would fail — so the classification is computed per date by
 * `classifyOn` and never persisted.
 */

// --- The register -----------------------------------------------------------

const engagementSchema = new mongoose.Schema(
  {
    engagedOn: { type: Date, required: true },

    /** A code, not free text — see the note in the engine on `scheduleMatch`. */
    occupation: { type: String, default: '', trim: true, uppercase: true },
    processes: {
      type: [{ type: String, trim: true, uppercase: true }],
      default: [],
    },

    /**
     * One of the two provisos to section 3, where one is claimed for a child.
     *
     * A claim about a relationship and about schooling rather than a job title,
     * which is why the evidence below is required with it.
     */
    childException: {
      type: String,
      enum: [...Object.values(CHILD_EXCEPTION), null],
      default: null,
    },
    exceptionEvidence: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    interferesWithSchooling: { type: Boolean, default: false },
  },
  { _id: false },
);

const workedDaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    /** `HH:MM` pairs. Spells, not a single in/out. */
    shifts: {
      type: [
        {
          _id: false,
          start: { type: String, required: true },
          end: { type: String, required: true },
        },
      ],
      default: [],
    },
    /**
     * Counted against the six-hour ceiling.
     *
     * Section 7(2) caps the day *including* waiting time, which no attendance
     * ledger in this product records — so it is a field here rather than
     * something derived from a punch.
     */
    waitingMinutes: { type: Number, default: 0, min: 0 },
    worked: { type: Boolean, default: true },
  },
  { _id: false },
);

const youngPersonRegisterSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    ageRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgeRecord',
      required: true,
    },

    engagement: { type: engagementSchema, required: true },

    /** The days in the period under review. */
    days: { type: [workedDaySchema], default: [] },

    /**
     * The proviso to section 7(5) allows the notified weekly day off to be
     * changed once a quarter. Stored as events rather than as a current value,
     * because the limit is on how often it moved.
     */
    dayOffChanges: {
      type: [
        {
          _id: false,
          changedOn: { type: Date, required: true },
          fromDay: { type: Number, min: 0, max: 6 },
          toDay: { type: Number, min: 0, max: 6 },
          notifiedOn: { type: Date },
        },
      ],
      default: [],
    },

    /** The nature of the work, as section 11 asks for it. */
    natureOfWork: { type: String, default: '', trim: true, maxlength: 1000 },

    active: { type: Boolean, default: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

youngPersonRegisterSchema.index(
  { tenantId: 1, establishment: 1, ageRecordId: 1 },
  { unique: true },
);

// --- Findings ---------------------------------------------------------------

/**
 * A finding.
 *
 * Occurrence, person, date, section. **No amount, no cost, no exposure and no
 * estimate.** See the header — this absence is the feature, and the engine's
 * `assertNoAmounts` is the test that keeps it.
 */
const employmentFindingSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    code: { type: String, enum: Object.values(FINDING), required: true },
    section: { type: String, default: '' },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },

    ageRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgeRecord' },
    name: { type: String, default: '' },

    /** Computed as at the date, never read from a stored field. */
    classification: {
      type: String,
      enum: [...Object.values(CLASSIFICATION), null],
      default: null,
    },
    ageYears: { type: Number, default: null },

    /** The day the occurrence relates to, where it is about a day. */
    occurredOn: { type: Date },

    /** Minutes over a limit. A duration, and deliberately not a cost. */
    minutes: { type: Number, default: null },
    limitMinutes: { type: Number, default: null },

    /** Schedule entries matched, where the finding is about the Schedule. */
    matched: { type: [String], default: [] },

    note: { type: String, default: '', maxlength: 2000 },

    /** Set when the establishment has acted, never to make it go away. */
    resolvedOn: { type: Date },
    resolution: { type: String, default: '', trim: true, maxlength: 2000 },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

employmentFindingSchema.index({ tenantId: 1, severity: 1, createdAt: -1 });

/**
 * The Schedule the findings were computed against.
 *
 * Snapshotted onto an assessment rather than referenced, because the Schedule
 * was cut substantially in 2016 and a finding raised under the older, longer
 * list has to stay readable as the finding it was.
 */
const scheduleSnapshotSchema = new mongoose.Schema(
  {
    effectiveFrom: { type: String, default: HAZARDOUS_SCHEDULE.effectiveFrom },
    occupations: { type: [String], default: [] },
    processes: { type: [String], default: [] },
    processesReference: { type: String, default: '' },
  },
  { _id: false },
);

const employmentAssessmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    establishment: { type: String, default: '', trim: true },

    asAt: { type: Date, required: true },

    /** Counts of people. There is no monetary figure on this document. */
    childrenEngaged: { type: Number, default: 0, min: 0 },
    adolescentsEngaged: { type: Number, default: 0, min: 0 },
    prohibitedCount: { type: Number, default: 0, min: 0 },
    breachCount: { type: Number, default: 0, min: 0 },

    scheduleSnapshot: { type: scheduleSnapshotSchema, default: () => ({}) },
    rulesSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

employmentAssessmentSchema.index({ tenantId: 1, establishment: 1, asAt: -1 });

const AgeRecord = mongoose.model('AgeRecord', ageRecordSchema);
const YoungPersonRegister = mongoose.model(
  'YoungPersonRegister',
  youngPersonRegisterSchema,
);
const EmploymentFinding = mongoose.model(
  'EmploymentFinding',
  employmentFindingSchema,
);
const EmploymentAssessment = mongoose.model(
  'EmploymentAssessment',
  employmentAssessmentSchema,
);

module.exports = {
  AgeRecord,
  YoungPersonRegister,
  EmploymentFinding,
  EmploymentAssessment,
};
