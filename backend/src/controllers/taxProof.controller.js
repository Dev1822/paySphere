/**
 * @fileoverview Tax Proof Controller
 * @description Handles employee submissions and HR verification workflows for tax proofs.
 * Issue: #982
 */
const TaxProof = require('../models/taxProof.model');
const Employee = require('../models/employee.model');
const {
  calculateTDSAdjustment,
  aggregateApprovedDeductions,
} = require('../utils/tdsAdjuster');
const eventBus = require('../services/event.service');

/**
 * POST /api/tax-proofs
 * Employee submits a new tax proof for a specific section.
 */
exports.submitProof = async (req, res, next) => {
  try {
    const { financialYear, sectionType, claimedAmount, receiptUrls } = req.body;

    // In a real app, req.userId would map to the employeeId, or HR submits on behalf
    const employee = await Employee.findOne({
      userId: req.userId
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const proof = await TaxProof.create({
      employeeId: employee._id,
      financialYear,
      sectionType,
      claimedAmount: Number(claimedAmount),
      receiptUrls: receiptUrls || []
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TAX_PROOF_SUBMITTED',
      resourceType: 'TaxProof',
      resourceIds: [proof._id],
      details: { sectionType, claimedAmount },
      req,
    });

    res
      .status(201)
      .json({ message: 'Tax proof submitted successfully', proof });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({
          message: 'Proof for this section already submitted for this FY.',
        });
    next(error);
  }
};

/**
 * GET /api/tax-proofs/my-proofs
 * Employee views their submitted proofs and status.
 */
exports.getMyProofs = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const proofs = await TaxProof.find({
      employeeId: employee._id
    }).sort({ createdAt: -1 });
    const aggregated = aggregateApprovedDeductions(proofs);

    res.status(200).json({ proofs, aggregated });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tax-proofs/queue
 * HR views all pending proofs for verification.
 */
exports.getVerificationQueue = async (req, res, next) => {
  try {
    const { status, financialYear } = req.query;
    const query = {};

    if (status) query.status = status;
    if (financialYear) query.financialYear = Number(financialYear);

    const proofs = await TaxProof.find(query)
      .populate('employeeId', 'fullName department role email')
      .sort({ createdAt: 1 }); // Oldest first for queue

    res.status(200).json({ proofs });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tax-proofs/:id/verify
 * HR approves, rejects, or partially approves a submitted proof.
 */
exports.verifyProof = async (req, res, next) => {
  try {
    const { approvedAmount, status, remarks } = req.body;
    // Was `findById` plus `proof.tenantId.toString() !== req.tenantId`
    // (#1010). That check does not do what it looks like it does:
    // `auth.middleware` sets `req.tenantId` from `user.tenantId`, which is
    // an ObjectId, and a string primitive is never strictly equal to an
    // object — so the comparison was *always true* and this endpoint
    // answered 404 to everyone, including the tenant that owns the proof.
    //
    // Verification decides how much TDS comes out of somebody's salary, so
    // the effect was not cosmetic: HR could not approve a proof at all.
    //
    // Scoping the query fixes both halves at once. Mongoose casts the
    // tenant, so ObjectId-versus-string cannot arise, and another
    // company's proof is unfetchable rather than fetched and then rejected.
    const proof = await TaxProof.findOne(
      { _id: req.params.id },
    );

    if (!proof) {
      return res.status(404).json({ message: 'Tax proof not found' });
    }

    if (!['Approved', 'Rejected', 'Partially Approved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid verification status' });
    }

    proof.status = status;
    proof.approvedAmount = Number(approvedAmount) || 0;
    proof.remarks = remarks || '';
    proof.reviewedBy = req.userId;
    proof.reviewedAt = new Date();

    await proof.save();

    // Calculate TDS impact if rejected or partially approved
    let tdsAdjustment = null;
    if (status !== 'Approved') {
      // Assuming 30% slab for calculation demo; real app would fetch employee's specific slab
      tdsAdjustment = calculateTDSAdjustment(
        proof.claimedAmount,
        proof.approvedAmount,
        0.3,
      );
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TAX_PROOF_VERIFIED',
      resourceType: 'TaxProof',
      resourceIds: [proof._id],
      details: {
        status,
        approvedAmount: proof.approvedAmount,
        tdsImpact: tdsAdjustment?.taxImpact,
      },
      req,
    });

    res
      .status(200)
      .json({ message: 'Proof verified successfully', proof, tdsAdjustment });
  } catch (error) {
    next(error);
  }
};
