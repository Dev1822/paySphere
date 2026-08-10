const { googleAuth, updatePassword, deleteAccount } = require('../user.controller');
const User = require('../../models/user.model');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn(),
}));
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            sub: 'google123',
            email: 'newuser@example.com',
            name: 'New User',
            picture: 'avatar.png',
          }),
        }),
      };
    }),
  };
});

jest.mock('../../models/user.model', () => {
  const mockConstructor = jest.fn().mockImplementation((data) => {
    return {
      ...data,
      save: jest.fn().mockResolvedValue({}),
    };
  });
  mockConstructor.findOne = jest.fn();
  mockConstructor.findById = jest.fn();
  mockConstructor.findByIdAndDelete = jest.fn();
  return mockConstructor;
});

jest.mock('../../models/employee.model', () => {
  return {
    deleteMany: jest.fn(),
  };
});

jest.mock('../../models/payroll.model', () => {
  return {
    deleteMany: jest.fn(),
  };
});

jest.mock('../../models/auditLog.model', () => {
  return {
    deleteMany: jest.fn(),
  };
});

describe('Google Authentication Controller tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {
        credential: 'dummy_id_token',
        companyName: 'Test Company',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    next = jest.fn((err) => console.log('GOOGLE AUTH ERROR:', err));
    jwt.sign.mockReturnValue('dummy_jwt_token');
  });

  test("should return 'Account created successfully' for a new Google sign-up", async () => {
    User.findOne.mockResolvedValueOnce(null);

    await googleAuth(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'newuser@example.com' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: 'dummy_jwt_token',
      companyName: 'Test Company',
      message: 'Account created successfully',
    });
  });

  test("should return 'Logged in successfully' for an existing user logging in", async () => {
    const existingUser = {
      _id: 'user123',
      email: 'newuser@example.com',
      companyName: 'Test Company',
      googleId: 'google123',
      save: jest.fn().mockResolvedValue({}),
    };

    User.findOne.mockResolvedValueOnce(existingUser);

    await googleAuth(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'newuser@example.com' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: 'dummy_jwt_token',
      companyName: 'Test Company',
      message: 'Logged in successfully',
    });
  });
});

describe('Update Password Controller tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      userId: 'user123',
      body: {
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('should update password and increment tokenVersion successfully with valid inputs', async () => {
    const mockUser = {
      _id: 'user123',
      password: 'hashed_old_password',
      tokenVersion: 0,
      save: jest.fn().mockResolvedValue({}),
    };

    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hashed_new_password');

    await updatePassword(req, res, next);

    expect(mockUser.tokenVersion).toBe(1);
    expect(mockUser.password).toBe('hashed_new_password');
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password updated successfully' });
  });

  test('should increment tokenVersion from undefined to 1', async () => {
    const mockUser = {
      _id: 'user123',
      password: 'hashed_old_password',
      // tokenVersion is undefined (not set)
      save: jest.fn().mockResolvedValue({}),
    };

    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hashed_new_password');

    await updatePassword(req, res, next);

    expect(mockUser.tokenVersion).toBe(1);
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('should return 400 if currentPassword is missing', async () => {
    req.body = { newPassword: 'NewPass1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Current password and new password are required' });
  });

  test('should return 400 if newPassword is missing', async () => {
    req.body = { currentPassword: 'OldPass1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Current password and new password are required' });
  });

  test('should return 400 if newPassword is too short', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'Ab1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character' });
  });

  test('should return 400 if newPassword lacks uppercase', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'lowercase1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 400 if newPassword lacks number', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'NoNumber!!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 400 if newPassword lacks special character', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'NoSpecial1' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 400 if newPassword is a weak string', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: '1' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character' });
  });

  test('should return 404 if user not found', async () => {
    User.findById.mockResolvedValue(null);

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  test('should return 400 if current password is incorrect', async () => {
    const mockUser = {
      _id: 'user123',
      password: 'hashed_old_password',
      tokenVersion: 0,
      save: jest.fn(),
    };

    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Incorrect current password' });
    expect(mockUser.save).not.toHaveBeenCalled();
  });

  test('should return 400 if user has no password set', async () => {
    const mockUser = {
      _id: 'user123',
      password: null,
    };

    User.findById.mockResolvedValue(mockUser);

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'No password set. Please use password recovery.' });
  });
});

describe('Delete Account Controller tests', () => {
  let req;
  let res;
  let next;
  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: 'user123' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should delete account atomically within a transaction', async () => {
    User.findById.mockResolvedValue({ _id: 'user123' });
    Employee.deleteMany.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });
    PayrollUpdate.deleteMany.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });
    User.findByIdAndDelete.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });

    await deleteAccount(req, res, next);

    expect(mongoose.startSession).toHaveBeenCalled();
    expect(mockSession.startTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account and associated data deleted successfully.' });
  });

  test('should return 404 if user not found', async () => {
    User.findById.mockResolvedValue(null);

    await deleteAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('should abort transaction and call next(error) on failure', async () => {
    const error = new Error('Database failure');
    User.findById.mockResolvedValue({ _id: 'user123' });
    Employee.deleteMany.mockImplementation(() => { throw error; });

    await deleteAccount(req, res, next);

    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should fall back to non-transactional delete when transactions are not supported', async () => {
    jest.spyOn(mongoose, 'startSession').mockRejectedValue(new Error('Transactions not supported'));

    User.findById.mockResolvedValue({ _id: 'user123' });
    Employee.deleteMany.mockResolvedValue({ deletedCount: 3 });
    PayrollUpdate.deleteMany.mockResolvedValue({ deletedCount: 5 });
    User.findByIdAndDelete.mockResolvedValue({ deletedCount: 1 });

    await deleteAccount(req, res, next);

    expect(Employee.deleteMany).toHaveBeenCalledWith({ createdBy: 'user123' }, {});
    expect(PayrollUpdate.deleteMany).toHaveBeenCalledWith({ createdBy: 'user123' }, {});
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('user123', {});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account and associated data deleted successfully.' });
  });
});
