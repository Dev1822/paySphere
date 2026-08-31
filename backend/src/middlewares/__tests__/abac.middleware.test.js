const { requireAbac } = require('../abac.middleware');
const { evaluateAccess } = require('../../services/abacEngine.service');

jest.mock('../../services/abacEngine.service');
jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('ABAC Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: 'user123',
      userRole: 'role123',
      tenantId: 'tenant123',
      ip: '127.0.0.1',
      method: 'GET',
      path: '/api/employees/1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    req.userId = null;
    req.user = null;

    const middleware = requireAbac('employee:read', 'Employee');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next if evaluateAccess returns true', async () => {
    evaluateAccess.mockResolvedValue(true);

    const middleware = requireAbac('employee:read', 'Employee');
    await middleware(req, res, next);

    expect(evaluateAccess).toHaveBeenCalledWith(
      { _id: 'user123', role: 'role123', tenantId: 'tenant123' },
      'employee:read',
      'Employee',
      {},
      { ip: '127.0.0.1', method: 'GET', path: '/api/employees/1' },
    );
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if evaluateAccess returns false', async () => {
    evaluateAccess.mockResolvedValue(false);

    const middleware = requireAbac('employee:read', 'Employee');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Access denied for action: employee:read on resource: Employee',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should run resourceFetcher and inject resourceData into evaluateAccess', async () => {
    evaluateAccess.mockResolvedValue(true);
    const mockFetcher = jest
      .fn()
      .mockResolvedValue({ id: '1', department: 'Sales' });

    const middleware = requireAbac('employee:read', 'Employee', mockFetcher);
    await middleware(req, res, next);

    expect(mockFetcher).toHaveBeenCalledWith(req);
    expect(req.abacResource).toEqual({ id: '1', department: 'Sales' });
    expect(evaluateAccess).toHaveBeenCalledWith(
      expect.any(Object),
      'employee:read',
      'Employee',
      { id: '1', department: 'Sales' },
      expect.any(Object),
    );
    expect(next).toHaveBeenCalled();
  });

  it('should return 404 if resourceFetcher returns null', async () => {
    const mockFetcher = jest.fn().mockResolvedValue(null);

    const middleware = requireAbac('employee:read', 'Employee', mockFetcher);
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Resource not found' });
    expect(evaluateAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 if evaluateAccess throws an error', async () => {
    evaluateAccess.mockRejectedValue(new Error('DB Error'));

    const middleware = requireAbac('employee:read', 'Employee');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error during authorization check',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
