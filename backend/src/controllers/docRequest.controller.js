/**
 * @fileoverview Document Request Controller
 * @description Request handlers for document templates, requests, approvals,
 *   e-signatures, delivery, SLA monitoring, and reporting.
 */

const docRequestService = require('../services/docRequest.service');
const Employee = require('../models/employee.model');

// ─── Template Endpoints ─────────────────────────────────────────────────────

/**
 * POST /api/doc-requests/templates
 * Create a new document template.
 */
exports.createTemplate = async (req, res, next) => {
  try {
    const { code, name, category, requiredFields, standardTATDays, requiresManagerApproval, requiresHRApproval, requiresSignature, feeAmount, minEmploymentMonths } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        message: 'Template code and name are required',
      });
    }

    const template = await docRequestService.createTemplate(
      req.tenantId,
      {
        code,
        name,
        description: req.body.description,
        category,
        requiredFields,
        standardTATDays,
        requiresManagerApproval,
        requiresHRApproval,
        requiresSignature,
        feeAmount,
        minEmploymentMonths,
      },
      req.userId,
    );

    res.status(201).json({ message: 'Template created', template });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/templates
 * List all document templates.
 */
exports.getTemplates = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const templates = await docRequestService.getTemplates(
      req.tenantId,
      req.query.category,
      includeInactive,
    );
    res.status(200).json({ templates });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/templates/:templateId
 * Update a document template.
 */
exports.updateTemplate = async (req, res, next) => {
  try {
    const template = await docRequestService.updateTemplate(
      req.params.templateId,
      req.tenantId,
      req.body,
    );
    res.status(200).json({ message: 'Template updated', template });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/doc-requests/templates/:templateId
 * Deactivate a document template.
 */
exports.deactivateTemplate = async (req, res, next) => {
  try {
    await docRequestService.deactivateTemplate(
      req.params.templateId,
      req.tenantId,
    );
    res.status(200).json({ message: 'Template deactivated' });
  } catch (error) {
    next(error);
  }
};

// ─── Request Submission ─────────────────────────────────────────────────────

/**
 * POST /api/doc-requests
 * Submit a new document request.
 */
exports.submitRequest = async (req, res, next) => {
  try {
    const { templateId, fieldValues, notes, urgency, deliveryMethod } = req.body;

    if (!templateId) {
      return res.status(400).json({ message: 'templateId is required' });
    }

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const request = await docRequestService.submitRequest(
      req.tenantId,
      employee._id,
      { templateId, fieldValues, notes, urgency, deliveryMethod },
    );

    res.status(201).json({
      message: 'Document request submitted',
      requestNumber: request.requestNumber,
      request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/my
 * Get the authenticated employee's document requests.
 */
exports.getMyRequests = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.category) filters.category = req.query.category;

    const requests = await docRequestService.getEmployeeRequests(
      req.tenantId,
      employee._id,
      filters,
    );

    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/:requestNumber
 * Get a specific document request by number.
 */
exports.getRequestByNumber = async (req, res, next) => {
  try {
    const request = await docRequestService.getRequestByNumber(
      req.tenantId,
      req.params.requestNumber,
    );
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.status(200).json({ request });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/id/:requestId
 * Get a specific document request by ID with full details.
 */
exports.getRequestById = async (req, res, next) => {
  try {
    const request = await docRequestService.getRequestById(
      req.params.requestId,
      req.tenantId,
    );
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Also fetch signatures and delivery logs
    const [signatures, deliveries] = await Promise.all([
      docRequestService.getSignatureLogs(request._id, req.tenantId),
      docRequestService.getDeliveryLogs(request._id, req.tenantId),
    ]);

    res.status(200).json({ request, signatures, deliveries });
  } catch (error) {
    next(error);
  }
};

// ─── Approval Workflow ──────────────────────────────────────────────────────

/**
 * GET /api/doc-requests/pending-manager
 * Get pending manager approvals.
 */
exports.getPendingManagerApprovals = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const requests = await docRequestService.getPendingManagerApprovals(
      req.tenantId,
      employee._id,
    );

    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/pending-hr
 * Get pending HR reviews.
 */
exports.getPendingHRReviews = async (req, res, next) => {
  try {
    const requests = await docRequestService.getPendingHRReviews(req.tenantId);
    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/:requestId/approve-manager
 * Manager approves a document request.
 */
exports.approveByManager = async (req, res, next) => {
  try {
    const request = await docRequestService.approveByManager(
      req.params.requestId,
      req.tenantId,
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Approved by manager', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/:requestId/reject-manager
 * Manager rejects a document request.
 */
exports.rejectByManager = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    const request = await docRequestService.rejectByManager(
      req.params.requestId,
      req.tenantId,
      req.userId,
      reason,
    );
    res.status(200).json({ message: 'Rejected by manager', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/:requestId/approve-hr
 * HR approves a document request.
 */
exports.approveByHR = async (req, res, next) => {
  try {
    const request = await docRequestService.approveByHR(
      req.params.requestId,
      req.tenantId,
      req.userId,
      req.body.comment,
    );
    res.status(200).json({ message: 'Approved by HR', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/:requestId/reject-hr
 * HR rejects a document request.
 */
exports.rejectByHR = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    const request = await docRequestService.rejectByHR(
      req.params.requestId,
      req.tenantId,
      req.userId,
      reason,
    );
    res.status(200).json({ message: 'Rejected by HR', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/:requestId/cancel
 * Cancel a document request.
 */
exports.cancelRequest = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ message: 'Cancellation reason is required' });
    }
    const request = await docRequestService.cancelRequest(
      req.params.requestId,
      req.tenantId,
      req.userId,
      reason,
    );
    res.status(200).json({ message: 'Request cancelled', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/:requestId/process
 * Mark a request as processing (document generation started).
 */
exports.markProcessing = async (req, res, next) => {
  try {
    const request = await docRequestService.markProcessing(
      req.params.requestId,
      req.tenantId,
      req.userId,
    );
    res.status(200).json({ message: 'Processing started', request });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doc-requests/:requestId/ready-for-signature
 * Mark a request as ready for e-signature.
 */
exports.markReadyForSignature = async (req, res, next) => {
  try {
    const request = await docRequestService.markReadyForSignature(
      req.params.requestId,
      req.tenantId,
      req.userId,
    );
    res.status(200).json({ message: 'Ready for signature', request });
  } catch (error) {
    next(error);
  }
};

// ─── E-Signature ────────────────────────────────────────────────────────────

/**
 * POST /api/doc-requests/:requestId/sign
 * Sign a document.
 */
exports.signDocument = async (req, res, next) => {
  try {
    const log = await docRequestService.signDocument(
      req.params.requestId,
      req.tenantId,
      req.userId,
      {
        signatureRef: req.body.signatureRef,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
      },
    );
    res.status(200).json({ message: 'Document signed', signature: log });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/doc-requests/:requestId/decline-signature
 * Decline to sign a document.
 */
exports.declineSignature = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const log = await docRequestService.declineSignature(
      req.params.requestId,
      req.userId,
      reason,
    );
    res.status(200).json({ message: 'Signature declined', signature: log });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/:requestId/signatures
 * Get signature logs for a request.
 */
exports.getSignatureLogs = async (req, res, next) => {
  try {
    const logs = await docRequestService.getSignatureLogs(
      req.params.requestId,
      req.tenantId,
    );
    res.status(200).json({ signatures: logs });
  } catch (error) {
    next(error);
  }
};

// ─── Delivery ───────────────────────────────────────────────────────────────

/**
 * POST /api/doc-requests/:requestId/deliver
 * Initiate document delivery.
 */
exports.initiateDelivery = async (req, res, next) => {
  try {
    const { method, emailTo, postalAddress } = req.body || {};
    if (!method) {
      return res.status(400).json({ message: 'Delivery method is required' });
    }

    const log = await docRequestService.createDeliveryLog(
      req.params.requestId,
      req.tenantId,
      method,
      { emailTo, postalAddress },
    );

    // Transition to Delivered status
    await docRequestService.transitionStatus(
      req.params.requestId,
      req.tenantId,
      'Delivered',
      req.userId,
      `Document delivered via ${method}`,
    );

    res.status(201).json({ message: 'Delivery initiated', delivery: log });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/:requestId/deliveries
 * Get delivery logs for a request.
 */
exports.getDeliveryLogs = async (req, res, next) => {
  try {
    const logs = await docRequestService.getDeliveryLogs(
      req.params.requestId,
      req.tenantId,
    );
    res.status(200).json({ deliveries: logs });
  } catch (error) {
    next(error);
  }
};

// ─── SLA & Escalation ──────────────────────────────────────────────────────

/**
 * GET /api/doc-requests/:requestId/sla
 * Check SLA status for a request.
 */
exports.checkSLA = async (req, res, next) => {
  try {
    const sla = await docRequestService.checkSLAStatus(
      req.params.requestId,
      req.tenantId,
    );
    res.status(200).json({ sla });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/escalated
 * Get all escalated requests (past TAT).
 */
exports.getEscalatedRequests = async (req, res, next) => {
  try {
    const threshold = req.query.thresholdDays
      ? parseInt(req.query.thresholdDays, 10)
      : 2;
    const requests = await docRequestService.getEscalatedRequests(
      req.tenantId,
      threshold,
    );
    res.status(200).json({ requests, count: requests.length });
  } catch (error) {
    next(error);
  }
};

// ─── Admin / Reporting ──────────────────────────────────────────────────────

/**
 * GET /api/doc-requests/queue
 * Get the processing queue (for HR/admin).
 */
exports.getProcessingQueue = async (req, res, next) => {
  try {
    const queue = await docRequestService.getProcessingQueue(req.tenantId);
    res.status(200).json({ queue });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doc-requests/reports/dashboard
 * Get dashboard statistics.
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const stats = await docRequestService.generateDashboardStats(
      req.tenantId,
      req.query.startDate,
      req.query.endDate,
    );
    res.status(200).json({ stats });
  } catch (error) {
    next(error);
  }
};
