const mongoose = require('mongoose');
const CompanyEvent = require('../../models/companyEvent.model');
const EventRSVP = require('../../models/eventRSVP.model');
const Employee = require('../../models/employee.model');
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  rsvp,
  checkIn,
  getMyRSVPs,
  getEventAttendees,
  getEventAnalytics,
} = require('../companyEvent.controller');

jest.mock('../../models/companyEvent.model');
jest.mock('../../models/eventRSVP.model');
jest.mock('../../models/employee.model');
jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('CompanyEvent Controller', () => {
  let req, res, next;
  const userId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  const eventId = new mongoose.Types.ObjectId().toString();
  const employeeId = new mongoose.Types.ObjectId().toString();
  const rsvpId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      userId,
      tenantId,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('createEvent', () => {
    it('should return 400 if title is missing', async () => {
      req.body = {
        startDateTime: '2026-10-01T10:00:00Z',
        endDateTime: '2026-10-01T12:00:00Z',
      };
      await createEvent(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should return 400 if endDateTime is before startDateTime', async () => {
      req.body = {
        title: 'Party',
        startDateTime: '2026-10-01T12:00:00Z',
        endDateTime: '2026-10-01T10:00:00Z',
      };
      await createEvent(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should create a company event', async () => {
      req.body = {
        title: 'Diwali Party',
        category: 'celebration',
        startDateTime: '2026-10-20T18:00:00Z',
        endDateTime: '2026-10-20T22:00:00Z',
        location: 'Office Rooftop',
      };
      CompanyEvent.create.mockResolvedValue({
        _id: eventId,
        title: 'Diwali Party',
      });
      await createEvent(req, res, next);
      expect(CompanyEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Diwali Party',
          category: 'celebration',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getEvents', () => {
    it('should return events', async () => {
      CompanyEvent.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
      });
      await getEvents(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getEventById', () => {
    it('should return 404 if not found', async () => {
      req.params.id = eventId;
      CompanyEvent.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await getEventById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
    it('should return event with RSVP stats', async () => {
      req.params.id = eventId;
      const mock = { _id: eventId, title: 'Party' };
      CompanyEvent.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mock),
      });
      EventRSVP.countDocuments.mockResolvedValue(0);
      await getEventById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].rsvpStats).toBeDefined();
    });
  });

  describe('updateEvent', () => {
    it('should update event fields', async () => {
      req.params.id = eventId;
      req.body = { title: 'Updated Party', location: 'New Location' };
      const mock = { _id: eventId, title: 'Old', save: jest.fn() };
      CompanyEvent.findOne.mockResolvedValue(mock);
      await updateEvent(req, res, next);
      expect(mock.title).toBe('Updated Party');
      expect(mock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteEvent', () => {
    it('should delete event and clean up RSVPs', async () => {
      req.params.id = eventId;
      CompanyEvent.findOneAndDelete.mockResolvedValue({ _id: eventId });
      EventRSVP.deleteMany.mockResolvedValue({ deletedCount: 5 });
      await deleteEvent(req, res, next);
      expect(EventRSVP.deleteMany).toHaveBeenCalledWith({ eventId, tenantId });
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 404 if not found', async () => {
      req.params.id = eventId;
      CompanyEvent.findOneAndDelete.mockResolvedValue(null);
      await deleteEvent(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('rsvp', () => {
    it('should record an RSVP', async () => {
      req.params.id = eventId;
      req.body = { status: 'going', note: 'Excited!' };
      CompanyEvent.findOne.mockResolvedValue({
        _id: eventId,
        maxAttendees: null,
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      EventRSVP.countDocuments.mockResolvedValue(0);
      EventRSVP.findOneAndUpdate.mockResolvedValue({
        _id: rsvpId,
        status: 'going',
      });
      await rsvp(req, res, next);
      expect(EventRSVP.findOneAndUpdate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 400 for invalid status', async () => {
      req.params.id = eventId;
      req.body = { status: 'invalid' };
      await rsvp(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should return 409 if event is at capacity', async () => {
      req.params.id = eventId;
      req.body = { status: 'going' };
      CompanyEvent.findOne.mockResolvedValue({ _id: eventId, maxAttendees: 2 });
      EventRSVP.countDocuments.mockResolvedValue(2);
      EventRSVP.findOne.mockResolvedValue(null);
      await rsvp(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('checkIn', () => {
    it('should check in to event', async () => {
      req.params.id = eventId;
      CompanyEvent.findOne.mockResolvedValue({ _id: eventId });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      const mock = {
        _id: rsvpId,
        status: 'going',
        checkedIn: false,
        save: jest.fn(),
      };
      EventRSVP.findOne.mockResolvedValue(mock);
      await checkIn(req, res, next);
      expect(mock.checkedIn).toBe(true);
      expect(mock.checkedInAt).toBeInstanceOf(Date);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 400 if not going', async () => {
      req.params.id = eventId;
      CompanyEvent.findOne.mockResolvedValue({ _id: eventId });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      EventRSVP.findOne.mockResolvedValue({ status: 'not-going' });
      await checkIn(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getMyRSVPs', () => {
    it('should return RSVPs for the employee', async () => {
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      EventRSVP.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
      });
      await getMyRSVPs(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getEventAttendees', () => {
    it('should return attendee list', async () => {
      req.params.id = eventId;
      EventRSVP.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
      });
      await getEventAttendees(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getEventAnalytics', () => {
    it('should return analytics for an event', async () => {
      req.params.id = eventId;
      CompanyEvent.findOne.mockResolvedValue({ _id: eventId, title: 'Party' });
      EventRSVP.find.mockResolvedValue([
        { status: 'going', checkedIn: true, employeeId: { department: 'Eng' } },
        {
          status: 'going',
          checkedIn: false,
          employeeId: { department: 'Eng' },
        },
        {
          status: 'not-going',
          checkedIn: false,
          employeeId: { department: 'Sales' },
        },
      ]);
      await getEventAnalytics(req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body.stats.going).toBe(2);
      expect(body.stats.noShow).toBe(1);
      expect(body.stats.notGoing).toBe(1);
    });
    it('should return 404 if event not found', async () => {
      req.params.id = eventId;
      CompanyEvent.findOne.mockResolvedValue(null);
      await getEventAnalytics(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
