const { EscrowAccount, EscrowTransaction } = require('../models/escrowAccount.model');
const PayrollUpdate = require('../models/payroll.model');
const eventBus = require('./event.service');
const logger = require('../utils/logger');

function parsePayrollRunId(runId) {
  const match = /^(\d{4})-(\d{1,2})$/.exec(runId);
  if (match) {
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
  }
  return null;
}

/**
 * Pre-Flight Payroll Funding Check
 */
async function checkPayrollFunding(tenantId, preparedItems) {
  let totalNetSalary = 0;
  let totalEmployerPF = 0;
  let totalEmployerESI = 0;
  let totalServiceFees = 0;

  for (const item of preparedItems) {
    const net = item.netSalary || 0;
    const base = item.baseSalary || 0;
    const overtime = item.overtimePay || 0;
    const bonus = item.bonus || 0;

    totalNetSalary += net;
    totalEmployerPF += 0.12 * base;
    totalEmployerESI += 0.0325 * (base + overtime + bonus);
    totalServiceFees += 0.05 * net;
  }

  const totalLiability = totalNetSalary + totalEmployerPF + totalEmployerESI + totalServiceFees;

  const escrow = await EscrowAccount.findOne({ tenantId });
  if (!escrow || escrow.balance < totalLiability) {
    // Raise alert
    eventBus.emit('AUDIT_LOG', {
      userId: tenantId.toString(),
      action: 'FUNDING_EXHAUSTED',
      resourceType: 'EscrowAccount',
      details: {
        totalLiability: Math.round(totalLiability * 100) / 100,
        currentBalance: escrow ? escrow.balance : 0,
      },
    });

    const err = new Error('Payroll execution blocked: Insufficient escrow funding balance.');
    err.status = 400;
    throw err;
  }

  // Deduct from balance on success
  escrow.balance = Math.round((escrow.balance - totalLiability) * 100) / 100;
  escrow.pendingReleases = Math.round((escrow.pendingReleases + totalLiability) * 100) / 100;
  await escrow.save();

  // Record a transaction of type PAYROLL_RELEASE
  await EscrowTransaction.create({
    tenantId,
    amount: -totalLiability,
    type: 'PAYROLL_RELEASE',
    status: 'APPROVED',
    notes: `Payroll release for total liability of ${totalLiability}`,
    makerId: tenantId,
  });
}

/**
 * Reconcile incoming wire transfer deposit (mocked bank alerts)
 */
async function reconcileIncomingWire(tenantId, amount, reference, makerId) {
  let escrow = await EscrowAccount.findOne({ tenantId });
  if (!escrow) {
    escrow = new EscrowAccount({
      tenantId,
      balance: 0,
      ledgerBalance: 0,
      pendingReleases: 0,
    });
  }

  // Record transaction
  const transaction = await EscrowTransaction.create({
    tenantId,
    amount,
    type: 'DEPOSIT',
    status: 'APPROVED',
    reference,
    makerId,
    notes: 'Reconciled wire transfer deposit',
  });

  // Update balance
  escrow.balance = Math.round((escrow.balance + amount) * 100) / 100;
  escrow.ledgerBalance = Math.round((escrow.ledgerBalance + amount) * 100) / 100;
  await escrow.save();

  logger.info(`Reconciled wire deposit of ${amount} for tenant ${tenantId}`);

  return { escrow, transaction };
}

/**
 * Record bank wire receipt (requires checker approval)
 */
async function createPendingDeposit(tenantId, amount, reference, makerId, notes) {
  const transaction = await EscrowTransaction.create({
    tenantId,
    amount,
    type: 'DEPOSIT',
    status: 'PENDING',
    reference,
    makerId,
    notes,
  });
  return transaction;
}

/**
 * Approve pending bank wire receipt (checker role)
 */
async function approveDeposit(tenantId, transactionId, checkerId) {
  const transaction = await EscrowTransaction.findOne({ _id: transactionId, tenantId, status: 'PENDING' });
  if (!transaction) {
    throw new Error('Pending escrow deposit transaction not found');
  }

  transaction.status = 'APPROVED';
  transaction.checkerId = checkerId;
  await transaction.save();

  let escrow = await EscrowAccount.findOne({ tenantId });
  if (!escrow) {
    escrow = new EscrowAccount({
      tenantId,
      balance: 0,
      ledgerBalance: 0,
      pendingReleases: 0,
    });
  }

  escrow.balance = Math.round((escrow.balance + transaction.amount) * 100) / 100;
  escrow.ledgerBalance = Math.round((escrow.ledgerBalance + transaction.amount) * 100) / 100;
  await escrow.save();

  logger.info(`Checker ${checkerId} approved deposit transaction ${transactionId} of ${transaction.amount}`);

  return { escrow, transaction };
}

/**
 * Query funding coverage analysis report
 */
async function getReconciliationReport(tenantId, payrollRunId) {
  const period = parsePayrollRunId(payrollRunId);
  if (!period) {
    throw new Error('Invalid payrollRunId format. Expected YYYY-MM');
  }

  const { year, month } = period;

  // Fetch all payroll update records for this period
  const records = await PayrollUpdate.find({ tenantId, year, month }).lean();
  
  let totalNetSalary = 0;
  let totalEmployerPF = 0;
  let totalEmployerESI = 0;
  let totalServiceFees = 0;

  for (const record of records) {
    const net = record.netSalary || 0;
    const base = record.baseSalary || 0;
    const overtime = record.overtimePay || 0;
    const bonus = record.bonus || 0;

    totalNetSalary += net;
    totalEmployerPF += 0.12 * base;
    totalEmployerESI += 0.0325 * (base + overtime + bonus);
    totalServiceFees += 0.05 * net;
  }

  const totalLiability = totalNetSalary + totalEmployerPF + totalEmployerESI + totalServiceFees;

  const escrow = await EscrowAccount.findOne({ tenantId }).lean();
  const currentBalance = escrow ? escrow.balance : 0;
  const isSufficient = currentBalance >= totalLiability;

  return {
    payrollRunId,
    year,
    month,
    employeeCount: records.length,
    totalNetSalary: Math.round(totalNetSalary * 100) / 100,
    totalEmployerPF: Math.round(totalEmployerPF * 100) / 100,
    totalEmployerESI: Math.round(totalEmployerESI * 100) / 100,
    totalServiceFees: Math.round(totalServiceFees * 100) / 100,
    totalLiability: Math.round(totalLiability * 100) / 100,
    escrowBalance: currentBalance,
    coverageStatus: isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT',
    deficit: isSufficient ? 0 : Math.round((totalLiability - currentBalance) * 100) / 100,
  };
}

module.exports = {
  checkPayrollFunding,
  reconcileIncomingWire,
  createPendingDeposit,
  approveDeposit,
  getReconciliationReport,
  parsePayrollRunId,
};
