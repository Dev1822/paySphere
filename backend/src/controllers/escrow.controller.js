const {
  createPendingDeposit,
  approveDeposit,
  getReconciliationReport,
  reconcileIncomingWire,
} = require('../services/escrowReconciliation.service');

exports.deposit = async (req, res, next) => {
  try {
    const { amount, reference, notes } = req.body;
    const tenantId = req.tenantId;
    const makerId = req.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'A positive deposit amount is required' });
    }
    if (!reference) {
      return res.status(400).json({ error: 'Deposit reference is required' });
    }

    const transaction = await createPendingDeposit(tenantId, Number(amount), reference, makerId, notes);
    res.status(201).json({ message: 'Deposit recorded and pending checker approval', transaction });
  } catch (error) {
    next(error);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const checkerId = req.userId;

    const result = await approveDeposit(tenantId, id, checkerId);
    res.json({ message: 'Deposit transaction successfully approved', result });
  } catch (error) {
    next(error);
  }
};

exports.getReconciliation = async (req, res, next) => {
  try {
    const { payrollRunId } = req.params;
    const tenantId = req.tenantId;

    const report = await getReconciliationReport(tenantId, payrollRunId);
    res.json(report);
  } catch (error) {
    next(error);
  }
};

exports.handleWireWebhook = async (req, res, next) => {
  try {
    const { tenantId, amount, reference } = req.body;
    if (!tenantId || !amount || !reference) {
      return res.status(400).json({ error: 'tenantId, amount, and reference are required' });
    }

    const result = await reconcileIncomingWire(tenantId, Number(amount), reference, 'bank_webhook');
    res.json({ message: 'Webhook wire processed and reconciled', result });
  } catch (error) {
    next(error);
  }
};
