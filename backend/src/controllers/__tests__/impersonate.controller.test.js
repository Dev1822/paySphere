const { impersonateUser, stopImpersonation } = require('../user.controller');
const User = require('../../models/user.model');
const { createAuditLog } = require('../../services/audit.service');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

jest.mock('../../models/user.model');
jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn().mockResolvedValue(true),
}));
jest.mock('jsonwebtoken');

describe('Impersonate User Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      user: {
        _id: new mongoose.Types.ObjectId().toString(),
        fullName: 'Super Admin',
        email: 'admin@paysphere.com',
        role: { name: 'SuperAdmin' },
        tenantId: new mongoose.Types.ObjectId().toString(),
      },
      tenantId: new mongoose.Types.ObjectId().toString(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('impersonateUser', () => {
    it('should return 400 if targetUserId is missing', async () => {
      req.body = {};
      await impersonateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'targetUserId is required' });
    });

    it('should return 400 if targetUserId is invalid format', async () => {
      req.body = { targetUserId: 'invalid-id' };
      await impersonateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid targetUserId format' });
    });

    it('should return 400 if trying to impersonate self', async () => {
      req.body = { targetUserId: req.user._id };
      await impersonateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cannot impersonate yourself' });
    });

    it('should return 404 if target user is not found or inactive', async () => {
      req.body = { targetUserId: new mongoose.Types.ObjectId().toString() };
      User.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await impersonateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Target user not found or inactive' });
    });

    it('should return 403 if target user is another SuperAdmin', async () => {
      const targetId = new mongoose.Types.ObjectId().toString();
      req.body = { targetUserId: targetId };

      User.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: targetId,
          fullName: 'Other SuperAdmin',
          email: 'otheradmin@paysphere.com',
          role: { name: 'SuperAdmin' },
          isActive: true,
        }),
      });

      await impersonateUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cannot impersonate another SuperAdmin' });
    });

    it('should successfully impersonate target employee and generate JWT & audit log', async () => {
      const targetId = new mongoose.Types.ObjectId().toString();
      const sameTenant = req.tenantId;
      req.body = { targetUserId: targetId };

      const mockTargetUser = {
        _id: targetId,
        fullName: 'Jane Employee',
        email: 'jane@example.com',
        companyName: 'Acme Corp',
        accountType: 'EMPLOYEE',
        role: { _id: 'role-emp', name: 'Employee' },
        tenantId: sameTenant,
        isActive: true,
        tokenVersion: 1,
      };

      User.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTargetUser),
      });
      jwt.sign.mockReturnValue('mock-impersonation-token');

      await impersonateUser(req, res, next);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: targetId,
          isImpersonating: true,
          impersonatorId: req.user._id,
        }),
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'IMPERSONATE_USER_START',
          resourceType: 'User',
          resourceIds: [targetId],
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock-impersonation-token',
          isImpersonating: true,
        })
      );
    });
  });

  describe('stopImpersonation', () => {
    it('should return 400 if not currently impersonating', async () => {
      req.isImpersonating = false;
      await stopImpersonation(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No active impersonation session' });
    });

    it('should restore original superadmin token and log IMPERSONATE_USER_STOP', async () => {
      const superAdminId = new mongoose.Types.ObjectId().toString();
      const currentEmployeeId = new mongoose.Types.ObjectId().toString();

      req.isImpersonating = true;
      req.impersonatorId = superAdminId;
      req.userId = currentEmployeeId;
      req.tenantId = new mongoose.Types.ObjectId().toString();

      const mockSuperAdmin = {
        _id: superAdminId,
        fullName: 'Super Admin',
        email: 'admin@paysphere.com',
        companyName: 'Acme Corp',
        accountType: 'ADMIN',
        role: { _id: 'role-admin', name: 'SuperAdmin' },
        isActive: true,
        tokenVersion: 0
      };

      User.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSuperAdmin),
      });
      jwt.sign.mockReturnValue('mock-superadmin-restored-token');

      await stopImpersonation(req, res, next);

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'IMPERSONATE_USER_STOP',
          resourceType: 'User',
          resourceIds: [currentEmployeeId],
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock-superadmin-restored-token',
          isImpersonating: false,
        })
      );
    });
  });
});
