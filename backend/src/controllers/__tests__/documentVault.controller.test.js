/**
 * @fileoverview Document Vault Controller Tests
 * @description Unit tests for the document vault and e-signature controller
 * covering categories, document CRUD, e-signature lifecycle, and dashboard analytics.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
}));

const eventBus = require('../../services/event.service');

const {
  DocumentCategory,
  EmployeeDocument,
  ESignatureRequest,
} = require('../../models/documentVault.model');

const tenantId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

function makeReq(overrides = {}) {
  return { tenantId, userId, params: {}, body: {}, query: {}, ip: '127.0.0.1', ...overrides };
}

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

const next = jest.fn();

let categoryId;

beforeEach(async () => {
  await Promise.all([
    DocumentCategory.deleteMany({}),
    EmployeeDocument.deleteMany({}),
    ESignatureRequest.deleteMany({}),
  ]);
  eventBus.emit.mockClear();
  next.mockClear();

  const cat = await DocumentCategory.create({
    tenantId, name: 'Employment Contracts', accessLevel: 'HR_ONLY', retentionDays: 3650,
  });
  categoryId = cat._id;
});

const {
  createCategory, getCategories, uploadDocument, getEmployeeDocuments,
  getDocument, updateDocument, deleteDocument,
  createSignatureRequest, getSignatureRequests, signDocument,
  declineSignature, getAuditTrail, getDashboard,
} = require('../documentVault.controller');

// ─── Category Tests ──────────────────────────────────────────────────────────

describe('DocumentCategory', () => {
  test('createCategory creates a category', async () => {
    const req = makeReq({ body: { name: 'Tax Documents', accessLevel: 'HR_ONLY' } });
    const res = makeRes();
    await createCategory(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      category: expect.objectContaining({ name: 'Tax Documents' }),
    }));
  });

  test('getCategories returns all active categories', async () => {
    const req = makeReq();
    const res = makeRes();
    await getCategories(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.categories).toHaveLength(1);
  });
});

// ─── Document Tests ──────────────────────────────────────────────────────────

describe('EmployeeDocument', () => {
  const employeeId = new mongoose.Types.ObjectId();

  test('uploadDocument creates a document with hash', async () => {
    const req = makeReq({
      body: {
        employeeId: String(employeeId),
        categoryId: String(categoryId),
        title: 'Offer Letter',
        fileName: 'offer.pdf',
        fileUrl: '/docs/offer.pdf',
      },
    });
    const res = makeRes();
    await uploadDocument(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.document.fileHash).toBeTruthy();
    expect(body.document.status).toBe('ACTIVE');
  });

  test('uploadDocument returns 404 for invalid category', async () => {
    const req = makeReq({
      body: {
        employeeId: String(employeeId),
        categoryId: String(new mongoose.Types.ObjectId()),
        title: 'Test',
        fileName: 'test.pdf',
        fileUrl: '/test.pdf',
      },
    });
    const res = makeRes();
    await uploadDocument(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('getEmployeeDocuments returns documents for an employee', async () => {
    await EmployeeDocument.create({
      tenantId, employeeId, categoryId,
      title: 'Test Doc', fileName: 'test.pdf', fileUrl: '/test.pdf',
      uploadedBy: userId, mimeType: 'application/pdf',
    });

    const req = makeReq({ params: { employeeId: String(employeeId) } });
    const res = makeRes();
    await getEmployeeDocuments(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.documents).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  test('getDocument returns a document and logs access', async () => {
    const doc = await EmployeeDocument.create({
      tenantId, employeeId, categoryId,
      title: 'Access Test', fileName: 'test.pdf', fileUrl: '/test.pdf',
      uploadedBy: userId, mimeType: 'application/pdf',
    });

    const req = makeReq({ params: { documentId: String(doc._id) } });
    const res = makeRes();
    await getDocument(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await EmployeeDocument.findById(doc._id);
    expect(updated.accessLog).toHaveLength(1);
    expect(updated.accessLog[0].action).toBe('VIEWED');
  });

  test('deleteDocument removes the document', async () => {
    const doc = await EmployeeDocument.create({
      tenantId, employeeId, categoryId,
      title: 'To Delete', fileName: 'del.pdf', fileUrl: '/del.pdf',
      uploadedBy: userId, mimeType: 'application/pdf',
    });

    const req = makeReq({ params: { documentId: String(doc._id) } });
    const res = makeRes();
    await deleteDocument(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const gone = await EmployeeDocument.findById(doc._id);
    expect(gone).toBeNull();
  });
});

// ─── E-Signature Tests ──────────────────────────────────────────────────────

describe('ESignatureRequest', () => {
  let document;

  beforeEach(async () => {
    const employeeId = new mongoose.Types.ObjectId();
    document = await EmployeeDocument.create({
      tenantId, employeeId, categoryId,
      title: 'Contract for Signing', fileName: 'contract.pdf', fileUrl: '/contract.pdf',
      uploadedBy: userId, mimeType: 'application/pdf',
    });
  });

  test('createSignatureRequest creates a request with audit trail', async () => {
    const req = makeReq({
      body: {
        documentId: String(document._id),
        title: 'Sign Employment Agreement',
        signers: [{ userId: String(userId), name: 'Test User', email: 'test@test.com', order: 1 }],
        expiresInDays: 14,
      },
    });
    const res = makeRes();
    await createSignatureRequest(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.request.status).toBe('SENT');
    expect(body.request.auditTrail).toHaveLength(2);
    expect(body.request.signers).toHaveLength(1);
  });

  test('signDocument records signature and updates status', async () => {
    const req2 = makeReq({
      body: {
        documentId: String(document._id),
        title: 'Sign This',
        signers: [{ userId: String(userId), name: 'Signer One', email: 's1@test.com', order: 1 }],
      },
    });
    const res2 = makeRes();
    await createSignatureRequest(req2, res2, next);
    const requestId = res2.json.mock.calls[0][0].request._id;

    const signReq = makeReq({
      params: { requestId: String(requestId) },
      body: { signerEmail: 's1@test.com', signatureData: 'data:image/png;base64,mock' },
    });
    const signRes = makeRes();
    await signDocument(signReq, signRes, next);

    expect(signRes.status).toHaveBeenCalledWith(200);
    const body = signRes.json.mock.calls[0][0];
    expect(body.request.status).toBe('COMPLETED');
    expect(body.message).toContain('All signatures collected');
  });

  test('signDocument with wrong email returns 400', async () => {
    const req2 = makeReq({
      body: {
        documentId: String(document._id),
        title: 'Test',
        signers: [{ userId: String(userId), name: 'S', email: 'real@test.com', order: 1 }],
      },
    });
    const res2 = makeRes();
    await createSignatureRequest(req2, res2, next);
    const requestId = res2.json.mock.calls[0][0].request._id;

    const signReq = makeReq({
      params: { requestId: String(requestId) },
      body: { signerEmail: 'wrong@test.com', signatureData: 'data:...' },
    });
    const signRes = makeRes();
    await signDocument(signReq, signRes, next);
    expect(signRes.status).toHaveBeenCalledWith(400);
  });

  test('declineSignature marks signer as DECLINED', async () => {
    const req2 = makeReq({
      body: {
        documentId: String(document._id),
        title: 'Decline Test',
        signers: [{ userId: String(userId), name: 'Decliner', email: 'd@test.com', order: 1 }],
      },
    });
    const res2 = makeRes();
    await createSignatureRequest(req2, res2, next);
    const requestId = res2.json.mock.calls[0][0].request._id;

    const declineReq = makeReq({
      params: { requestId: String(requestId) },
      body: { signerEmail: 'd@test.com', reason: 'Terms unacceptable' },
    });
    const declineRes = makeRes();
    await declineSignature(declineReq, declineRes, next);

    expect(declineRes.status).toHaveBeenCalledWith(200);
    const body = declineRes.json.mock.calls[0][0];
    expect(body.request.status).toBe('DECLINED');
    expect(body.request.signers[0].status).toBe('DECLINED');
  });

  test('getAuditTrail returns full audit history', async () => {
    const req2 = makeReq({
      body: {
        documentId: String(document._id),
        title: 'Audit Test',
        signers: [{ userId: String(userId), name: 'A', email: 'a@test.com', order: 1 }],
      },
    });
    const res2 = makeRes();
    await createSignatureRequest(req2, res2, next);
    const requestId = res2.json.mock.calls[0][0].request._id;

    const auditReq = makeReq({ params: { requestId: String(requestId) } });
    const auditRes = makeRes();
    await getAuditTrail(auditReq, auditRes, next);

    expect(auditRes.status).toHaveBeenCalledWith(200);
    const body = auditRes.json.mock.calls[0][0];
    expect(body.auditTrail.length).toBeGreaterThanOrEqual(2);
    expect(body.signers).toHaveLength(1);
  });
});

// ─── Dashboard Tests ─────────────────────────────────────────────────────────

describe('getDashboard', () => {
  test('returns aggregated vault metrics', async () => {
    await EmployeeDocument.create([
      { tenantId, employeeId: new mongoose.Types.ObjectId(), categoryId, title: 'D1', fileName: 'd1.pdf', fileUrl: '/d1.pdf', uploadedBy: userId, mimeType: 'application/pdf', status: 'ACTIVE' },
      { tenantId, employeeId: new mongoose.Types.ObjectId(), categoryId, title: 'D2', fileName: 'd2.pdf', fileUrl: '/d2.pdf', uploadedBy: userId, mimeType: 'application/pdf', status: 'EXPIRED' },
    ]);

    const req = makeReq();
    const res = makeRes();
    await getDashboard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.totalDocuments).toBe(2);
    expect(body.activeDocuments).toBe(1);
    expect(body.expiredDocuments).toBe(1);
    expect(Array.isArray(body.recentDocuments)).toBe(true);
  });
});
