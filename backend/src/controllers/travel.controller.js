/**
 * @fileoverview Travel policy, request, advance and settlement endpoints.
 * @description Handles both original grade-based travel management (#1077)
 * and simplified corporate travel & per diem workflows (#1209).
 *
 * The order of operations is the feature: a trip is *requested*, then
 * *approved* against policy, then *funded* with an advance, then *settled*
 * against actuals. Each step carries a refusal:
 *
 *   - approval refuses a trip with no usable policy for the traveller's grade,
 *   - advance release refuses more than the policy ceiling,
 *   - settlement refuses a trip that was never approved, and refuses a second
 *     settlement against the same trip.
 *
 * Approval is the only place policy violations are evaluated, and the result is
 * snapshotted onto the request. Recomputing on read would let a later policy
 * amendment make an approved breach look compliant in hindsight.
 */

const mongoose = require('mongoose');

const {
  TravelPolicy,
  TravelRequest,
  TravelSettlement,
  PerDiemPolicy,
  CorporateTravelRequest,
  CorporateTravelSettlement,
} = require('../models/travel.model');
const Employee = require('../models/employee.model');
const {
  REQUEST_STATUS,
  computeTripPerDiem,
  computeAdvanceCeiling,
  detectPolicyViolations,
  settleTrip,
  outstandingAdvances,
  rebalanceMultiCurrencyTravelSettlement,
  calculatePerDiem,
  reconcileSettlement,
} = require('../utils/perDiemCalculator');
const eventBus = require('../services/event.service');

// ============================================================================
// Original Travel Controllers (Issue #1077)
// ============================================================================

/**
 * A caller-supplied date, falling back to now.
 *
 * @param {string|undefined} raw
 * @returns {Date}
 */
function resolveAsOf(raw) {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * The policy for a grade, or null.
 *
 * @param {string} tenantId
 * @param {string} grade
 * @returns {Promise<object|null>}
 */
async function policyForGrade(tenantId, grade) {
  return TravelPolicy.findOne({ tenantId, grade, isActive: true }).lean();
}

/**
 * POST /api/travel/original/policies
 */
exports.upsertPolicy = async (req, res, next) => {
  try {
    const { grade } = req.body;
    if (!grade) return res.status(400).json({ message: 'grade is required' });

    // Upsert rather than create: a policy is per grade and there is exactly one
    // of them, so a second POST is an edit and answering 409 would leave no way
    // to change a rate.
    const policy = await TravelPolicy.findOneAndUpdate(
      {
        grade
      },
      {
        $set: {
          ...req.body,
          grade,
          createdBy: req.userId
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAVEL_POLICY_UPDATED',
      resourceType: 'TravelPolicy',
      resourceIds: [policy._id],
      details: { grade, perDiemRates: policy.perDiemRates },
      req,
    });

    return res.status(201).json({ message: 'Policy saved', policy });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/travel/original/policies
 */
exports.getPolicies = async (req, res, next) => {
  try {
    const policies = await TravelPolicy.find({})
      .sort({ grade: 1 })
      .lean();

    return res.json({ policies });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/travel/original/requests
 *
 * The per-diem estimate is computed and returned but not stored: the trip has
 * not happened, the legs will move, and a stored estimate would be mistaken for
 * an entitlement. The authoritative number is computed at settlement.
 */
exports.createRequest = async (req, res, next) => {
  try {
    const { employeeId, purpose, legs, estimatedCost, advanceRequested } =
      req.body;

    if (!purpose || !Array.isArray(legs) || legs.length === 0) {
      return res
        .status(400)
        .json({
          message: 'purpose and at least one itinerary leg are required',
        });
    }

    // An employee filing for themselves does not send an id; HR filing on
    // somebody's behalf does. Falling back to the caller's own record is what
    // makes the self-service path safe — there is nothing to substitute.
    const employee = employeeId
      ? await Employee.findOne({
      _id: mongoose.isValidObjectId(employeeId) ? employeeId : null
    })
        .select('_id fullName grade role')
        .lean()
      : await Employee.findOne({
      userId: req.userId
    })
        .select('_id fullName grade role')
        .lean();

    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    const grade = employee.grade || employee.role || 'Default';
    const policy = await policyForGrade(req.tenantId, grade);

    const request = await TravelRequest.create({
      employeeId: employee._id,
      grade,
      purpose,
      legs,
      estimatedCost,
      advanceRequested,
      status: REQUEST_STATUS.SUBMITTED,
      createdBy: req.userId
    });

    // Computed for the requester's information only. Reported as null when no
    // policy exists rather than as zero, because zero reads as "you are entitled
    // to nothing" and the truth is "nobody has set a policy for your grade".
    const perDiem = policy ? computeTripPerDiem(request, policy) : null;

    return res.status(201).json({
      message: 'Travel request submitted',
      request,
      estimatedPerDiem: perDiem,
      policyFound: Boolean(policy),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/travel/original/requests
 */
exports.getRequests = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (
      req.query.employeeId &&
      mongoose.isValidObjectId(req.query.employeeId)
    ) {
      filter.employeeId = req.query.employeeId;
    }

    const requests = await TravelRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ requests });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/travel/original/requests/:id/approve
 *
 * Violations are reported, not silently accepted and not automatically refused.
 * An approver may knowingly authorise a business-class ticket; what they may not
 * do is authorise one without being told. `acknowledgeViolations` has to be sent
 * explicitly, and what was acknowledged is written onto the request.
 */
exports.approveRequest = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const request = await TravelRequest.findOne({
      _id: req.params.id
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.status !== REQUEST_STATUS.SUBMITTED) {
      return res
        .status(409)
        .json({
          message: `Request is ${request.status} and cannot be approved`,
        });
    }

    const policy = await policyForGrade(req.tenantId, request.grade);
    if (!policy) {
      return res.status(409).json({
        message: `No active travel policy for grade '${request.grade}'`,
      });
    }

    const violations = detectPolicyViolations(request, policy);

    if (violations.length > 0 && !req.body.acknowledgeViolations) {
      return res.status(409).json({
        message: `This trip breaches ${violations.length} policy rule(s)`,
        violations,
        hint: 'Resend with acknowledgeViolations: true to approve anyway',
      });
    }

    request.status = REQUEST_STATUS.APPROVED;
    request.approvedBy = req.userId;
    request.approvedAt = new Date();
    // Snapshotted: amending the policy afterwards must not make an approved
    // breach look compliant in hindsight.
    request.policyViolations = violations;
    await request.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAVEL_REQUEST_APPROVED',
      resourceType: 'TravelRequest',
      resourceIds: [request._id],
      details: {
        violations: violations.length,
        estimatedCost: request.estimatedCost,
      },
      req,
    });

    return res.json({
      message: 'Travel request approved',
      request,
      violations,
      perDiem: computeTripPerDiem(request, policy),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/travel/original/requests/:id/reject
 */
exports.rejectRequest = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const { reason } = req.body;
    if (!reason || String(reason).trim().length < 5) {
      return res
        .status(400)
        .json({ message: 'A rejection reason is required' });
    }

    const request = await TravelRequest.findOne({
      _id: req.params.id
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.status !== REQUEST_STATUS.SUBMITTED) {
      return res
        .status(409)
        .json({
          message: `Request is ${request.status} and cannot be rejected`,
        });
    }

    request.status = REQUEST_STATUS.REJECTED;
    request.rejectionReason = String(reason).trim();
    await request.save();

    return res.json({ message: 'Travel request rejected', request });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/travel/original/requests/:id/advance
 *
 * Releasing an advance creates a company receivable, which is why it is a
 * separate call from approval rather than a side effect of it.
 */
exports.releaseAdvance = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ message: 'amount must be a positive number' });
    }

    const request = await TravelRequest.findOne({
      _id: req.params.id
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.status !== REQUEST_STATUS.APPROVED) {
      return res
        .status(409)
        .json({
          message: 'An advance can only be released against an approved trip',
        });
    }
    if (request.advanceReleased > 0) {
      return res.status(409).json({
        message: 'An advance has already been released for this trip',
        advanceReleased: request.advanceReleased,
      });
    }

    const policy = await policyForGrade(req.tenantId, request.grade);
    const { ceiling, percent } = computeAdvanceCeiling(
      request.estimatedCost,
      policy || {},
    );

    if (amount > ceiling) {
      return res.status(409).json({
        message: `Advance exceeds the policy ceiling of ${ceiling} (${percent}% of the estimate)`,
        ceiling,
        requested: amount,
      });
    }

    request.advanceReleased = amount;
    request.advanceReleasedAt = new Date();
    await request.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAVEL_ADVANCE_RELEASED',
      resourceType: 'TravelRequest',
      resourceIds: [request._id],
      details: { amount, ceiling },
      req,
    });

    return res.json({ message: 'Advance released', request, ceiling });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/travel/original/requests/:id/settle
 *
 * The per-diem is recomputed here from the policy and the itinerary rather than
 * taken from the request body. It is an entitlement, not a claim, and letting a
 * claimant state it would make the whole calculator decorative.
 */
exports.settleRequest = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const { actuals, payrollMonth, payrollYear } = req.body;

    const request = await TravelRequest.findOne({
      _id: req.params.id
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (
      request.status !== REQUEST_STATUS.APPROVED &&
      request.status !== REQUEST_STATUS.COMPLETED
    ) {
      return res.status(409).json({
        message: `Only an approved trip can be settled; this one is ${request.status}`,
      });
    }

    const policy = await policyForGrade(req.tenantId, request.grade);
    if (!policy) {
      return res.status(409).json({
        message: `No active travel policy for grade '${request.grade}'`,
      });
    }

    const perDiem = computeTripPerDiem(request, policy);
    if (!perDiem.valid) {
      return res
        .status(422)
        .json({
          message: 'Per-diem could not be computed',
          reason: perDiem.reason,
        });
    }

    const outcome = settleTrip({
      advanceReleased: request.advanceReleased,
      actuals,
      perDiemEntitlement: perDiem.total,
      policy,
    });

    const settlement = await TravelSettlement.create({
      requestId: request._id,
      employeeId: request.employeeId,
      actualsByHead: outcome.actualsByHead,
      actualsTotal: outcome.actualsTotal,
      perDiemEntitlement: outcome.perDiemEntitlement,
      perDiemBreakdown: perDiem.legs,
      advanceAdjusted: outcome.advanceReleased,
      settlementType: outcome.type,
      reimbursementAmount: outcome.reimbursementAmount,
      recoveryAmount: outcome.recoveryAmount,
      payrollComponent: outcome.payrollComponent,
      payrollMonth: payrollMonth ?? null,
      payrollYear: payrollYear ?? null,
      settledBy: req.userId
    });

    request.status = REQUEST_STATUS.SETTLED;
    await request.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAVEL_TRIP_SETTLED',
      resourceType: 'TravelSettlement',
      resourceIds: [settlement._id],
      details: {
        type: outcome.type,
        reimbursement: outcome.reimbursementAmount,
        recovery: outcome.recoveryAmount,
      },
      req,
    });

    return res.status(201).json({
      message: `Trip settled — ${outcome.type}`,
      settlement,
      perDiem,
      outcome,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'This trip has already been settled' });
    }
    return next(error);
  }
};

/**
 * GET /api/travel/original/advances/outstanding
 *
 * The receivables ledger this feature exists for. An advance is a company asset
 * until the trip settles, and nothing in the product tracked one.
 */
exports.getOutstandingAdvances = async (req, res, next) => {
  try {
    const asOf = resolveAsOf(req.query.asOf);

    const requests = await TravelRequest.find({
      advanceReleased: { $gt: 0 }
    }).lean();

    const settlements = await TravelSettlement.find({})
      .select('requestId')
      .lean();

    return res.json(outstandingAdvances(requests, settlements, asOf));
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/travel/original/my-trips
 *
 * Self-service. The employee is resolved from `req.userId`, never a parameter.
 */
exports.getMyTrips = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId
    })
      .select('_id fullName grade role')
      .lean();

    if (!employee) {
      return res
        .status(404)
        .json({ message: 'No employee record is linked to this account' });
    }

    const requests = await TravelRequest.find({
      employeeId: employee._id
    })
      .sort({ createdAt: -1 })
      .lean();

    const settlements = await TravelSettlement.find({
      employeeId: employee._id
    }).lean();

    const settledIds = new Set(settlements.map((row) => String(row.requestId)));

    return res.json({
      employee: { id: employee._id, fullName: employee.fullName },
      trips: requests,
      settlements,
      outstandingAdvance: requests
        .filter(
          (request) =>
            request.advanceReleased > 0 && !settledIds.has(String(request._id)),
        )
        .reduce((sum, request) => sum + request.advanceReleased, 0),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/travel/original/variance-report
 * Generates an executive summary of trip variances, budget adherence, and surplus recovery statuses.
 */
exports.getTravelVarianceReport = async (req, res, next) => {
  try {
    const settlements = await TravelSettlement.find({})
      .populate('employeeId', 'fullName department')
      .populate('requestId', 'purpose advanceReleased')
      .sort({ createdAt: -1 })
      .lean();

    let totalAdvances = 0;
    let totalActuals = 0;
    let totalReimbursements = 0;
    let totalSurplusRecoveries = 0;

    const report = settlements.map((s) => {
      const advance = s.advanceDeducted || s.requestId?.advanceReleased || 0;
      const actual = s.actualExpensesTotal + s.perDiemTotal;
      totalAdvances += advance;
      totalActuals += actual;

      if (s.settlementType === 'reimbursement') {
        totalReimbursements += s.netPayable;
      } else if (s.settlementType === 'recovery') {
        totalSurplusRecoveries += s.netPayable;
      }

      return {
        settlementId: s._id,
        employee: s.employeeId,
        tripPurpose: s.requestId?.purpose || 'N/A',
        settlementType: s.settlementType,
        advanceAmount: advance,
        actualSpent: actual,
        netPayable: s.netPayable,
        settledAt: s.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      summary: {
        totalTripsSettled: settlements.length,
        totalAdvances: Math.round(totalAdvances * 100) / 100,
        totalActuals: Math.round(totalActuals * 100) / 100,
        totalReimbursements: Math.round(totalReimbursements * 100) / 100,
        totalSurplusRecoveries: Math.round(totalSurplusRecoveries * 100) / 100,
        netCompanyVariance:
          Math.round((totalActuals - totalAdvances) * 100) / 100,
      },
      settlements: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/travel/original/requests/:id/multi-currency-settle
 * Settles international trip with multi-currency receipts against advance.
 */
exports.settleMultiCurrencyTrip = async (req, res, next) => {
  try {
    const { expenses = [], forexRates = {}, receipts = [] } = req.body;

    const request = await TravelRequest.findOne({
      _id: req.params.id
    });
    if (!request)
      return res.status(404).json({ message: 'Travel request not found' });

    const existingSettlement = await TravelSettlement.findOne({
      requestId: request._id
    });
    if (existingSettlement) {
      return res
        .status(409)
        .json({ message: 'This trip has already been settled' });
    }

    const rebalance = rebalanceMultiCurrencyTravelSettlement(
      request,
      expenses,
      forexRates,
    );

    const settlementType =
      rebalance.settlementAction === 'REIMBURSEMENT_DUE'
        ? 'reimbursement'
        : rebalance.settlementAction === 'SURPLUS_RECOVERY_DUE'
          ? 'recovery'
          : 'nil';

    const netPayable =
      rebalance.reimbursementPayable || rebalance.surplusToRecover || 0;

    const settlement = await TravelSettlement.create({
      requestId: request._id,
      employeeId: request.employeeId,
      perDiemTotal: rebalance.perDiemBase,
      actualExpensesTotal: rebalance.totalExpensesBase,
      advanceDeducted: rebalance.advanceReleasedBase,
      settlementType,
      netPayable,
      receipts: receipts.length ? receipts : undefined,
      recordedBy: req.userId
    });

    request.status = REQUEST_STATUS.SETTLED;
    await request.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAVEL_MULTI_CURRENCY_SETTLED',
      resourceType: 'TravelSettlement',
      resourceIds: [settlement._id],
      details: {
        requestId: request._id,
        settlementType,
        netPayable,
        netVariance: rebalance.netVariance,
      },
      req,
    });

    res.status(201).json({
      message: 'Multi-currency travel settlement processed successfully',
      settlement,
      rebalanceSummary: rebalance,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Corporate Travel & Per Diem Controllers (Issue #1209)
// ============================================================================

/**
 * GET /api/travel/corporate/policies
 * Fetches active per diem policies by city tier.
 */
exports.getCorporatePolicies = async (req, res, next) => {
  try {
    const policies = await PerDiemPolicy.find({
      isActive: true
    });
    res.status(200).json({ policies });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/travel/corporate/request
 * Submits a simplified corporate travel request with automatic per diem calculation.
 */
exports.requestTravel = async (req, res, next) => {
  try {
    const {
      destination,
      cityTier,
      purpose,
      startDate,
      endDate,
      estimatedTravelCost,
    } = req.body;
    const employee = await Employee.findOne({
      userId: req.userId
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const perDiem = await calculatePerDiem(req.tenantId, cityTier, durationDays);
    const totalAdvance = perDiem.totalPerDiem + (estimatedTravelCost || 0);

    const request = await CorporateTravelRequest.create({
      employeeId: employee._id,
      destination,
      cityTier,
      purpose,
      startDate: start,
      endDate: end,
      durationDays,
      estimatedPerDiem: perDiem.totalPerDiem,
      estimatedTravelCost: estimatedTravelCost || 0,
      totalAdvanceRequested: totalAdvance,
      status: 'Pending Approval'
    });

    res.status(201).json({
      message: 'Travel request submitted',
      request,
      perDiemBreakdown: perDiem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/travel/corporate/approve/:id
 * Approves advance payment and initializes settlement record.
 */
exports.approveAdvance = async (req, res, next) => {
  try {
    const request = await CorporateTravelRequest.findById(req.params.id);
    if (!request)
      return res.status(404).json({ message: 'Request not found' });

    request.status = 'Advance Paid';
    request.approvedBy = req.userId;
    request.advancePaidAt = new Date();
    await request.save();

    // Initialize settlement record
    await CorporateTravelSettlement.create({
      requestId: request._id,
      advancePaid: request.totalAdvanceRequested,
      actualExpenses: 0,
      balance: -request.totalAdvanceRequested,
      status: 'Pending Submission'
    });

    res
      .status(200)
      .json({ message: 'Advance approved and marked as paid.', request });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/travel/corporate/settle
 * Submits expense settlement with receipt reconciliation.
 */
exports.submitSettlement = async (req, res, next) => {
  try {
    const { requestId, expenseReceipts } = req.body;
    const settlement = await CorporateTravelSettlement.findOne({
      requestId
    });
    if (!settlement)
      return res
        .status(404)
        .json({
          message: 'Settlement record not found. Was the advance paid?',
        });

    const totalActuals = expenseReceipts.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    settlement.actualExpenses = totalActuals;
    settlement.expenseReceipts = expenseReceipts;

    const reconciliation = reconcileSettlement(
      settlement.advancePaid,
      totalActuals,
    );
    settlement.balance = reconciliation.balance;
    settlement.status = reconciliation.status;

    await settlement.save();

    res
      .status(200)
      .json({ message: 'Settlement submitted for finance review.', settlement });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/travel/corporate/my-travel
 * Fetches employee's corporate travel requests.
 */
exports.getMyTravel = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId
    });
    const requests = await CorporateTravelRequest.find({
      employeeId: employee._id
    }).sort({ createdAt: -1 });
    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Internal utilities (for testing)
// ============================================================================

exports._internals = { resolveAsOf, policyForGrade };

