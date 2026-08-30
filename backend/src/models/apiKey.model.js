const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const apiKeySchema = new mongoose.Schema(
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
    hashedKey: {
      type: String,
      required: true,
      unique: true,
    },
    prefix: {
      type: String,
      required: true,
      index: true,
    },
    scopes: {
      type: [String],
      default: [],
    },
    secret: {
      type: String,
      required: true,
    },
    whitelistedCIDRs: {
      type: [String],
      default: [],
    },
    lastUsedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 }, // Automatically delete if expired
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

apiKeySchema.plugin(softDeletePlugin);

// Compound index for fast lookup within a tenant
apiKeySchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('ApiKey', apiKeySchema);
