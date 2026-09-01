const mongoose = require('mongoose');

jest.mock('../../shutdown', () => ({
  getIsShuttingDown: jest.fn(() => false),
}), { virtual: true });

jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../../config/redis', () => ({
  isRedisAvailable: jest.fn(() => true),
}), { virtual: true });

const { liveness, readiness, metrics } = require('../health.controller');

describe('health.controller - Health & Readiness Controller Tests', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
  });

  describe('liveness', () => {
    it('returns status ok and process uptime', () => {
      liveness(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          uptime: expect.any(Number),
        })
      );
    });
  });

  describe('readiness', () => {
    it('returns 200 ready when mongo ping succeeds', async () => {
      const originalDb = mongoose.connection.db;
      mongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue(true),
        }),
      };

      await readiness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          checks: { mongo: true, redis: true },
          errors: [],
        })
      );

      mongoose.connection.db = originalDb;
    });

    it('returns 503 degraded when mongo ping fails', async () => {
      const originalDb = mongoose.connection.db;
      mongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockRejectedValue(new Error('Mongo timeout')),
        }),
      };

      await readiness(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          checks: { mongo: false, redis: true },
          errors: expect.arrayContaining(['MongoDB: Mongo timeout']),
        })
      );

      mongoose.connection.db = originalDb;
    });
  });

  describe('metrics', () => {
    it('serves prometheus metrics or returns 500 on failure', async () => {
      await metrics(req, res);
      expect(res.end).toHaveBeenCalled();
    });
  });
});
