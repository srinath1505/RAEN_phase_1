const authService = require('../services/authService');
const cartService = require('../services/cartService');
const { success, error } = require('../utils/apiResponse');
const otpService = require('../services/otpService');
const resetTokenService = require('../services/resetTokenService');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

exports.register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    
    // Sync guest cart if sessionId provided
    if (req.body.sessionId) {
      await cartService.syncGuestCart(result.user.id, req.body.sessionId);
    }
    
    return success(res, result, 'Registration successful', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, sessionId } = req.body;
    const result = await authService.login(email, password);
    
    // Sync guest cart if sessionId provided
    if (sessionId) {
      await cartService.syncGuestCart(result.user.id, sessionId);
    }
    
    return success(res, result, 'Login successful');
  } catch (err) {
    return error(res, err.message, 401);
  }
};

exports.getMe = async (req, res) => {
  try {
    return success(res, { user: req.user }, 'User retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.logout = async (req, res) => {
  try {
    return success(res, null, 'Logout successful');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// POST /api/auth/send-otp
// Sends a 6-digit verification code to the provided phone via SMS or WhatsApp.
// Used as the first step of OTP-verified registration.
exports.sendOtp = async (req, res) => {
  try {
    const { phone, channel = 'sms' } = req.body;
    if (!phone) return error(res, 'Phone number is required', 400);
    if (!['sms', 'whatsapp'].includes(channel)) return error(res, 'Channel must be sms or whatsapp', 400);

    await otpService.sendOtp(phone, channel);
    return success(res, { phone: otpService.normalisePhone(phone), channel }, 'Verification code sent');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// POST /api/auth/register-otp
// Verifies OTP + creates account in one atomic step.
// Keeps existing POST /api/auth/register intact for backward-compat with tests.
exports.registerWithOtp = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, otp, sessionId } = req.body;
    if (!firstName || !lastName || !email || !phone || !password || !otp) {
      return error(res, 'All fields are required', 400);
    }
    if (password.length < 8) return error(res, 'Password must be at least 8 characters', 400);

    const otpResult = otpService.verifyOtp(phone, otp);
    if (!otpResult.valid) return error(res, otpResult.reason, 400);

    const result = await authService.register({ firstName, lastName, email, phone, password });

    if (sessionId) {
      await cartService.syncGuestCart(result.user.id, sessionId).catch(() => {});
    }

    return success(res, result, 'Account created successfully', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// POST /api/auth/google
// Verifies a Google ID token issued by the frontend (Google Identity Services).
// Finds or creates the user, then returns a RAEN JWT.
exports.googleAuth = async (req, res) => {
  try {
    const { credential, sessionId } = req.body;
    if (!credential) return error(res, 'Google credential is required', 400);

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId || googleClientId.includes('PLACEHOLDER')) {
      return error(res, 'Google Sign-In is not configured on this server yet. Please use email/password registration.', 503);
    }

    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: googleClientId });
    const payload = ticket.getPayload();

    const { email, given_name: firstName, family_name: lastName, sub: googleId } = payload;
    if (!email) return error(res, 'Google account has no email address', 400);

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const passwordHash = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10);
      user = await prisma.user.create({
        data: {
          email,
          firstName: firstName || 'Member',
          lastName: lastName || '',
          passwordHash,
          role: 'CUSTOMER'
        }
      });
    }

    const { passwordHash: _pw, ...userWithoutPassword } = user;
    const token = authService.generateToken(userWithoutPassword);

    if (sessionId) {
      await cartService.syncGuestCart(user.id, sessionId).catch(() => {});
    }

    return success(res, { token, user: userWithoutPassword }, 'Google sign-in successful');
  } catch (err) {
    console.error('Google auth error:', err.message);
    return error(res, 'Google authentication failed. Please try again.', 401);
  }
};

// ─── Forgot Password — Step 1: send OTP to registered phone ──────────────────
// POST /api/auth/forgot-password   body: { email }
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return error(res, 'Email address is required.', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return error(res, 'No account found with this email address.', 404);
    if (!user.phone) {
      return error(res, 'This account has no registered phone number for verification. Please contact hello@raen.design for assistance.', 400);
    }

    await otpService.sendOtp(user.phone, 'sms');

    const ph = user.phone;
    const maskedPhone = ph.length > 4 ? ph.slice(0, -4).replace(/\d/g, '·') + ph.slice(-4) : ph;

    return success(res, { maskedPhone }, 'A verification code has been sent to your registered phone.');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// ─── Forgot Password — Step 2: verify OTP → generate + send magic link ───────
// POST /api/auth/forgot-password-verify   body: { email, otp }
exports.forgotPasswordVerify = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return error(res, 'Email and verification code are required.', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.phone) return error(res, 'Invalid request.', 400);

    const otpResult = otpService.verifyOtp(user.phone, otp);
    if (!otpResult.valid) return error(res, otpResult.reason, 400);

    // Generate single-use reset token (1 hour)
    const resetToken = resetTokenService.generateResetToken(user.id, user.email);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4173';
    const resetLink   = `${frontendUrl}/reset-password.html?token=${resetToken}`;

    const isDevSmtp = !process.env.SMTP_USER || process.env.SMTP_USER.includes('your-email');
    if (isDevSmtp) {
      console.log('\n[RAEN DEV RESET LINK] ──────────────────────────');
      console.log(`  Email   : ${user.email}`);
      console.log(`  Link    : ${resetLink}`);
      console.log(`  Expires : 1 hour from now`);
      console.log('─────────────────────────────────────────────────\n');
    } else {
      try {
        const emailService = require('../services/emailService');
        if (typeof emailService.sendPasswordReset === 'function') {
          emailService.sendPasswordReset({
            email: user.email,
            name:  user.firstName,
            resetLink
          }).catch(e => console.error('Reset email error:', e.message));
        }
      } catch (e) {
        console.error('Email service error:', e.message);
      }
    }

    const maskedEmail = user.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + b.replace(/./g, '·') + c);
    return success(res, { maskedEmail }, 'Password reset link sent. Please check your email.');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// ─── Validate reset token (called by reset-password.html on load) ─────────────
// GET /api/auth/validate-reset-token?token=xxx
exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return error(res, 'Token is required.', 400);
    const record = resetTokenService.validateResetToken(token);
    if (!record) return error(res, 'This reset link has expired or is invalid. Please request a new one.', 400);
    return success(res, { email: record.email }, 'Token is valid.');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// ─── Reset password (submit new password via magic link) ──────────────────────
// POST /api/auth/reset-password   body: { token, password }
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return error(res, 'Token and new password are required.', 400);
    if (password.length < 8) return error(res, 'Password must be at least 8 characters.', 400);

    const record = resetTokenService.consumeResetToken(token);
    if (!record) return error(res, 'This reset link has expired or is invalid. Please request a new one.', 400);

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });

    return success(res, null, 'Password updated successfully. You can now sign in with your new password.');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
