const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validationMiddleware = require('../middleware/validationMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

router.post(
  '/register',
  authLimiter,
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().trim()
  ],
  validationMiddleware,
  authController.register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validationMiddleware,
  authController.login
);

router.get('/me', authMiddleware, authController.getMe);

router.post('/logout', authController.logout);

// OTP-verified registration (two-step: send-otp then register-otp)
router.post(
  '/send-otp',
  authLimiter,
  [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('channel').optional().isIn(['sms', 'whatsapp']).withMessage('Channel must be sms or whatsapp')
  ],
  validationMiddleware,
  authController.sendOtp
);

router.post(
  '/register-otp',
  authLimiter,
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('otp').trim().notEmpty().withMessage('Verification code is required')
  ],
  validationMiddleware,
  authController.registerWithOtp
);

// Google Sign-In
router.post('/google', authController.googleAuth);

// ─── Forgot Password / Account Recovery ──────────────────────────────────────
// Step 1: email → OTP sent to registered phone
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validationMiddleware,
  authController.forgotPassword
);

// Step 2: verify OTP → magic link sent to email
router.post(
  '/forgot-password-verify',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('otp').trim().notEmpty().withMessage('Verification code is required')
  ],
  validationMiddleware,
  authController.forgotPasswordVerify
);

// Validate magic link token (GET, called by reset-password.html on load)
router.get('/validate-reset-token', authController.validateResetToken);

// Reset password via magic link token
router.post(
  '/reset-password',
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  validationMiddleware,
  authController.resetPassword
);

module.exports = router;
