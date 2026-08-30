const mongoose = require('mongoose');

const companyEventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    category: {
      type: String,
      enum: [
        'social',
        'team-building',
        'workshop',
        'holiday',
        'celebration',
        'town-hall',
        'other',
      ],
      default: 'social',
    },
    location: { type: String, default: '', maxlength: 200 },
    isVirtual: { type: Boolean, default: false },
    meetingLink: { type: String, default: '', maxlength: 500 },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    maxAttendees: { type: Number, default: undefined, min: 1 },
    requiresApproval: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    tags: [{ type: String, trim: true, maxlength: 50 }],
    recurrence: {
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'none',
      },
      interval: { type: Number, default: 1, min: 1 },
      endDate: { type: Date, default: undefined },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

companyEventSchema.index({ tenantId: 1, startDateTime: 1 });
companyEventSchema.index({ tenantId: 1, category: 1, startDateTime: 1 });

module.exports = mongoose.model('CompanyEvent', companyEventSchema);
