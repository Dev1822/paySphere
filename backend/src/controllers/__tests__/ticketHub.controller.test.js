/**
 * @fileoverview Ticket Hub Controller Tests
 * @description Unit tests for the helpdesk ticketing hub controller covering
 * categories, SLA policies, tickets, comments, assignment, and dashboard.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });

jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
const eventBus = require('../../services/event.service');

const { TicketCategory, SLAPolicy, Ticket, TicketComment } = require('../../models/ticketHub.model');

const tenantId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
function makeReq(overrides = {}) { return { tenantId, userId, params: {}, body: {}, query: {}, ...overrides }; }
function makeRes() { return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }; }
const next = jest.fn();

let categoryId;
beforeEach(async () => {
  await Promise.all([
    TicketCategory.deleteMany({}), SLAPolicy.deleteMany({}),
    Ticket.deleteMany({}), TicketComment.deleteMany({}),
  ]);
  eventBus.emit.mockClear(); next.mockClear();
  const cat = await TicketCategory.create({ tenantId, name: 'IT Support', defaultPriority: 'HIGH' });
  categoryId = cat._id;
  await SLAPolicy.create({ tenantId, name: 'High SLA', priority: 'HIGH', firstResponseHours: 4, resolutionHours: 8, escalationAfterHours: 6 });
});

const { createCategory, getCategories, createSLAPolicy, getSLAPolicies, createTicket, getTickets, getTicket, updateTicket, addComment, assignTicket, getDashboard } = require('../ticketHub.controller');

describe('TicketCategory', () => {
  test('createCategory creates a category', async () => {
    const req = makeReq({ body: { name: 'Payroll', defaultPriority: 'MEDIUM' } });
    const res = makeRes();
    await createCategory(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ category: expect.objectContaining({ name: 'Payroll' }) }));
  });
  test('getCategories returns active categories', async () => {
    const req = makeReq(); const res = makeRes();
    await getCategories(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].categories).toHaveLength(1);
  });
});

describe('SLAPolicy', () => {
  test('createSLAPolicy creates a policy', async () => {
    const req = makeReq({ body: { name: 'Low SLA', priority: 'LOW', firstResponseHours: 24, resolutionHours: 72, escalationAfterHours: 48 } });
    const res = makeRes();
    await createSLAPolicy(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
  });
  test('getSLAPolicies returns policies', async () => {
    const req = makeReq(); const res = makeRes();
    await getSLAPolicies(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].policies).toHaveLength(1);
  });
});

describe('Ticket', () => {
  test('createTicket creates a ticket with SLA deadlines', async () => {
    const req = makeReq({ body: { categoryId: String(categoryId), subject: 'VPN Issue', description: 'Cannot connect', priority: 'HIGH' } });
    const res = makeRes();
    await createTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.ticket.ticketNumber).toMatch(/^TKT-2026-/);
    expect(body.ticket.resolutionDueAt).toBeTruthy();
    expect(body.ticket.firstResponseDueAt).toBeTruthy();
  });
  test('getTickets returns paginated results', async () => {
    await Ticket.create(Array.from({ length: 5 }, (_, i) => ({
      tenantId, categoryId, subject: `T${i}`, description: `D${i}`, requesterId: new mongoose.Types.ObjectId(),
      ticketNumber: `TKT-2026-${String(i + 100).padStart(4, '0')}`,
    })));
    const req = makeReq({ query: { page: 1, limit: 3 } });
    const res = makeRes();
    await getTickets(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.tickets).toHaveLength(3);
    expect(body.pagination.total).toBe(5);
  });
  test('getTicket returns ticket with comments and SLA status', async () => {
    const t = await Ticket.create({
      tenantId, categoryId, subject: 'Test', description: 'Desc',
      requesterId: new mongoose.Types.ObjectId(), ticketNumber: 'TKT-2026-0999',
      resolutionDueAt: new Date(Date.now() + 8 * 3600000),
    });
    const req = makeReq({ params: { ticketId: String(t._id) } });
    const res = makeRes();
    await getTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.slaStatus).toBe('ON_TRACK');
    expect(Array.isArray(body.comments)).toBe(true);
  });
  test('updateTicket changes status and logs system event', async () => {
    const t = await Ticket.create({
      tenantId, categoryId, subject: 'Update', description: 'D',
      requesterId: new mongoose.Types.ObjectId(), ticketNumber: 'TKT-2026-0998',
    });
    const req = makeReq({ params: { ticketId: String(t._id) }, body: { status: 'IN_PROGRESS' } });
    const res = makeRes();
    await updateTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await Ticket.findById(t._id);
    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.firstResponseAt).toBeTruthy();
    const sysComment = await TicketComment.findOne({ ticketId: t._id, isSystemEvent: true });
    expect(sysComment).toBeTruthy();
  });
  test('assignTicket assigns and transitions OPEN to IN_PROGRESS', async () => {
    const t = await Ticket.create({
      tenantId, categoryId, subject: 'Assign', description: 'D',
      requesterId: new mongoose.Types.ObjectId(), ticketNumber: 'TKT-2026-0997', status: 'OPEN',
    });
    const req = makeReq({ params: { ticketId: String(t._id) }, body: { assigneeId: userId, assigneeName: 'Test HR' } });
    const res = makeRes();
    await assignTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await Ticket.findById(t._id);
    expect(updated.assigneeName).toBe('Test HR');
    expect(updated.status).toBe('IN_PROGRESS');
  });
});

describe('getDashboard', () => {
  test('returns aggregated metrics', async () => {
    await Ticket.create([
      { tenantId, categoryId, subject: 'T1', description: 'D1', requesterId: new mongoose.Types.ObjectId(), ticketNumber: 'TKT-2026-1000', status: 'OPEN', priority: 'HIGH' },
      { tenantId, categoryId, subject: 'T2', description: 'D2', requesterId: new mongoose.Types.ObjectId(), ticketNumber: 'TKT-2026-1001', status: 'RESOLVED', priority: 'LOW' },
    ]);
    const req = makeReq(); const res = makeRes();
    await getDashboard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.totalTickets).toBe(2);
    expect(body.openTickets).toBe(1);
    expect(body.resolvedTickets).toBe(1);
    expect(typeof body.avgResolutionHours).toBe('number');
  });
});
