/**
 * Contract Labour (Regulation and Abolition) Act, 1970 (#1700).
 *
 * Three collections, and the split is the whole design.
 *
 * `ContractLabourContractor` is the counterparty — one row per contractor, with
 * its section 12 licence. `ContractLabourDeployment` is a *month* of workmen on
 * site, which is the unit everything interesting is measured in: the section
 * 1(4) applicability test wants a daily series, section 21 exposure is per month
 * per contractor, and rule 25 parity is per designation. `ContractLabourReturn`
 * is the Form XXV filing.
 *
 * Not folded into `EnterpriseVendorModel`, which already holds contractors as a
 * finance counterparty. The vendor is the party to an invoice; the unit of
 * compliance here is the workman, of whom there may be four hundred behind one
 * vendor row, and bolting this on gives a model where the interesting quantity
 * has nowhere to live.
 */

const mongoose = require('mongoose');

const { REMITTANCE } = require('../utils/contractLabour');

/**
 * One contractor and its licence.
 *
 * The licence fields are on the contractor rather than in a collection of their
 * own even though a licence is renewed and therefore has a history. The
 * question the register asks is only ever "is there a valid licence covering
 * this deployment, today" — nobody audits a lapsed licence from four years ago
 * — and a second collection would buy history nobody reads at the cost of a
 * join on every read.
 */
const contractLabourContractorSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },

    /**
     * The finance-side vendor, where the tenant has one.
     *
     * Optional and deliberately not required: a principal employer's compliance
     * obligation attaches to the contractor supplying workmen, whether or not
     * anybody has raised a purchase order. Requiring the link would make the
     * register depend on finance having done its half first.
     */
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },

    /** Where the workmen are deployed. Drives nothing; read by humans. */
    establishment: { type: String, default: '' },
    workNature: { type: String, default: '' },

    // --- Section 12 licence ------------------------------------------------

    licenceNumber: { type: String, default: '', trim: true },
    licensingOfficer: { type: String, default: '' },
    licenceValidFrom: { type: Date, default: null },
    licenceValidTo: { type: Date, default: null },

    /**
     * The number of workmen the licence authorises.
     *
     * The figure the licence is *issued for*, not the number deployed.
     * Deploying forty against a licence for twenty-five is an offence by the
     * contractor and a compliance failure for the principal employer, and the
     * two numbers live in different systems that never compare — which is
     * exactly the check this exists to make possible.
     */
    licensedWorkmen: { type: Number, default: 0, min: 0 },

    securityDeposit: { type: Number, default: 0, min: 0 },

    active: { type: Boolean, default: true },
    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

contractLabourContractorSchema.index({ tenantId: 1, active: 1, name: 1 });

/** A remittance the contractor has evidenced for a month. */
const remittanceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(REMITTANCE), required: true },
    /** `YYYY-MM`. A string so months compare and sort without a date parse. */
    month: { type: String, required: true },
    reference: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    evidencedOn: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Workmen at one designation, in one month. */
const designationSchema = new mongoose.Schema(
  {
    designation: { type: String, required: true, trim: true },
    workmen: { type: Number, default: 0, min: 0 },
    /** The monthly wage per workman, as the contractor's register shows it. */
    wage: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const contractLabourDeploymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    contractorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContractLabourContractor',
      required: true,
    },

    /** `YYYY-MM`. */
    month: { type: String, required: true },

    workmen: { type: Number, default: 0, min: 0 },
    wageBill: { type: Number, default: 0, min: 0 },

    designations: { type: [designationSchema], default: [] },

    /**
     * The daily headcount for the month.
     *
     * Stored as a series rather than as a monthly peak because section 1(4)
     * asks about *any day* of the preceding twelve months, and a monthly figure
     * cannot answer it — an establishment that peaked at twenty-three for a
     * fortnight would show a monthly average of eleven and read as out of scope.
     *
     * Sparse by design: a tenant that records only the days the headcount
     * changed gets the same answer as one recording every day, because the test
     * is a maximum.
     */
    dailyHeadcounts: {
      type: [
        new mongoose.Schema(
          {
            date: { type: Date, required: true },
            workmen: { type: Number, default: 0, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    remittances: { type: [remittanceSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One deployment row per contractor per month. Recording April twice would
// double the section 21 exposure for April, which is the one number on this
// register that has to be right.
contractLabourDeploymentSchema.index(
  { tenantId: 1, contractorId: 1, month: 1 },
  { unique: true },
);

// The assessment's read: every deployment for a tenant across a window.
contractLabourDeploymentSchema.index({ tenantId: 1, month: 1 });

const contractLabourReturnSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The calendar year the Form XXV return covers. */
    year: { type: Number, required: true },

    dueBy: { type: Date, required: true },
    filedOn: { type: Date, default: null },
    acknowledgementRef: { type: String, default: '' },

    /**
     * The findings the assessment produced when the return was filed.
     *
     * Stored on the return rather than recomputed, for the reason every other
     * committed record in this tree gives: the contractors, their licences and
     * their remittance evidence all change, and a return that could not
     * reproduce what was known when it was filed is not evidence of anything.
     */
    exposureAtFiling: { type: Number, default: 0 },
    contractorCount: { type: Number, default: 0 },
    peakWorkmen: { type: Number, default: 0 },

    filedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

contractLabourReturnSchema.index({ tenantId: 1, year: 1 }, { unique: true });

const ContractLabourContractor = mongoose.model(
  'ContractLabourContractor',
  contractLabourContractorSchema,
);

const ContractLabourDeployment = mongoose.model(
  'ContractLabourDeployment',
  contractLabourDeploymentSchema,
);

const ContractLabourReturn = mongoose.model(
  'ContractLabourReturn',
  contractLabourReturnSchema,
);

module.exports = {
  ContractLabourContractor,
  ContractLabourDeployment,
  ContractLabourReturn,
};
