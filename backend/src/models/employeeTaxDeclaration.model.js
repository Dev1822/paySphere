/**
 * What an employee declares for a financial year (#933, added in #951).
 *
 * The regime they have opted into, the PAN the certificate is issued against,
 * and the investments they are claiming a deduction for. `utils/
 * complianceAggregator.js` has read this collection since #933
 * (`find({ tenantId, financialYear })`, `decl.regime`) and the model was never
 * committed, so the aggregator threw on require and no Form 16 or 24Q could be
 * produced.
 *
 * One row per employee per financial year. A year is identified by its start:
 * `financialYear: 2026` is 1 April 2026 to 31 March 2027.
 *
 * PAN lives here rather than on `Employee` deliberately. It is a tax identity
 * tied to a filing year, it is the field a certificate is wrong without, and
 * `models/employee.model.js` has no `pan` path — which is why the aggregator's
 * `emp.pan` has always resolved to `undefined` and been written out as 'N/A'.
 */

const mongoose = require('mongoose');
const cryptoSealPlugin = require('../middlewares/cryptoSeal.plugin');

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Old regime: lower slabs, deductions allowed. New regime: higher slabs, almost
 * none. Which one an employee is on decides whether the numbers below are worth
 * anything to them, so it is required rather than defaulted silently.
 */
const TAX_REGIME = {
  OLD: 'old',
  NEW: 'new',
};

const DECLARATION_STATUS = {
  /** Employee has entered figures; payroll should treat them as provisional. */
  DECLARED: 'declared',
  /** Proof submitted and checked. Only these should feed a filed return. */
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

const employeeTaxDeclarationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    /** The year the financial year starts in: 2026 means FY 2026-27. */
    financialYear: {
      type: Number,
      required: true,
      min: [2000, 'Financial year must be 2000 or later'],
      max: [2100, 'Financial year cannot exceed 2100'],
    },

    regime: {
      type: String,
      enum: Object.values(TAX_REGIME),
      default: TAX_REGIME.NEW,
    },

    pan: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      validate: {
        validator: (v) => !v || PAN_PATTERN.test(v),
        message: 'PAN must be in the format AAAAA0000A',
      },
    },

    /**
     * Declared investments, by the section they are claimed under.
     *
     * Stored as named amounts rather than a free-form object so a total can be
     * computed without trusting a client-supplied key, and so a new section can
     * be added without migrating documents.
     */
    declarations: {
      section80C: { type: Number, default: 0, min: 0 },
      section80D: { type: Number, default: 0, min: 0 },
      section80CCD1B: { type: Number, default: 0, min: 0 },
      section80G: { type: Number, default: 0, min: 0 },
      section80TTA: { type: Number, default: 0, min: 0 },
      houseRentPaid: { type: Number, default: 0, min: 0 },
      homeLoanInterest: { type: Number, default: 0, min: 0 },
      otherIncome: { type: Number, default: 0, min: 0 },
    },

    status: {
      type: String,
      enum: Object.values(DECLARATION_STATUS),
      default: DECLARATION_STATUS.DECLARED,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: { type: Date },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// One declaration per employee per year, per company. Scoped to the tenant for
// the same reason every other business collection is: two admins editing the
// same employee's declaration must land on one row, not two.
employeeTaxDeclarationSchema.index(
  { tenantId: 1, employeeId: 1, financialYear: 1 },
  { unique: true },
);

/**
 * Total claimed under the old regime, capped at the statutory ceilings.
 *
 * Capped here rather than at entry: an employee may legitimately declare more
 * than the ceiling, and what the return can claim is a different number from
 * what they said they invested.
 *
 * @returns {number}
 */
employeeTaxDeclarationSchema.methods.totalDeductions =
  function totalDeductions() {
    if (this.regime !== TAX_REGIME.OLD) return 0;

    const d = this.declarations || {};

    return (
      Math.min(d.section80C || 0, 150000) +
      Math.min(d.section80D || 0, 100000) +
      Math.min(d.section80CCD1B || 0, 50000) +
      Math.min(d.homeLoanInterest || 0, 200000) +
      (d.section80G || 0) +
      Math.min(d.section80TTA || 0, 10000)
    );
  };

employeeTaxDeclarationSchema.plugin(cryptoSealPlugin);

const EmployeeTaxDeclaration = mongoose.model(
  'EmployeeTaxDeclaration',
  employeeTaxDeclarationSchema,
);

EmployeeTaxDeclaration.TAX_REGIME = TAX_REGIME;
EmployeeTaxDeclaration.DECLARATION_STATUS = DECLARATION_STATUS;
EmployeeTaxDeclaration.PAN_PATTERN = PAN_PATTERN;

module.exports = EmployeeTaxDeclaration;
