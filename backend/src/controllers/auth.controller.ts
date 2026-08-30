import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

type UserDocument = {
  _id: unknown;
  fullName: string;
  email: string;
  companyName: string;
  password?: string;
  googleId?: string;
  avatar?: string;
  role?: unknown;
  tenantId?: unknown;
  accountType?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  tokenVersion?: number;
  failedLoginAttempts?: number;
  lockUntil?: Date | null;
  save: () => Promise<UserDocument>;
};

type UserModel = {
  findOne: (query: Record<string, unknown>) => Promise<UserDocument | null>;
  findById: (id: unknown) => Promise<UserDocument | null>;
  create: (payload: Record<string, unknown>) => Promise<UserDocument>;
};

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    tokenVersion: number;
  };
};

type AuthPayload = {
  sub: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type SignupBody = {
  fullName?: unknown;
  email?: unknown;
  companyName?: unknown;
  password?: unknown;
  accountType?: unknown;
};

type RefreshBody = {
  refreshToken?: unknown;
};

type PasswordResetBody = {
  token?: unknown;
  password?: unknown;
};

type ControllerError = Error & {
  statusCode?: number;
};

const USER_MODEL_PATH = '../models/user.model.js';
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN ?? '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
const PASSWORD_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

function getUserModel(): UserModel {
  // The repository currently keeps the User model in CommonJS JavaScript.
  // Keeping the boundary in one function lets this controller be strictly
  // typed without forcing an unrelated model migration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(USER_MODEL_PATH) as UserModel;
}

function getJwtSecret(name: 'access' | 'refresh'): string {
  const value =
    name === 'access'
      ? process.env.JWT_SECRET
      : (process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET);

  if (!value) {
    throw new Error(
      `${name === 'access' ? 'JWT_SECRET' : 'JWT_REFRESH_SECRET'} is not configured`,
    );
  }

  return value;
}

function getString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const error: ControllerError = new Error(`${field} is required`);
    error.statusCode = 400;
    throw error;
  }

  return value.trim();
}

function sanitizeUser(user: UserDocument): Record<string, unknown> {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    companyName: user.companyName,
    avatar: user.avatar ?? null,
    role: user.role ?? null,
    tenantId: user.tenantId ?? null,
    accountType: user.accountType ?? null,
    isActive: user.isActive !== false,
    isEmailVerified: user.isEmailVerified === true,
  };
}

function signAccessToken(user: UserDocument): string {
  const payload: AuthPayload = {
    sub: String(user._id),
    tokenVersion: user.tokenVersion ?? 0,
  };

  return jwt.sign(payload, getJwtSecret('access'), {
    expiresIn: ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

function signRefreshToken(user: UserDocument): string {
  const payload: AuthPayload = {
    sub: String(user._id),
    tokenVersion: user.tokenVersion ?? 0,
  };

  return jwt.sign(payload, getJwtSecret('refresh'), {
    expiresIn: REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

function verifyToken(
  token: string,
  secretName: 'access' | 'refresh',
): AuthPayload {
  const decoded = jwt.verify(token, getJwtSecret(secretName));

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.tokenVersion !== 'number'
  ) {
    const error: ControllerError = new Error('Invalid authentication token');
    error.statusCode = 401;
    throw error;
  }

  return decoded as AuthPayload;
}

function sendError(
  response: Response,
  error: unknown,
  fallbackStatus = 500,
): Response {
  const controllerError = error as ControllerError;
  const status = controllerError.statusCode ?? fallbackStatus;

  return response.status(status).json({
    success: false,
    message:
      controllerError.message || 'An unexpected authentication error occurred',
  });
}

export async function signup(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const body = request.body as SignupBody;
    const fullName = getString(body.fullName, 'fullName');
    const email = getString(body.email, 'email').toLowerCase();
    const companyName = getString(body.companyName, 'companyName');
    const password = getString(body.password, 'password');
    const accountType =
      typeof body.accountType === 'string' && body.accountType.trim()
        ? body.accountType.trim()
        : undefined;

    if (password.length < 8) {
      const error: ControllerError = new Error(
        'Password must be at least 8 characters long',
      );
      error.statusCode = 400;
      throw error;
    }

    const User = getUserModel();
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      const error: ControllerError = new Error(
        'An account with this email already exists',
      );
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await User.create({
      fullName,
      email,
      companyName,
      password: passwordHash,
      ...(accountType ? { accountType } : {}),
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    return response.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const body = request.body as LoginBody;
    const email = getString(body.email, 'email').toLowerCase();
    const password = getString(body.password, 'password');

    const User = getUserModel();
    const user = await User.findOne({ email });

    if (!user || !user.password) {
      const error: ControllerError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    if (user.isActive === false) {
      const error: ControllerError = new Error('This account is inactive');
      error.statusCode = 403;
      throw error;
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const error: ControllerError = new Error(
        'Account temporarily locked. Please try again later',
      );
      error.statusCode = 423;
      throw error;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await user.save();

      const error: ControllerError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    return response.status(200).json({
      success: true,
      message: 'Login successful',
      user: sanitizeUser(user),
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  request: Request,
  response: Response,
): Promise<Response> {
  try {
    const body = request.body as RefreshBody;
    const refreshToken = getString(body.refreshToken, 'refreshToken');
    const payload = verifyToken(refreshToken, 'refresh');
    const User = getUserModel();
    const user = await User.findById(payload.sub);

    if (!user || user.isActive === false) {
      const error: ControllerError = new Error('Account is unavailable');
      error.statusCode = 401;
      throw error;
    }

    if ((user.tokenVersion ?? 0) !== payload.tokenVersion) {
      const error: ControllerError = new Error(
        'Refresh token has been revoked',
      );
      error.statusCode = 401;
      throw error;
    }

    return response.status(200).json({
      success: true,
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
    });
  } catch (error) {
    return sendError(response, error, 401);
  }
}

export async function me(
  request: AuthenticatedRequest,
  response: Response,
): Promise<Response> {
  try {
    if (!request.user?.id) {
      const error: ControllerError = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const User = getUserModel();
    const user = await User.findById(request.user.id);

    if (!user || user.isActive === false) {
      const error: ControllerError = new Error('Account is unavailable');
      error.statusCode = 401;
      throw error;
    }

    if ((user.tokenVersion ?? 0) !== request.user.tokenVersion) {
      const error: ControllerError = new Error('Session has been revoked');
      error.statusCode = 401;
      throw error;
    }

    return response.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return sendError(response, error, 401);
  }
}

export async function logout(
  request: AuthenticatedRequest,
  response: Response,
): Promise<Response> {
  try {
    if (!request.user?.id) {
      return response.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const User = getUserModel();
    const user = await User.findById(request.user.id);

    if (user) {
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save();
    }

    return response.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    return sendError(response, error);
  }
}

export function authenticate(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  try {
    const header = request.header('authorization');
    const token =
      header?.startsWith('Bearer ') === true
        ? header.slice('Bearer '.length).trim()
        : undefined;

    if (!token) {
      const error: ControllerError = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const payload = verifyToken(token, 'access');

    request.user = {
      id: payload.sub,
      tokenVersion: payload.tokenVersion,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  request: Request,
  response: Response,
): Promise<Response> {
  try {
    const body = request.body as PasswordResetBody;
    const token = getString(body.token, 'token');
    const password = getString(body.password, 'password');

    if (password.length < 8) {
      const error: ControllerError = new Error(
        'Password must be at least 8 characters long',
      );
      error.statusCode = 400;
      throw error;
    }

    const User = getUserModel();
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      const error: ControllerError = new Error(
        'Password reset token is invalid or expired',
      );
      error.statusCode = 400;
      throw error;
    }

    user.password = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return response.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    return sendError(response, error, 400);
  }
}
