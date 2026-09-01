const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-global-4.4');
const { calculateRetroactiveArrears, injectApprovedArrears } = require('../retroCalculator.service');
const RetroactiveAdjustment = require('../../models/retroactiveAdjustment.model');
const SalaryStructure = require('../../models/salaryStructure.model');
const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');

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

describe('retroCalculator.service', () => {
  let tenantId, employeeId, originalStructureId, newStructureId, userId;

  beforeEach(async () => {
    await RetroactiveAdjustment.deleteMany({});
    await SalaryStructure.deleteMany({});
    await PayrollUpdate.deleteMany({});
    await Employee.deleteMany({});

    tenantId = new mongoose.Types.ObjectId();
    employeeId = new mongoose.Types.ObjectId();
    originalStructureId = new mongoose.Types.ObjectId();
    newStructureId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();

    await Employee.create({
      _id: employeeId,
      tenantId,
      name: 'John Doe',
      createdBy: userId,
    });

    // Create a new SalaryStructure revision with grossMonthly = 25000 (BASIC = 12500)
    await SalaryStructure.create({
      _id: newStructureId,
      tenantId,
      employeeId,
      effectiveFrom: new Date('2026-04-01'),
      grossMonthly: 25000,
      components: [
        { code: 'BASIC', label: 'Basic Salary', value: 12500 },
      ],
      createdBy: userId,
    });
  });

  describe('calculateRetroactiveArrears', () => {
    it('correctly calculates monthly deltas for gross, PF, ESI, and Professional Tax', async () => {
      // 1. Create a finalized/paid payroll update for 2026-04 with baseSalary = 8000 (BASIC = 8000, gross = 8000)
      // Original PF = 12% of 8000 = 960
      // Original ESI = 1.75% of 8000 = 140
      // Original PT = 0 (gross <= 15000)
      // New Gross = 25000, New BASIC = 12500
      // New PF = 12% of 12500 = 1500 -> PF delta = 540
      // New ESI = 0 (new gross 25000 > 21000 ESI ceiling) -> ESI delta = -140 (clamped to 0)
      // New PT = 200 (new gross > 15000) -> PT delta = 200
      // Gross delta = 25000 - 8000 = 17000
      // Net delta = 17000 - 540 (PF) - 0 (ESI) - 200 (PT) = 16260
      await PayrollUpdate.create({
        employeeId,
        employeeName: 'John Doe',
        tenantId,
        month: 4,
        year: 2026,
        baseSalary: 8000,
        netSalary: 6900,
        status: 'PAID',
        createdBy: userId,
      });

      // Target current date mocked in service is 2026-08 (runs up to 2026-07).
      // Let's run calculation from 2026-04-01.
      const result = await calculateRetroactiveArrears(tenantId, employeeId, '2026-04-01', newStructureId);

      expect(result.calculatedArrears).toHaveLength(1);
      const aprilArrear = result.calculatedArrears[0];
      expect(aprilArrear.year).toBe(2026);
      expect(aprilArrear.month).toBe(4);
      expect(aprilArrear.grossDelta).toBe(17000);
      expect(aprilArrear.pfDelta).toBe(540);
      expect(aprilArrear.ptDelta).toBe(200);
      expect(aprilArrear.netDelta).toBe(16260);

      expect(result.totalArrears).toBe(16260);
      // Total tax liability is 10% of totalArrears
      expect(result.totalTaxLiability).toBe(1626);
    });
  });

  describe('injectApprovedArrears (Arrears Injector)', () => {
    it('retrieves approved adjustments, updates status to PROCESSED, and returns totals', async () => {
      // Create approved adjustment
      await RetroactiveAdjustment.create({
        tenantId,
        employeeId,
        effectiveDate: new Date('2026-04-01'),
        originalStructureId: originalStructureId,
        newStructureId,
        status: 'APPROVED',
        totalArrears: 5000,
        totalTaxLiability: 500,
        createdBy: userId,
      });

      const inputNet = 10000;
      const inputDeductions = 1000;

      const result = await injectApprovedArrears(tenantId, employeeId, inputNet, inputDeductions);

      expect(result.netSalary).toBe(15000);
      expect(result.deductions).toBe(1500);
      expect(result.arrearsAmount).toBe(5000);
      expect(result.taxAddition).toBe(500);

      // Verify status updated to PROCESSED
      const updated = await RetroactiveAdjustment.findOne({ employeeId, tenantId });
      expect(updated.status).toBe('PROCESSED');
    });
  });
});
