const mongoose = require('mongoose');

const customFieldDefinitionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['Employee', 'Payroll', 'Expense'],
    },
    fieldKey: {
      type: String,
      required: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Field key can only contain letters, numbers, and underscores',
      ],
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    fieldType: {
      type: String,
      required: true,
      enum: ['text', 'number', 'date', 'dropdown'],
    },
    options: {
      type: [String],
      default: [],
    },
    validationRules: {
      required: { type: Boolean, default: false },
      min: { type: Number },
      max: { type: Number },
      maxLength: { type: Number },
    },
  },
  { timestamps: true },
);

// Ensure a field key is unique per entity type per tenant
customFieldDefinitionSchema.index(
  { tenantId: 1, entityType: 1, fieldKey: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  'CustomFieldDefinition',
  customFieldDefinitionSchema,
);
