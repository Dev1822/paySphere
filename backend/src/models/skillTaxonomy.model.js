const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

const skillTaxonomySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Skill name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Category cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

skillTaxonomySchema.index({ tenantId: 1, name: 1 }, { unique: true });

skillTaxonomySchema.plugin(softDeletePlugin);
skillTaxonomySchema.plugin(auditTrailPlugin);

module.exports = mongoose.model('SkillTaxonomy', skillTaxonomySchema);
