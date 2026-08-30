/**
 * @fileoverview Investigation Workflow Controller Tests
 * @description Unit tests for the investigation lifecycle controller covering
 * step management, comments, evidence, assignments, and dashboard analytics.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// ─── In-memory MongoDB setup ─────────────────────────────────────────────────

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ─── Stub the event bus ──────────────────────────────────────────────────────

jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
}));

const eventBus = require('../../services/event.service');

// ─── Models ──────────────────────────────────────────────────────────────────

const {
  InvestigationStep,
  CaseComment,
  CaseAssignment,
  CaseEvidence,
} = require('../../models/investigation.model');
const { Grievance } = require('../../models/grievance.model');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const tenantId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

function makeReq(overrides = {}) {
  return {
    tenantId,
    userId,
    params: {},
    body: {},
    query: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

const next = jest.fn();

// ─── Shared fixtures ─────────────────────────────────────────────────────────

let grievanceId;

beforeEach(async () => {
  await Promise.all([
    InvestigationStep.deleteMany({}),
    CaseComment.deleteMany({}),
    CaseAssignment.deleteMany({}),
    CaseEvidence.deleteMany({}),
    Grievance.deleteMany({}),
  ]);

  eventBus.emit.mockClear();
  next.mockClear();

  const g = await Grievance.create({
    tenantId,
    caseNumber: 'POSH-2026-TEST-001',
    incidentDate: new Date('2026-08-01'),
    encryptedDescription: 'encrypted:text',
    encryptionIV: 'iv123',
    slaDeadline: new Date('2026-11-01'),
  });
  grievanceId = g._id;
});

// ─── Import controller ───────────────────────────────────────────────────────

const {
  createStep,
  getSteps,
  updateStep,
  cancelStep,
  addComment,
  getComments,
  deleteComment,
  addEvidence,
  getEvidence,
  verifyEvidence,
  assignToCase,
  getAssignments,
  deactivateAssignment,
  getDashboard,
  getCaseTimeline,
} = require('../investigation.controller');

// ─── Step Tests ──────────────────────────────────────────────────────────────

describe('InvestigationStep', () => {
  test('createStep creates a step and auto-transitions Filed case to Under Inquiry', async () => {
    const req = makeReq({
      params: { caseId: String(grievanceId) },
      body: {
        actionType: 'INTAKE_INTERVIEW',
        title: 'Initial complainant interview',
        description: 'Scheduled intake session with the complainant.',
      },
    });
    const res = makeRes();

    await createStep(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        step: expect.objectContaining({
          stepNumber: 1,
          actionType: 'INTAKE_INTERVIEW',
          status: 'PENDING',
        }),
      }),
    );

    const g = await Grievance.findById(grievanceId);
    expect(g.status).toBe('Under Inquiry');

    expect(eventBus.emit).toHaveBeenCalledWith(
      'AUDIT_LOG',
      expect.objectContaining({ action: 'INVESTIGATION_STEP_CREATED' }),
    );
  });

  test('getSteps returns all steps for a case in order', async () => {
    await InvestigationStep.create([
      {
        tenantId,
        caseId: grievanceId,
        stepNumber: 1,
        actionType: 'INTAKE_INTERVIEW',
        title: 'Step 1',
        description: 'First step',
        performedBy: userId,
        status: 'COMPLETED',
      },
      {
        tenantId,
        caseId: grievanceId,
        stepNumber: 2,
        actionType: 'WITNESS_STATEMENT',
        title: 'Step 2',
        description: 'Second step',
        performedBy: userId,
        status: 'IN_PROGRESS',
      },
    ]);

    const req = makeReq({ params: { caseId: String(grievanceId) } });
    const res = makeRes();

    await getSteps(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.steps).toHaveLength(2);
    expect(body.steps[0].stepNumber).toBe(1);
    expect(body.steps[1].stepNumber).toBe(2);
    expect(body.total).toBe(2);
  });

  test('updateStep marks completedAt when status transitions to COMPLETED', async () => {
    const step = await InvestigationStep.create({
      tenantId,
      caseId: grievanceId,
      stepNumber: 1,
      actionType: 'FACT_FINDING',
      title: 'Preliminary review',
      description: 'Review all documents',
      performedBy: userId,
      status: 'IN_PROGRESS',
    });

    const req = makeReq({
      params: { stepId: String(step._id) },
      body: { status: 'COMPLETED' },
    });
    const res = makeRes();

    await updateStep(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await InvestigationStep.findById(step._id);
    expect(updated.status).toBe('COMPLETED');
    expect(updated.completedAt).toBeTruthy();
  });

  test('cancelStep sets status to CANCELLED', async () => {
    const step = await InvestigationStep.create({
      tenantId,
      caseId: grievanceId,
      stepNumber: 1,
      actionType: 'OTHER',
      title: 'To cancel',
      description: 'This will be cancelled',
      performedBy: userId,
      status: 'PENDING',
    });

    const req = makeReq({ params: { stepId: String(step._id) } });
    const res = makeRes();

    await cancelStep(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const cancelled = await InvestigationStep.findById(step._id);
    expect(cancelled.status).toBe('CANCELLED');
  });

  test('createStep returns 404 for non-existent case', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const req = makeReq({
      params: { caseId: String(fakeId) },
      body: { actionType: 'OTHER', title: 'X', description: 'Y' },
    });
    const res = makeRes();

    await createStep(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── Comment Tests ───────────────────────────────────────────────────────────

describe('CaseComment', () => {
  test('addComment creates a comment', async () => {
    const req = makeReq({
      params: { caseId: String(grievanceId) },
      body: { content: 'Reviewing the incident report.' },
    });
    const res = makeRes();

    await addComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: expect.objectContaining({ content: 'Reviewing the incident report.' }),
      }),
    );
  });

  test('getComments returns comments excluding internal by default', async () => {
    await CaseComment.create([
      { tenantId, caseId: grievanceId, authorId: userId, content: 'Public comment' },
      { tenantId, caseId: grievanceId, authorId: userId, content: 'Internal note', isInternal: true },
    ]);

    const req = makeReq({ params: { caseId: String(grievanceId) }, query: {} });
    const res = makeRes();

    await getComments(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].content).toBe('Public comment');
  });

  test('deleteComment removes the comment', async () => {
    const comment = await CaseComment.create({
      tenantId,
      caseId: grievanceId,
      authorId: userId,
      content: 'To be deleted',
    });

    const req = makeReq({ params: { commentId: String(comment._id) }, userId });
    const res = makeRes();

    await deleteComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const gone = await CaseComment.findById(comment._id);
    expect(gone).toBeNull();
  });
});

// ─── Evidence Tests ──────────────────────────────────────────────────────────

describe('CaseEvidence', () => {
  test('addEvidence creates an evidence item', async () => {
    const req = makeReq({
      params: { caseId: String(grievanceId) },
      body: {
        evidenceType: 'EMAIL',
        title: 'Incident email chain',
        fileUrl: '/files/email.pdf',
        fileName: 'email.pdf',
        fileSize: 50000,
      },
    });
    const res = makeRes();

    await addEvidence(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence: expect.objectContaining({ evidenceType: 'EMAIL', verified: false }),
      }),
    );
  });

  test('verifyEvidence marks evidence as verified', async () => {
    const ev = await CaseEvidence.create({
      tenantId,
      caseId: grievanceId,
      evidenceType: 'DOCUMENT',
      title: 'Police report',
      fileUrl: '/files/report.pdf',
      fileName: 'report.pdf',
      uploadedBy: userId,
    });

    const req = makeReq({ params: { evidenceId: String(ev._id) } });
    const res = makeRes();

    await verifyEvidence(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const verified = await CaseEvidence.findById(ev._id);
    expect(verified.verified).toBe(true);
    expect(verified.verifiedBy).toEqual(userId);
    expect(verified.verifiedAt).toBeTruthy();
  });
});

// ─── Assignment Tests ────────────────────────────────────────────────────────

describe('CaseAssignment', () => {
  test('assignToCase creates an assignment', async () => {
    const assignTo = new mongoose.Types.ObjectId();
    const req = makeReq({
      params: { caseId: String(grievanceId) },
      body: { assignedTo: String(assignTo), role: 'INVESTIGATOR' },
    });
    const res = makeRes();

    await assignToCase(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.assignment.role).toBe('INVESTIGATOR');
    expect(body.assignment.isActive).toBe(true);
  });

  test('deactivateAssignment removes a member from a case', async () => {
    const assignment = await CaseAssignment.create({
      tenantId,
      caseId: grievanceId,
      assignedTo: new mongoose.Types.ObjectId(),
      assignedBy: userId,
      role: 'LEGAL_COUNSEL',
      isActive: true,
    });

    const req = makeReq({
      params: { assignmentId: String(assignment._id) },
      body: { reason: 'Completed review' },
    });
    const res = makeRes();

    await deactivateAssignment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await CaseAssignment.findById(assignment._id);
    expect(updated.isActive).toBe(false);
    expect(updated.reason).toBe('Completed review');
  });
});

// ─── Dashboard & Timeline Tests ──────────────────────────────────────────────

describe('getDashboard', () => {
  test('returns aggregated metrics', async () => {
    await InvestigationStep.create([
      {
        tenantId,
        caseId: grievanceId,
        stepNumber: 1,
        actionType: 'INTAKE_INTERVIEW',
        title: 'S1',
        description: 'D1',
        performedBy: userId,
        status: 'COMPLETED',
      },
      {
        tenantId,
        caseId: grievanceId,
        stepNumber: 2,
        actionType: 'WITNESS_STATEMENT',
        title: 'S2',
        description: 'D2',
        performedBy: userId,
        status: 'IN_PROGRESS',
      },
    ]);

    await CaseAssignment.create({
      tenantId,
      caseId: grievanceId,
      assignedTo: userId,
      assignedBy: userId,
      role: 'INVESTIGATOR',
      isActive: true,
    });

    await CaseEvidence.create({
      tenantId,
      caseId: grievanceId,
      evidenceType: 'DOCUMENT',
      title: 'E1',
      fileUrl: '/f',
      fileName: 'f.pdf',
      uploadedBy: userId,
    });

    const req = makeReq();
    const res = makeRes();

    await getDashboard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.totalCases).toBe(1);
    expect(body.activeAssignments).toBe(1);
    expect(body.evidenceCount).toBe(1);
    expect(body.stepsByStatus.COMPLETED).toBe(1);
    expect(body.stepsByStatus.IN_PROGRESS).toBe(1);
    expect(typeof body.completionRate).toBe('number');
  });
});

describe('getCaseTimeline', () => {
  test('returns a merged, chronological timeline', async () => {
    await InvestigationStep.create({
      tenantId,
      caseId: grievanceId,
      stepNumber: 1,
      actionType: 'INTAKE_INTERVIEW',
      title: 'Step',
      description: 'Desc',
      performedBy: userId,
      status: 'COMPLETED',
    });

    await CaseComment.create({
      tenantId,
      caseId: grievanceId,
      authorId: userId,
      content: 'A comment',
    });

    const req = makeReq({ params: { caseId: String(grievanceId) } });
    const res = makeRes();

    await getCaseTimeline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.timeline.length).toBeGreaterThanOrEqual(2);
    expect(body.summary.totalSteps).toBe(1);
    expect(body.summary.totalComments).toBe(1);
    // Timeline should be sorted newest first
    const timestamps = body.timeline.map((e) => new Date(e.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });
});
