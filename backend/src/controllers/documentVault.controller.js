/**
 * @fileoverview Document Vault & E-Signature Controller
 * @description Manages document storage, categorization, access control,
 * and digital e-signature request workflows with full audit trails.
 */
const crypto = require('crypto');
const {
  DocumentCategory,
  EmployeeDocument,
  ESignatureRequest,
} = require('../models/documentVault.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

// ============================================================================
// Document Categories
// ============================================================================

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, icon, color, accessLevel, retentionDays } = req.body;

    const category = await DocumentCategory.create({
      name,
      description: description || '',
      icon: icon || 'file',
      color: color || '#6366f1',
      accessLevel: accessLevel || 'HR_ONLY',
      retentionDays: retentionDays || 2555,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'DOC_CATEGORY_CREATED',
      resourceType: 'DocumentCategory',
      resourceIds: [category._id],
      details: { name, accessLevel },
      req,
    });

    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await DocumentCategory.find(
      { isActive: true },
    ).sort({ name: 1 }).lean();

    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Employee Documents
// ============================================================================

exports.uploadDocument = async (req, res, next) => {
  try {
    const { employeeId, categoryId, title, description, fileName, fileUrl, fileSize, mimeType, isConfidential, tags, expiryDate } = req.body;

    const category = await DocumentCategory.findOne(
      { _id: categoryId, isActive: true },
    );
    if (!category) {
      return res.status(404).json({ message: 'Document category not found' });
    }

    const fileHash = crypto.createHash('sha256').update(fileUrl + title).digest('hex');

    const document = await EmployeeDocument.create({
      employeeId,
      categoryId,
      title,
      description: description || '',
      fileName,
      fileUrl,
      fileSize: fileSize || 0,
      mimeType: mimeType || 'application/octet-stream',
      fileHash,
      uploadedBy: req.userId,
      isConfidential: isConfidential || false,
      tags: tags || [],
      expiryDate: expiryDate ? new Date(expiryDate) : null
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'DOC_UPLOADED',
      resourceType: 'EmployeeDocument',
      resourceIds: [document._id],
      details: { title, employeeId, categoryName: category.name },
      req,
    });

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
};

exports.getEmployeeDocuments = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { categoryId, status, tag } = req.query;

    const filter = { employeeId };
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.status = status;
    if (tag) filter.tags = tag;

    const documents = await EmployeeDocument.find(filter)
      .populate('categoryId', 'name icon color')
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ documents, total: documents.length });
  } catch (error) {
    next(error);
  }
};

exports.getDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    const document = await EmployeeDocument.findOne(
      { _id: documentId },
    )
      .populate('categoryId', 'name icon color accessLevel')
      .populate('uploadedBy', 'name email')
      .populate('employeeId', 'fullName department')
      .lean();

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log access
    await EmployeeDocument.findByIdAndUpdate(documentId, {
      $push: {
        accessLog: {
          accessedBy: req.userId,
          action: 'VIEWED',
        },
      },
    });

    res.status(200).json({ document });
  } catch (error) {
    next(error);
  }
};

exports.updateDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { title, description, tags, isConfidential, status } = req.body;

    const document = await EmployeeDocument.findOneAndUpdate(
      { _id: documentId },
      {
        $set: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(tags !== undefined && { tags }),
          ...(isConfidential !== undefined && { isConfidential }),
          ...(status !== undefined && { status }),
        },
        $push: {
          accessLog: {
            accessedBy: req.userId,
            action: 'UPDATED',
          },
        },
      },
      { new: true, runValidators: true },
    );

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.status(200).json({ document });
  } catch (error) {
    next(error);
  }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    const document = await EmployeeDocument.findOneAndDelete(
      { _id: documentId },
    );

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'DOC_DELETED',
      resourceType: 'EmployeeDocument',
      resourceIds: [document._id],
      details: { title: document.title, employeeId: String(document.employeeId) },
      req,
    });

    res.status(200).json({ message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// E-Signature Requests
// ============================================================================

exports.createSignatureRequest = async (req, res, next) => {
  try {
    const { documentId, title, message, signers, accessCode, expiresInDays } = req.body;

    const document = await EmployeeDocument.findOne(
      { _id: documentId },
    );
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 14));

    const request = await ESignatureRequest.create({
      documentId,
      requestedBy: req.userId,
      title,
      message: message || '',

      signers: signers.map((s, i) => ({
        userId: s.userId,
        name: s.name,
        email: s.email,
        order: s.order || i + 1,
        status: 'PENDING',
      })),

      status: 'SENT',
      accessCode: accessCode || null,
      expiresAt,

      auditTrail: [
        {
          event: 'CREATED',
          actorId: req.userId,
          actorName: req.userId,
          timestamp: new Date(),
          details: `E-signature request created with ${signers.length} signer(s)`,
        },
        {
          event: 'SENT',
          actorId: req.userId,
          actorName: req.userId,
          timestamp: new Date(),
          details: 'Request sent to all signers',
        },
      ]
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESIGN_REQUEST_CREATED',
      resourceType: 'ESignatureRequest',
      resourceIds: [request._id],
      details: { title, signerCount: signers.length },
      req,
    });

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

exports.getSignatureRequests = async (req, res, next) => {
  try {
    const { status, mySignatures } = req.query;

    const filter = {};
    if (status) filter.status = status;

    // If user wants only their pending signatures
    if (mySignatures === 'pending') {
      filter['signers.userId'] = req.userId;
      filter['signers.status'] = 'PENDING';
    }

    const requests = await ESignatureRequest.find(filter)
      .populate('documentId', 'title fileName')
      .populate('requestedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
};

exports.signDocument = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { signerEmail, signatureData, accessCode } = req.body;

    const request = await ESignatureRequest.findOne(
      { _id: requestId, status: { $in: ['SENT', 'IN_PROGRESS'] } },
    );

    if (!request) {
      return res.status(404).json({ message: 'Signature request not found or already completed' });
    }

    if (request.expiresAt < new Date()) {
      request.status = 'EXPIRED';
      await request.save();
      return res.status(410).json({ message: 'This signature request has expired' });
    }

    // Verify access code if set
    if (request.accessCode && request.accessCode !== accessCode) {
      return res.status(403).json({ message: 'Invalid access code' });
    }

    // Find the signer
    const signerIndex = request.signers.findIndex(
      (s) => s.email === signerEmail && s.status === 'PENDING',
    );

    if (signerIndex === -1) {
      return res.status(400).json({ message: 'You are not a pending signer on this request' });
    }

    // Update signer
    request.signers[signerIndex].status = 'SIGNED';
    request.signers[signerIndex].signedAt = new Date();
    request.signers[signerIndex].signatureData = signatureData;
    request.signers[signerIndex].ipAddress = req.ip || req.headers['x-forwarded-for'] || 'Unknown';

    // Update overall status
    const allSigned = request.signers.every((s) => s.status === 'SIGNED');
    const anyDeclined = request.signers.some((s) => s.status === 'DECLINED');

    if (allSigned) {
      request.status = 'COMPLETED';
      request.completedAt = new Date();
    } else {
      request.status = 'IN_PROGRESS';
    }

    if (anyDeclined) {
      request.status = 'DECLINED';
    }

    // Audit trail
    request.auditTrail.push({
      event: 'SIGNED',
      actorId: req.userId,
      actorName: request.signers[signerIndex].name,
      timestamp: new Date(),
      details: `Signed by ${request.signers[signerIndex].name}`,
      ipAddress: request.signers[signerIndex].ipAddress,
    });

    await request.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESIGN_DOCUMENT_SIGNED',
      resourceType: 'ESignatureRequest',
      resourceIds: [request._id],
      details: {
        signerName: request.signers[signerIndex].name,
        overallStatus: request.status,
        signersCompleted: request.signers.filter((s) => s.status === 'SIGNED').length,
        totalSigners: request.signers.length,
      },
      req,
    });

    res.status(200).json({
      message: allSigned ? 'All signatures collected! Document is fully signed.' : 'Signature recorded. Awaiting remaining signers.',
      request,
    });
  } catch (error) {
    next(error);
  }
};

exports.declineSignature = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { signerEmail, reason } = req.body;

    const request = await ESignatureRequest.findOne(
      { _id: requestId, status: { $in: ['SENT', 'IN_PROGRESS'] } },
    );

    if (!request) {
      return res.status(404).json({ message: 'Signature request not found or already completed' });
    }

    const signerIndex = request.signers.findIndex(
      (s) => s.email === signerEmail && s.status === 'PENDING',
    );

    if (signerIndex === -1) {
      return res.status(400).json({ message: 'You are not a pending signer on this request' });
    }

    request.signers[signerIndex].status = 'DECLINED';
    request.signers[signerIndex].declinedAt = new Date();
    request.signers[signerIndex].declineReason = reason || 'Declined by signer';
    request.status = 'DECLINED';

    request.auditTrail.push({
      event: 'DECLINED',
      actorId: req.userId,
      actorName: request.signers[signerIndex].name,
      timestamp: new Date(),
      details: `Declined: ${reason || 'No reason provided'}`,
    });

    await request.save();

    res.status(200).json({ message: 'Signature declined', request });
  } catch (error) {
    next(error);
  }
};

exports.cancelSignatureRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await ESignatureRequest.findOne(
      { _id: requestId, requestedBy: req.userId, status: { $ne: 'COMPLETED' } },
    );

    if (!request) {
      return res.status(404).json({ message: 'Request not found or cannot be cancelled' });
    }

    request.status = 'CANCELLED';
    request.auditTrail.push({
      event: 'CANCELLED',
      actorId: req.userId,
      timestamp: new Date(),
      details: 'Request cancelled by initiator',
    });

    await request.save();

    res.status(200).json({ message: 'Request cancelled', request });
  } catch (error) {
    next(error);
  }
};

exports.getAuditTrail = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await ESignatureRequest.findOne(
      { _id: requestId },
    ).lean();

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.status(200).json({
      requestId: request._id,
      title: request.title,
      status: request.status,
      auditTrail: request.auditTrail,
      signers: request.signers.map((s) => ({
        name: s.name,
        email: s.email,
        status: s.status,
        signedAt: s.signedAt,
        declinedAt: s.declinedAt,
        ipAddress: s.ipAddress,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Dashboard
// ============================================================================

exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();

    const [
      totalDocuments,
      activeDocuments,
      pendingSignatures,
      completedSignatures,
      expiredDocuments,
      recentDocuments,
      recentSignatures,
    ] = await Promise.all([
      EmployeeDocument.countDocuments({}),
      EmployeeDocument.countDocuments({ status: 'ACTIVE' }),
      ESignatureRequest.countDocuments(
        { status: { $in: ['SENT', 'IN_PROGRESS'] }, expiresAt: { $gt: now } },
      ),
      ESignatureRequest.countDocuments({ status: 'COMPLETED' }),
      EmployeeDocument.countDocuments(
        { expiryDate: { $lt: now }, status: 'ACTIVE' },
      ),
      EmployeeDocument.find({})
        .populate('categoryId', 'name icon color')
        .populate('employeeId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      ESignatureRequest.find({})
        .populate('documentId', 'title')
        .populate('requestedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    res.status(200).json({
      totalDocuments,
      activeDocuments,
      pendingSignatures,
      completedSignatures,
      expiredDocuments,
      recentDocuments,
      recentSignatures,
    });
  } catch (error) {
    next(error);
  }
};
