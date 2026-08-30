/**
 * @fileoverview Nomination Controller Tests
 * @description Unit tests for the recognition & nomination workflow controller
 * covering category management, peer nominations, approval, comments, cycles,
 * leaderboard, and dashboard analytics.
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
  NominationCategory,
  Nomination,
  RecognitionCycle,
  NominationComment,
} = require('../../models/nomination.model');

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
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const next = jest.fn();

// ─── Shared fixtures ─────────────────────────────────────────────────────────

let categoryId;

beforeEach(async () => {
  await Promise.all([
    NominationCategory.deleteMany({}),
    Nomination.deleteMany({}),
    RecognitionCycle.deleteMany({}),
    NominationComment.deleteMany({}),
  ]);

  eventBus.emit.mockClear();
  next.mockClear();

  const cat = await NominationCategory.create({
    tenantId,
    name: 'Team Player',
    description: 'For collaboration',
    pointsPerNomination: 15,
    maxNominationsPerMonth: 5,
    requiresManagerApproval: false,
    createdBy: userId,
  });
  categoryId = cat._id;
});

// ─── Import controller ───────────────────────────────────────────────────────

const {
  createCategory,
  getCategories,
  updateCategory,
  createNomination,
  getFeed,
  getMyNominations,
  approveNomination,
  rejectNomination,
  addComment,
  getComments,
  createCycle,
  finalizeCycle,
  getLeaderboard,
  getDashboard,
} = require('../nomination.controller');

// ─── Category Tests ──────────────────────────────────────────────────────────

describe('NominationCategory', () => {
  test('createCategory creates a category and emits audit log', async () => {
    const req = makeReq({
      body: {
        name: 'Innovation Champion',
        description: 'For creative solutions',
        pointsPerNomination: 25,
        maxNominationsPerMonth: 2,
      },
    });
    const res = makeRes();

    await createCategory(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        category: expect.objectContaining({ name: 'Innovation Champion' }),
      }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'AUDIT_LOG',
      expect.objectContaining({ action: 'NOMINATION_CATEGORY_CREATED' }),
    );
  });

  test('getCategories returns all active categories', async () => {
    await NominationCategory.create({
      tenantId,
      name: 'Second Category',
      pointsPerNomination: 10,
      maxNominationsPerMonth: 3,
    });

    const req = makeReq();
    const res = makeRes();

    await getCategories(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.categories).toHaveLength(2);
  });

  test('updateCategory updates category fields', async () => {
    const req = makeReq({
      params: { categoryId: String(categoryId) },
      body: { name: 'Updated Name', pointsPerNomination: 20 },
    });
    const res = makeRes();

    await updateCategory(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await NominationCategory.findById(categoryId);
    expect(updated.name).toBe('Updated Name');
    expect(updated.pointsPerNomination).toBe(20);
  });
});

// ─── Nomination Tests ────────────────────────────────────────────────────────

describe('Nomination', () => {
  test('createNomination creates a nomination when category allows direct approval', async () => {
    const nomineeId = new mongoose.Types.ObjectId();
    const req = makeReq({
      body: {
        categoryId: String(categoryId),
        nomineeId: String(nomineeId),
        title: 'Outstanding sprint delivery',
        reason: 'Delivered a critical feature ahead of schedule.',
      },
    });
    const res = makeRes();

    await createNomination(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.nomination.status).toBe('APPROVED');
    expect(body.nomination.pointsAwarded).toBe(15);
  });

  test('createNomination returns PENDING_APPROVAL when category requires manager approval', async () => {
    const approvalCat = await NominationCategory.create({
      tenantId,
      name: 'Customer Hero',
      pointsPerNomination: 20,
      maxNominationsPerMonth: 3,
      requiresManagerApproval: true,
    });

    const nomineeId = new mongoose.Types.ObjectId();
    const req = makeReq({
      body: {
        categoryId: String(approvalCat._id),
        nomineeId: String(nomineeId),
        title: 'Saved a critical account',
        reason: 'Resolved a complex issue for a major client.',
      },
    });
    const res = makeRes();

    await createNomination(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.nomination.status).toBe('PENDING_APPROVAL');
    expect(body.nomination.pointsAwarded).toBe(0);
  });

  test('getFeed returns public nominations with pagination', async () => {
    await Nomination.create([
      {
        tenantId,
        categoryId,
        nomineeId: new mongoose.Types.ObjectId(),
        nominatorId: userId,
        title: 'Nom 1',
        reason: 'Reason 1',
        status: 'APPROVED',
        pointsAwarded: 15,
        isPublic: true,
      },
      {
        tenantId,
        categoryId,
        nomineeId: new mongoose.Types.ObjectId(),
        nominatorId: userId,
        title: 'Nom 2',
        reason: 'Reason 2',
        status: 'APPROVED',
        pointsAwarded: 15,
        isPublic: true,
      },
    ]);

    const req = makeReq({ query: { page: 1, limit: 10 } });
    const res = makeRes();

    await getFeed(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.nominations).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });
});

// ─── Approval Tests ──────────────────────────────────────────────────────────

describe('Approval Workflow', () => {
  let pendingNomination;

  beforeEach(async () => {
    const approvalCat = await NominationCategory.create({
      tenantId,
      name: 'Impact Driver',
      pointsPerNomination: 30,
      maxNominationsPerMonth: 2,
      requiresManagerApproval: true,
    });

    pendingNomination = await Nomination.create({
      tenantId,
      categoryId: approvalCat._id,
      nomineeId: new mongoose.Types.ObjectId(),
      nominatorId: userId,
      title: 'Critical project success',
      reason: 'Led the project to success.',
      pointsAwarded: 0,
      status: 'PENDING_APPROVAL',
    });
  });

  test('approveNomination sets status to APPROVED and awards points', async () => {
    const req = makeReq({
      params: { nominationId: String(pendingNomination._id) },
      body: { approvalNote: 'Well deserved!' },
    });
    const res = makeRes();

    await approveNomination(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await Nomination.findById(pendingNomination._id);
    expect(updated.status).toBe('APPROVED');
    expect(updated.pointsAwarded).toBe(30);
    expect(updated.approvedBy).toEqual(userId);
  });

  test('rejectNomination sets status to REJECTED', async () => {
    const req = makeReq({
      params: { nominationId: String(pendingNomination._id) },
      body: { reason: 'Needs more detail' },
    });
    const res = makeRes();

    await rejectNomination(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await Nomination.findById(pendingNomination._id);
    expect(updated.status).toBe('REJECTED');
    expect(updated.rejectedBy).toEqual(userId);
  });
});

// ─── Comment Tests ───────────────────────────────────────────────────────────

describe('NominationComment', () => {
  test('addComment creates a comment and increments commentCount', async () => {
    const nomination = await Nomination.create({
      tenantId,
      categoryId,
      nomineeId: new mongoose.Types.ObjectId(),
      nominatorId: userId,
      title: 'Test nomination',
      reason: 'For testing',
      status: 'APPROVED',
      pointsAwarded: 15,
      commentCount: 0,
    });

    const req = makeReq({
      params: { nominationId: String(nomination._id) },
      body: { content: 'Great work!' },
    });
    const res = makeRes();

    await addComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const updated = await Nomination.findById(nomination._id);
    expect(updated.commentCount).toBe(1);
  });

  test('getComments returns comments for a nomination', async () => {
    const nomination = await Nomination.create({
      tenantId,
      categoryId,
      nomineeId: new mongoose.Types.ObjectId(),
      nominatorId: userId,
      title: 'Test',
      reason: 'For test',
      status: 'APPROVED',
      pointsAwarded: 15,
    });

    await NominationComment.create({
      tenantId,
      nominationId: nomination._id,
      authorId: userId,
      content: 'Awesome!',
    });

    const req = makeReq({ params: { nominationId: String(nomination._id) } });
    const res = makeRes();

    await getComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.comments).toHaveLength(1);
  });
});

// ─── Cycle Tests ─────────────────────────────────────────────────────────────

describe('RecognitionCycle', () => {
  test('createCycle creates a cycle with correct dates', async () => {
    const req = makeReq({
      body: { title: 'August 2026', month: 8, year: 2026 },
    });
    const res = makeRes();

    await createCycle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.cycle.month).toBe(8);
    expect(body.cycle.year).toBe(2026);
    expect(body.cycle.status).toBe('DRAFT');
  });

  test('createCycle rejects duplicate month/year', async () => {
    await RecognitionCycle.create({
      tenantId,
      title: 'First',
      month: 8,
      year: 2026,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      status: 'OPEN',
    });

    const req = makeReq({
      body: { title: 'Duplicate', month: 8, year: 2026 },
    });
    const res = makeRes();

    await createCycle(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 11000 }),
    );
  });

  test('finalizeCycle computes totals and sets FINALIZED', async () => {
    const cycle = await RecognitionCycle.create({
      tenantId,
      title: 'July 2026',
      month: 7,
      year: 2026,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      status: 'CLOSED',
    });

    // Add approved nominations for this cycle
    await Nomination.create([
      {
        tenantId, categoryId, cycleId: cycle._id,
        nomineeId: new mongoose.Types.ObjectId(), nominatorId: userId,
        title: 'N1', reason: 'R1', status: 'APPROVED', pointsAwarded: 15,
      },
      {
        tenantId, categoryId, cycleId: cycle._id,
        nomineeId: new mongoose.Types.ObjectId(), nominatorId: userId,
        title: 'N2', reason: 'R2', status: 'APPROVED', pointsAwarded: 15,
      },
    ]);

    const req = makeReq({ params: { cycleId: String(cycle._id) } });
    const res = makeRes();

    await finalizeCycle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await RecognitionCycle.findById(cycle._id);
    expect(updated.status).toBe('FINALIZED');
    expect(updated.totalNominations).toBe(2);
    expect(updated.totalPointsAwarded).toBe(30);
  });
});

// ─── Dashboard & Leaderboard Tests ───────────────────────────────────────────

describe('getDashboard', () => {
  test('returns aggregated metrics', async () => {
    await Nomination.create([
      {
        tenantId, categoryId,
        nomineeId: new mongoose.Types.ObjectId(), nominatorId: userId,
        title: 'N1', reason: 'R1', status: 'APPROVED', pointsAwarded: 15, isPublic: true,
      },
      {
        tenantId, categoryId,
        nomineeId: new mongoose.Types.ObjectId(), nominatorId: userId,
        title: 'N2', reason: 'R2', status: 'PENDING_APPROVAL', pointsAwarded: 0, isPublic: true,
      },
    ]);

    const req = makeReq();
    const res = makeRes();

    await getDashboard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.totalNominations).toBe(1);
    expect(body.pendingApprovals).toBe(1);
    expect(body.totalCategories).toBe(1);
    expect(Array.isArray(body.recentNominations)).toBe(true);
  });
});

describe('getLeaderboard', () => {
  test('returns top nominees ranked by points', async () => {
    const nom1 = new mongoose.Types.ObjectId();
    const nom2 = new mongoose.Types.ObjectId();

    await Nomination.create([
      {
        tenantId, categoryId, nomineeId: nom1, nominatorId: userId,
        title: 'N1', reason: 'R1', status: 'APPROVED', pointsAwarded: 30,
      },
      {
        tenantId, categoryId, nomineeId: nom1, nominatorId: userId,
        title: 'N2', reason: 'R2', status: 'APPROVED', pointsAwarded: 15,
      },
      {
        tenantId, categoryId, nomineeId: nom2, nominatorId: userId,
        title: 'N3', reason: 'R3', status: 'APPROVED', pointsAwarded: 10,
      },
    ]);

    const req = makeReq({ query: { limit: 5 } });
    const res = makeRes();

    await getLeaderboard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.leaderboard).toHaveLength(2);
    // First entry should have more points
    expect(body.leaderboard[0].totalPoints).toBeGreaterThanOrEqual(
      body.leaderboard[1].totalPoints,
    );
  });
});
