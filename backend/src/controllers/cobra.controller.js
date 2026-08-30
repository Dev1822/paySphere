/**
 * @fileoverview COBRA Controller
 * @description Manages qualifying events, elections, premium billing, and ERISA compliance.
 * Issue: #1759
 */
const mongoose = require('mongoose');
const { COBRAQualifyingEvent, COBRAElection, PremiumBillingLedger } = require('../models/cobraAdministration.model');
const { calculatePremium, evaluateElectionWindow, evaluateGracePeriod, checkERISADeadline } = require('../utils/cobraBillingEngine.utils');
const logger = require('../utils/logger');

exports.logQualifyingEvent = async (req, res, next) => {
    try {
        const { employeeId, eventType, eventDate, coverageEndDate, baseMonthlyPremium } = req.body;

        const event = await COBRAQualifyingEvent.create({
            tenantId: req.tenantId, employeeId, eventType,
            eventDate: new Date(eventDate), coverageEndDate: new Date(coverageEndDate)
        });

        // Check ERISA Deadline immediately
        const erisaCheck = checkERISADeadline(event.eventDate, null);
        if (!erisaCheck.isCompliant) {
            event.isNoticeOverdue = true;
            await event.save();
            logger.warn(`[COBRA] ERISA Deadline Guardrail: Notice overdue for employee ${employeeId}`);
        }

        res.status(201).json({ message: 'Qualifying event logged', event, erisaCheck });
    } catch (error) { next(error); }
};

exports.sendNotice = async (req, res, next) => {
    try {
        const { eventId } = req.params;
        const event = await COBRAQualifyingEvent.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        event.noticeSentDate = new Date();

        const erisaCheck = checkERISADeadline(event.eventDate, event.noticeSentDate);
        event.isNoticeOverdue = !erisaCheck.isCompliant;
        event.status = 'Notice Sent';
        await event.save();

        res.status(200).json({ message: 'Notice dispatched', event, erisaCheck });
    } catch (error) { next(error); }
};

exports.submitElection = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { eventId, electionDate, baseMonthlyPremium, isDisabilityExtension } = req.body;

        const event = await COBRAQualifyingEvent.findById(eventId).session(session);
        if (!event) throw new Error('Event not found');

        const windowCheck = evaluateElectionWindow(event.eventDate, event.noticeSentDate, electionDate);
        if (!windowCheck.isTimely) {
            throw new Error(`Election rejected: Outside the 60-day statutory window.`);
        }

        const premiumCalc = calculatePremium(baseMonthlyPremium, isDisabilityExtension);

        // Calculate max coverage end date (18 months standard, 29 for disability, 36 for others)
        const maxMonths = isDisabilityExtension ? 29 : (['Death', 'Divorce', 'MedicareEntitlement'].includes(event.eventType) ? 36 : 18);
        const maxCoverageEndDate = new Date(event.coverageEndDate);
        maxCoverageEndDate.setMonth(maxCoverageEndDate.getMonth() + maxMonths);

        const election = await COBRAElection.create([{
            tenantId: req.tenantId, eventId, electionDate: new Date(electionDate),
            coverageStartDate: event.coverageEndDate, maxCoverageEndDate,
            baseMonthlyPremium, adminFeeRate: premiumCalc.adminFeeRate,
            totalMonthlyPremium: premiumCalc.totalMonthlyPremium,
            isDisabilityExtension, status: 'Active'
        }], { session });

        // Generate first month billing ledger
        const firstDueDate = new Date(election[0].coverageStartDate);
        const firstGraceEndDate = new Date(firstDueDate);
        firstGraceEndDate.setDate(firstGraceEndDate.getDate() + 45); // 45-day initial grace period

        await PremiumBillingLedger.create([{
            tenantId: req.tenantId, electionId: election[0]._id,
            coverageMonth: firstDueDate.getMonth() + 1, coverageYear: firstDueDate.getFullYear(),
            amountDue: premiumCalc.totalMonthlyPremium, dueDate: firstDueDate,
            gracePeriodEndDate: firstGraceEndDate, isFirstPayment: true, status: 'Unpaid'
        }], { session });

        event.status = 'Elected';
        await event.save({ session });

        await session.commitTransaction();
        res.status(201).json({ message: 'Election processed and first invoice generated', election: election[0] });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.recordPayment = async (req, res, next) => {
    try {
        const { ledgerId, amountPaid, paymentDate } = req.body;
        const ledger = await PremiumBillingLedger.findById(ledgerId);
        if (!ledger) return res.status(404).json({ message: 'Billing ledger not found' });

        const graceCheck = evaluateGracePeriod(ledger.dueDate, paymentDate, ledger.isFirstPayment);

        ledger.amountPaid += amountPaid;

        if (ledger.amountPaid >= ledger.amountDue) {
            ledger.status = 'Paid';
        } else if (!graceCheck.isWithinGracePeriod) {
            ledger.status = 'Defaulted';
            // Trigger coverage termination logic here
        } else {
            ledger.status = 'Grace Period';
        }

        await ledger.save();
        res.status(200).json({ message: 'Payment recorded', ledger, graceCheck });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const events = await COBRAQualifyingEvent.find({ tenantId: req.tenantId })
            .populate('employeeId', 'fullName').sort({ eventDate: -1 }).limit(50);

        const elections = await COBRAElection.find({ tenantId: req.tenantId, status: 'Active' })
            .populate({ path: 'eventId', populate: { path: 'employeeId', select: 'fullName' } });

        const unpaidLedgers = await PremiumBillingLedger.find({ tenantId: req.tenantId, status: { $in: ['Unpaid', 'Grace Period'] } })
            .populate({ path: 'electionId', populate: { path: 'eventId', populate: { path: 'employeeId', select: 'fullName' } } });

        // Calculate compliance metrics
        const overdueNotices = events.filter(e => e.isNoticeOverdue && e.status === 'Pending Notice').length;

        res.status(200).json({ events, elections, unpaidLedgers, overdueNotices });
    } catch (error) { next(error); }
};
