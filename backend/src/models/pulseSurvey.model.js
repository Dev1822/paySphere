const mongoose = require('mongoose');

/**
 * Pulse Survey Model
 *
 * Lightweight employee engagement polling.  An admin creates a survey with
 * rating or multiple-choice questions, publishes it, and employees respond
 * anonymously.  Results are aggregated server-side so no individual vote is
 * exposed to the survey creator.
 */

const MAX_OPTIONS = 10;
const MAX_QUESTIONS = 20;

// ─── Question Subschema ──────────────────────────────────────────────────────

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      maxlength: [300, 'Question text cannot exceed 300 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['rating', 'multiple_choice', 'yes_no'],
        message: 'Question type must be one of: rating, multiple_choice, yes_no',
      },
      required: true,
    },
    /** Options for multiple_choice — ignored for rating and yes_no */
    options: {
      type: [String],
      default: [],
      validate: {
        validator: function (opts) {
          if (this.type === 'multiple_choice') {
            return opts.length >= 2 && opts.length <= MAX_OPTIONS;
          }
          return true;
        },
        message: `Multiple choice requires 2–${MAX_OPTIONS} options`,
      },
    },
    /** For rating: 1–5 scale (default) */
    maxRating: {
      type: Number,
      default: 5,
      min: 3,
      max: 10,
    },
  },
  { _id: true },
);

// ─── Response Subschema ──────────────────────────────────────────────────────

const responseSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    answers: [
      {
        questionId: mongoose.Schema.Types.ObjectId,
        /** Rating value or chosen option index */
        value: mongoose.Schema.Types.Mixed,
      },
    ],
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// ─── Main Schema ─────────────────────────────────────────────────────────────

const pulseSurveySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Survey title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    questions: {
      type: [questionSchema],
      required: true,
      validate: {
        validator: (q) => q.length >= 1 && q.length <= MAX_QUESTIONS,
        message: `A survey must have 1–${MAX_QUESTIONS} questions`,
      },
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'closed'],
      default: 'draft',
    },
    /** When the survey was published */
    publishedAt: {
      type: Date,
      default: null,
    },
    /** Auto-close date (optional) */
    closesAt: {
      type: Date,
      default: null,
    },
    /** Department scope — empty array means all */
    targetDepartments: {
      type: [String],
      default: [],
    },
    /** Anonymous responses — always true for V1, field exists for future opt-in */
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    responses: {
      type: [responseSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  { timestamps: true },
);

pulseSurveySchema.index({ tenantId: 1, status: 1 });
pulseSurveySchema.index({ tenantId: 1, createdBy: 1 });
// Unique response per employee per survey (enforced at application layer too)
pulseSurveySchema.index(
  { tenantId: 1, 'responses.employeeId': 1 },
  { sparse: true },
);

module.exports = mongoose.model('PulseSurvey', pulseSurveySchema);
