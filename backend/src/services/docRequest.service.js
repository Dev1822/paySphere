/**
 * @fileoverview Document Request Service
 * @description Business logic for document templates, request lifecycle,
 *   approval workflow, e-signatures, delivery, and reporting.
 */

const {
  DocumentTemplate,
  DocumentRequest,
  ESignatureLog,
  DocumentDeliveryLog,
} = require('../models/docRequest.model');
const Employee = require('../models/employee.model');
const {
  validateTransition,
  generateRequestNumber,
  calculateExpectedDeliveryDate,
  getSLAStatus,
  validateFieldValues,
  checkForEscalation,
} = require('../utils/docRequest.utils');
const logger = require('../utils/logger');

// ─── Template Management ────────────────────────────────────────────────────

async function createTemplate(tenantId, data, userId) {
  const template = await DocumentTemplate.create({
    ...data,
    tenantId,
    createdBy: userId,
  });
  logger.info('Document template created', { templateId: template._id, tenantId });
  return template;
}

async function getTemplates(tenantId, category, includeInactive = false) {
  const filter = { tenantId };
  if (!includeInactive) filter.isActive = true;
  if (category) filter.category = category;
  return DocumentTemplate.find(filter).sort({ category: 1, name: 1 });
}

async function updateTemplate(templateId, tenantId, data) {
  const template = await DocumentTemplate.findOneAndUpdate(
    { _id: templateId, tenantId },
    { $set: data },
    { new: true, runValidators: true },
  );
  if (!template) {
    throw Object.assign(new Error('Template not found'), { statusCode: 404 });
  }
  return template;
}

async function deactivateTemplate(templateId, tenantId) {
  const template = await DocumentTemplate.findOneAndUpdate(
    { _id: templateId, tenantId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!template) {
    throw Object.assign(new Error('Template not found'), { statusCode: 404 });
  }
  return template;
}

// ─── Request Submission ─────────────────────────────────────────────────────

async function submitRequest(tenantId, employeeId, data) {
  const template = await DocumentTemplate.findOne({
    _id: data.templateId,
    tenantId,
    isActive: true,
  });
  if (!template) {
    throw Object.assign(new Error('Document template not found'), {
      statusCode: 404,
    });
  }

  // Validate field values
  if (template.requiredFields && template.requiredFields.length > 0) {
    const validation = validateFieldValues(
      template.requiredFields,
      data.fieldValues || {},
    );
    if (!validation.valid) {
      throw Object.assign(
        new Error(`Validation errors: ${validation.errors.join('; ')}`),
        { statusCode: 400 },
      );
    }
  }

  // Employment duration check
  if (template.minEmploymentMonths > 0) {
    const employee = await Employee.findById(employeeId);
    if (employee && employee.joiningDate) {
      const monthsEmployed = Math.floor(
        (Date.now() - new Date(employee.joiningDate)) /
          (1000 * 60 * 60 * 24 * 30),
      );
      if (monthsEmployed < template.minEmploymentMonths) {
        throw Object.assign(
          new Error(
            `Minimum ${template.minEmploymentMonths} months of employment required`,
          ),
          { statusCode: 400 },
        );
      }
    }
  }

  // Generate request number
  const count = await DocumentRequest.countDocuments({ tenantId });
  const requestNumber = generateRequestNumber(count + 1);

  // Compute expected delivery date
  const expectedDeliveryDate = calculateExpectedDeliveryDate(
    new Date(),
    template.standardTATDays,
  );

  // Determine initial status based on approval requirements
  let initialStatus = 'Submitted';
  if (!template.requiresManagerApproval && !template.requiresHRApproval) {
    initialStatus = 'Processing';
  } else if (template.requiresManagerApproval) {
    initialStatus = 'ManagerReview';
  } else if (template.requiresHRApproval) {
    initialStatus = 'HRReview';
  }

  // Get manager from employee record
  let managerId = null;
  const employee = await Employee.findById(employeeId);
  if (employee) {
    managerId = employee.reportingTo || employee.managerId || null;
  }

  const request = await DocumentRequest.create({
    tenantId,
    employeeId,
    templateId: data.templateId,
    requestNumber,
    fieldValues: data.fieldValues || {},
    notes: data.notes || '',
    urgency: data.urgency || 'Normal',
    status: initialStatus,
    expectedDeliveryDate,
    deliveryMethod: data.deliveryMethod || 'Download',
    managerId,
    statusHistory: [
      {
        status: initialStatus,
        changedBy: null,
        changedAt: new Date(),
        comment: 'Request submitted',
      },
    ],
  });

  // Create e-signature entries if template requires signature
  if (template.requiresSignature) {
    const signers = [];
    if (managerId) {
      signers.push({
        signerId: managerId,
        signerRole: 'Manager',
        signerName: employee?.reportingToName || 'Manager',
        signerEmail: employee?.reportingToEmail || '',
        signatureType: 'Digital',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }
    signers.push({
      signerId: employee?.userId,
      signerRole: 'Employee',
      signerName: employee?.fullName || 'Employee',
      signerEmail: employee?.email || '',
      signatureType: 'Digital',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    for (const signer of signers) {
      if (signer.signerId) {
        await ESignatureLog.create({
          tenantId,
          requestId: request._id,
          ...signer,
        });
      }
    }
  }

  logger.info('Document request submitted', {
    requestId: request._id,
    requestNumber,
    employeeId,
    templateId: data.templateId,
  });

  return request;
}

// ─── Status Transitions ─────────────────────────────────────────────────────

async function transitionStatus(
  requestId,
  tenantId,
  targetStatus,
  userId,
  comment,
) {
  const request = await DocumentRequest.findOne({
    _id: requestId,
    tenantId,
  });
  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }

  const validation = validateTransition(request.status, targetStatus);
  if (!validation.allowed) {
    throw Object.assign(new Error(validation.reason), { statusCode: 400 });
  }

  request.status = targetStatus;
  request.statusHistory.push({
    status: targetStatus,
    changedBy: userId,
    changedAt: new Date(),
    comment: comment || '',
  });

  // Set action-specific fields
  const now = new Date();
  switch (targetStatus) {
    case 'ManagerApproved':
      request.managerActionAt = now;
      request.managerComment = comment || '';
      break;
    case 'ManagerRejected':
      request.managerActionAt = now;
      request.managerComment = comment || '';
      break;
    case 'HRApproved':
      request.hrActionAt = now;
      request.hrComment = comment || '';
      break;
    case 'HRRejected':
      request.hrActionAt = now;
      request.hrComment = comment || '';
      break;
    case 'Cancelled':
      request.cancelledAt = now;
      request.cancelledBy = userId;
      request.cancelReason = comment || '';
      break;
    case 'Delivered':
      request.actualDeliveryDate = now;
      break;
  }

  await request.save();
  logger.info('Document request status transitioned', {
    requestId: request._id,
    from: request.statusHistory[request.statusHistory.length - 2]?.status,
    to: targetStatus,
    userId,
  });

  return request;
}

async function approveByManager(requestId, tenantId, managerId, comment) {
  return transitionStatus(
    requestId,
    tenantId,
    'ManagerApproved',
    managerId,
    comment,
  );
}

async function rejectByManager(requestId, tenantId, managerId, reason) {
  if (!reason || reason.trim().length === 0) {
    throw Object.assign(
      new Error('Rejection reason is required'),
      { statusCode: 400 },
    );
  }
  return transitionStatus(
    requestId,
    tenantId,
    'ManagerRejected',
    managerId,
    reason,
  );
}

async function approveByHR(requestId, tenantId, hrUserId, comment) {
  return transitionStatus(
    requestId,
    tenantId,
    'HRApproved',
    hrUserId,
    comment,
  );
}

async function rejectByHR(requestId, tenantId, hrUserId, reason) {
  if (!reason || reason.trim().length === 0) {
    throw Object.assign(
      new Error('Rejection reason is required'),
      { statusCode: 400 },
    );
  }
  return transitionStatus(
    requestId,
    tenantId,
    'HRRejected',
    hrUserId,
    reason,
  );
}

async function cancelRequest(requestId, tenantId, userId, reason) {
  if (!reason || reason.trim().length === 0) {
    throw Object.assign(
      new Error('Cancellation reason is required'),
      { statusCode: 400 },
    );
  }
  return transitionStatus(
    requestId,
    tenantId,
    'Cancelled',
    userId,
    reason,
  );
}

async function markProcessing(requestId, tenantId, userId) {
  return transitionStatus(
    requestId,
    tenantId,
    'Processing',
    userId,
    'Document processing started',
  );
}

async function markReadyForSignature(requestId, tenantId, userId) {
  return transitionStatus(
    requestId,
    tenantId,
    'ReadyForSignature',
    userId,
    'Document ready for signature',
  );
}

// ─── E-Signature ────────────────────────────────────────────────────────────

async function signDocument(requestId, tenantId, signerId, signatureData) {
  const log = await ESignatureLog.findOne({
    requestId,
    signerId,
    status: 'Pending',
  });
  if (!log) {
    throw Object.assign(
      new Error('No pending signature found for this signer'),
      { statusCode: 404 },
    );
  }

  if (log.expiresAt && new Date() > log.expiresAt) {
    log.status = 'Expired';
    await log.save();
    throw Object.assign(
      new Error('Signing link has expired'),
      { statusCode: 400 },
    );
  }

  log.status = 'Signed';
  log.signedAt = new Date();
  log.signatureRef = signatureData?.signatureRef || '';
  log.ipAddress = signatureData?.ipAddress || '';
  log.userAgent = signatureData?.userAgent || '';
  await log.save();

  // Check if all signatures are complete
  const pendingSigs = await ESignatureLog.countDocuments({
    requestId,
    status: 'Pending',
  });

  if (pendingSigs === 0) {
    // All signatures collected — transition to Signed
    await transitionStatus(requestId, tenantId, 'Signed', signerId, 'All signatures collected');
  }

  logger.info('Document signed', {
    requestId,
    signerId,
    signerRole: log.signerRole,
  });

  return log;
}

async function declineSignature(requestId, signerId, reason) {
  const log = await ESignatureLog.findOne({
    requestId,
    signerId,
    status: 'Pending',
  });
  if (!log) {
    throw Object.assign(
      new Error('No pending signature found'),
      { statusCode: 404 },
    );
  }

  log.status = 'Declined';
  log.declinedAt = new Date();
  log.declineReason = reason || '';
  await log.save();

  return log;
}

async function getSignatureLogs(requestId, tenantId) {
  return ESignatureLog.find({ requestId, tenantId })
    .sort({ createdAt: 1 });
}

// ─── Delivery ───────────────────────────────────────────────────────────────

async function createDeliveryLog(requestId, tenantId, method, details) {
  const log = await DocumentDeliveryLog.create({
    tenantId,
    requestId,
    method,
    status: 'Pending',
    emailTo: details?.emailTo || '',
    postalAddress: details?.postalAddress || '',
  });
  return log;
}

async function markDeliverySent(deliveryLogId, trackingNumber) {
  const log = await DocumentDeliveryLog.findById(deliveryLogId);
  if (!log) {
    throw Object.assign(new Error('Delivery log not found'), { statusCode: 404 });
  }
  log.status = 'Sent';
  log.sentAt = new Date();
  log.trackingNumber = trackingNumber || '';
  log.attempts += 1;
  await log.save();
  return log;
}

async function markDeliveryDelivered(deliveryLogId) {
  const log = await DocumentDeliveryLog.findById(deliveryLogId);
  if (!log) {
    throw Object.assign(new Error('Delivery log not found'), { statusCode: 404 });
  }
  log.deliveredAt = new Date();
  await log.save();
  return log;
}

async function markDeliveryFailed(deliveryLogId, reason) {
  const log = await DocumentDeliveryLog.findById(deliveryLogId);
  if (!log) {
    throw Object.assign(new Error('Delivery log not found'), { statusCode: 404 });
  }
  log.status = 'Failed';
  log.failureReason = reason || '';
  log.attempts += 1;
  await log.save();
  return log;
}

async function getDeliveryLogs(requestId, tenantId) {
  return DocumentDeliveryLog.find({ requestId, tenantId }).sort({ createdAt: 1 });
}

// ─── Queries ────────────────────────────────────────────────────────────────

async function getEmployeeRequests(tenantId, employeeId, filters = {}) {
  const query = { tenantId, employeeId };
  if (filters.status) query.status = filters.status;
  if (filters.category) {
    const templates = await DocumentTemplate.find({
      tenantId,
      category: filters.category,
    }).select('_id');
    query.templateId = { $in: templates.map((t) => t._id) };
  }

  return DocumentRequest.find(query)
    .populate('templateId', 'name code category')
    .populate('managerId', 'fullName')
    .sort({ createdAt: -1 });
}

async function getPendingManagerApprovals(tenantId, managerId) {
  return DocumentRequest.find({
    tenantId,
    managerId,
    status: 'ManagerReview',
  })
    .populate('employeeId', 'fullName email department')
    .populate('templateId', 'name code category')
    .sort({ urgency: -1, createdAt: 1 });
}

async function getPendingHRReviews(tenantId) {
  return DocumentRequest.find({
    tenantId,
    status: { $in: ['HRReview', 'HROnHold'] },
  })
    .populate('employeeId', 'fullName email department')
    .populate('templateId', 'name code category')
    .sort({ urgency: -1, createdAt: 1 });
}

async function getProcessingQueue(tenantId) {
  return DocumentRequest.find({
    tenantId,
    status: { $in: ['Processing', 'ReadyForSignature'] },
  })
    .populate('employeeId', 'fullName email department')
    .populate('templateId', 'name code category')
    .sort({ expectedDeliveryDate: 1 });
}

async function getRequestByNumber(tenantId, requestNumber) {
  return DocumentRequest.findOne({ tenantId, requestNumber })
    .populate('templateId')
    .populate('employeeId', 'fullName email department')
    .populate('managerId', 'fullName');
}

async function getRequestById(requestId, tenantId) {
  return DocumentRequest.findOne({ _id: requestId, tenantId })
    .populate('templateId')
    .populate('employeeId', 'fullName email department')
    .populate('managerId', 'fullName');
}

// ─── SLA & Escalation ──────────────────────────────────────────────────────

async function checkSLAStatus(requestId, tenantId) {
  const request = await DocumentRequest.findOne({ _id: requestId, tenantId });
  if (!request) {
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  }

  const sla = getSLAStatus(request.expectedDeliveryDate, request.status);
  const escalation = checkForEscalation(request);

  return { ...sla, ...escalation, requestNumber: request.requestNumber };
}

async function getEscalatedRequests(tenantId, thresholdDays = 2) {
  const activeRequests = await DocumentRequest.find({
    tenantId,
    status: {
      $nin: ['Delivered', 'Signed', 'Cancelled', 'Expired'],
    },
    expectedDeliveryDate: { $ne: null },
  });

  return activeRequests.filter((req) => {
    const { shouldEscalate } = checkForEscalation(req, thresholdDays);
    return shouldEscalate;
  });
}

// ─── Reports ────────────────────────────────────────────────────────────────

async function generateDashboardStats(tenantId, startDate, endDate) {
  const query = { tenantId };
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const [requests, templates] = await Promise.all([
    DocumentRequest.find(query),
    DocumentTemplate.find({ tenantId }),
  ]);

  const stats = {
    total: requests.length,
    byStatus: {},
    byCategory: {},
    byUrgency: { Normal: 0, Urgent: 0 },
    averageTATDays: 0,
    onTimeRate: 0,
    escalations: 0,
    totalTemplates: templates.length,
  };

  let tatSum = 0;
  let tatCount = 0;
  let onTimeCount = 0;
  let completedCount = 0;

  for (const req of requests) {
    stats.byStatus[req.status] = (stats.byStatus[req.status] || 0) + 1;
    stats.byUrgency[req.urgency] = (stats.byUrgency[req.urgency] || 0) + 1;

    const template = templates.find(
      (t) => t._id.toString() === req.templateId?.toString(),
    );
    const category = template?.category || 'Custom';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

    // TAT calculation for completed requests
    if (['Delivered', 'Signed'].includes(req.status) && req.actualDeliveryDate) {
      const tatMs = req.actualDeliveryDate - req.createdAt;
      const tatDays = Math.ceil(tatMs / (1000 * 60 * 60 * 24));
      tatSum += tatDays;
      tatCount++;
      completedCount++;

      if (
        req.expectedDeliveryDate &&
        req.actualDeliveryDate <= req.expectedDeliveryDate
      ) {
        onTimeCount++;
      }
    }

    const { shouldEscalate } = checkForEscalation(req);
    if (shouldEscalate) stats.escalations++;
  }

  stats.averageTATDays =
    tatCount > 0 ? Math.round((tatSum / tatCount) * 10) / 10 : 0;
  stats.onTimeRate =
    completedCount > 0
      ? Math.round((onTimeCount / completedCount) * 10000) / 100
      : 0;

  return stats;
}

module.exports = {
  createTemplate,
  getTemplates,
  updateTemplate,
  deactivateTemplate,
  submitRequest,
  transitionStatus,
  approveByManager,
  rejectByManager,
  approveByHR,
  rejectByHR,
  cancelRequest,
  markProcessing,
  markReadyForSignature,
  signDocument,
  declineSignature,
  getSignatureLogs,
  createDeliveryLog,
  markDeliverySent,
  markDeliveryDelivered,
  markDeliveryFailed,
  getDeliveryLogs,
  getEmployeeRequests,
  getPendingManagerApprovals,
  getPendingHRReviews,
  getProcessingQueue,
  getRequestByNumber,
  getRequestById,
  checkSLAStatus,
  getEscalatedRequests,
  generateDashboardStats,
};
