/**
 * @fileoverview Document Request Controller Unit Tests
 */

const docRequestController = require('../docRequest.controller');
const docRequestService = require('../../services/docRequest.service');
const Employee = require('../../models/employee.model');

jest.mock('../../services/docRequest.service');
jest.mock('../../models/employee.model');

describe('Document Request Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'tenant123',
      userId: 'user123',
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // ─── Template Endpoints ────────────────────────────────────────────

  describe('createTemplate', () => {
    it('should create a template with valid data', async () => {
      req.body = {
        code: 'EXP',
        name: 'Experience Letter',
        category: 'Employment',
      };
      const mockTemplate = { _id: 't1', code: 'EXP', name: 'Experience Letter' };
      docRequestService.createTemplate.mockResolvedValue(mockTemplate);

      await docRequestController.createTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Template created',
        template: mockTemplate,
      });
    });

    it('should return 400 when code is missing', async () => {
      req.body = { name: 'Experience Letter' };

      await docRequestController.createTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when name is missing', async () => {
      req.body = { code: 'EXP' };

      await docRequestController.createTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getTemplates', () => {
    it('should return all active templates', async () => {
      const mockTemplates = [{ _id: 't1', name: 'Experience Letter' }];
      docRequestService.getTemplates.mockResolvedValue(mockTemplates);

      await docRequestController.getTemplates(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ templates: mockTemplates });
    });

    it('should filter by category', async () => {
      docRequestService.getTemplates.mockResolvedValue([]);
      req.query.category = 'Tax';

      await docRequestController.getTemplates(req, res, next);

      expect(docRequestService.getTemplates).toHaveBeenCalledWith(
        'tenant123',
        'Tax',
        false,
      );
    });
  });

  // ─── Request Submission ────────────────────────────────────────────

  describe('submitRequest', () => {
    it('should submit a document request', async () => {
      req.body = { templateId: 't1', fieldValues: { purpose: 'Bank loan' } };
      const mockEmployee = { _id: 'emp1' };
      Employee.findOne.mockResolvedValue(mockEmployee);
      const mockRequest = { _id: 'r1', requestNumber: 'DOC-202608-0001' };
      docRequestService.submitRequest.mockResolvedValue(mockRequest);

      await docRequestController.submitRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Document request submitted',
          requestNumber: 'DOC-202608-0001',
        }),
      );
    });

    it('should return 400 when templateId is missing', async () => {
      req.body = {};

      await docRequestController.submitRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when employee is not found', async () => {
      req.body = { templateId: 't1' };
      Employee.findOne.mockResolvedValue(null);

      await docRequestController.submitRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyRequests', () => {
    it('should return employee requests', async () => {
      const mockEmployee = { _id: 'emp1' };
      Employee.findOne.mockResolvedValue(mockEmployee);
      docRequestService.getEmployeeRequests.mockResolvedValue([{ _id: 'r1' }]);

      await docRequestController.getMyRequests(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── Approval Workflow ─────────────────────────────────────────────

  describe('approveByManager', () => {
    it('should approve a request', async () => {
      req.params = { requestId: 'r1' };
      docRequestService.approveByManager.mockResolvedValue({
        _id: 'r1',
        status: 'ManagerApproved',
      });

      await docRequestController.approveByManager(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rejectByManager', () => {
    it('should reject with reason', async () => {
      req.params = { requestId: 'r1' };
      req.body = { reason: 'Insufficient documentation' };
      docRequestService.rejectByManager.mockResolvedValue({
        _id: 'r1',
        status: 'ManagerRejected',
      });

      await docRequestController.rejectByManager(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 without reason', async () => {
      req.params = { requestId: 'r1' };
      req.body = {};

      await docRequestController.rejectByManager(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('approveByHR', () => {
    it('should approve by HR', async () => {
      req.params = { requestId: 'r1' };
      docRequestService.approveByHR.mockResolvedValue({
        _id: 'r1',
        status: 'HRApproved',
      });

      await docRequestController.approveByHR(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rejectByHR', () => {
    it('should reject with reason', async () => {
      req.params = { requestId: 'r1' };
      req.body = { reason: 'Cannot provide this document' };
      docRequestService.rejectByHR.mockResolvedValue({
        _id: 'r1',
        status: 'HRRejected',
      });

      await docRequestController.rejectByHR(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 without reason', async () => {
      req.params = { requestId: 'r1' };
      req.body = {};

      await docRequestController.rejectByHR(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('cancelRequest', () => {
    it('should cancel a request', async () => {
      req.params = { requestId: 'r1' };
      req.body = { reason: 'No longer needed' };
      docRequestService.cancelRequest.mockResolvedValue({
        _id: 'r1',
        status: 'Cancelled',
      });

      await docRequestController.cancelRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── E-Signature ──────────────────────────────────────────────────

  describe('signDocument', () => {
    it('should sign a document', async () => {
      req.params = { requestId: 'r1' };
      req.body = { signatureRef: 'sig-abc123' };
      docRequestService.signDocument.mockResolvedValue({
        status: 'Signed',
        signedAt: new Date(),
      });

      await docRequestController.signDocument(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getSignatureLogs', () => {
    it('should return signature logs', async () => {
      req.params = { requestId: 'r1' };
      docRequestService.getSignatureLogs.mockResolvedValue([
        { status: 'Signed' },
      ]);

      await docRequestController.getSignatureLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── Delivery ─────────────────────────────────────────────────────

  describe('initiateDelivery', () => {
    it('should initiate delivery', async () => {
      req.params = { requestId: 'r1' };
      req.body = { method: 'Email', emailTo: 'emp@test.com' };
      docRequestService.createDeliveryLog.mockResolvedValue({ _id: 'd1' });
      docRequestService.transitionStatus.mockResolvedValue({});

      await docRequestController.initiateDelivery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 without method', async () => {
      req.params = { requestId: 'r1' };
      req.body = {};

      await docRequestController.initiateDelivery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── SLA ──────────────────────────────────────────────────────────

  describe('checkSLA', () => {
    it('should return SLA status', async () => {
      req.params = { requestId: 'r1' };
      docRequestService.checkSLAStatus.mockResolvedValue({
        slaStatus: 'OnTrack',
        daysRemaining: 3,
      });

      await docRequestController.checkSLA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getEscalatedRequests', () => {
    it('should return escalated requests', async () => {
      docRequestService.getEscalatedRequests.mockResolvedValue([
        { _id: 'r1', daysOverdue: 3 },
      ]);

      await docRequestController.getEscalatedRequests(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1 }),
      );
    });
  });

  // ─── Reports ──────────────────────────────────────────────────────

  describe('getDashboardStats', () => {
    it('should return dashboard stats', async () => {
      docRequestService.generateDashboardStats.mockResolvedValue({
        total: 42,
        onTimeRate: 88.5,
      });

      await docRequestController.getDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ stats: expect.any(Object) }),
      );
    });
  });
});
