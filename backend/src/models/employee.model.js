const mongoose = require("mongoose");
const { MONTHLY_SALARY_MAX, OVERTIME_RATE_MAX } = require("../utils/validators");

const employeeSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    maxlength: [100, "Full name cannot exceed 100 characters"],
  },
  email: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    default: "",
    maxlength: [100, "Role cannot exceed 100 characters"],
  },
  monthlySalary: {
    type: Number,
    required: true,
    min: [1, "Monthly salary must be positive"],
    max: [MONTHLY_SALARY_MAX, `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}`],
  },
  overtimeRate: {
    type: Number,
    default: 0,
    min: [0, "Overtime rate cannot be negative"],
    max: [OVERTIME_RATE_MAX, `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}`],
  },
  companyName: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

employeeSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
