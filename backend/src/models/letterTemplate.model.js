const mongoose = require('mongoose');

const letterTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['Offer', 'Salary Revision', 'Relieving', 'Experience', 'Other'],
      default: 'Other',
    },
    bodyHtml: {
      type: String,
      required: true,
    },
    headerHtml: {
      type: String,
      default: '',
    },
    footerHtml: {
      type: String,
      default: '',
    },
    declaredVariables: [
      {
        type: String,
      },
    ],
    version: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('LetterTemplate', letterTemplateSchema);
