const mongoose = require('mongoose');

const lifecycleEventSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'HIRED',
        'DEPARTMENT_TRANSFERRED',
        'ROLE_CHANGED',
        'SALARY_CHANGED',
        'APPRAISAL_COMPLETED',
        'WORK_ANNIVERSARY',
        'TENURE_MILESTONE',
        'PROMOTION',
        'WARNING',
        'TERMINATED',
        'CUSTOM_NOTE',
      ],
    },
    category: {
      type: String,
      required: true,
      enum: ['Compensation', 'Role', 'Milestones', 'Performance', 'Other'],
      default: 'Other',
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    previousValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

lifecycleEventSchema.index({ employeeId: 1, occurredAt: -1 });
lifecycleEventSchema.index({ tenantId: 1, employeeId: 1 });

module.exports = mongoose.model('LifecycleEvent', lifecycleEventSchema);
