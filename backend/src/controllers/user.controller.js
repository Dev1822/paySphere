const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const User = require("../models/user.model");
const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const { sendEmail } = require("../utils/email");
const { isNonEmptyString, isValidEmail, sanitizeText, DAILY_RATE_MAX, OVERTIME_RATE_MAX } = require("../utils/validators");
const logger = require("../utils/logger");
const { createAuditLog } = require("../services/audit.service");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const generateTokens = (user, res) => {
  const accessToken = jwt.sign(
    { id: user._id, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return accessToken;
};

// SIGN UP
exports.signup = async (req, res, next) => {
  try {
    const { fullName, email, companyName, password } = req.body;

    if (!isNonEmptyString(fullName) || !isNonEmptyString(email) || !isNonEmptyString(companyName) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: "Full name, email, company name, and password are required non-empty strings" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email address format" });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      fullName: sanitizeText(fullName),
      email: cleanEmail,
      companyName: sanitizeText(companyName),
      password: hashedPassword,
    });

    await newUser.save();

    const token = generateTokens(newUser, res);

    res.status(201).json({ token, companyName: newUser.companyName });
  } catch (error) {
    next(error);
  }
};

// LOGIN
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: "Email and password are required strings" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email address format" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateTokens(user, res);

    res.status(200).json({ token, companyName: user.companyName });
  } catch (error) {
    next(error);
  }
};

// GET USER SETTINGS
exports.getSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const employeeCount = await Employee.countDocuments({ createdBy: req.userId });

    res.status(200).json({
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      companyName: user.companyName,
      settings: user.settings,
      defaultOvertimeRate: user.defaultOvertimeRate || 0,
      defaultDailyRate: user.defaultDailyRate || 0,
      isGoogleLinked: !!user.googleId,
      organizationId: user._id.toString(),
      payrollId: "PR-" + user._id.toString().slice(-6).toUpperCase(),
      employeeCount
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE USER SETTINGS
exports.updateSettings = async (req, res, next) => {
  try {
    const { settings, fullName, email, companyName, defaultOvertimeRate, defaultDailyRate, avatar } = req.body;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      (defaultOvertimeRate !== undefined && (typeof defaultOvertimeRate !== "number" || isNaN(defaultOvertimeRate) || defaultOvertimeRate < 0)) ||
      (defaultDailyRate !== undefined && (typeof defaultDailyRate !== "number" || isNaN(defaultDailyRate) || defaultDailyRate < 0))
    ) {
      return res.status(400).json({ message: "Default rates must be non-negative numbers" });
    }

    if (defaultOvertimeRate !== undefined && defaultOvertimeRate > OVERTIME_RATE_MAX) {
      return res.status(400).json({ message: `Default overtime rate cannot exceed ${OVERTIME_RATE_MAX}` });
    }
    if (defaultDailyRate !== undefined && defaultDailyRate > DAILY_RATE_MAX) {
      return res.status(400).json({ message: `Default daily rate cannot exceed ${DAILY_RATE_MAX}` });
    }

    if (fullName) user.fullName = sanitizeText(fullName);
    if (email) user.email = email;
    if (companyName) user.companyName = sanitizeText(companyName);
    if (defaultOvertimeRate !== undefined) user.defaultOvertimeRate = defaultOvertimeRate;
    if (defaultDailyRate !== undefined) user.defaultDailyRate = defaultDailyRate;
    if (avatar !== undefined) user.avatar = avatar;

    if (!user.settings) user.settings = {};

    if (settings) {
      if (settings.preferences) {
        user.settings.preferences = { ...(user.settings.preferences || {}), ...settings.preferences };
      }
      if (settings.companyInfo) {
        user.settings.companyInfo = { ...(user.settings.companyInfo || {}), ...settings.companyInfo };
      }
      if (settings.payrollConfig) {
        user.settings.payrollConfig = { ...(user.settings.payrollConfig || {}), ...settings.payrollConfig };
      }
      if (settings.notifications) {
        user.settings.notifications = { ...(user.settings.notifications || {}), ...settings.notifications };
      }
    }

    await user.save();

    createAuditLog({
      userId: req.userId,
      action: "SETTINGS_UPDATE",
      resourceType: "User",
      details: { updatedFields: Object.keys(req.body) },
      req,
    });

    logger.info(`Settings updated`, { userId: req.userId, fields: Object.keys(req.body) });

    res.status(200).json({
      message: "Settings updated successfully",
      settings: user.settings,
      fullName: user.fullName,
      email: user.email,
      companyName: user.companyName,
      avatar: user.avatar,
      defaultOvertimeRate: user.defaultOvertimeRate,
      defaultDailyRate: user.defaultDailyRate
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PASSWORD
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ message: "Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character" });
    }

    if (!user.password) {
      return res.status(400).json({ message: "No password set. Please use password recovery." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    createAuditLog({
      userId: req.userId,
      action: "PASSWORD_UPDATE",
      resourceType: "User",
      details: {},
      req,
    });

    logger.info(`Password updated`, { userId: req.userId });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};
// GOOGLE AUTH
exports.googleAuth = async (req, res, next) => {
  try {
    const { credential, accessToken, companyName } = req.body;
    let googleData;

    if (credential) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      googleData = ticket.getPayload();
    } else if (accessToken) {
      const response = await axios.get(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );
      googleData = response.data;
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

      user = new User({
        fullName: sanitizeText(name),
        email,
        companyName: sanitizeText(companyName),
        googleId: googleId || googleData.sub,
        avatar: picture || googleData.picture,
      });

      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId || googleData.sub;
      user.avatar = picture || googleData.picture;
      await user.save();
    }

    const token = generateTokens(user, res);

    res.status(200).json({
      token,
      companyName: user.companyName,
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

// FORGOT PASSWORD
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!isNonEmptyString(email) || !isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check cooldown for this email (5 minutes)
    const lastRequest = resetCooldowns.get(cleanEmail);
    if (lastRequest && Date.now() - lastRequest < 5 * 60 * 1000) {
      // Still in cooldown period, return generic message without sending email
      return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
    }

    // Update cooldown
    resetCooldowns.set(cleanEmail, Date.now());

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
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

    // Reset link pointing to frontend
    const frontendUrl =
      req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
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

    await sendEmail({
      to: user.email,
      subject: 'PaySphere Password Reset Link',
      text,
      html,
    });

    res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
  } catch (error) {
    next(error);
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!isNonEmptyString(password) || !passwordRegex.test(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character" });
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

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Save user new password, clear token fields, and increment tokenVersion
    user.password = hashedPassword;
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
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.password) {
      return res.status(400).json({ message: "You must set a password before disconnecting your Google account." });
    }

    user.googleId = undefined;
    await user.save();

    res.status(200).json({ message: "Google account disconnected successfully." });
  } catch (error) {
    next(error);
  }
};

// DELETE ACCOUNT
exports.deleteAccount = async (req, res, next) => {
  let session = null;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Try to start a transaction (gracefully fallback if not supported)
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessionErr) {
      session = null;
    }

    const deleteOptions = session ? { session } : {};

    await Employee.deleteMany({ createdBy: req.userId }, deleteOptions);
    await PayrollUpdate.deleteMany({ createdBy: req.userId }, deleteOptions);
    await User.findByIdAndDelete(req.userId, deleteOptions);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    createAuditLog({
      userId: req.userId,
      action: "ACCOUNT_DELETE",
      resourceType: "User",
      details: {},
      req,
    });

    logger.info(`Account deleted`, { userId: req.userId });

    res.status(200).json({ message: "Account and associated data deleted successfully." });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (e) {
        // ignore session cleanup error
      }
    }
    next(error);
  }
};

// REFRESH TOKEN
exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "No refresh token provided" });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded.id).select("_id isActive tokenVersion");
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "User not found or deactivated" });
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: "Token is no longer valid" });
    }

    const token = generateTokens(user, res);
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};

// LOGOUT
exports.logout = (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });
  res.status(200).json({ message: "Logged out successfully" });
};
