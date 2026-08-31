const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const escrowAccountSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    ledgerBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    pendingReleases: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    wireBankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      swiftCode: { type: String, default: '' },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const escrowTransactionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['DEPOSIT', 'PAYROLL_RELEASE', 'ADJUSTMENT'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reference: {
      type: String,
      default: '',
    },
    makerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

escrowAccountSchema.plugin(softDeletePlugin);
escrowTransactionSchema.plugin(softDeletePlugin);

const EscrowAccount = mongoose.model('EscrowAccount', escrowAccountSchema);
const EscrowTransaction = mongoose.model('EscrowTransaction', escrowTransactionSchema);

module.exports = {
  EscrowAccount,
  EscrowTransaction,
};
