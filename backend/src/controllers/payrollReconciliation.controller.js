'use strict';
const PayrollReconciliation = require('../models/payrollReconciliation.model');
const Anomaly = require('../models/anomaly.model');
const logger = require('../utils/logger');

async function reconcileAnomaly(req, res) {
  try {
    const { payrollId, anomalyType, justification } = req.body;
    if (!payrollId || !anomalyType || !justification) {
      return res.status(400).json({ message: 'payrollId, anomalyType, and justification are required.' });
    }

    if (justification.length < 20) {
      return res.status(400).json({ message: 'Justification must be at least 20 characters long.' });
    }

    const reconciliation = await PayrollReconciliation.create({
      payrollId,
      anomalyType,
      reconciledBy: req.userId,
      justification,
      status: 'reconciled'
    });

    await Anomaly.updateMany(
      { payrollRunId: payrollId },
      { $set: { resolved: true } }
    );

    return res.status(201).json({ message: 'Anomaly reconciled successfully.', reconciliation });
  } catch (err) {
    logger.error('reconcileAnomaly error', { error: err.message });
    return res.status(500).json({ message: 'Failed to reconcile anomaly.' });
  }
}

async function getReconciliations(req, res) {
  try {
    const { payrollId } = req.query;
    const filter = {};
    if (payrollId) filter.payrollId = payrollId;

    const reconciliations = await PayrollReconciliation.find(filter)
      .populate('reconciledBy', 'fullName email')
      .sort('-createdAt')
      .lean();

    return res.json({ reconciliations });
  } catch (err) {
    logger.error('getReconciliations error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch reconciliations.' });
  }
}

module.exports = { reconcileAnomaly, getReconciliations };