/**
 * @fileoverview Tests for Talent Retention Analytics Controller
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
const SalaryHistory = require('../../models/salaryHistory.model');

const TENANT_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

function mockReq(overrides = {}) {
  return { tenantId: TENANT_ID, userId: USER_ID, params: {}, query: {}, ...overrides };
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
    joiningDate: new Date(Date.now() - 365 * 86400000),
    createdBy: USER_ID,
    tenantId: TENANT_ID,
    ...overrides,
  });
}

describe('Retention Analytics Controller', () => {
  beforeEach(async () => {
    await Employee.deleteMany({});
    await SalaryHistory.deleteMany({});
    jest.clearAllMocks();
  });

  // ─── Flight Risk ────────────────────────────────────────────────────────

  describe('getFlightRiskScores', () => {
    it('should return empty results for no employees', async () => {
      const { getFlightRiskScores } = require('../retentionAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getFlightRiskScores(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.employees).toHaveLength(0);
      expect(body.summary.total).toBe(0);
    });

    it('should compute flight risk scores for employees', async () => {
      await createEmployee({ fullName: 'Alice', department: 'Engineering', monthlySalary: 40000 });
      await createEmployee({ fullName: 'Bob', department: 'Engineering', monthlySalary: 80000 });
      await createEmployee({ fullName: 'Carol', department: 'Sales', monthlySalary: 30000 });

      const { getFlightRiskScores } = require('../retentionAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getFlightRiskScores(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.employees).toHaveLength(3);
      expect(body.departments).toHaveLength(2);

      // Verify each employee has a risk score
      for (const emp of body.employees) {
        expect(emp.flightRiskScore).toBeGreaterThanOrEqual(0);
        expect(emp.flightRiskScore).toBeLessThanOrEqual(100);
        expect(['Critical', 'High', 'Medium', 'Low']).toContain(emp.riskLevel);
        expect(emp.factors).toBeDefined();
      }

      // Summary should have counts
      expect(body.summary.total).toBe(3);
      expect(body.summary.criticalRisk + body.summary.highRisk + body.summary.mediumRisk + body.summary.lowRisk).toBe(3);
    });

    it('should call next on error', async () => {
      const originalFind = Employee.find;
      Employee.find = jest.fn().mockRejectedValue(new Error('DB Error'));

      const { getFlightRiskScores } = require('../retentionAnalytics.controller');
      await getFlightRiskScores(mockReq(), mockRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      Employee.find = originalFind;
    });
  });

  // ─── Attrition Trends ───────────────────────────────────────────────────

  describe('getAttritionTrends', () => {
    it('should return attrition trends', async () => {
      await createEmployee({ fullName: 'Active1' });
      await createEmployee({ fullName: 'Active2', isActive: false });

      const { getAttritionTrends } = require('../retentionAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getAttritionTrends(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.trend).toBeInstanceOf(Array);
      expect(body.trend).toHaveLength(12);
      expect(body.summary).toBeDefined();
      expect(typeof body.summary.overallAttritionRate).toBe('number');
    });
  });

  // ─── Compensation Benchmark ─────────────────────────────────────────────

  describe('getCompensationBenchmark', () => {
    it('should return empty results for no employees', async () => {
      const { getCompensationBenchmark } = require('../retentionAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getCompensationBenchmark(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.overall).toBeNull();
    });

    it('should compute compensation benchmark data', async () => {
      for (let i = 0; i < 5; i++) {
        await createEmployee({
          fullName: `Emp ${i}`,
          department: i < 3 ? 'Engineering' : 'Sales',
          monthlySalary: 30000 + i * 10000,
        });
      }

      const { getCompensationBenchmark } = require('../retentionAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getCompensationBenchmark(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.overall).toBeDefined();
      expect(body.overall.total).toBe(5);
      expect(body.overall.median).toBeGreaterThan(0);
      expect(body.overall.p10).toBeLessThanOrEqual(body.overall.p90);
      expect(body.departments).toHaveLength(2);
      expect(body.histogram).toBeInstanceOf(Array);
      expect(body.histogram.length).toBeGreaterThan(0);
    });
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────

  describe('getRetentionDashboard', () => {
    it('should return dashboard summary', async () => {
      await createEmployee({ fullName: 'E1', joiningDate: new Date(Date.now() - 730 * 86400000) });
      await createEmployee({ fullName: 'E2', joiningDate: new Date(Date.now() - 30 * 86400000) });

      const { getRetentionDashboard } = require('../retentionAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getRetentionDashboard(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.dashboard).toBeDefined();
      expect(body.dashboard.activeCount).toBe(2);
      expect(body.dashboard.retentionRate).toBeGreaterThanOrEqual(0);
      expect(body.dashboard.avgTenure).toBeGreaterThanOrEqual(0);
      expect(body.tenureDistribution).toBeInstanceOf(Array);
      expect(body.insights).toBeInstanceOf(Array);
    });
  });
});
