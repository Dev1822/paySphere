const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

/**
 * A tenant — one customer company, and the unit every scoped query filters on.
 *
 * #585 introduced `tenantId` on seven collections and rewrote every controller
 * to filter by it, but never created a single Tenant document: `signup` did not
 * provision one, so `user.tenantId` was undefined, the JWT carried
 * `tenantId: undefined`, and mongoose dropped the key out of every filter it
 * was handed. `Employee.find({ tenantId: undefined })` is not "match nothing",
 * it is `Employee.find({})` — the whole collection, every customer (#612).
 *
 * So the tenant has to actually exist before it can scope anything, and it has
 * to exist for accounts that predate the field. That is what
 * services/tenant.service.js and migrations/backfillTenants.js are for.
 *
 * One tenant per owner account. PaySphere has always been single-company —
 * `signup` takes a `companyName` and everything the account creates belongs to
 * it — so the tenant is that company, and `ownerId` is the account that
 * registered it. Employee portal logins (#443) join their employer's tenant
 * rather than getting one of their own.
 */
const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Tenant name cannot exceed 200 characters'],
    },

    /**
     * The account that registered the company.
     *
     * Unique, because a second tenant for the same owner would silently split
     * that customer's data in half: whichever one `user.tenantId` points at
     * becomes visible and the other becomes unreachable. `sparse` so tenants
     * created without an owner do not collide with each other on `null`.
     */
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      sparse: true,
    },

    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },

    /**
     * Soft-disable, mirroring `User.isActive`. Kept rather than deleted,
     * because the documents that reference a tenant outlive it.
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Retention policy for sensitive tenant data.
     *
     * Payroll and audit history are retained for historical/legal reporting.
     * Employee PII is anonymized after the employee retention period when the
     * employee has been soft-deleted. Attendance can be physically removed
     * after its shorter operational retention period because finalized payroll
     * snapshots contain the values required to reproduce historical payroll.
     */
    retentionPolicy: {
      employeePiiYears: {
        type: Number,
        default: 7,
        min: 1,
        max: 50,
      },
      attendanceYears: {
        type: Number,
        default: 2,
        min: 1,
        max: 50,
      },
      payrollYears: {
        type: Number,
        default: 7,
        min: 1,
        max: 50,
      },
      auditLogYears: {
        type: Number,
        default: 7,
        min: 1,
        max: 50,
      },
    },  },
  { timestamps: true },
);

tenantSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Tenant', tenantSchema);
