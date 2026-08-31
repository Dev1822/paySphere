const mongoose = require('mongoose');

/**
 * Competency Tracking Model
 *
 * Tracks employee skills with proficiency levels, last assessment dates,
 * and supports department-level skill requirements for gap analysis.
 *
 * Each document represents a single employee's competency profile,
 * scoped by tenant for multi-tenancy isolation.
 */

const proficiencyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const skillEntrySchema = new mongoose.Schema(
  {
    skillName: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
      maxlength: [100, 'Skill name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      required: [true, 'Skill category is required'],
      trim: true,
      maxlength: [60, 'Category cannot exceed 60 characters'],
    },
    proficiency: {
      type: String,
      enum: {
        values: proficiencyLevels,
        message: 'Proficiency must be one of: Beginner, Intermediate, Advanced, Expert',
      },
      required: [true, 'Proficiency level is required'],
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
      min: [0, 'Years of experience cannot be negative'],
      max: [50, 'Years of experience cannot exceed 50'],
    },
    lastAssessedDate: {
      type: Date,
      default: Date.now,
    },
    assessedBy: {
      type: String,
      default: 'Self',
      trim: true,
      maxlength: [100, 'Assessor name cannot exceed 100 characters'],
    },
    notes: {
      type: String,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  { _id: true, timestamps: true },
);

const competencySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required'],
    },
    skills: {
      type: [skillEntrySchema],
      default: [],
      validate: {
        validator: function (skills) {
          const names = skills.map((s) => s.skillName.toLowerCase());
          return new Set(names).size === names.length;
        },
        message: 'Duplicate skill names are not allowed within an employee profile',
      },
    },
    /** Denormalized department for department-level skill matrix queries */
    department: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
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

// Ensure one competency profile per employee per tenant
competencySchema.index(
  { employeeId: 1, tenantId: 1 },
  { unique: true },
);

// Efficient lookups by department for the skill matrix
competencySchema.index({ tenantId: 1, department: 1 });

// Skill-level index for cross-employee skill searches
competencySchema.index({ tenantId: 1, 'skills.skillName': 1 });

module.exports = mongoose.model('Competency', competencySchema);
module.exports.proficiencyLevels = proficiencyLevels;
