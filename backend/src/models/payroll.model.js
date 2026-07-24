const mongoose = require("mongoose");

const payrollUpdateSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  },
  employeeName: {
    type: String,
    required: true,
  },
  month: {
    type: Number, // 1-12
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  baseSalary: {
    type: Number,
    required: true,
  },
  overtimeRate: {
    type: Number,
    default: 0,
  },
  leaveDays: {
    type: Number,
    default: 0,
  },
  overtimeHours: {
    type: Number,
    default: 0,
  },
  bonus: {
    type: Number,
    default: 0,
  },
  deductions: {
    type: Number,
    default: 0,
  },
  leaveDeduction: {
    type: Number,
    default: 0,
  },
  overtimePay: {
    type: Number,
    default: 0,
  },
  netSalary: {
    type: Number,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["finalized", "paid"],
    default: "finalized",
  },
}, { timestamps: true });

// Ensure one payroll record per employee per month
payrollUpdateSchema.index({ employeeId: 1, month: 1, year: 1, createdBy: 1 }, { unique: true });

payrollUpdateSchema.index({ createdBy: 1, year: -1, month: -1 });

module.exports = mongoose.model("PayrollUpdate", payrollUpdateSchema);
