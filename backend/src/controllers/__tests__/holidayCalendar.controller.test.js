const mongoose = require('mongoose');
const HolidayCalendar = require('../../models/holidayCalendar.model');
const Employee = require('../../models/employee.model');
const {
  createCalendar,
  getCalendars,
  getCalendarById,
  updateCalendar,
  deleteCalendar,
  addHoliday,
  removeHoliday,
  getUpcomingHolidays,
  getHolidayStats,
} = require('../holidayCalendar.controller');

jest.mock('../../models/holidayCalendar.model');
jest.mock('../../models/employee.model');
jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('HolidayCalendar Controller', () => {
  let req, res, next;
  const userId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  const calId = new mongoose.Types.ObjectId().toString();
  const holidayId = new mongoose.Types.ObjectId().toString();

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

  describe('createCalendar', () => {
    it('should return 400 if name is missing', async () => {
      req.body = {};
      await createCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should create a global calendar', async () => {
      req.body = { name: 'India Holidays 2026' };
      HolidayCalendar.create.mockResolvedValue({
        _id: calId,
        name: 'India Holidays 2026',
        assignmentType: 'global',
      });
      await createCalendar(req, res, next);
      expect(HolidayCalendar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'India Holidays 2026',
          assignmentType: 'global',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should require assignedTo for department calendars', async () => {
      req.body = { name: 'Eng Holidays', assignmentType: 'department' };
      await createCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getCalendars', () => {
    it('should return all calendars for tenant', async () => {
      HolidayCalendar.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
      });
      await getCalendars(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getCalendarById', () => {
    it('should return 404 if not found', async () => {
      req.params.id = calId;
      HolidayCalendar.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await getCalendarById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
    it('should return the calendar', async () => {
      req.params.id = calId;
      const mock = { _id: calId, name: 'India' };
      HolidayCalendar.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mock),
      });
      await getCalendarById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ calendar: mock });
    });
  });

  describe('updateCalendar', () => {
    it('should return 404 if not found', async () => {
      req.params.id = calId;
      req.body = { name: 'Updated' };
      HolidayCalendar.findOne.mockResolvedValue(null);
      await updateCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
    it('should update name and save', async () => {
      req.params.id = calId;
      req.body = { name: 'Updated Name' };
      const mock = { _id: calId, name: 'Old', save: jest.fn() };
      HolidayCalendar.findOne.mockResolvedValue(mock);
      await updateCalendar(req, res, next);
      expect(mock.name).toBe('Updated Name');
      expect(mock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteCalendar', () => {
    it('should delete and return 200', async () => {
      req.params.id = calId;
      HolidayCalendar.findOneAndDelete.mockResolvedValue({ _id: calId });
      await deleteCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 404 if not found', async () => {
      req.params.id = calId;
      HolidayCalendar.findOneAndDelete.mockResolvedValue(null);
      await deleteCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('addHoliday', () => {
    it('should return 400 if date is missing', async () => {
      req.params.id = calId;
      req.body = { name: 'Republic Day' };
      await addHoliday(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should add a holiday to the calendar', async () => {
      req.params.id = calId;
      req.body = { date: '2026-01-26', name: 'Republic Day', type: 'gazetted' };
      const mock = {
        _id: calId,
        holidays: [],
        save: jest.fn(),
      };
      HolidayCalendar.findOne.mockResolvedValue(mock);
      await addHoliday(req, res, next);
      expect(mock.holidays).toHaveLength(1);
      expect(mock.holidays[0].name).toBe('Republic Day');
      expect(mock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should return 409 for duplicate date', async () => {
      req.params.id = calId;
      req.body = { date: '2026-01-26', name: 'Republic Day' };
      const existing = {
        _id: 'existing',
        date: new Date('2026-01-26'),
        name: 'Old',
      };
      const mock = {
        _id: calId,
        holidays: [existing],
        save: jest.fn(),
      };
      HolidayCalendar.findOne.mockResolvedValue(mock);
      await addHoliday(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('removeHoliday', () => {
    it('should remove a holiday from the calendar', async () => {
      req.params = { id: calId, holidayId };
      const mock = {
        _id: calId,
        holidays: [{ _id: holidayId, name: 'Republic Day', date: new Date() }],
        save: jest.fn(),
      };
      HolidayCalendar.findOne.mockResolvedValue(mock);
      await removeHoliday(req, res, next);
      expect(mock.holidays).toHaveLength(0);
      expect(mock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 404 if holiday not found', async () => {
      req.params = {
        id: calId,
        holidayId: new mongoose.Types.ObjectId().toString(),
      };
      const mock = { _id: calId, holidays: [], save: jest.fn() };
      HolidayCalendar.findOne.mockResolvedValue(mock);
      await removeHoliday(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getUpcomingHolidays', () => {
    it('should return upcoming holidays from global calendars', async () => {
      Employee.findOne.mockResolvedValue({ department: 'Eng' });
      HolidayCalendar.find.mockResolvedValue([
        {
          _id: calId,
          name: 'India',
          assignmentType: 'global',
          holidays: [
            {
              _id: 'h1',
              date: new Date('2026-12-25'),
              name: 'Christmas',
              type: 'gazetted',
            },
          ],
        },
      ]);
      await getUpcomingHolidays(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].holidays).toHaveLength(1);
    });
    it('should return empty if no employee record', async () => {
      Employee.findOne.mockResolvedValue(null);
      HolidayCalendar.find.mockResolvedValue([]);
      await getUpcomingHolidays(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].holidays).toHaveLength(0);
    });
  });

  describe('getHolidayStats', () => {
    it('should return aggregated stats', async () => {
      HolidayCalendar.find.mockResolvedValue([
        {
          holidays: [
            { type: 'gazetted' },
            { type: 'gazetted' },
            { type: 'restricted' },
            { type: 'half-day' },
          ],
        },
      ]);
      await getHolidayStats(req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body.totalCalendars).toBe(1);
      expect(body.totalHolidays).toBe(4);
      expect(body.byType.gazetted).toBe(2);
      expect(body.byType.restricted).toBe(1);
      expect(body.byType['half-day']).toBe(1);
    });
  });
});
