const mongoose = require('mongoose');

const generatedLetterSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LetterTemplate',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    templateVersion: {
      type: Number,
      required: true,
    },
    renderedHtml: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Pending', 'Generated', 'Failed'],
      default: 'Pending',
    },
    sealHash: {
      type: String,
      required: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('GeneratedLetter', generatedLetterSchema);
