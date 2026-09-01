/**
 * @fileoverview Referral Controller
 * @description Manages referral submissions, candidate pipeline progression,
 * milestone vesting evaluations, and payroll bonus dispatch.
 */
const { ReferralProgram, ReferralCandidate, ReferralPayout } = require('../models/referral.model');
const Employee = require('../models/employee.model');
const {
  processMilestonePayouts,
  generateReferralPayrollLineItems,
  evaluateReferralMilestoneVesting,
} = require('../utils/referralPayoutEngine.utils');
const eventBus = require('../services/event.service');

exports.getActivePrograms = async (req, res, next) => {
  try {
    const programs = await ReferralProgram.find({
      isActive: true
    });
    res.status(200).json({ programs });
  } catch (error) { next(error); }
};

exports.submitReferral = async (req, res, next) => {
  try {
    const { programId, candidateName, candidateEmail, candidatePhone, resumeUrl } = req.body;
    const referrer = await Employee.findOne({
      userId: req.userId
    });
    if (!referrer) return res.status(404).json({ message: 'Employee profile not found' });

    const candidate = await ReferralCandidate.create({
      programId,
      referrerId: referrer._id,
      candidateName,
      candidateEmail,
      candidatePhone,
      resumeUrl
    });

    res.status(201).json({ message: 'Referral submitted successfully', candidate });
  } catch (error) { next(error); }
};

exports.getMyReferrals = async (req, res, next) => {
  try {
    const referrer = await Employee.findOne({
      userId: req.userId
    });
    if (!referrer) return res.status(404).json({ message: 'Employee profile not found' });

    const referrals = await ReferralCandidate.find({
      referrerId: referrer._id
    })
      .populate('programId', 'title bountyAmount milestoneSplits')
      .sort({ createdAt: -1 });

    const payouts = await ReferralPayout.find({
      referrerId: referrer._id
    });
    const payoutMap = new Map(payouts.map((p) => [p.candidateId.toString(), p]));

    const data = referrals.map((r) => ({
      ...r.toObject(),
      payout: payoutMap.get(r._id.toString()) || null,
    }));

    res.status(200).json({ referrals: data });
  } catch (error) { next(error); }
};

exports.updateCandidateStatus = async (req, res, next) => {
  try {
    const { status, hiredEmployeeId } = req.body;
    const candidate = await ReferralCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    candidate.status = status;
    if (status === 'Hired' && hiredEmployeeId) {
      candidate.hiredEmployeeId = hiredEmployeeId;
      candidate.hiredAt = new Date();

      const program = await ReferralProgram.findById(candidate.programId);
      if (program) {
        const splits = program.milestoneSplits && program.milestoneSplits.length > 0
          ? program.milestoneSplits
          : [
            { label: 'Joining Bonus', percentage: 50, trigger: 'HIRED' },
            { label: 'Probation Completion Bonus', percentage: 50, trigger: 'PROBATION_COMPLETE' },
          ];

        for (const split of splits) {
          const amount = Math.round(((program.bountyAmount * (split.percentage || 50)) / 100) * 100) / 100;
          await ReferralPayout.create({
            candidateId: candidate._id,
            referrerId: candidate.referrerId,
            milestoneLabel: split.label,
            amount,
            status: split.trigger === 'HIRED' ? 'Approved' : 'Pending'
          });
        }
      }
    }

    await candidate.save();
    res.status(200).json({ message: 'Status updated', candidate });
  } catch (error) { next(error); }
};

exports.runPayoutEngine = async (req, res, next) => {
  try {
    const result = await processMilestonePayouts(req.tenantId);
    res.status(200).json({ message: 'Payout engine executed', result });
  } catch (error) { next(error); }
};

/**
 * POST /api/referrals/payouts/process-vested
 * Processes vested payouts and generates payroll additions.
 */
exports.processVestedReferralPayouts = async (req, res, next) => {
  try {
    const engineResult = await processMilestonePayouts(req.tenantId);

    const approvedPayouts = await ReferralPayout.find({
      status: 'Approved',
      payrollRunId: null
    }).populate('referrerId', 'fullName monthlySalary');

    const payrollLines = generateReferralPayrollLineItems(approvedPayouts);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'REFERRAL_PAYOUTS_VESTED_PROCESSED',
      resourceType: 'ReferralPayout',
      resourceIds: approvedPayouts.map((p) => p._id),
      details: {
        processedCount: engineResult.processed,
        forfeitedCount: engineResult.forfeited,
        totalBonusAmount: payrollLines.reduce((s, l) => s + l.amount, 0),
      },
      req,
    });

    res.status(200).json({
      message: 'Vested referral payouts processed successfully',
      engineResult,
      payrollLines,
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/referrals/payouts/pending-vesting
 * Summary of all pending and approved referral bonus liabilities.
 */
exports.getPendingVestingSummary = async (req, res, next) => {
  try {
    const payouts = await ReferralPayout.find({})
      .populate('referrerId', 'fullName department')
      .populate('candidateId', 'candidateName status hiredAt');

    const pending = payouts.filter((p) => p.status === 'Pending');
    const approved = payouts.filter((p) => p.status === 'Approved');
    const forfeited = payouts.filter((p) => p.status === 'Forfeited');

    const sumAmount = (list) => Math.round(list.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;

    res.status(200).json({
      totalPayouts: payouts.length,
      pendingCount: pending.length,
      pendingAmount: sumAmount(pending),
      approvedCount: approved.length,
      approvedAmount: sumAmount(approved),
      forfeitedCount: forfeited.length,
      forfeitedAmount: sumAmount(forfeited),
      payouts,
    });
  } catch (error) { next(error); }
};

exports.getAdminPipeline = async (req, res, next) => {
  try {
    const candidates = await ReferralCandidate.find({})
      .populate('referrerId', 'fullName department')
      .populate('programId', 'title')
      .sort({ createdAt: -1 });
    res.status(200).json({ candidates });
  } catch (error) { next(error); }
};
