const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const CompanyPolicy = require('../models/policyAcknowledgment.model');
const { PolicyAcknowledgment } = require('../models/policyAcknowledgment.model');
const Employee = require('../models/employee.model');

jest.mock('../middlewares/auth.middleware', () => (req, res, next) => {
  req.userId = global.testUserId || '507f1f77bcf86cd799439011';
  req.tenantId = global.testTenantId || '507f1f77bcf86cd799439012';
  req.userRole = 'admin';
  next();
});

jest.mock('../middlewares/rbac.middleware', () => ({
  requireScope: () => (req, res, next) => next(),
}));

describe('Policy Acknowledgment Controller', () => {
  let testEmployee;

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/paysphere_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    testEmployee = await Employee.create({
      fullName: 'Policy Test Employee',
      role: 'Developer',
      department: 'Engineering',
      monthlySalary: 50000,
      companyName: 'Test Corp',
      createdBy: global.testUserId || '507f1f77bcf86cd799439011',
      tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
    });
  });

  afterAll(async () => {
    await CompanyPolicy.deleteMany({});
    await PolicyAcknowledgment.deleteMany({});
    await Employee.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await CompanyPolicy.deleteMany({});
    await PolicyAcknowledgment.deleteMany({});
  });

  describe('POST /api/policies/', () => {
    it('should create a new policy', async () => {
      const res = await request(app)
        .post('/api/policies/')
        .send({
          title: 'Data Security Policy',
          content: 'All employees must use strong passwords.',
          category: 'Data Security',
          isMandatory: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.policy.title).toBe('Data Security Policy');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/policies/')
        .send({ title: 'Incomplete Policy' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/policies/', () => {
    it('should list all policies', async () => {
      await CompanyPolicy.create({
        title: 'Leave Policy', content: 'Employees get 15 days leave.',
        category: 'Leave Policy', createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
      const res = await request(app).get('/api/policies/');
      expect(res.status).toBe(200);
      expect(res.body.policies).toHaveLength(1);
    });
  });

  describe('POST /api/policies/:policyId/acknowledge', () => {
    let policy;

    beforeEach(async () => {
      policy = await CompanyPolicy.create({
        title: 'Code of Conduct', content: 'Be professional.',
        category: 'Code of Conduct', createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
    });

    it('should acknowledge a policy', async () => {
      const res = await request(app)
        .post(`/api/policies/${policy._id}/acknowledge`);
      expect(res.status).toBe(201);
      expect(res.body.acknowledgment).toBeDefined();
    });

    it('should be idempotent for duplicate acknowledgment', async () => {
      await request(app).post(`/api/policies/${policy._id}/acknowledge`);
      const res = await request(app).post(`/api/policies/${policy._id}/acknowledge`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('already acknowledged');
    });

    it('should return 404 for non-existent policy', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).post(`/api/policies/${fakeId}/acknowledge`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/policies/my/policies', () => {
    it('should return policies with acknowledgment status', async () => {
      await CompanyPolicy.create({
        title: 'Remote Work Policy', content: 'WFH guidelines.',
        category: 'Remote Work', createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012', isMandatory: true,
      });
      const res = await request(app).get('/api/policies/my/policies');
      expect(res.status).toBe(200);
      expect(res.body.policies).toBeDefined();
      expect(res.body.summary).toBeDefined();
    });
  });

  describe('GET /api/policies/admin/compliance-report', () => {
    it('should return compliance report', async () => {
      await CompanyPolicy.create({
        title: 'Security', content: 'Rules.', category: 'Data Security',
        isMandatory: true, createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
      const res = await request(app).get('/api/policies/admin/compliance-report');
      expect(res.status).toBe(200);
      expect(res.body.report).toBeDefined();
      expect(typeof res.body.overallCompliance).toBe('number');
    });
  });
});
