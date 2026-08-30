const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');
const {
  MONTHLY_SALARY_MAX,
  OVERTIME_RATE_MAX,
  PHONE_REGEX,
  EMAIL_REGEX,
} = require('../utils/validators');
const { EMPLOYMENT_STATUS, EXIT_TYPE } = require('../config/employment');

const employeeSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    } /**
     * Employee contact number, validated as an international phone number
     * with an optional leading "+" and a national number of 7-15 digits.
     * Optional on creation, same as `email`.
     */,
    phone: {
      type: String,
      required: false,
      trim: true,
      match: [
        PHONE_REGEX,
        'Phone number must be a valid international phone number',
      ],
    },
    role: {
      type: String,
      default: '',
      maxlength: [100, 'Role cannot exceed 100 characters'],
    },
    targetCurrency: { type: String, default: 'USD' },
    baseCurrency: { type: String, default: 'USD' },
    department: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
    },

    /**
     * Who this employee reports to, for the drag-and-drop org chart (#1287).
     *
     * Self-referencing so the whole hierarchy can be rebuilt from a flat
     * list. `null` means "top of the chart" (e.g. the CEO) rather than an
     * unset value — the org chart builder treats both the same way anyway.
     */
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    /**     * Pay equity attributes (#1347).
     *
     * All three are optional and all three are absent by default, which is the
     * only version of this that is defensible. A tenant that does not collect
     * them gets the compa-ratio analysis and a clearly-labelled
     * "insufficient data" on the demographic one — never a crash, and never a
     * fabricated zero gap.
     *
     * `gender` is deliberately free text with a short list of conventional
     * values rather than a two-value enum. It is self-declared, it is not the
     * product's business to decide what the valid answers are, and a schema
     * that rejects an employee's own description of themselves is a bug that
     * surfaces as a 500 on a profile save. The analysis groups by whatever
     * string is here and suppresses any group too small to report on, so an
     * open vocabulary costs nothing.
     *
     * `ethnicity` is here for the same reporting reason and is not read by
     * anything today; it is the second axis the pay gap regulations in several
     * jurisdictions are moving towards, and adding the column later would mean
     * a backfill nobody can do retrospectively.
     */
    gender: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: [60, 'Gender cannot exceed 60 characters'],
    },
    ethnicity: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: [60, 'Ethnicity cannot exceed 60 characters'],
    },
    /**
     * The grade this employee sits at, which is what makes a like-for-like
     * comparison possible at all. `role` is a job title and two people with the
     * same title can be three grades apart, so it cannot stand in for this.
     */
    jobLevel: {
      type: String,
      default: '',
      trim: true,
      maxlength: [40, 'Job level cannot exceed 40 characters'],
    },
    /**
     * Contracted hours a month, where they differ from a standard month.
     *
     * The gap regulations compute on *hourly* pay so that part-time and
     * full-time employees are comparable; without this, a part-time workforce
     * shows a pay gap that is really a hours gap.
     */
    contractedMonthlyHours: {
      type: Number,
      default: undefined,
      min: [1, 'Contracted hours must be positive'],
      max: [400, 'Contracted hours cannot exceed 400 a month'],
    },

    /**
     * Where this employee sits in the minimum wage schedules (#1698).
     *
     * Four fields rather than one because that is genuinely how many it takes
     * to identify a notified rate. A state notifies per *scheduled employment*,
     * within that per *area class*, and within that per *skill category*, and
     * the schedules do not agree between states on what any of those columns
     * contain. Collapsing them to a single "wage band" merges two different
     * notifications, and the merged rate is wrong for at least one of the
     * populations it now covers.
     *
     * Nested rather than flattened onto the root because the four are only
     * meaningful together — an `areaClass` with no `state` names nothing — and
     * because grouping them keeps the projection in
     * `minimumWages.controller.js` to one field.
     *
     * All optional. An employee with no classification is reported as an
     * exclusion with a reason rather than assessed against a guess.
     */
    statutoryClassification: {
      /** ISO 3166-2 subdivision code without the country prefix: KA, MH, TN. */
      state: {
        type: String,
        default: '',
        uppercase: true,
        trim: true,
        maxlength: [8, 'State code cannot exceed 8 characters'],
      },
      /**
       * The scheduled employment as the state names it. Free text, because the
       * schedules are state-specific and a closed list here would mean a tenant
       * in a state we have not enumerated cannot classify their own staff.
       */
      scheduledEmployment: {
        type: String,
        default: '',
        trim: true,
        maxlength: [120, 'Scheduled employment cannot exceed 120 characters'],
      },
      /**
       * Zone I / II / III. States name these differently — Area A/B/C in
       * Karnataka, a metro split elsewhere — but it is always an ordered
       * classification of where the establishment is, so the notification
       * carries the state's own label and this carries the ordering.
       */
      areaClass: {
        type: String,
        enum: ['', 'ZONE_I', 'ZONE_II', 'ZONE_III'],
        default: '',
      },
      /** The four categories every state schedule is written in terms of. */
      skillCategory: {
        type: String,
        enum: ['', 'UNSKILLED', 'SEMI_SKILLED', 'SKILLED', 'HIGHLY_SKILLED'],
        default: '',
      },
    },

    /**
     * Where this record came from, when it came from an external HRMS (#954).
     *
     * The adapters in `src/integrations/` have always returned an `externalId`
     * and there was nowhere to put it, so a second sync could not recognise
     * what the first one created and matching would have fallen back to email
     * forever. An email address changes; an HRMS id does not.
     */
    externalId: {
      type: String,
      default: undefined,
      trim: true,
    },
    externalProvider: {
      type: String,
      enum: ['bamboohr', 'workday', 'adp', 'sap', null, undefined],
      default: undefined,
    },

    /**
     * Derived mirror of `employmentStatus`, kept so every existing query that
     * filters on it keeps working untouched (#462).
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Explicit employment state.
     */
    employmentStatus: {
      type: String,
      enum: Object.values(EMPLOYMENT_STATUS),
      default: EMPLOYMENT_STATUS.ACTIVE,
    },

    exitDetails: {
      lastWorkingDay: { type: Date },
      resignationDate: { type: Date },
      exitType: {
        type: String,
        enum: Object.values(EXIT_TYPE),
      },
      reason: {
        type: String,
        default: '',
        maxlength: [500, 'Exit reason cannot exceed 500 characters'],
      },
      noticePeriodDays: { type: Number, min: 0, max: 365 },
      noticeServedDays: { type: Number, min: 0, max: 365 },
      exitInterviewDone: { type: Boolean, default: false },
    },
    monthlySalary: {
      type: Number,
      required: true,
      min: [1, 'Monthly salary must be positive'],
      max: [
        MONTHLY_SALARY_MAX,
        `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}`,
      ],
    },
    overtimeRate: {
      type: Number,
      default: 0,
      min: [0, 'Overtime rate cannot be negative'],
      max: [
        OVERTIME_RATE_MAX,
        `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}`,
      ],
    },
    companyName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: (value) => !value || value <= new Date(),
        message: 'Date of birth cannot be in the future',
      },
    },
    joiningDate: {
      type: Date,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    language: {
      type: String,
      enum: ['en', 'es', 'hi'],
      default: 'en',
    },

    /**
     * Who created this row. An audit fact, not a scoping key.
     *
     * #585's codemod rewrote every `createdBy: req.userId` in the controllers
     * to `tenantId: req.tenantId` while leaving this field `required: true`, so
     * every insert omitted a field the schema demanded and `create()` threw
     * before reaching Mongo (#613). Both fields are written now: this one
     * records the actor, `tenantId` below decides who can see the row.
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
    bankDetails: {
      bankName: {
        type: String,
        default: '',
        maxlength: [100, 'Bank name cannot exceed 100 characters'],
      },
      accountNumber: {
        type: String,
        default: '',
        maxlength: [30, 'Account number cannot exceed 30 characters'],
      },
      routingCode: {
        type: String,
        default: '',
        maxlength: [20, 'Routing/IFSC code cannot exceed 20 characters'],
      },
    },
    customData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);
employeeSchema.index({ tenantId: 1, fullName: 1, role: 1 }, { unique: true });
// Note: the index above is a prefix of this one and is also unique, so it is
// the one that decides. Adding `department` here cannot loosen a constraint the
// shorter index already enforces — two people with the same name and role in
// different departments are still rejected. Left as-is because relaxing it
// changes who can be hired, which is a product decision, not a scoping fix.
employeeSchema.index(
  { tenantId: 1, fullName: 1, role: 1, department: 1 },
  { unique: true },
);

/**
 * Email is unique within a company, for the employees that have one.
 *
 * Scoped by `tenantId` rather than `createdBy`: an address must not be usable
 * twice inside one company, and it must be usable in a different one. Scoping
 * it to the creator would let two admins at the same company each add the same
 * person.
 *
 * The invariants from #414 still hold and are what the model test checks:
 *
 *   - `partialFilterExpression`, not `sparse`. `sparse` on a compound index
 *     only skips a document when *every* indexed key is missing, and the second
 *     key is required — so every email-less employee was indexed with
 *     `email: null` and the second one hit E11000.
 *   - The filter is `$type: 'string'`, so a document with no email is outside
 *     the index entirely rather than sharing a null slot.
 */
employeeSchema.index(
  { email: 1, tenantId: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

// Index for efficient soft delete filtering
employeeSchema.index({ tenantId: 1, isDeleted: 1, isActive: 1 });

/**
 * One record per external id, per provider, per company (#954).
 *
 * `partialFilterExpression` rather than `sparse`, for the reason spelled out
 * above the email index: `sparse` on a compound index only skips a document
 * when every indexed key is missing, and `tenantId` is required — so every
 * employee added by hand would be indexed with a null external id and the
 * second one would collide.
 */
employeeSchema.index(
  { tenantId: 1, externalProvider: 1, externalId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalId: { $type: 'string' } },
  },
);

employeeSchema.plugin(softDeletePlugin);
employeeSchema.plugin(auditTrailPlugin);
module.exports = mongoose.model('Employee', employeeSchema);
