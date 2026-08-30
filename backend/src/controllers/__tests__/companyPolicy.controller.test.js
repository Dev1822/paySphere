const mongoose = require('mongoose');
const CompanyPolicy = require('../../models/companyPolicy.model');
const PolicyAcknowledgment = require('../../models/policyAcknowledgment.model');
const Employee = require('../../models/employee.model');
const {
  createPolicy,
  getPolicies,
  getPolicyById,
  publishVersion,
  acknowledgePolicy,
  getPendingPolicies,
  getComplianceOverview,
} = require('../companyPolicy.controller');

jest.mock('../../models/companyPolicy.model');
jest.mock('../../models/policyAcknowledgment.model');
jest.mock('../../models/employee.model');
jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('CompanyPolicy Controller', () => {
  let req, res, next;
  const userId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  const policyId = new mongoose.Types.ObjectId().toString();
  const employeeId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      userId,
      tenantId,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      user: { role: { name: 'admin' } },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('createPolicy', () => {
    it('should return 400 if policyCode is missing', async () => {
      req.body = { title: 'Title', content: 'Content' };
      await createPolicy(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should create a draft policy with version 1', async () => {
      req.body = {
        policyCode: 'DATA-SEC',
        title: 'Data Security',
        content: 'Encrypted.',
      };
      CompanyPolicy.findOne.mockResolvedValue(null);
      CompanyPolicy.create.mockResolvedValue({
        _id: policyId,
        policyCode: 'DATA-SEC',
        status: 'draft',
      });
      await createPolicy(req, res, next);
      expect(CompanyPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          policyCode: 'DATA-SEC',
          status: 'draft',
          currentVersion: 1,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should normalise policyCode to uppercase with hyphens', async () => {
      req.body = { policyCode: 'data security', title: 'T', content: 'C' };
      CompanyPolicy.findOne.mockResolvedValue(null);
      CompanyPolicy.create.mockResolvedValue({ _id: policyId });
      await createPolicy(req, res, next);
      expect(CompanyPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({ policyCode: 'DATA-SECURITY' }),
      );
    });
  });

  describe('getPolicies', () => {
    it('should return policies for the tenant', async () => {
      CompanyPolicy.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({
            sort: jest.fn().mockResolvedValue([{ _id: policyId }]),
          }),
      });
      await getPolicies(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getPolicyById', () => {
    it('should return 404 if not found', async () => {
      req.params.id = policyId;
      CompanyPolicy.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await getPolicyById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
    it('should hide drafts from non-admin users', async () => {
      req.params.id = policyId;
      req.user = { role: { name: 'employee' } };
      CompanyPolicy.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({ status: 'draft' }),
      });
      await getPolicyById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('publishVersion', () => {
    it('should increment version and set status to active', async () => {
      req.params.id = policyId;
      req.body = {
        title: 'V2',
        content: 'Updated',
        changeNote: 'Compliance update',
      };
      const mock = {
        currentVersion: 1,
        versions: [{ versionNumber: 1 }],
        status: 'draft',
        save: jest.fn(),
      };
      CompanyPolicy.findOne.mockResolvedValue(mock);
      await publishVersion(req, res, next);
      expect(mock.currentVersion).toBe(2);
      expect(mock.status).toBe('active');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('acknowledgePolicy', () => {
    it('should create an acknowledgment successfully', async () => {
      req.params.id = policyId;
      CompanyPolicy.findOne.mockResolvedValue({
        _id: policyId,
        status: 'active',
        requiresAcknowledgment: true,
        isGlobal: true,
        currentVersion: 1,
        policyCode: 'HR-01',
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      PolicyAcknowledgment.findOne.mockResolvedValue(null);
      PolicyAcknowledgment.create.mockResolvedValue({ _id: 'ack1' });
      await acknowledgePolicy(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should return 409 if already acknowledged', async () => {
      req.params.id = policyId;
      CompanyPolicy.findOne.mockResolvedValue({
        _id: policyId,
        status: 'active',
        requiresAcknowledgment: true,
        isGlobal: true,
        currentVersion: 1,
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      PolicyAcknowledgment.findOne.mockResolvedValue({ policyVersion: 1 });
      await acknowledgePolicy(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('getPendingPolicies', () => {
    it('should return policies not yet acknowledged', async () => {
      Employee.findOne.mockResolvedValue({
        _id: employeeId,
        department: 'Eng',
      });
      CompanyPolicy.find.mockResolvedValue([
        {
          _id: policyId,
          policyCode: 'HR',
          category: 'general',
          currentVersion: 1,
          isGlobal: true,
          versions: [{ title: 'T', summary: 'S' }],
        },
      ]);
      PolicyAcknowledgment.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });
      await getPendingPolicies(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].policies).toHaveLength(1);
    });
  });

  describe('getComplianceOverview', () => {
    it('should return compliance stats for all active policies', async () => {
      CompanyPolicy.find.mockResolvedValue([
        {
          _id: policyId,
          policyCode: 'HR',
          category: 'general',
          currentVersion: 1,
        },
      ]);
      Employee.countDocuments.mockResolvedValue(50);
      PolicyAcknowledgment.countDocuments.mockResolvedValue(40);
      await getComplianceOverview(req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body.totalEmployees).toBe(50);
      expect(body.policies[0].acknowledgedCount).toBe(40);
    });
  });
});
