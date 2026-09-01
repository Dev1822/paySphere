const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

const employeeSkillSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillTaxonomy',
      required: true,
    },
    proficiencyLevel: {
      type: Number,
      required: true,
      min: [1, 'Proficiency level must be at least 1'],
      max: [5, 'Proficiency level cannot exceed 5'],
    },
    source: {
      type: String,
      enum: ['self_assessed', 'manager_endorsed'],
      default: 'self_assessed',
    },
    status: {
      type: String,
      enum: ['pending_endorsement', 'approved'],
      default: 'pending_endorsement',
    },
    certificationExpiry: {
      type: Date,
      default: null,
    },
    certificationDocument: {
      type: String,
      default: null,
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

employeeSkillSchema.index(
  { tenantId: 1, employeeId: 1, skillId: 1 },
  { unique: true },
);

employeeSkillSchema.plugin(softDeletePlugin);
employeeSkillSchema.plugin(auditTrailPlugin);

module.exports = mongoose.model('EmployeeSkill', employeeSkillSchema);
