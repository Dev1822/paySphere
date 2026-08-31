const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const zxcvbn = require('../utils/zxcvbn');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const User = require('../models/user.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const { enqueueEmail } = require('../jobs/email.queue');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const {
  isNonEmptyString,
  isValidEmail,
  sanitizeText,
  DAILY_RATE_MAX,
  OVERTIME_RATE_MAX,
} = require('../utils/validators');
const logger = require('../utils/logger');
const { getDownloadUrl, isStorageUri, putObject, uploadDataUrl } = require('../services/objectStorage.service');
const eventBus = require('../services/event.service');
const { getDefaultRole } = require('../seeds/rbac.seed');
const { resolveAccountType } = require('../config/accountTypes');
const { ensureTenantForUser } = require('../services/tenant.service');
const { createAuditLog } = require('../services/audit.service');
const redisClient = require('../config/redis');

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '250441239388-ldget7kv1v1hvf6vm1r6b0p48fassv43.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const RefreshToken = require('../models/refreshToken.model');

/**
 * Generates access and refresh tokens with rotation support (Issue #725)
 * @param {Object} user - The user document
 * @param {Object} res - Express response object for setting cookies
 * @param {string} [family=null] - Token family for rotation tracking
 * @returns {Promise<string>} The access token
 */
const generateTokens = async (user, res, family = null) => {
  // Short-lived access token (15 minutes)
  const accessToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }, // Changed from 7d to 15m for security
  );

  // Generate cryptographically secure refresh token
  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = RefreshToken.hashToken(rawRefreshToken);

  // Use existing family or create new one
  const tokenFamily = family || crypto.randomBytes(16).toString('hex');

  // Store hashed refresh token in database
  await RefreshToken.create({
    tokenHash,
    userId: user._id,
    tenantId: user.tenantId,
    family: tokenFamily,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    userAgent: '', // Will be set by caller if available
    ip: '', // Will be set by caller if available
  });

  // Set refresh token in HTTP-only cookie
  res.cookie('refreshToken', rawRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return accessToken;
};

// SIGN UP
exports.signup = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { fullName, email, companyName, password } = req.body;

    if (
      !isNonEmptyString(fullName) ||
      !isNonEmptyString(email) ||
      !isNonEmptyString(companyName) ||
      !isNonEmptyString(password)
    ) {
      return res.status(400).json({
        message:
          'Full name, email, company name, and password are required non-empty strings',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
      });
    }

    const strength = zxcvbn(password);
    if (strength.score < 3) {
      return res.status(400).json({
        message: `Password is too weak. ${strength.feedback.warning || ''} Suggestions: ${strength.feedback.suggestions.join(', ')}`,
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser)
      return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);

    // Assign the owner role at creation. Without this the account is locked out
    // of every permission-guarded route the moment it is created (#413).
    const defaultRole = await getDefaultRole();

    const newUser = new User({
      fullName: sanitizeText(fullName),
      email: cleanEmail,
      companyName: sanitizeText(companyName),
      password: hashedPassword,
      passwordHistory: [hashedPassword],
      ...(defaultRole ? { role: defaultRole._id } : {}),
    });

    await newUser.save();

    if (!defaultRole) {
      logger.warn(
        'Signed up a user without a role: RBAC roles are not seeded',
        {
          userId: newUser._id,
        },
      );
    }

    // Create the company this account is registering, and bind the account to
    // it, *before* the token is minted — `generateTokens` reads `user.tenantId`
    // into the claim, and every scoped query in the backend then filters on it.
    //
    // #585 skipped this step entirely, which is why `Tenant` was imported at
    // the top of this file and never used. The consequence was not that scoped
    // reads returned nothing: mongoose strips `{ tenantId: undefined }` out of a
    // filter, so they returned every company's rows (#612).
    await ensureTenantForUser(newUser);

    const token = await generateTokens(newUser, res); // Added await for Issue #725

    // `role` here is the *account type* the client renders navigation from, not
    // the RBAC role reference — see config/accountTypes.js (#558).
    res.status(201).json({
      token,
      companyName: newUser.companyName,
      role: resolveAccountType(newUser),
      employeeId: newUser.employeeId,
      currency: newUser.settings?.payrollConfig?.currency || 'INR',
    });
  } catch (error) {
    next(error);
  }
};

// LOGIN
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res
        .status(400)
        .json({ message: 'Email and password are required strings' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check account lockout status (#1275)
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil(
        (user.lockUntil - Date.now()) / (60 * 1000),
      );
      return res.status(403).json({
        message: `Account is locked due to 5 consecutive failed login attempts. Please try again after ${remainingMinutes} minute(s).`,
        isLocked: true,
        lockUntil: user.lockUntil,
      });
    }

    // Auto-reset expired lockout
    if (user.lockUntil && user.lockUntil <= Date.now()) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lockout
        await user.save();

        return res.status(403).json({
          message:
            'Account locked due to 5 consecutive failed login attempts. Please try again after 30 minutes.',
          isLocked: true,
          lockUntil: user.lockUntil,
        });
      }

      await user.save();
      const remaining = 5 - user.failedLoginAttempts;
      return res.status(400).json({
        message: 'Invalid credentials',
        remainingAttempts: remaining,
      });
    }

    // Reset failed login attempts on successful match
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    if (user.isTwoFactorEnabled) {
      return res.status(200).json({
        requires2FA: true,
        userId: user._id,
        message: 'Two-Factor Authentication code required',
      });
    }

    // Self-heal on the way in, for accounts that predate #585 or that the
    // boot-time backfill has not reached. A no-op — one indexed read — once the
    // account has a tenant, which is every account created after this change.
    await ensureTenantForUser(user);

    // There is no `utils/generateToken` module — `generateTokens` is defined at
    // the top of this file, and every other call site in it uses that one. This
    // line shadowed it with a require that throws MODULE_NOT_FOUND, so *login*
    // answered 500 for every account. It stayed invisible because the suite
    // covering it cannot even load: `otplib@13` pulls in ESM that jest is not
    // configured to transform (#792).
    const token = await generateTokens(user, res); // Added await for Issue #725

    res.status(200).json({
      token,
      companyName: user.companyName,
      role: resolveAccountType(user),
      employeeId: user.employeeId,
      currency: user.settings?.payrollConfig?.currency || 'INR',
    });
  } catch (error) {
    next(error);
  }
};

// GET USER SETTINGS
exports.getSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Scoped by tenant like every other employee read since #585. Left on
    // `createdBy`, this counted only the employees this particular admin had
    // added, and after #585 stopped writing that field it counted zero — the
    // Settings page reported an empty company (#613).
    const employeeCount = await Employee.countDocuments({});

    const UserDTO = require('../utils/userDTO');
    const safeUser = UserDTO.toClient(user);
    const responseUser = { ...safeUser };
    if (isStorageUri(responseUser.avatar)) {
      responseUser.avatar = await getDownloadUrl(responseUser.avatar);
    }
    if (responseUser.settings?.companyInfo?.companyLogo && isStorageUri(responseUser.settings.companyInfo.companyLogo)) {
      responseUser.settings = {
        ...responseUser.settings,
        companyInfo: {
          ...responseUser.settings.companyInfo,
          companyLogo: await getDownloadUrl(responseUser.settings.companyInfo.companyLogo),
        },
      };
    }

    res.status(200).json({
      ...responseUser,
      organizationId: user._id.toString(),
      payrollId: 'PR-' + user._id.toString().slice(-6).toUpperCase(),
      employeeCount,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE USER SETTINGS

exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: 'No image provided' });

    // Store as base64 string
    const storedLogo = await putObject({
      key: `profiles/company-logos/${req.tenantId}/${Date.now()}-${require('crypto').randomUUID()}`,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    await User.findByIdAndUpdate(req.userId, { companyLogoData: storedLogo.uri });
    const signedUrl = await getDownloadUrl(storedLogo.uri);

    res
      .status(200)
      .json({ message: 'Logo updated successfully', logo: signedUrl });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    let {
      settings,
      fullName,
      email,
      companyName,
      defaultOvertimeRate,
      defaultDailyRate,
      avatar,
    } = req.body;

    if (settings && settings.payrollConfig) {
      if (
        defaultDailyRate === undefined &&
        settings.payrollConfig.defaultDailyRate !== undefined
      ) {
        defaultDailyRate = Number(settings.payrollConfig.defaultDailyRate);
      }
      if (
        defaultOvertimeRate === undefined &&
        settings.payrollConfig.defaultOvertimeRate !== undefined
      ) {
        defaultOvertimeRate = Number(
          settings.payrollConfig.defaultOvertimeRate,
        );
      }
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (
      (defaultOvertimeRate !== undefined &&
        (typeof defaultOvertimeRate !== 'number' ||
          isNaN(defaultOvertimeRate) ||
          defaultOvertimeRate < 0)) ||
      (defaultDailyRate !== undefined &&
        (typeof defaultDailyRate !== 'number' ||
          isNaN(defaultDailyRate) ||
          defaultDailyRate < 0))
    ) {
      return res
        .status(400)
        .json({ message: 'Default rates must be non-negative numbers' });
    }

    if (
      defaultOvertimeRate !== undefined &&
      defaultOvertimeRate > OVERTIME_RATE_MAX
    ) {
      return res.status(400).json({
        message: `Default overtime rate cannot exceed ${OVERTIME_RATE_MAX}`,
      });
    }
    if (defaultDailyRate !== undefined && defaultDailyRate > DAILY_RATE_MAX) {
      return res.status(400).json({
        message: `Default daily rate cannot exceed ${DAILY_RATE_MAX}`,
      });
    }

    if (fullName) user.fullName = sanitizeText(fullName);

    if (email !== undefined) {
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return res
          .status(400)
          .json({ message: 'Invalid email address format' });
      }
      if (cleanEmail !== user.email) {
        const emailExists = await User.findOne({ email: cleanEmail });
        if (emailExists) {
          return res
            .status(409)
            .json({ message: 'Email is already in use by another account' });
        }
        user.email = cleanEmail;
      }
    }

    if (companyName) user.companyName = sanitizeText(companyName);
    if (defaultOvertimeRate !== undefined)
      user.defaultOvertimeRate = defaultOvertimeRate;
    if (defaultDailyRate !== undefined)
      user.defaultDailyRate = defaultDailyRate;

    if (avatar !== undefined) {
      if (avatar === '') {
        user.avatar = '';
      } else if (isStorageUri(avatar)) {
        user.avatar = avatar;
      } else if (typeof avatar === 'string' && avatar.startsWith('data:image/')) {
        const storedAvatar = await uploadDataUrl({
          dataUrl: avatar,
          area: 'profiles/avatars'
        });
        user.avatar = storedAvatar.uri;
      } else {
        // OAuth/provider avatars are already remote URLs and do not need to be
        // copied into S3. Locally uploaded data URLs are the only values this
        // endpoint migrates to object storage.
        user.avatar = avatar;
      }
    }

    if (!user.settings) user.settings = {};

    if (settings) {
      if (settings.preferences) {
        user.settings.preferences = {
          ...(user.settings.preferences || {}),
          ...settings.preferences,
        };
      }
      if (settings.companyInfo) {
        user.settings.companyInfo = {
          ...(user.settings.companyInfo || {}),
          ...settings.companyInfo,
        };
        const companyLogo = user.settings.companyInfo.companyLogo;
        if (typeof companyLogo === 'string' && companyLogo.startsWith('data:image/')) {
          const storedLogo = await uploadDataUrl({
            dataUrl: companyLogo,
            area: 'profiles/company-logos'
          });
          user.settings.companyInfo.companyLogo = storedLogo.uri;
        }
      }
      if (settings.payrollConfig) {
        user.settings.payrollConfig = {
          ...(user.settings.payrollConfig || {}),
          ...settings.payrollConfig,
        };
      }
      if (settings.notifications) {
        user.settings.notifications = {
          ...(user.settings.notifications || {}),
          ...settings.notifications,
        };
      }
    }

    await user.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'User',
      details: { updatedFields: Object.keys(req.body) },
      req,
    });

    logger.info(`Settings updated`, {
      userId: req.userId,
      fields: Object.keys(req.body),
    });

    const responseSettings = user.settings?.toObject ? user.settings.toObject() : { ...user.settings };
    if (responseSettings.companyInfo?.companyLogo && isStorageUri(responseSettings.companyInfo.companyLogo)) {
      responseSettings.companyInfo = {
        ...responseSettings.companyInfo,
        companyLogo: await getDownloadUrl(responseSettings.companyInfo.companyLogo),
      };
    }
    const responseAvatar = isStorageUri(user.avatar) ? await getDownloadUrl(user.avatar) : user.avatar;

    res.status(200).json({
      message: 'Settings updated successfully',
      settings: responseSettings,
      fullName: user.fullName,
      email: user.email,
      companyName: user.companyName,
      avatar: responseAvatar,
      defaultOvertimeRate: user.defaultOvertimeRate,
      defaultDailyRate: user.defaultDailyRate,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PASSWORD
exports.updatePassword = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      return res
        .status(400)
        .json({ message: 'Current password and new password are required' });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
      });
    }

    const strength = zxcvbn(newPassword);
    if (strength.score < 3) {
      return res.status(400).json({
        message: `Password is too weak. ${strength.feedback.warning || ''} Suggestions: ${strength.feedback.suggestions.join(', ')}`,
      });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ message: 'No password set. Please use password recovery.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Incorrect current password' });

    if (user.passwordHistory && user.passwordHistory.length > 0) {
      for (const oldHash of user.passwordHistory) {
        const isReused = await bcrypt.compare(newPassword, oldHash);
        if (isReused) {
          return res.status(400).json({
            message: 'You cannot reuse any of your last 5 passwords',
          });
        }
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    if (!user.passwordHistory) {
      user.passwordHistory = [];
    }
    user.passwordHistory.push(hashedPassword);
    if (user.passwordHistory.length > 5) {
      user.passwordHistory.shift();
    }
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'PASSWORD_UPDATE',
      resourceType: 'User',
      details: {},
      req,
    });

    logger.info(`Password updated`, { userId: req.userId });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
// GOOGLE AUTH
exports.googleAuth = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { credential, accessToken, companyName } = req.body;
    let googleData;

    if (credential) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      googleData = ticket.getPayload();
    } else if (accessToken) {
      const tokenInfoResponse = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
      );
      const tokenInfo = tokenInfoResponse.data;

      if (
        tokenInfo.aud !== GOOGLE_CLIENT_ID &&
        tokenInfo.azp !== GOOGLE_CLIENT_ID
      ) {
        return res
          .status(401)
          .json({ message: 'Invalid Google access token: audience mismatch' });
      }

      const userInfoResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );
      googleData = userInfoResponse.data;
    } else {
      return res
        .status(400)
        .json({ message: 'No Google credentials provided' });
    }

    const { sub: googleId, email, name, picture } = googleData;

    let user = await User.findOne({ email });
    const isNewUser = !user;

    if (!user) {
      if (!companyName) {
        return res.status(202).json({
          message:
            "Account doesn't exist. Please provide a company name to sign up.",
          needsCompanyName: true,
        });
      }

      // Same as the password signup path: a Google-registered owner needs the
      // default role or they are locked out of the app they just created (#413).
      const defaultRole = await getDefaultRole();

      user = new User({
        fullName: sanitizeText(name),
        email,
        companyName: sanitizeText(companyName),
        googleId: googleId || googleData.sub,
        avatar: picture || googleData.picture,
        ...(defaultRole ? { role: defaultRole._id } : {}),
      });

      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId || googleData.sub;
      user.avatar = picture || googleData.picture;
      await user.save();
    }

    // Same as the password paths: provision on registration, self-heal on
    // return. Google sign-in is a first-class way to create a company here, so
    // it needs a tenant just as much as `signup` does (#612).
    await ensureTenantForUser(user);

    const token = await generateTokens(user, res); // Added await for Issue #725

    const statusCode = isNewUser ? 201 : 200;
    res.status(statusCode).json({
      token,
      companyName: user.companyName,
      role: resolveAccountType(user),
      employeeId: user.employeeId,
      currency: user.settings?.payrollConfig?.currency || 'INR',
      message: isNewUser
        ? 'Account created successfully'
        : 'Logged in successfully',
    });
  } catch (error) {
    next(error);
  }
};

// GITHUB AUTH
exports.githubAuth = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { code, companyName } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'No GitHub code provided' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      },
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      return res.status(401).json({ message: 'Invalid GitHub code' });
    }

    // Fetch user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubData = userResponse.data;

    // Fetch user emails (GitHub doesn't always return email in profile if private)
    const emailResponse = await axios.get(
      'https://api.github.com/user/emails',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const primaryEmailObj =
      emailResponse.data.find((e) => e.primary) || emailResponse.data[0];
    if (!primaryEmailObj || !primaryEmailObj.email) {
      return res
        .status(400)
        .json({ message: 'No email found in GitHub account' });
    }

    const email = primaryEmailObj.email;
    const { id: githubId, name, login, avatar_url } = githubData;
    const fullName = name || login;

    let user = await User.findOne({ email });
    const isNewUser = !user;

    if (!user) {
      if (!companyName) {
        return res.status(202).json({
          message:
            "Account doesn't exist. Please provide a company name to sign up.",
          needsCompanyName: true,
        });
      }

      const defaultRole = await getDefaultRole();

      user = new User({
        fullName: sanitizeText(fullName),
        email,
        companyName: sanitizeText(companyName),
        githubId: String(githubId),
        avatar: avatar_url,
        ...(defaultRole ? { role: defaultRole._id } : {}),
      });

      await user.save();
    } else if (!user.githubId) {
      user.githubId = String(githubId);
      if (!user.avatar) user.avatar = avatar_url;
      await user.save();
    }

    await ensureTenantForUser(user);

    const token = await generateTokens(user, res); // Added await for Issue #725

    const statusCode = isNewUser ? 201 : 200;
    res.status(statusCode).json({
      token,
      companyName: user.companyName,
      role: resolveAccountType(user),
      employeeId: user.employeeId,
      currency: user.settings?.payrollConfig?.currency || 'INR',
      message: isNewUser
        ? 'Account created successfully'
        : 'Logged in successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Local Map to store cooldowns for password reset requests (5 minutes per email)
const resetCooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

// Periodically clean up expired cooldown entries to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - COOLDOWN_MS;
  for (const [email, timestamp] of resetCooldowns) {
    if (timestamp < cutoff) resetCooldowns.delete(email);
  }
}, 60 * 1000);

// FORGOT PASSWORD
exports.forgotPassword = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { email } = req.body;
    if (!isNonEmptyString(email) || !isValidEmail(email)) {
      return res
        .status(400)
        .json({ message: 'A valid email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check cooldown for this email (5 minutes)
    const lastRequest = resetCooldowns.get(cleanEmail);
    if (lastRequest && Date.now() - lastRequest < COOLDOWN_MS) {
      // Still in cooldown period, return generic message without sending email
      return res.status(200).json({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Update cooldown
    resetCooldowns.set(cleanEmail, Date.now());

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(200).json({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Set token and expiry (1 hour)
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    // Reset link pointing to frontend — always use server-side config,
    // never the user-controlled Origin header (prevents token hijacking)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const text =
      `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.\n`;

    const html =
      `<p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>` +
      `<p>Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:</p>` +
      `<p><a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a></p>` +
      `<p>If you cannot click the button, copy and paste the link below into your browser:</p>` +
      `<p>${resetUrl}</p>` +
      `<hr/>` +
      `<p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await enqueueEmail('generic', {
      to: user.email,
      subject: 'PaySphere Password Reset Link',
      text,
      html,
    });
    res.status(200).json({
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { password } = req.body;

    if (!isNonEmptyString(password) || !passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
      });
    }

    const strength = zxcvbn(password);
    if (strength.score < 3) {
      return res.status(400).json({
        message: `Password is too weak. ${strength.feedback.warning || ''} Suggestions: ${strength.feedback.suggestions.join(', ')}`,
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Password reset token is invalid or has expired' });
    }

    if (user.passwordHistory && user.passwordHistory.length > 0) {
      for (const oldHash of user.passwordHistory) {
        const isReused = await bcrypt.compare(password, oldHash);
        if (isReused) {
          return res.status(400).json({
            message: 'You cannot reuse any of your last 5 passwords',
          });
        }
      }
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Save user new password, clear token fields, and increment tokenVersion
    user.password = hashedPassword;
    if (!user.passwordHistory) {
      user.passwordHistory = [];
    }
    user.passwordHistory.push(hashedPassword);
    if (user.passwordHistory.length > 5) {
      user.passwordHistory.shift();
    }
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};

// DISCONNECT GOOGLE
exports.disconnectGoogle = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.password) {
      return res.status(400).json({
        message:
          'You must set a password before disconnecting your Google account.',
      });
    }

    user.googleId = undefined;
    await user.save();

    res
      .status(200)
      .json({ message: 'Google account disconnected successfully.' });
  } catch (error) {
    next(error);
  }
};

// DELETE ACCOUNT
exports.deleteAccount = async (req, res, next) => {
  let session = null;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required' });
    }
    if (!user.password) {
      return res
        .status(400)
        .json({ message: 'No password set on this account' });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(403).json({ message: 'Current password is incorrect' });
    }

    // Try to start a transaction (gracefully fallback if not supported)
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    const deleteOptions = session ? { session } : {};

    const Tenant = require('../models/tenant.model');
    const AuditLog = require('../models/auditLog.model');
    const tenant = await Tenant.findById(req.tenantId);

    const isTenantOwner =
      tenant && String(tenant.ownerId) === String(req.userId);

    if (isTenantOwner) {
      // Scoped by tenant: these rows are the company's, and since #585 they no
      // longer carry a `createdBy` to match on. Filtering by the old key deleted
      // nothing and left the company's employee and payroll records behind after
      // the account that owned them was gone (#613).
      await Employee.deleteMany({}, deleteOptions);
      await PayrollUpdate.deleteMany({}, deleteOptions);
      // Soft-delete the tenant as well
      await Tenant.findByIdAndUpdate(
        tenant._id,
        { $set: { isActive: false } },
        deleteOptions,
      );
    }

    await AuditLog.deleteMany({ userId: req.userId }, deleteOptions);
    await User.findByIdAndDelete(req.userId, deleteOptions);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'ACCOUNT_DELETE',
      resourceType: 'User',
      details: {},
      req,
    });

    logger.info(`Account deleted`, { userId: req.userId });

    res
      .status(200)
      .json({ message: 'Account and associated data deleted successfully.' });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch {
        // ignore session cleanup error
      }
    }
    next(error);
  }
};

// REFRESH TOKEN (Issue #725 - Token Rotation)
exports.refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    // Hash the token and look it up in the database
    const tokenHash = RefreshToken.hashToken(rawRefreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash });

    // Security Check: Token not found or already revoked = potential theft
    if (!storedToken || storedToken.isRevoked) {
      // If token exists but is revoked, someone is reusing it - revoke entire family
      if (storedToken) {
        await RefreshToken.updateMany(
          { family: storedToken.family, isRevoked: false },
          { $set: { isRevoked: true } },
        );
        logger.warn('Token reuse detected - family revoked', {
          userId: storedToken.userId,
          family: storedToken.family,
        });
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      return res.status(403).json({
        message: 'Invalid or revoked refresh token. Session terminated.',
      });
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      storedToken.isRevoked = true;
      await storedToken.save();

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // Fetch user with all required fields
    const user = await User.findById(storedToken.userId).select(
      '_id isActive tokenVersion role tenantId companyName fullName employeeId',
    );

    if (!user || user.isActive === false) {
      storedToken.isRevoked = true;
      await storedToken.save();
      return res.status(401).json({ message: 'User not found or deactivated' });
    }

    // Check token version (password change invalidation)
    if (
      user.tokenVersion !== undefined &&
      user.tokenVersion !== storedToken.tokenVersion
    ) {
      storedToken.isRevoked = true;
      await storedToken.save();
      return res.status(401).json({ message: 'Token is no longer valid' });
    }

    await ensureTenantForUser(user);

    // ROTATION: Revoke old token and issue new one in same family
    storedToken.isRevoked = true;
    await storedToken.save();

    // Generate new tokens with same family
    const newAccessToken = await generateTokens(user, res, storedToken.family);

    res.status(200).json({ token: newAccessToken });
  } catch (error) {
    next(error);
  }
};

// LOGOUT (Issue #725 - Proper Token Revocation)
exports.logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies.refreshToken;

    // Revoke the refresh token in database
    if (rawRefreshToken) {
      const tokenHash = RefreshToken.hashToken(rawRefreshToken);
      await RefreshToken.findOneAndUpdate(
        { tokenHash },
        { $set: { isRevoked: true } },
      );
    }

    // Also increment tokenVersion to invalidate all access tokens
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, {
          ignoreExpiration: true,
        });
        
        // Add to Redis blacklist (Token Replay Prevention #2088)
        if (redisClient && redisClient.status === "ready") {
          // Calculate TTL based on token expiration
          const now = Math.floor(Date.now() / 1000);
          const ttl = decoded.exp ? decoded.exp - now : 86400; // default 24h
          
          if (ttl > 0) {
            await redisClient.setex(`blacklist:${accessToken}`, ttl, 'true');
          }
        }

        if (decoded && decoded.id) {
          await User.findByIdAndUpdate(decoded.id, {
            $inc: { tokenVersion: 1 },
          });
        }
      } catch {
        // Ignore token verification errors during logout
      }
    }

    // Clear the refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// GENERATE 2FA QR CODE & SECRET
exports.generate2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      `PaySphere (${user.companyName || 'Admin'})`,
      secret,
    );

    user.twoFactorSecret = secret;
    await user.save();

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return res.status(200).json({
      secret,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    next(error);
  }
};

// VERIFY & ENABLE 2FA
exports.verifyAndEnable2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: '2FA token code is required' });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: '2FA is not initialized' });
    }

    const isValid = authenticator.verify({
      token: token.trim(),
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid 2FA verification code' });
    }

    user.isTwoFactorEnabled = true;
    await user.save();

    return res.status(200).json({
      message: 'Two-Factor Authentication successfully enabled',
      isTwoFactorEnabled: true,
    });
  } catch (error) {
    next(error);
  }
};

// DISABLE 2FA
exports.disable2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.userId);

    if (!user || !user.isTwoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not currently enabled' });
    }

    const isValid = authenticator.verify({
      token: token.trim(),
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid 2FA verification code' });
    }

    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = '';
    await user.save();

    return res.status(200).json({
      message: 'Two-Factor Authentication disabled',
      isTwoFactorEnabled: false,
    });
  } catch (error) {
    next(error);
  }
};

// VALIDATE 2FA ON LOGIN
exports.validate2FALogin = async (req, res, next) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res
        .status(400)
        .json({ message: 'User ID and 2FA token are required' });
    }

    const user = await User.findById(userId);
    if (!user || !user.isTwoFactorEnabled) {
      return res
        .status(400)
        .json({ message: '2FA is not enabled for this user' });
    }

    const isValid = authenticator.verify({
      token: token.trim(),
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid 2FA code' });
    }

    // Generate full JWT access token after successful 2FA
    const accessToken = await generateTokens(user, res); // Added await for Issue #725

    return res.status(200).json({
      message: '2FA verification successful',
      token: accessToken,
      user: {
        id: user._id,
        role: user.role,
        tenantId: user.tenantId,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName,
      },
    });
  } catch (error) {
    next(error);
  }
};

// IMPERSONATE USER
exports.impersonateUser = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ message: 'targetUserId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid targetUserId format' });
    }

    const impersonator = req.user;
    if (!impersonator) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (String(impersonator._id) === String(targetUserId)) {
      return res.status(400).json({ message: 'Cannot impersonate yourself' });
    }

    const targetUser = await User.findById(targetUserId).populate('role');
    if (!targetUser || targetUser.isActive === false) {
      return res
        .status(404)
        .json({ message: 'Target user not found or inactive' });
    }

    const targetRoleName = targetUser.role?.name || targetUser.role;
    if (targetRoleName === 'SuperAdmin') {
      return res
        .status(403)
        .json({ message: 'Cannot impersonate another SuperAdmin' });
    }

    if (
      req.tenantId &&
      targetUser.tenantId &&
      String(req.tenantId) !== String(targetUser.tenantId)
    ) {
      return res
        .status(403)
        .json({ message: 'Target user belongs to another organization' });
    }

    const tokenPayload = {
      id: targetUser._id,
      role: targetUser.role?._id || targetUser.role,
      tenantId: targetUser.tenantId,
      tokenVersion: targetUser.tokenVersion,
      isImpersonating: true,
      impersonatorId: impersonator._id,
      impersonatorName: impersonator.fullName,
      impersonatorEmail: impersonator.email,
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    await createAuditLog({
      userId: impersonator._id,
      tenantId: impersonator.tenantId || targetUser.tenantId,
      action: 'IMPERSONATE_USER_START',
      resourceType: 'User',
      resourceIds: [targetUser._id],
      details: {
        impersonatorId: impersonator._id,
        impersonatorEmail: impersonator.email,
        impersonatedUserId: targetUser._id,
        impersonatedUserEmail: targetUser.email,
      },
      req,
    });

    return res.status(200).json({
      message: `Successfully impersonated ${targetUser.fullName}`,
      token: accessToken,
      isImpersonating: true,
      impersonator: {
        id: impersonator._id,
        fullName: impersonator.fullName,
        email: impersonator.email,
      },
      user: {
        id: targetUser._id,
        email: targetUser.email,
        fullName: targetUser.fullName,
        companyName: targetUser.companyName,
        accountType: targetUser.accountType,
        role: targetUser.role,
        tenantId: targetUser.tenantId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// STOP IMPERSONATION
exports.stopImpersonation = async (req, res, next) => {
  try {
    if (!req.isImpersonating || !req.impersonatorId) {
      return res
        .status(400)
        .json({ message: 'No active impersonation session' });
    }

    const impersonator = await User.findById(req.impersonatorId).populate(
      'role',
    );
    if (!impersonator || impersonator.isActive === false) {
      return res
        .status(404)
        .json({ message: 'Original admin account not found or inactive' });
    }

    const tokenPayload = {
      id: impersonator._id,
      role: impersonator.role?._id || impersonator.role,
      tenantId: impersonator.tenantId,
      tokenVersion: impersonator.tokenVersion,
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });

    await createAuditLog({
      userId: impersonator._id,
      tenantId: impersonator.tenantId,
      action: 'IMPERSONATE_USER_STOP',
      resourceType: 'User',
      resourceIds: [req.userId],
      details: {
        impersonatorId: impersonator._id,
        stoppedImpersonatingUserId: req.userId,
      },
      req,
    });

    return res.status(200).json({
      message: 'Impersonation session ended',
      token: accessToken,
      isImpersonating: false,
      user: {
        id: impersonator._id,
        email: impersonator.email,
        fullName: impersonator.fullName,
        companyName: impersonator.companyName,
        accountType: impersonator.accountType,
        role: impersonator.role,
        tenantId: impersonator.tenantId,
      },
    });
  } catch (error) {
    next(error);
  }
};
