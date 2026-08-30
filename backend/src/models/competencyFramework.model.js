const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

const competencyFrameworkSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Role cannot exceed 100 characters'],
    },
    requiredSkills: [
      {
        skillId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SkillTaxonomy',
          required: true,
        },
        minProficiencyLevel: {
          type: Number,
          required: true,
          min: [1, 'Minimum proficiency level must be at least 1'],
          max: [5, 'Minimum proficiency level cannot exceed 5'],
        },
      },
    ],
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

competencyFrameworkSchema.index({ tenantId: 1, role: 1 }, { unique: true });

competencyFrameworkSchema.plugin(softDeletePlugin);
competencyFrameworkSchema.plugin(auditTrailPlugin);

module.exports = mongoose.model(
  'CompetencyFramework',
  competencyFrameworkSchema,
);
