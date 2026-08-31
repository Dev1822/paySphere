/**
 * @fileoverview TOIL Controller
 * @description Manages policy configuration, balance fetching, time-off requests,
 * automated expiration processing, and overtime conversion forecasts.
 */
const { ToilPolicy, ToilLedger, ToilRequest } = require('../models/toil.model');
const Employee = require('../models/employee.model');
const {
  getCurrentBalance,
  convertExpiredToilToOvertime,
  evaluateUpcomingToilExpirations,
} = require('../utils/toilCalculator.utils');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

exports.getPolicy = async (req, res, next) => {
  try {
    let policy = await ToilPolicy.findOne({});
    if (!policy) policy = await ToilPolicy.create({});
    res.status(200).json({ policy });
  } catch (error) { next(error); }
};

exports.updatePolicy = async (req, res, next) => {
  try {
    const policy = await ToilPolicy.findOneAndUpdate(
      {},
      { ...req.body, updatedAt: new Date() },
      { upsert: true, new: true },
    );
    res.status(200).json({ message: 'TOIL policy updated', policy });
  } catch (error) { next(error); }
};

exports.getMyToilData = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId
    });
    if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

    const balance = await getCurrentBalance(req.tenantId, employee._id);

    const ledger = await ToilLedger.find({
      employeeId: employee._id
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const expiringSoon = await ToilLedger.find({
      employeeId: employee._id,
      transactionType: 'Accrual',
      expiresAt: { $gte: now, $lte: in30Days }
    }).sort({ expiresAt: 1 });

    res.status(200).json({ balance, ledger, expiringSoon });
  } catch (error) { next(error); }
};

exports.requestToil = async (req, res, next) => {
  try {
    const { requestType, daysRequested, startDate, endDate, remarks } = req.body;
    const employee = await Employee.findOne({
      userId: req.userId
    });
    if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

    const currentBalance = await getCurrentBalance(req.tenantId, employee._id);
    if (currentBalance < daysRequested) {
      return res.status(400).json({ message: `Insufficient TOIL balance. Available: ${currentBalance} days.` });
    }

    const request = await ToilRequest.create({
      employeeId: employee._id,
      requestType,
      daysRequested,
      startDate,
      endDate,
      remarks
    });

    res.status(201).json({ message: 'TOIL request submitted', request });
  } catch (error) { next(error); }
};

exports.approveRequest = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const request = await ToilRequest.findById(req.params.id);
    if (!request || request.status !== 'Pending') {
      return res.status(400).json({ message: 'Request not found or already processed.' });
    }

    request.status = status;
    request.remarks = remarks || request.remarks;
    request.approvedBy = req.userId;
    await request.save();

    if (status === 'Approved') {
      const currentBalance = await getCurrentBalance(req.tenantId, request.employeeId);

      await ToilLedger.create({
        employeeId: request.employeeId,
        transactionType: 'Usage',
        days: -request.daysRequested,
        balanceAfter: currentBalance - request.daysRequested,
        referenceId: request._id,
        description: `TOIL ${request.requestType} approved for ${request.startDate ? new Date(request.startDate).toLocaleDateString() : 'Encashment'}`
      });
    }

    res.status(200).json({ message: `Request ${status}`, request });
  } catch (error) { next(error); }
};

exports.getUpcomingExpirationsByDepartment = async (req, res, next) => {
  try {
    const now = new Date();
    const days = parseInt(req.query.days, 10) || 30;
    const limitDate = new Date(now);
    limitDate.setDate(limitDate.getDate() + days);

    const accruals = await ToilLedger.find({
      transactionType: 'Accrual',
      expiresAt: { $gte: now, $lte: limitDate }
    }).populate({
      path: 'employeeId',
      select: 'fullName email department',
    });

    const departmentsMap = {};

    for (const accrual of accruals) {
      if (!accrual.employeeId) continue;

      const usedFromThisAccrual = await ToilLedger.aggregate([
        {
          $match: {
            employeeId: accrual.employeeId._id,
            transactionType: 'Usage',
            createdAt: { $gt: accrual.createdAt, $lt: now }
          },
        },
        { $group: { _id: null, totalUsed: { $sum: { $abs: '$days' } } } },
      ]);

      const totalUsed = usedFromThisAccrual.length > 0 ? usedFromThisAccrual[0].totalUsed : 0;
      const remainingDays = accrual.days - totalUsed;

      if (remainingDays <= 0) continue;

      const dept = accrual.employeeId.department || 'Unassigned';
      if (!departmentsMap[dept]) {
        departmentsMap[dept] = [];
      }

      departmentsMap[dept].push({
        accrualId: accrual._id,
        employeeId: accrual.employeeId._id,
        employeeName: accrual.employeeId.fullName,
        employeeEmail: accrual.employeeId.email,
        accruedDays: accrual.days,
        remainingDays,
        expiresAt: accrual.expiresAt,
        createdAt: accrual.createdAt,
      });
    }

    res.status(200).json({ success: true, departments: departmentsMap });
  } catch (error) { next(error); }
};

/**
 * POST /api/toil/process-expirations
 * Sweeps and processes all expired TOIL credits, converting to overtime payouts.
 */
exports.processToilExpirations = async (req, res, next) => {
  try {
    const policy = await ToilPolicy.findOne({});
    const now = new Date();

    const expiredAccruals = await ToilLedger.find({
      transactionType: 'Accrual',
      expiresAt: { $lt: now }
    }).populate('employeeId', 'fullName monthlySalary basicSalary');

    const conversionCandidates = [];

    for (const accrual of expiredAccruals) {
      if (!accrual.employeeId) continue;

      // Check if already expired or encashed
      const alreadyProcessed = await ToilLedger.findOne({
        referenceId: accrual._id,
        transactionType: { $in: ['Expiration', 'Encashment'] }
      });

      if (alreadyProcessed) continue;

      const currentBalance = await getCurrentBalance(req.tenantId, accrual.employeeId._id);
      const daysToExpire = Math.min(accrual.days, Math.max(0, currentBalance));

      if (daysToExpire > 0) {
        // Record Expiration in ledger
        await ToilLedger.create({
          employeeId: accrual.employeeId._id,
          transactionType: policy?.allowEncashment ? 'Encashment' : 'Expiration',
          days: -daysToExpire,
          balanceAfter: currentBalance - daysToExpire,
          referenceId: accrual._id,
          description: `Automatic TOIL ${policy?.allowEncashment ? 'Overtime Payout' : 'Expiration'} for accrual of ${accrual.days} days`
        });

        conversionCandidates.push({
          employeeId: accrual.employeeId._id,
          days: daysToExpire,
          monthlySalary: accrual.employeeId.monthlySalary || 30000,
        });
      }
    }

    const conversionResult = convertExpiredToilToOvertime(
      conversionCandidates,
      policy || {},
      1.5,
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TOIL_EXPIRATIONS_PROCESSED',
      resourceType: 'ToilLedger',
      resourceIds: expiredAccruals.map((a) => a._id),
      details: {
        totalConvertedDays: conversionResult.totalDays,
        totalCompensation: conversionResult.totalCompensation,
      },
      req,
    });

    res.status(200).json({
      message: 'Expired TOIL units processed successfully',
      summary: conversionResult,
    });
  } catch (error) { next(error); }
};

/**
 * GET /api/toil/payout-forecast
 * Previews upcoming TOIL expiration liability for the next window (30/60/90 days).
 */
exports.getPayoutForecast = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const policy = await ToilPolicy.findOne({});
    const now = new Date();
    const limitDate = new Date(now);
    limitDate.setDate(limitDate.getDate() + days);

    const upcomingAccruals = await ToilLedger.find({
      transactionType: 'Accrual',
      expiresAt: { $gte: now, $lte: limitDate }
    }).populate('employeeId', 'fullName monthlySalary basicSalary');

    const candidates = upcomingAccruals.map((a) => ({
      employeeId: a.employeeId?._id,
      days: a.days,
      monthlySalary: a.employeeId?.monthlySalary || 30000,
    }));

    const forecast = convertExpiredToilToOvertime(candidates, policy || {}, 1.5);

    res.status(200).json({
      success: true,
      windowDays: days,
      forecast,
    });
  } catch (error) { next(error); }
};
