const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const User = require("../models/user.model");
const { sendEmail } = require("../utils/email");
const { isNonEmptyString, isValidEmail } = require("../utils/validators");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// SIGN UP
exports.signup = async (req, res) => {
  try {
    const { fullName, email, companyName, password } = req.body;

    if (!isNonEmptyString(fullName) || !isNonEmptyString(email) || !isNonEmptyString(companyName) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: "Full name, email, company name, and password are required non-empty strings" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email address format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      fullName: fullName.trim(),
      email: cleanEmail,
      companyName: companyName.trim(),
      password: hashedPassword,
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, tokenVersion: newUser.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, companyName: newUser.companyName });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// LOGIN
exports.login = async (req, res) => {
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
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({ token, companyName: user.companyName });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET USER SETTINGS
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      defaultOvertimeRate: user.defaultOvertimeRate || 0,
      defaultDailyRate: user.defaultDailyRate || 0
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// UPDATE USER SETTINGS
exports.updateSettings = async (req, res) => {
  try {
    const { defaultOvertimeRate, defaultDailyRate } = req.body;

    if (
      (defaultOvertimeRate !== undefined && (typeof defaultOvertimeRate !== "number" || isNaN(defaultOvertimeRate) || defaultOvertimeRate < 0)) ||
      (defaultDailyRate !== undefined && (typeof defaultDailyRate !== "number" || isNaN(defaultDailyRate) || defaultDailyRate < 0))
    ) {
      return res.status(400).json({ message: "Default rates must be non-negative numbers" });
    }

    const updateFields = {};
    if (defaultOvertimeRate !== undefined) updateFields.defaultOvertimeRate = defaultOvertimeRate;
    if (defaultDailyRate !== undefined) updateFields.defaultDailyRate = defaultDailyRate;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Settings updated successfully",
      settings: {
        defaultOvertimeRate: user.defaultOvertimeRate,
        defaultDailyRate: user.defaultDailyRate
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// GOOGLE AUTH
exports.googleAuth = async (req, res) => {
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
      const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
      googleData = response.data;
    } else {
      return res.status(400).json({ message: "No Google credentials provided" });
    }

    const { sub: googleId, email, name, picture } = googleData;

    let user = await User.findOne({ email });

    if (!user) {
      if (!companyName) {
        return res.status(202).json({ 
          message: "Account doesn't exist. Please provide a company name to sign up.",
          needsCompanyName: true 
        });
      }

      user = new User({
        fullName: name,
        email,
        companyName,
        googleId: googleId || googleData.sub,
        avatar: picture || googleData.picture,
      });

      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId || googleData.sub;
      user.avatar = picture || googleData.picture;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({ 
      token, 
      companyName: user.companyName,
      message: user.isNew ? "Account created successfully" : "Logged in successfully"
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ message: "Google auth failed", error: error.message });
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!isNonEmptyString(email) || !isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: "User with this email does not exist" });
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");
    
    // Set token and expiry (1 hour)
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    // Reset link pointing to frontend
    const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const text = `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.\n`;

    const html = `<p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>` +
      `<p>Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:</p>` +
      `<p><a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a></p>` +
      `<p>If you cannot click the button, copy and paste the link below into your browser:</p>` +
      `<p>${resetUrl}</p>` +
      `<hr/>` +
      `<p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await sendEmail({
      to: user.email,
      subject: "PaySphere Password Reset Link",
      text,
      html,
    });

    res.status(200).json({ message: "Password reset link sent to email" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!isNonEmptyString(password) || password.length < 6) {
      return res.status(400).json({ message: "New password must be a string with at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Save user new password, clear token fields, and increment tokenVersion
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

