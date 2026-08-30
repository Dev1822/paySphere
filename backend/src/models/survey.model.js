/**
 * @fileoverview Employee Survey & Pulse Check Schemas
 * @description Manages survey templates, question types, anonymous responses,
 * pulse check campaigns, and analytics aggregations.
 */
const mongoose = require('mongoose');

// ============================================================================
// Survey Schema
// ============================================================================

const surveyQuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, maxlength: 500 },
    questionType: {
      type: String,
      enum: ['LIKERT_5', 'LIKERT_7', 'YES_NO', 'RATING_1_10', 'OPEN_TEXT', 'MULTIPLE_CHOICE', 'NET_PROMOTER'],
      required: true,
    },
    options: [{ type: String, maxlength: 200 }],
    isRequired: { type: Boolean, default: true },
    category: { type: String, default: 'general', maxlength: 100 },
  },
  { _id: true },
);

const surveySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    type: {
      type: String,
      enum: ['PULSE', 'ENGAGEMENT', 'ONBOARDING', 'EXIT', 'CUSTOM'],
      default: 'PULSE',
    },
    questions: [surveyQuestionSchema],
    isAnonymous: { type: Boolean, default: true },
    targetDepartments: [{ type: String }],
    targetAll: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'CLOSED', 'ANALYZING'],
      default: 'DRAFT',
      index: true,
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    responseCount: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    avgCompletionTime: { type: Number, default: 0 },
  },
  { timestamps: true },
);

surveySchema.index({ tenantId: 1, status: 1 });

const Survey = mongoose.model('Survey', surveySchema);

// ============================================================================
// Survey Response Schema
// ============================================================================

const surveyResponseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Survey',
      required: true,
      index: true,
    },
    respondentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isAnonymous: { type: Boolean, default: true },
    answers: [
      {
        questionId: mongoose.Schema.Types.ObjectId,
        questionText: { type: String, default: '' },
        questionType: { type: String, default: '' },
        value: { type: mongoose.Schema.Types.Mixed },
        textValue: { type: String, default: '' },
      },
    ],
    department: { type: String, default: '' },
    completionTime: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

surveyResponseSchema.index({ tenantId: 1, surveyId: 1, respondentId: 1 }, { unique: true, sparse: true });
surveyResponseSchema.index({ tenantId: 1, surveyId: 1, department: 1 });

const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);

// ============================================================================
// Pulse Check Campaign Schema
// ============================================================================

const pulseCheckSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    question: { type: String, required: true, maxlength: 500 },
    questionType: {
      type: String,
      enum: ['EMOJI_1_5', 'SLIDER_1_10', 'YES_NO'],
      default: 'EMOJI_1_5',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED'],
      default: 'ACTIVE',
      index: true,
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    responseCount: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    sentiment: {
      type: String,
      enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_DATA'],
      default: 'NO_DATA',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

pulseCheckSchema.index({ tenantId: 1, status: 1 });

const PulseCheck = mongoose.model('PulseCheck', pulseCheckSchema);

// ============================================================================
// Pulse Check Response Schema
// ============================================================================

const pulseCheckResponseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    pulseCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PulseCheck',
      required: true,
      index: true,
    },
    respondentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    value: { type: Number, required: true },
    emoji: { type: String, default: '' },
    department: { type: String, default: '' },
    respondedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

pulseCheckResponseSchema.index({ tenantId: 1, pulseCheckId: 1, respondentId: 1 }, { unique: true });

const PulseCheckResponse = mongoose.model('PulseCheckResponse', pulseCheckResponseSchema);

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  Survey,
  SurveyResponse,
  PulseCheck,
  PulseCheckResponse,
};
