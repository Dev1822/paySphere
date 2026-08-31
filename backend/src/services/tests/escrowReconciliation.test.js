const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-global-4.4');
const {
  checkPayrollFunding,
  reconcileIncomingWire,
  createPendingDeposit,
  approveDeposit,
  getReconciliationReport,
} = require('../escrowReconciliation.service');
const { EscrowAccount, EscrowTransaction } = require('../../models/escrowAccount.model');
const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');
const eventBus = require('../event.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('escrowReconciliation.service', () => {
  let tenantId, userId;

  beforeEach(async () => {
    await EscrowAccount.deleteMany({});
    await EscrowTransaction.deleteMany({});
    await PayrollUpdate.deleteMany({});
    await Employee.deleteMany({});

    tenantId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
  });

  describe('checkPayrollFunding', () => {
    it('succeeds and updates balances when escrow balance is sufficient', async () => {
      // Setup escrow account with $5000
      await EscrowAccount.create({
        tenantId,
        balance: 5000,
        ledgerBalance: 5000,
        pendingReleases: 0,
      });

      const preparedItems = [
        {
          netSalary: 1000,
          baseSalary: 800,
          overtimePay: 100,
          bonus: 50,
        },
      ];

      // Total liability: net (1000) + PF (0.12 * 800 = 96) + ESI (0.0325 * 950 = 30.875) + Fee (0.05 * 1000 = 50) = 1176.875
      await checkPayrollFunding(tenantId, preparedItems);

      const escrow = await EscrowAccount.findOne({ tenantId });
      expect(escrow.balance).toBeLessThan(5000);
      expect(escrow.pendingReleases).toBeGreaterThan(0);

      const tx = await EscrowTransaction.findOne({ tenantId, type: 'PAYROLL_RELEASE' });
      expect(tx).toBeDefined();
      expect(tx.amount).toBeLessThan(0);
      expect(tx.status).toBe('APPROVED');
    });

    it('blocks payroll and triggers FUNDING_EXHAUSTED event when balance is insufficient', async () => {
      const auditLogSpy = jest.fn();
      eventBus.on('AUDIT_LOG', auditLogSpy);

      await EscrowAccount.create({
        tenantId,
        balance: 100, // Very low balance
        ledgerBalance: 100,
        pendingReleases: 0,
      });

      const preparedItems = [
        {
          netSalary: 1000,
          baseSalary: 800,
        },
      ];

      await expect(checkPayrollFunding(tenantId, preparedItems)).rejects.toThrow(
        'Payroll execution blocked: Insufficient escrow funding balance.'
      );

      expect(auditLogSpy).toHaveBeenCalledTimes(1);
      expect(auditLogSpy.mock.calls[0][0]).toMatchObject({
        action: 'FUNDING_EXHAUSTED',
        resourceType: 'EscrowAccount',
      });

      eventBus.off('AUDIT_LOG', auditLogSpy);
    });
  });

  describe('reconcileIncomingWire', () => {
    it('creates an approved deposit transaction and increments balances', async () => {
      const { escrow, transaction } = await reconcileIncomingWire(tenantId, 3000, 'REF-999', userId);

      expect(escrow.balance).toBe(3000);
      expect(escrow.ledgerBalance).toBe(3000);
      expect(transaction.status).toBe('APPROVED');
      expect(transaction.amount).toBe(3000);
    });
  });

  describe('maker-checker deposit flow', () => {
    it('creates a pending deposit and allows checker approval', async () => {
      // 1. Maker creates pending deposit
      const pendingTx = await createPendingDeposit(tenantId, 1500, 'REF-123', userId, 'Pending wire');
      expect(pendingTx.status).toBe('PENDING');
      expect(pendingTx.amount).toBe(1500);

      // Check balance remains 0
      let escrow = await EscrowAccount.findOne({ tenantId });
      expect(escrow).toBeNull();

      // 2. Checker approves
      const checkerId = new mongoose.Types.ObjectId();
      const { escrow: updatedEscrow, transaction: approvedTx } = await approveDeposit(
        tenantId,
        pendingTx._id,
        checkerId
      );

      expect(approvedTx.status).toBe('APPROVED');
      expect(approvedTx.checkerId).toEqual(checkerId);
      expect(updatedEscrow.balance).toBe(1500);
    });
  });

  describe('getReconciliationReport', () => {
    it('correctly aggregates liability and coverage details', async () => {
      const empId = new mongoose.Types.ObjectId();
      await Employee.create({
        _id: empId,
        tenantId,
        name: 'John Doe',
        createdBy: userId,
      });

      await PayrollUpdate.create({
        employeeId: empId,
        employeeName: 'John Doe',
        tenantId,
        month: 4,
        year: 2024,
        baseSalary: 1000,
        netSalary: 1200,
        overtimePay: 100,
        bonus: 50,
        createdBy: userId,
      });

      await EscrowAccount.create({
        tenantId,
        balance: 1000,
        ledgerBalance: 1000,
      });

      const report = await getReconciliationReport(tenantId, '2024-04');

      expect(report.year).toBe(2024);
      expect(report.month).toBe(4);
      expect(report.employeeCount).toBe(1);
      expect(report.totalNetSalary).toBe(1200);
      expect(report.totalLiability).toBeGreaterThan(1200);
      expect(report.coverageStatus).toBe('INSUFFICIENT');
      expect(report.deficit).toBeGreaterThan(0);
    });
  });
});
