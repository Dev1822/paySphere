const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');
const cryptoSealPlugin = require('../middlewares/cryptoSeal.plugin');
const {
  ALL_STATUSES,
  PAYROLL_STATUS,
  normalizeStatus,
} = require('../config/payrollStatus');

const payrollUpdateSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
      maxlength: [100, 'Employee name cannot exceed 100 characters'],
    },
    month: {
      type: Number, // 1-12
      required: true,
      min: [1, 'Month must be between 1 and 12'],
      max: [12, 'Month must be between 1 and 12'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    baseCurrency: {
      type: String,
      default: 'USD',
    },
    disbursementCurrency: {
      type: String,
      default: 'USD',
    },
    fxRate: {
      type: Number,
      default: 1.0,
    },
    convertedNetSalary: {
      type: Number,
      default: null,
    },
    year: {
      type: Number,
      required: true,
      min: [2000, 'Year must be 2000 or later'],
      max: [2100, 'Year must be 2100 or earlier'],
    },
    baseSalary: {
      type: Number,
      required: true,
      min: [0, 'Base salary cannot be negative'],
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
      dailyRate: {
    type: Number,
    description: 'Daily rate for leave calculation',
  },

  leaveDays: {
    type: Number,
    default: 0,
    description: 'Number of leave days taken',
  },

  overtimeHours: {
    type: Number,
    default: 0,
    description: 'Overtime hours worked',
  },

  overtimeRate: {
    type: Number,
    default: 0,
    description: 'Rate per overtime hour',
  },

  taxRate: {
    type: Number,
    default: 0,
    description: 'Tax rate percentage',
  },

  components: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Calculated payroll components breakdown',
    default: null,
  },
    customDeductions: [
      {
        name: {
          type: String,
          maxlength: [100, 'Deduction name cannot exceed 100 characters'],
        },
        amount: {
          type: Number,
          min: [0, 'Deduction amount cannot be negative'],
        },
      },
    ],
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
    targetCurrency: {
      type: String,
      default: 'USD',
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    /**
     * Who created this row. An audit fact, not a scoping key.
     *
     * #585's codemod rewrote every `createdBy: req.userId` in the controllers to
     * `tenantId: req.tenantId` while leaving this field `required: true`, so
     * every insert omitted a field the schema demanded and `create()` threw
     * before reaching Mongo (#613). Both fields are written now: this one records
     * the actor, `tenantId` below decides who can see the row.
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /**
     * Which company this row belongs to — the field every read filters on.
     *
     * Separate from `createdBy` because a company can have more than one admin,
     * and a row created by one of them has to stay visible to the others.
     */
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    // The approval workflow added in #438 writes "PENDING_APPROVAL"/"APPROVED"/
    // "REJECTED", none of which were in this enum — so every save() path threw a
    // ValidationError and the workflow only appeared to work because it went
    // through updateMany, which skips validators by default (#458).
    //
    // The vocabulary now comes from config/payrollStatus.js, shared with every
    // controller that compares against it. `set` folds the legacy "finalized" and
    // the screaming-snake spellings onto the canonical values so documents
    // written by either older revision keep validating.
    blockchainTxHash: { type: String },
    merkleRoot: { type: String },
    status: {
      type: String,
      enum: ALL_STATUSES,
      default: PAYROLL_STATUS.PENDING_APPROVAL,
      set: (value) => normalizeStatus(value) || value,
    },
    /**
     * The maker–checker trail (#559).
     *
     * #458 mounted the approval routes and wired the controller to write these
     * six fields, but none of them were ever declared here. Two consequences,
     * both silent:
     *
     *   - `getPendingApprovals` calls `.populate("submittedBy", …)`, and mongoose
     *     has had `strictPopulate` on by default since v6 — populating a path
     *     that is not in the schema throws, so the checker queue answered 500.
     *   - Strict mode drops `$set` keys that are not in the schema, so every
     *     approver, timestamp and rejection reason the controller wrote was
     *     discarded before the query left the process.
     *
     * Without `submittedBy` on disk there is also nothing to compare an approver
     * against, so the separation of WRITE_PAYROLL from APPROVE_PAYROLL that
     * config/permissions.js sets up cannot actually be enforced.
     */
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    submittedAt: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    // Capped here as well as in the controller: the controller's slice only
    // guards the HTTP path, and this field is also written by the migration and
    // by anything that talks to the model directly.
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
    /**
     * Where leaveDays and overtimeHours came from.
     *
     * "ledger"  — derived from the validated Attendance document for the month
     * "manual"  — parsed out of the activity tag strings, the pre-#459 path
     *
     * Recorded so an audit of "why was this employee docked three days?" can tell
     * whether the answer is a day-by-day record or a regex over a display label.
     */
    attendanceSource: {
      type: String,
      enum: ['ledger', 'manual'],
      default: 'manual',
    },
    /**
     * Instalments collected against this payroll row (#460).
     *
     * Stored on the row rather than only on the loan so a payslip regenerated
     * later reproduces the recovery line exactly as it was paid, and so the
     * deduction can be traced back to the loan it serviced.
     */
    loanRecoveries: [
      {
        loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
        amount: { type: Number, default: 0 },
        principalComponent: { type: Number, default: 0 },
        interestComponent: { type: Number, default: 0 },
        scheduledAmount: { type: Number, default: 0 },
        shortfall: { type: Number, default: 0 },
      },
    ],
    loanRecoveryTotal: {
      type: Number,
      default: 0,
    },

    /**
     * Tax-free expense reimbursements bundled into this run (#719).
     *
     * Carried as its own column rather than folded into `bonus`, because the
     * two are taxed differently and a payslip has to show them on separate
     * lines: a bonus is earnings, a reimbursement is the employee being made
     * whole for money they already spent.
     */
    reimbursements: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * The claims this row paid out, for the audit trail.
     *
     * The claim documents carry a `payrollId` pointing back here, so the link
     * is stored from both ends: the reimbursement line on a regenerated payslip
     * resolves without a second query, and an auditor asking "which run paid
     * this receipt?" starts from the claim.
     */
    reimbursedExpenseIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpenseClaim',
      },
    ],

    /**
     * Back pay released by this run for months already paid at an older rate
     * (#931, declared here in #950).
     *
     * Its own column for the same reason `reimbursements` is: it is not this
     * month's earnings. Folding it into `bonus` would misstate both the payslip
     * and every month-over-month comparison built on top of these rows.
     *
     * The controller has been computing all three of these since #931 and
     * writing them into a document whose schema declared none of them, so
     * Mongoose dropped them silently and the payslip showed an unexplained net.
     */
    arrearsPayout: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Which months the payout is made of, so a payslip can itemise it.
     *
     * Denormalised out of the ledger deliberately: the ledger rows can be
     * corrected or superseded later, and a payslip has to keep showing what was
     * actually paid at the time it was issued.
     */
    arrearsBreakdown: [
      {
        month: { type: Number, min: 1, max: 12 },
        year: { type: Number },
        amount: { type: Number, default: 0 },
        isProRated: { type: Boolean, default: false },
        days: { type: Number, default: 0 },
      },
    ],

    /** The ledger rows this run retired, for the audit trail back. */
    arrearsLedgerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ArrearsLedger',
      },
    ],

    /**
     * The salary component split in force when this row was calculated (#461).
     *
     * Snapshotted rather than looked up at render time, so a payslip regenerated
     * a year later still shows the breakdown that was actually paid instead of
     * the employee's current package.
     */
    salarySnapshot: {
      effectiveGross: { type: Number },
      isProrated: { type: Boolean, default: false },
      segmentCount: { type: Number, default: 1 },
      components: [
        {
          code: String,
          label: String,
          type: String,
          amount: Number,
        },
      ],
    },
    /**
     * Immutable payroll calculation snapshot.
     *
     * This stores the exact values used by the calculation rather than relying
     * on the employee record at the time a historical payslip is viewed.
     */
    calculationSnapshot: {
      version: {
        type: String,
        required: true,
      },
      ruleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollCalculationRuleVersion',
        default: null,
      },
      rules: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      employee: {        fullName: String,
        email: String,
        role: String,
        companyName: String,
        language: String,
      },
      inputs: {
        baseSalary: Number,
        overtimeRate: Number,
        leaveDays: Number,
        overtimeHours: Number,
        bonus: Number,
        deductions: Number,
        leaveDeduction: Number,
        overtimePay: Number,
        reimbursements: Number,
        loanRecoveryTotal: Number,
        arrearsPayout: Number,
        exchangeRate: Number,
        currency: String,
        targetCurrency: String,
        baseCurrency: String,
        attendanceSource: String,
        defaultDailyRate: Number,
        defaultOvertimeRate: Number,
      },
      salarySnapshot: mongoose.Schema.Types.Mixed,
      loanRecoveries: mongoose.Schema.Types.Mixed,
      arrearsBreakdown: mongoose.Schema.Types.Mixed,
      reimbursedExpenseIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ExpenseClaim',
        },
      ],
      finalAmounts: {
        grossNetBeforeRecovery: Number,
        netSalary: Number,
      },
      finalizedAt: {
        type: Date,
      },
      finalizedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    payslipEmailed: {
      type: Boolean,
      default: false,
    },  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);
// Every index below leads with `tenantId` because that is what every query
// filters on since #585. They led with `createdBy` until #613 — which meant the
// rewritten queries had no index behind them and collection-scanned the largest
// collection in the product, while the indexes that did exist covered a field
// nothing filtered by any more.

// Ensure one payroll record per employee per month, per company. Scoped to the
// tenant rather than the creator: two admins at the same company must not each
// be able to run August for the same employee.
payrollUpdateSchema.index(
  { employeeId: 1, month: 1, year: 1, tenantId: 1 },
  { unique: true },
);

payrollUpdateSchema.index({ tenantId: 1, year: -1, month: -1 });

// The approvals queue reads "everything pending, newest first, for this
// company". Without a compound index on the two fields it filters by, that is a
// collection scan on the single largest collection in the product — the exact
// class of problem #241 fixed for the other hot paths.
payrollUpdateSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

// Summary, exports and analytics all filter { tenantId, month, year, status }.
payrollUpdateSchema.index({ tenantId: 1, year: -1, month: -1, status: 1 });

// "What did I submit, and where has it got to?" — the maker's own view of the
// queue, and the lookup an approver-is-not-the-submitter check needs (#559).
// `submittedBy` is a user, so this one is genuinely per-actor within a company.
payrollUpdateSchema.index({ tenantId: 1, submittedBy: 1, status: 1 });
const snapshotIsBeingChanged = (update = {}) => {
  const set = update.$set || {};
  const unset = update.$unset || {};

  return (
    Object.keys(set).some((key) => key === 'calculationSnapshot' || key.startsWith('calculationSnapshot.')) ||
    Object.keys(unset).some((key) => key === 'calculationSnapshot' || key.startsWith('calculationSnapshot.'))
  );
};

payrollUpdateSchema.pre('save', function (next) {
  if (
    !this.isNew &&
    this.get('calculationSnapshot.finalizedAt') &&
    this.isModified('calculationSnapshot')
  ) {
    return next(
      new Error('Finalized payroll calculation snapshot cannot be modified'),
    );
  }

  next();
});

payrollUpdateSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate'],
  async function (next) {
    try {
      if (!snapshotIsBeingChanged(this.getUpdate())) {
        return next();
      }

      const query = this.getQuery();
      const finalized = await this.model.exists({
        ...query,
        'calculationSnapshot.finalizedAt': { $exists: true, $ne: null },
      });

      if (finalized) {
        return next(
          new Error(
            'Finalized payroll calculation snapshot cannot be modified',
          ),
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  },
);
payrollUpdateSchema.plugin(softDeletePlugin);
payrollUpdateSchema.plugin(auditTrailPlugin);
payrollUpdateSchema.plugin(cryptoSealPlugin);
module.exports = mongoose.model('PayrollUpdate', payrollUpdateSchema);
