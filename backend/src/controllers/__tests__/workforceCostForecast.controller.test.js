/**
 * @fileoverview Tests for Workforce Cost Forecast Controller
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const Employee = require('../../models/employee.model');

const TENANT_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

function mockReq(body = {}) {
  return { tenantId: TENANT_ID, userId: USER_ID, params: {}, query: {}, body };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next = jest.fn();

async function createEmployee(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return Employee.create({
    fullName: `Emp ${id.toString().slice(-5)}`,
    email: `emp-${id.toString().slice(-8)}@test.com`,
    department: 'Engineering',
    monthlySalary: 50000,
    companyName: 'TestCorp',
    createdBy: USER_ID,
    tenantId: TENANT_ID,
    ...overrides,
  });
}

describe('Workforce Cost Forecast Controller', () => {
  beforeEach(async () => {
    await Employee.deleteMany({});
    jest.clearAllMocks();
  });

  // ─── getForecast ────────────────────────────────────────────────────────

  describe('getForecast', () => {
    it('should return empty forecast for no employees', async () => {
      const { getForecast } = require('../workforceCostForecast.controller');
      const req = mockReq({ months: 6 });
      const res = mockRes();

      await getForecast(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.projection).toHaveLength(0);
      expect(body.summary.headcount).toBe(0);
    });

    it('should project costs for 6 months', async () => {
      await createEmployee({ monthlySalary: 40000 });
      await createEmployee({ monthlySalary: 60000 });

      const { getForecast } = require('../workforceCostForecast.controller');
      const req = mockReq({ months: 6, monthlyHires: 1, annualAttritionRate: 10 });
      const res = mockRes();

      await getForecast(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.projection).toHaveLength(6);
      expect(body.summary.currentHeadcount).toBe(2);
      expect(body.summary.currentMonthlyPayroll).toBe(100000);
      expect(body.departmentBreakdown).toHaveLength(1);
      expect(body.assumptions.monthlyHires).toBe(1);
    });

    it('should apply uniform salary revision', async () => {
      await createEmployee({ monthlySalary: 100000 });

      const { getForecast } = require('../workforceCostForecast.controller');
      const req = mockReq({
        months: 3,
        salaryRevision: { type: 'uniform', uniformPercent: 10 },
      });
      const res = mockRes();

      await getForecast(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.departmentBreakdown[0].revisedMonthlyPayroll).toBe(110000);
      expect(body.departmentBreakdown[0].totalHikeCost).toBe(10000);
    });

    it('should apply department-wise revision', async () => {
      await createEmployee({ department: 'Engineering', monthlySalary: 80000 });
      await createEmployee({ department: 'Sales', monthlySalary: 50000 });

      const { getForecast } = require('../workforceCostForecast.controller');
      const req = mockReq({
        months: 3,
        salaryRevision: {
          type: 'departmentWise',
          departmentHikes: { Engineering: 15, Sales: 5 },
          defaultHike: 8,
        },
      });
      const res = mockRes();

      await getForecast(req, res, next);

      const body = res.json.mock.calls[0][0];
      const eng = body.departmentBreakdown.find((d) => d.department === 'Engineering');
      const sales = body.departmentBreakdown.find((d) => d.department === 'Sales');
      expect(eng.revisedMonthlyPayroll).toBe(92000); // 80000 * 1.15
      expect(sales.revisedMonthlyPayroll).toBe(52500); // 50000 * 1.05
    });

    it('should call next on error', async () => {
      const originalFind = Employee.find;
      Employee.find = jest.fn().mockRejectedValue(new Error('DB Error'));

      const { getForecast } = require('../workforceCostForecast.controller');
      await getForecast(mockReq(), mockRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      Employee.find = originalFind;
    });
  });

  // ─── compareScenarios ──────────────────────────────────────────────────

  describe('compareScenarios', () => {
    it('should return 400 when no scenarios provided', async () => {
      const { compareScenarios } = require('../workforceCostForecast.controller');
      const req = mockReq({ scenarios: [] });
      const res = mockRes();

      await compareScenarios(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'At least one scenario is required' });
    });

    it('should compare multiple scenarios', async () => {
      await createEmployee({ monthlySalary: 100000 });
      await createEmployee({ monthlySalary: 60000 });

      const { compareScenarios } = require('../workforceCostForecast.controller');
      const req = mockReq({
        scenarios: [
          { name: 'Conservative', type: 'uniform', uniformPercent: 5 },
          { name: 'Aggressive', type: 'uniform', uniformPercent: 15 },
        ],
        months: 12,
      });
      const res = mockRes();

      await compareScenarios(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.comparisons).toHaveLength(2);
      expect(body.baseline).toBeDefined();
      expect(body.baseline.monthlyPayroll).toBe(160000);

      // Aggressive should have higher cost
      const conservative = body.comparisons.find((c) => c.name === 'Conservative');
      const aggressive = body.comparisons.find((c) => c.name === 'Aggressive');
      expect(aggressive.projectedAnnualIncrement).toBeGreaterThan(conservative.projectedAnnualIncrement);
    });
  });

  // ─── getCostSummary ────────────────────────────────────────────────────

  describe('getCostSummary', () => {
    it('should return empty summary for no employees', async () => {
      const { getCostSummary } = require('../workforceCostForecast.controller');
      const req = mockReq();
      const res = mockRes();

      await getCostSummary(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.summary.headcount).toBe(0);
    });

    it('should compute cost summary with department breakdown', async () => {
      await createEmployee({ department: 'Engineering', monthlySalary: 80000 });
      await createEmployee({ department: 'Engineering', monthlySalary: 60000 });
      await createEmployee({ department: 'Sales', monthlySalary: 45000 });

      const { getCostSummary } = require('../workforceCostForecast.controller');
      const req = mockReq();
      const res = mockRes();

      await getCostSummary(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.summary.headcount).toBe(3);
      expect(body.summary.totalMonthlyPayroll).toBe(185000);
      expect(body.summary.avgSalary).toBeGreaterThan(0);
      expect(body.departmentCosts).toHaveLength(2);
      expect(body.departmentCosts[0].department).toBe('Engineering');
      expect(body.departmentCosts[0].headcount).toBe(2);
      expect(body.summary.statutory).toBeDefined();
    });
  });
});
