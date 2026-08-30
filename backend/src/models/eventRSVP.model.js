const mongoose = require('mongoose');

const eventRSVPSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyEvent',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['going', 'maybe', 'not-going'],
      default: 'going',
    },
    note: { type: String, default: '', maxlength: 300 },
    respondedAt: { type: Date, default: Date.now },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true },
);

eventRSVPSchema.index(
  { tenantId: 1, eventId: 1, employeeId: 1 },
  { unique: true },
);
eventRSVPSchema.index({ tenantId: 1, eventId: 1, status: 1 });

module.exports = mongoose.model('EventRSVP', eventRSVPSchema);
