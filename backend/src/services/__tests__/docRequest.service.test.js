/**
 * @fileoverview Document Request Service Unit Tests
 */

const docRequestService = require('../docRequest.service');
const {
  DocumentTemplate,
  DocumentRequest,
  ESignatureLog,
  DocumentDeliveryLog,
} = require('../../models/docRequest.model');
const Employee = require('../../models/employee.model');

jest.mock('../../models/docRequest.model');
jest.mock('../../models/employee.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Document Request Service', () => {
  const tenantId = 'tenant123';
  const employeeId = 'emp123';
  const userId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Template Management ───────────────────────────────────────────

  describe('createTemplate', () => {
    it('should create a template', async () => {
      const data = {
        code: 'EXP',
        name: 'Experience Letter',
        category: 'Employment',
      };
      DocumentTemplate.create.mockResolvedValue({ _id: 't1', ...data });

      const template = await docRequestService.createTemplate(tenantId, data, userId);

      expect(DocumentTemplate.create).toHaveBeenCalled();
      expect(template._id).toBe('t1');
    });
  });

  describe('getTemplates', () => {
    it('should return active templates by default', async () => {
      DocumentTemplate.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 't1' }]),
      });

      const templates = await docRequestService.getTemplates(tenantId);

      expect(DocumentTemplate.find).toHaveBeenCalledWith({
        tenantId,
        isActive: true,
      });
    });

    it('should filter by category', async () => {
      DocumentTemplate.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      await docRequestService.getTemplates(tenantId, 'Tax');

      expect(DocumentTemplate.find).toHaveBeenCalledWith({
        tenantId,
        isActive: true,
        category: 'Tax',
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      DocumentTemplate.findOneAndUpdate.mockResolvedValue({
        _id: 't1',
        name: 'Updated',
      });

      const template = await docRequestService.updateTemplate(
        't1',
        tenantId,
        { name: 'Updated' },
      );

      expect(template.name).toBe('Updated');
    });

    it('should throw 404 when not found', async () => {
      DocumentTemplate.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        docRequestService.updateTemplate('t1', tenantId, { name: 'X' }),
      ).rejects.toThrow('not found');
    });
  });

  // ─── Request Submission ────────────────────────────────────────────

  describe('submitRequest', () => {
    it('should submit a request with valid template', async () => {
      const mockTemplate = {
        _id: 't1',
        name: 'Experience Letter',
        requiredFields: [],
        minEmploymentMonths: 0,
        standardTATDays: 3,
        requiresManagerApproval: true,
        requiresHRApproval: true,
        requiresSignature: false,
      };
      DocumentTemplate.findOne.mockResolvedValue(mockTemplate);
      DocumentRequest.countDocuments.mockResolvedValue(10);
      DocumentRequest.create.mockResolvedValue({
        _id: 'r1',
        requestNumber: 'DOC-202608-0011',
        status: 'ManagerReview',
        statusHistory: [],
        save: jest.fn(),
      });
      const mockEmployee = {
        _id: employeeId,
        reportingTo: 'mgr1',
        fullName: 'John Doe',
      };
      Employee.findById.mockResolvedValue(mockEmployee);

      const request = await docRequestService.submitRequest(tenantId, employeeId, {
        templateId: 't1',
        fieldValues: { purpose: 'Bank loan' },
        notes: 'Urgent',
        urgency: 'Urgent',
      });

      expect(DocumentRequest.create).toHaveBeenCalled();
      expect(request.requestNumber).toBe('DOC-202608-0011');
    });

    it('should throw 404 when template not found', async () => {
      DocumentTemplate.findOne.mockResolvedValue(null);

      await expect(
        docRequestService.submitRequest(tenantId, employeeId, {
          templateId: 'nonexistent',
        }),
      ).rejects.toThrow('not found');
    });

    it('should throw 400 when required fields validation fails', async () => {
      const mockTemplate = {
        _id: 't1',
        requiredFields: [
          { fieldName: 'purpose', fieldLabel: 'Purpose', fieldType: 'text', isOptional: false },
        ],
        minEmploymentMonths: 0,
        standardTATDays: 3,
        requiresManagerApproval: false,
        requiresHRApproval: false,
      };
      DocumentTemplate.findOne.mockResolvedValue(mockTemplate);

      await expect(
        docRequestService.submitRequest(tenantId, employeeId, {
          templateId: 't1',
          fieldValues: {},
        }),
      ).rejects.toThrow('Validation errors');
    });
  });

  // ─── Status Transitions ────────────────────────────────────────────

  describe('transitionStatus', () => {
    it('should transition to valid status', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'ManagerReview',
        statusHistory: [],
        save: jest.fn(),
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      const result = await docRequestService.transitionStatus(
        'r1',
        tenantId,
        'ManagerApproved',
        userId,
        'Looks good',
      );

      expect(result.status).toBe('ManagerApproved');
      expect(result.managerComment).toBe('Looks good');
      expect(result.managerActionAt).toBeDefined();
      expect(result.save).toHaveBeenCalled();
    });

    it('should throw for invalid transition', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'Draft',
        statusHistory: [],
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      await expect(
        docRequestService.transitionStatus(
          'r1',
          tenantId,
          'Delivered',
          userId,
        ),
      ).rejects.toThrow('Cannot transition');
    });

    it('should set cancelled fields', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'Submitted',
        statusHistory: [],
        save: jest.fn(),
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      const result = await docRequestService.transitionStatus(
        'r1',
        tenantId,
        'Cancelled',
        userId,
        'No longer needed',
      );

      expect(result.cancelReason).toBe('No longer needed');
      expect(result.cancelledBy).toBe(userId);
    });

    it('should set delivered fields', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'Signed',
        statusHistory: [],
        save: jest.fn(),
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      const result = await docRequestService.transitionStatus(
        'r1',
        tenantId,
        'Delivered',
        userId,
      );

      expect(result.actualDeliveryDate).toBeDefined();
    });
  });

  describe('approveByManager', () => {
    it('should approve request', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'ManagerReview',
        statusHistory: [],
        save: jest.fn(),
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      const result = await docRequestService.approveByManager(
        'r1',
        tenantId,
        userId,
        'Approved',
      );

      expect(result.status).toBe('ManagerApproved');
    });
  });

  describe('rejectByManager', () => {
    it('should reject with reason', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'ManagerReview',
        statusHistory: [],
        save: jest.fn(),
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      const result = await docRequestService.rejectByManager(
        'r1',
        tenantId,
        userId,
        'Missing documents',
      );

      expect(result.status).toBe('ManagerRejected');
    });

    it('should throw without reason', async () => {
      await expect(
        docRequestService.rejectByManager('r1', tenantId, userId, ''),
      ).rejects.toThrow('required');
    });
  });

  describe('approveByHR', () => {
    it('should approve request', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'HRReview',
        statusHistory: [],
        save: jest.fn(),
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      const result = await docRequestService.approveByHR('r1', tenantId, userId, 'OK');

      expect(result.status).toBe('HRApproved');
    });
  });

  describe('cancelRequest', () => {
    it('should cancel with reason', async () => {
      const mockRequest = {
        _id: 'r1',
        status: 'Submitted',
        statusHistory: [],
        save: jest.fn(),
      };
      DocumentRequest.findOne.mockResolvedValue(mockRequest);

      const result = await docRequestService.cancelRequest(
        'r1',
        tenantId,
        userId,
        'Changed mind',
      );

      expect(result.status).toBe('Cancelled');
    });

    it('should throw without reason', async () => {
      await expect(
        docRequestService.cancelRequest('r1', tenantId, userId, ''),
      ).rejects.toThrow('required');
    });
  });

  // ─── E-Signature ──────────────────────────────────────────────────

  describe('signDocument', () => {
    it('should sign when pending signature exists', async () => {
      const mockLog = {
        _id: 's1',
        status: 'Pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        save: jest.fn(),
        signerRole: 'Employee',
      };
      ESignatureLog.findOne.mockResolvedValue(mockLog);
      ESignatureLog.countDocuments.mockResolvedValue(0);

      // Mock transitionStatus
      DocumentRequest.findOne.mockResolvedValue({
        _id: 'r1',
        status: 'ReadyForSignature',
        statusHistory: [],
        save: jest.fn(),
      });

      const result = await docRequestService.signDocument('r1', tenantId, userId, {
        signatureRef: 'sig-123',
        ipAddress: '127.0.0.1',
      });

      expect(result.status).toBe('Signed');
      expect(result.signedAt).toBeDefined();
    });

    it('should throw when no pending signature found', async () => {
      ESignatureLog.findOne.mockResolvedValue(null);

      await expect(
        docRequestService.signDocument('r1', tenantId, userId, {}),
      ).rejects.toThrow('No pending signature');
    });

    it('should throw when signing link expired', async () => {
      const mockLog = {
        _id: 's1',
        status: 'Pending',
        expiresAt: new Date(Date.now() - 1000),
        save: jest.fn(),
      };
      ESignatureLog.findOne.mockResolvedValue(mockLog);

      await expect(
        docRequestService.signDocument('r1', tenantId, userId, {}),
      ).rejects.toThrow('expired');
    });
  });

  describe('declineSignature', () => {
    it('should decline signature', async () => {
      const mockLog = {
        _id: 's1',
        status: 'Pending',
        save: jest.fn(),
      };
      ESignatureLog.findOne.mockResolvedValue(mockLog);

      const result = await docRequestService.declineSignature(
        'r1',
        userId,
        'Cannot sign at this time',
      );

      expect(result.status).toBe('Declined');
      expect(result.declineReason).toBe('Cannot sign at this time');
    });
  });

  // ─── Delivery ─────────────────────────────────────────────────────

  describe('createDeliveryLog', () => {
    it('should create a delivery log', async () => {
      DocumentDeliveryLog.create.mockResolvedValue({ _id: 'd1', method: 'Email' });

      const log = await docRequestService.createDeliveryLog(
        'r1',
        tenantId,
        'Email',
        { emailTo: 'emp@test.com' },
      );

      expect(DocumentDeliveryLog.create).toHaveBeenCalled();
      expect(log.method).toBe('Email');
    });
  });

  describe('markDeliverySent', () => {
    it('should mark as sent', async () => {
      const mockLog = { _id: 'd1', attempts: 0, save: jest.fn() };
      DocumentDeliveryLog.findById.mockResolvedValue(mockLog);

      await docRequestService.markDeliverySent('d1', 'TRACK123');

      expect(mockLog.status).toBe('Sent');
      expect(mockLog.trackingNumber).toBe('TRACK123');
      expect(mockLog.attempts).toBe(1);
    });
  });

  // ─── Queries ──────────────────────────────────────────────────────

  describe('getRequestByNumber', () => {
    it('should find request by number', async () => {
      DocumentRequest.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
      });
      DocumentRequest.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: jest.fn(),
      });

      await docRequestService.getRequestByNumber(tenantId, 'DOC-202608-0001');

      expect(DocumentRequest.findOne).toHaveBeenCalledWith({
        tenantId,
        requestNumber: 'DOC-202608-0001',
      });
    });
  });

  describe('getEscalatedRequests', () => {
    it('should return requests past TAT', async () => {
      DocumentRequest.find.mockResolvedValue([
        {
          _id: 'r1',
          status: 'Processing',
          expectedDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          _id: 'r2',
          status: 'Delivered',
          expectedDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
      ]);

      const escalated = await docRequestService.getEscalatedRequests(tenantId, 2);

      expect(escalated).toHaveLength(1);
      expect(escalated[0]._id).toBe('r1');
    });
  });

  // ─── Reports ──────────────────────────────────────────────────────

  describe('generateDashboardStats', () => {
    it('should generate stats', async () => {
      DocumentRequest.find.mockResolvedValue([
        { status: 'Delivered', urgency: 'Normal', createdAt: new Date(), actualDeliveryDate: new Date(), expectedDeliveryDate: new Date(Date.now() + 1000) },
        { status: 'Processing', urgency: 'Urgent', createdAt: new Date(), expectedDeliveryDate: null },
      ]);
      DocumentTemplate.find.mockResolvedValue([]);

      const stats = await docRequestService.generateDashboardStats(tenantId);

      expect(stats.total).toBe(2);
      expect(stats.byStatus.Delivered).toBe(1);
      expect(stats.byStatus.Processing).toBe(1);
      expect(stats.byUrgency.Normal).toBe(1);
      expect(stats.byUrgency.Urgent).toBe(1);
    });
  });
});
