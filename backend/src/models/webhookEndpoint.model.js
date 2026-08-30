/**
 * @fileoverview Webhook Endpoint Schema
 * @description Defines the configuration for external webhook URLs that
 * subscribe to specific internal PaySphere events.
 *
 * Issue: #645
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const webhookEndpointSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      match: /^https?:\/\/.+/i, // Must be a valid HTTP/HTTPS URL
    },
    signingSecret: {
      type: String,
      required: true,
      minlength: 16, // Minimum 16 chars for HMAC security
    },
    subscribedEvents: {
      type: [String],
      required: true,
      enum: [
        'EMPLOYEE_CREATE',
        'EMPLOYEE_UPDATE',
        'EMPLOYEE_DELETE',
        'PAYROLL_FINALIZE',
        'PAYROLL_APPROVE',
        'PAYROLL_REJECT',
        'PAYROLL_PAID',
      ],
      validate: [
        (array) => array.length > 0,
        'Must subscribe to at least one event',
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      maxlength: 200,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

// Index for fast lookup of active endpoints for a specific tenant
webhookEndpointSchema.index({ tenantId: 1, isActive: 1 });

webhookEndpointSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('WebhookEndpoint', webhookEndpointSchema);
