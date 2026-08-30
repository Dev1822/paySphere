const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-global-4.4');
const {
  runSandboxSimulation,
  getComparisonReport,
  commitSandboxSession,
  rollbackSandboxSession,
} = require('../sandboxEngine.service');
const { SandboxSession, SimulatedPayroll } = require('../../models/sandboxSession.model');
const SalaryStructure = require('../../models/salaryStructure.model');
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

describe('sandboxEngine.service', () => {
  let tenantId, employeeId, originalStructureId, sessionId, userId;

  beforeEach(async () => {
    await SandboxSession.deleteMany({});
    await SimulatedPayroll.deleteMany({});
    await SalaryStructure.deleteMany({});
    await Employee.deleteMany({});

    tenantId = new mongoose.Types.ObjectId();
    employeeId = new mongoose.Types.ObjectId();
    originalStructureId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();

    // Create target employee
    await Employee.create({
      _id: employeeId,
      tenantId,
      fullName: 'John Doe',
      department: 'Engineering',
      monthlySalary: 10000,
      createdBy: userId,
    });

    // Create original salary structure
    await SalaryStructure.create({
      _id: originalStructureId,
      tenantId,
      employeeId,
      effectiveFrom: new Date('2026-01-01'),
      grossMonthly: 10000,
      components: [
        { code: 'BASIC', label: 'Basic Salary', value: 5000 },
      ],
      createdBy: userId,
    });

    // Create sandbox session with draft components (+20% hike adjustment)
    const session = await SandboxSession.create({
      tenantId,
      name: 'Q3 Engineering Adjustment',
      targets: { departments: ['Engineering'], employeeIds: [] },
      draftComponents: [
        { code: 'G_HIKE', value: 20 },
      ],
      isActive: true,
      createdBy: userId,
    });
    sessionId = session._id;
  });

  describe('runSandboxSimulation', () => {
    it('clones employees, mock calculates outcomes, and saves simulated records', async () => {
      const records = await runSandboxSimulation(tenantId, sessionId);

      expect(records).toHaveLength(1);
      expect(records[0].originalGross).toBe(10000);
      // gross 10000 * 1.20 = 12000
      expect(records[0].simulatedGross).toBe(12000);
      expect(records[0].simulatedNet).toBeGreaterThan(0);
      expect(records[0].simulatedTax).toBe(1200);

      const cached = await SimulatedPayroll.find({ sandboxSessionId: sessionId });
      expect(cached).toHaveLength(1);
    });
  });

  describe('getComparisonReport', () => {
    it('groups results by department, calculates deltas, and returns report', async () => {
      // Run simulation first
      await runSandboxSimulation(tenantId, sessionId);

      const report = await getComparisonReport(tenantId, sessionId);

      expect(report).toHaveLength(1);
      expect(report[0].department).toBe('Engineering');
      expect(report[0].employeeCount).toBe(1);
      expect(report[0].originalGrossTotal).toBe(10000);
      expect(report[0].simulatedGrossTotal).toBe(12000);
      expect(report[0].grossDelta).toBe(2000);
    });
  });

  describe('commitSandboxSession', () => {
    it('applies simulated changes, saves original to journal, creates revisions, and logs audit', async () => {
      const auditLogSpy = jest.fn();
      eventBus.on('AUDIT_LOG', auditLogSpy);

      // Run simulation first
      await runSandboxSimulation(tenantId, sessionId);

      // Commit
      const committed = await commitSandboxSession(tenantId, sessionId, userId);

      expect(committed.isActive).toBe(false);
      expect(committed.transactionJournal).toHaveLength(1);
      expect(committed.transactionJournal[0].monthlySalary).toBe(10000);

      // Verify Employee Gross Monthly Salary was updated to 12000
      const emp = await Employee.findById(employeeId);
      expect(emp.monthlySalary).toBe(12000);

      // Verify a new SalaryStructure revision was created
      const structures = await SalaryStructure.find({ employeeId }).sort({ effectiveFrom: -1 });
      expect(structures).toHaveLength(2);
      expect(structures[0].grossMonthly).toBe(12000);
      expect(structures[0].note).toContain('Committed sandbox simulation');

      // Verify Audit Log Event
      expect(auditLogSpy).toHaveBeenCalledTimes(1);
      expect(auditLogSpy.mock.calls[0][0]).toMatchObject({
        action: 'SANDBOX_COMMITTED',
        resourceType: 'SandboxSession',
      });

      eventBus.off('AUDIT_LOG', auditLogSpy);
    });
  });

  describe('rollbackSandboxSession', () => {
    it('restores original employee monthly salary and salary structures from journal', async () => {
      // Run simulation and commit
      await runSandboxSimulation(tenantId, sessionId);
      await commitSandboxSession(tenantId, sessionId, userId);

      // Rollback
      const rolledBack = await rollbackSandboxSession(tenantId, sessionId);

      expect(rolledBack.isActive).toBe(false);
      expect(rolledBack.transactionJournal).toHaveLength(0);

      // Verify Employee Gross Monthly Salary was restored to 10000
      const emp = await Employee.findById(employeeId);
      expect(emp.monthlySalary).toBe(10000);

      // Verify committed revision was deleted, leaving only original structure
      const structures = await SalaryStructure.find({ employeeId });
      expect(structures).toHaveLength(1);
      expect(structures[0].grossMonthly).toBe(10000);
    });
  });
});
