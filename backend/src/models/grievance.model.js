/**
 * @fileoverview POSH Grievance & ICC Schemas
 * @description Cryptographically secure schemas for anonymous reporting,
 * Internal Complaints Committee (ICC) case management, votes, and SLA tracking.
 */
const mongoose = require('mongoose');

const iccCommitteeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['Presiding Officer', 'Internal Member', 'External Member'], required: true },
  isActive: { type: Boolean, default: true },
  decryptionPinHash: { type: String, required: true }, // Bcrypt hash of secondary PIN
}, { timestamps: true });

iccCommitteeSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
const ICCCommittee = mongoose.model('ICCCommittee', iccCommitteeSchema);

const grievanceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  caseNumber: { type: String, required: true, unique: true }, // e.g., POSH-2024-001
  complainantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null }, // Null = Anonymous
  respondentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  incidentDate: { type: Date, required: true },
  // Encrypted fields (AES-256-GCM)
  encryptedDescription: { type: String, required: true },
  encryptionIV: { type: String, required: true },
  status: {
    type: String,
    enum: ['Filed', 'Under Inquiry', 'Resolved', 'Dismissed'],
    default: 'Filed',
  },
  finalVerdict: {
    type: String,
    enum: ['Pending', 'Upheld', 'Dismissed', 'Inconclusive'],
    default: 'Pending',
  },
  inquiryReport: { type: String, default: null },
  resolutionDate: { type: Date, default: null },
  isSLAAlertSent: { type: Boolean, default: false },
  filedAt: { type: Date, default: Date.now },
  slaDeadline: { type: Date, required: true }, // filedAt + 90 days
}, { timestamps: true });

grievanceSchema.index({ tenantId: 1, status: 1 });
const Grievance = mongoose.model('Grievance', grievanceSchema);

const caseNoteSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  grievanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Must be ICC member
  encryptedNote: { type: String, required: true },
  encryptionIV: { type: String, required: true },
  noteType: { type: String, enum: ['Hearing', 'Evidence', 'Finding', 'General'], default: 'General' },
}, { timestamps: true });

const CaseNote = mongoose.model('CaseNote', caseNoteSchema);

const iccVoteSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  grievanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', required: true, index: true },
  voterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verdict: { type: String, enum: ['Upheld', 'Dismissed', 'Inconclusive'], required: true },
  comments: { type: String, default: '' },
  votedAt: { type: Date, default: Date.now },
}, { timestamps: true });

iccVoteSchema.index({ grievanceId: 1, voterId: 1 }, { unique: true });
const ICCVote = mongoose.model('ICCVote', iccVoteSchema);

module.exports = { ICCCommittee, Grievance, CaseNote, ICCVote };
