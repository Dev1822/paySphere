const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    positionCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: ['Active', 'Vacant', 'Frozen', 'Eliminated'],
      default: 'Vacant',
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    managerPositionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

positionSchema.index({ tenantId: 1, positionCode: 1 }, { unique: true });

const Position = mongoose.model('Position', positionSchema);

module.exports = Position;
