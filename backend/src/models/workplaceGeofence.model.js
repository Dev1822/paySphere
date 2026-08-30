const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const workplaceGeofenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    radius: {
      type: Number,
      required: true,
      default: 100, // Allowed radius limits in meters
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

workplaceGeofenceSchema.plugin(softDeletePlugin);

// Compound index for fast lookup of geofences per tenant
workplaceGeofenceSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('WorkplaceGeofence', workplaceGeofenceSchema);
