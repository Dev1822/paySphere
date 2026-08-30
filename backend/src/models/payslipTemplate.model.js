const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String },
    visible: { type: Boolean, default: true },
    order: { type: Number, required: true },
  },
  { _id: false },
);

const payslipTemplateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: '#3b82f6' },
      accentColor: { type: String, default: '#1e3a8a' },
      fontFamily: { type: String, default: 'Helvetica' },
    },
    sections: {
      type: [sectionSchema],
      default: [
        { id: 'header', title: 'Company Header', order: 0 },
        { id: 'employeeDetails', title: 'Employee Details', order: 1 },
        { id: 'earnings', title: 'Earnings', order: 2 },
        { id: 'deductions', title: 'Deductions', order: 3 },
        { id: 'netPay', title: 'Net Pay', order: 4 },
        { id: 'footer', title: 'Footer Info', order: 5 },
      ],
    },
    footerOptions: {
      showQrCode: { type: Boolean, default: false },
      digitalSeal: { type: Boolean, default: false },
      customText: { type: String, default: '' },
    },
    security: {
      passwordStrategy: {
        type: String,
        enum: ['NONE', 'DOB', 'PAN'],
        default: 'NONE',
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PayslipTemplate', payslipTemplateSchema);
