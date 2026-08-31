const cron = require('node-cron');
const User = require('../../models/user.model');
const {
  getDashboardSummary,
} = require('../../controllers/dashboard.controller');
const cacheService = require('../../services/cache.service');
const logger = require('../../utils/logger');
const { startCacheWarming } = require('../cacheWarming.job');

// Mock dependencies
jest.mock('node-cron');
jest.mock('../../models/user.model');
jest.mock('../../controllers/dashboard.controller');
jest.mock('../../services/cache.service');
jest.mock('../../utils/logger');

describe('Cache Warming Job', () => {
  let cronTaskMock;
  let scheduleCallback;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock cron.schedule to capture the callback
    cronTaskMock = { stop: jest.fn() };
    cron.schedule.mockImplementation((schedule, callback) => {
      scheduleCallback = callback;
      return cronTaskMock;
    });

    // Mock cacheService.generateHash to return a predictable hash
    cacheService.generateHash.mockReturnValue('mocked-hash');
  });

  describe('startCacheWarming', () => {
    it('should register the cron job with the correct schedule', () => {
      const task = startCacheWarming();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 4 * * *',
        expect.any(Function),
      );
      expect(task).toBe(cronTaskMock);
    });
  });

  describe('Cron Job Execution', () => {
    beforeEach(() => {
      startCacheWarming();
    });

    it('should execute successfully when there are no users to warm', async () => {
      // Mock User.find to return an object with a limit method that returns an empty array
      const limitMock = jest.fn().mockResolvedValue([]);
      User.find.mockReturnValue({ limit: limitMock });

      await scheduleCallback();

      expect(logger.info).toHaveBeenCalledWith(
        'Starting daily cache warming process',
      );
      expect(User.find).toHaveBeenCalledWith({ isActive: true, role: 'admin' });
      expect(limitMock).toHaveBeenCalledWith(50);
      expect(logger.info).toHaveBeenCalledWith(
        'Cache warming completed successfully.',
      );
      expect(getDashboardSummary).not.toHaveBeenCalled();
      expect(cacheService.setEx).not.toHaveBeenCalled();
    });

    it('should execute successfully and warm cache for a single admin user', async () => {
      const mockUser = { _id: 'user1', tenantId: 'tenant1' };
      const limitMock = jest.fn().mockResolvedValue([mockUser]);
      User.find.mockReturnValue({ limit: limitMock });

      const mockDashboardData = { metrics: { totalEmployees: 100 } };

      // Mock getDashboardSummary to simulate a successful response
      getDashboardSummary.mockImplementation(async (req, res, next) => {
        // Assert the mock req object
        expect(req.userId).toBe('user1');
        expect(req.tenantId).toBe('tenant1');
        expect(req.originalUrl).toBe('/api/dashboard/summary');
        expect(req.query).toEqual({});

        // Chain status and json
        res.status(200).json(mockDashboardData);
      });

      await scheduleCallback();

      expect(getDashboardSummary).toHaveBeenCalledTimes(1);

      const expectedCacheKey =
        'dashboard:summary:user1:/api/dashboard/summary:mocked-hash';
      const expectedTags = ['dashboard', 'dashboard:summary:user1'];

      expect(cacheService.generateHash).toHaveBeenCalledWith(
        JSON.stringify({}),
      );
      expect(cacheService.setEx).toHaveBeenCalledWith(
        expectedCacheKey,
        86400,
        mockDashboardData,
        expectedTags,
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'Warmed dashboard cache for user user1',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Cache warming completed successfully.',
      );
    });

    it('should handle users without a tenantId correctly', async () => {
      const mockUser = { _id: 'user_no_tenant' };
      const limitMock = jest.fn().mockResolvedValue([mockUser]);
      User.find.mockReturnValue({ limit: limitMock });

      const mockDashboardData = { metrics: { totalEmployees: 50 } };

      getDashboardSummary.mockImplementation(async (req, res, next) => {
        expect(req.userId).toBe('user_no_tenant');
        expect(req.tenantId).toBeNull();
        res.status(200).json(mockDashboardData);
      });

      await scheduleCallback();

      expect(getDashboardSummary).toHaveBeenCalledTimes(1);
      expect(cacheService.setEx).toHaveBeenCalledTimes(1);
    });

    it('should not cache if the dashboard summary returns a non-200 status', async () => {
      const mockUser = { _id: 'user1' };
      const limitMock = jest.fn().mockResolvedValue([mockUser]);
      User.find.mockReturnValue({ limit: limitMock });

      getDashboardSummary.mockImplementation(async (req, res, next) => {
        res.status(400).json({ error: 'Bad Request' });
      });

      await scheduleCallback();

      expect(getDashboardSummary).toHaveBeenCalledTimes(1);
      expect(cacheService.setEx).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Cache warming completed successfully.',
      );
    });

    it('should continue processing remaining users if one user fails', async () => {
      const mockUser1 = { _id: 'user1' };
      const mockUser2 = { _id: 'user2' };
      const mockUser3 = { _id: 'user3' };
      const limitMock = jest
        .fn()
        .mockResolvedValue([mockUser1, mockUser2, mockUser3]);
      User.find.mockReturnValue({ limit: limitMock });

      const mockDashboardData = { metrics: { success: true } };

      getDashboardSummary.mockImplementation(async (req, res, next) => {
        if (req.userId === 'user2') {
          throw new Error('Simulated controller error');
        }
        res.status(200).json(mockDashboardData);
      });

      await scheduleCallback();

      expect(getDashboardSummary).toHaveBeenCalledTimes(3);
      expect(cacheService.setEx).toHaveBeenCalledTimes(2); // user1 and user3

      // Verify the error was logged for user2
      expect(logger.error).toHaveBeenCalledWith(
        'Error warming cache for user user2: Simulated controller error',
      );

      // Verify overall completion
      expect(logger.info).toHaveBeenCalledWith(
        'Cache warming completed successfully.',
      );
    });

    it('should log a generic error if the User query fails completely', async () => {
      const dbError = new Error('Database connection failed');
      const limitMock = jest.fn().mockRejectedValue(dbError);
      User.find.mockReturnValue({ limit: limitMock });

      await scheduleCallback();

      expect(User.find).toHaveBeenCalledTimes(1);
      expect(getDashboardSummary).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to run cache warming job:',
        'Database connection failed',
      );
    });

    it('should properly handle next() being called with an error by the controller', async () => {
      const mockUser = { _id: 'user1' };
      const limitMock = jest.fn().mockResolvedValue([mockUser]);
      User.find.mockReturnValue({ limit: limitMock });

      getDashboardSummary.mockImplementation(async (req, res, next) => {
        next(new Error('Controller passed error to next'));
      });

      await scheduleCallback();

      expect(getDashboardSummary).toHaveBeenCalledTimes(1);
      expect(cacheService.setEx).not.toHaveBeenCalled();

      // The error thrown inside the next() mock should be caught and logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error warming cache for user user1: Controller passed error to next',
      );
    });

    it('should test chainability of mock response object set() method', async () => {
      const mockUser = { _id: 'user1' };
      const limitMock = jest.fn().mockResolvedValue([mockUser]);
      User.find.mockReturnValue({ limit: limitMock });

      getDashboardSummary.mockImplementation(async (req, res, next) => {
        // Assert that res.set() returns res, allowing chaining
        res.set('Cache-Control', 'private').status(200).json({ ok: true });
      });

      await scheduleCallback();

      expect(getDashboardSummary).toHaveBeenCalledTimes(1);
      expect(cacheService.setEx).toHaveBeenCalledTimes(1);
    });
  });
});
