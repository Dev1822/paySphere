/**
 * @fileoverview Comp-Off Controller Unit Tests
 */

const compOffController = require('../compOff.controller');
const compOffService = require('../../services/compOff.service');
const Employee = require('../../models/employee.model');

jest.mock('../../services/compOff.service');
jest.mock('../../models/employee.model');

describe('Comp-Off Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant123',
      userId: 'user123',
      userRole: 'Admin',
      accountType: 'owner',
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // ─── Policy Endpoints ──────────────────────────────────────────────

  describe('createPolicy', () => {
    it('should create a policy with valid data', async () => {
      req.body = {
        name: 'Standard Comp-Off',
        accrualRules: [{ workType: 'weekend', hoursPerDay: 8 }],
      };
      const mockPolicy = { _id: 'policy1', name: 'Standard Comp-Off' };
      compOffService.createPolicy.mockResolvedValue(mockPolicy);

      await compOffController.createPolicy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Policy created',
        policy: mockPolicy,
      });
    });

    it('should return 400 when name is missing', async () => {
      req.body = { accrualRules: [{ workType: 'weekend', hoursPerDay: 8 }] };

      await compOffController.createPolicy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when accrualRules is empty', async () => {
      req.body = { name: 'Test', accrualRules: [] };

      await compOffController.createPolicy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPolicies', () => {
    it('should return all active policies', async () => {
      const mockPolicies = [{ _id: 'p1', name: 'Policy 1' }];
      compOffService.getPolicies.mockResolvedValue(mockPolicies);

      await compOffController.getPolicies(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ policies: mockPolicies });
    });
  });

  describe('updatePolicy', () => {
    it('should update a policy', async () => {
      req.params = { policyId: 'policy1' };
      req.body = { name: 'Updated Policy' };
      const mockPolicy = { _id: 'policy1', name: 'Updated Policy' };
      compOffService.updatePolicy.mockResolvedValue(mockPolicy);

      await compOffController.updatePolicy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deactivatePolicy', () => {
    it('should deactivate a policy', async () => {
      req.params = { policyId: 'policy1' };
      compOffService.deactivatePolicy.mockResolvedValue({});

      await compOffController.deactivatePolicy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Policy deactivated' });
    });
  });

  // ─── Request Endpoints ─────────────────────────────────────────────

  describe('submitRequest', () => {
    it('should submit a comp-off request', async () => {
      req.body = {
        policyId: 'policy1',
        workDate: '2026-08-20',
        compOffDate: '2026-09-01',
        workType: 'weekend',
        hoursWorked: 8,
        reason: 'Worked on Saturday',
      };
      const mockEmployee = { _id: 'emp1' };
      Employee.findOne.mockResolvedValue(mockEmployee);
      const mockRequest = { _id: 'req1', status: 'pending' };
      compOffService.submitRequest.mockResolvedValue(mockRequest);

      await compOffController.submitRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Comp-off request submitted',
        request: mockRequest,
      });
    });

    it('should return 400 when required fields are missing', async () => {
      req.body = { policyId: 'policy1' };

      await compOffController.submitRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when employee profile is not found', async () => {
      req.body = {
        policyId: 'policy1',
        workDate: '2026-08-20',
        compOffDate: '2026-09-01',
        workType: 'weekend',
        reason: 'Worked on Saturday',
      };
      Employee.findOne.mockResolvedValue(null);

      await compOffController.submitRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyRequests', () => {
    it('should return employee requests', async () => {
      const mockEmployee = { _id: 'emp1' };
      Employee.findOne.mockResolvedValue(mockEmployee);
      const mockRequests = [{ _id: 'r1' }];
      compOffService.getEmployeeRequests.mockResolvedValue(mockRequests);

      await compOffController.getMyRequests(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ requests: mockRequests });
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals', async () => {
      const mockRequests = [{ _id: 'r1', status: 'pending' }];
      compOffService.getPendingApprovals.mockResolvedValue(mockRequests);

      await compOffController.getPendingApprovals(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ requests: mockRequests });
    });
  });

  describe('approveRequest', () => {
    it('should approve a request', async () => {
      req.params = { requestId: 'req1' };
      req.body = { note: 'Looks good' };
      const mockRequest = { _id: 'req1', status: 'approved' };
      compOffService.approveRequest.mockResolvedValue(mockRequest);

      await compOffController.approveRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rejectRequest', () => {
    it('should reject a request with reason', async () => {
      req.params = { requestId: 'req1' };
      req.body = { reason: 'Insufficient documentation' };
      const mockRequest = { _id: 'req1', status: 'rejected' };
      compOffService.rejectRequest.mockResolvedValue(mockRequest);

      await compOffController.rejectRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when rejection reason is missing', async () => {
      req.params = { requestId: 'req1' };
      req.body = {};

      await compOffController.rejectRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('cancelRequest', () => {
    it('should cancel a request', async () => {
      req.params = { requestId: 'req1' };
      req.body = { reason: 'Changed my mind' };
      const mockRequest = { _id: 'req1', status: 'cancelled' };
      compOffService.cancelRequest.mockResolvedValue(mockRequest);

      await compOffController.cancelRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── Balance & Ledger ──────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return the employee balance', async () => {
      const mockEmployee = { _id: 'emp1' };
      Employee.findOne.mockResolvedValue(mockEmployee);
      const mockBalance = { availableBalance: 5 };
      compOffService.getBalance.mockResolvedValue(mockBalance);

      await compOffController.getBalance(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ balance: mockBalance });
    });
  });

  describe('getLedger', () => {
    it('should return the employee ledger', async () => {
      const mockEmployee = { _id: 'emp1' };
      Employee.findOne.mockResolvedValue(mockEmployee);
      const mockLedger = [{ type: 'accrual', days: 1 }];
      compOffService.getLedger.mockResolvedValue(mockLedger);

      await compOffController.getLedger(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ledger: mockLedger });
    });
  });

  // ─── Admin / System ────────────────────────────────────────────────

  describe('processExpiries', () => {
    it('should process expiries', async () => {
      const mockResult = { processedCount: 2, balanceAdjusted: 1 };
      compOffService.processExpiries.mockResolvedValue(mockResult);

      await compOffController.processExpiries(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Expiry processing complete',
        result: mockResult,
      });
    });
  });

  describe('getSummaryReport', () => {
    it('should return a summary report', async () => {
      const mockReport = { year: 2026, totalEmployees: 10 };
      compOffService.generateSummaryReport.mockResolvedValue(mockReport);

      await compOffController.getSummaryReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ report: mockReport });
    });
  });
});
