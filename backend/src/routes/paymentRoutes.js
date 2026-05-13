const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const validationMiddleware = require('../middleware/validationMiddleware');
const { paymentLimiter } = require('../middleware/rateLimitMiddleware');

// Razorpay routes
router.post(
  '/razorpay/create',
  paymentLimiter,
  [
    body('orderId').notEmpty().withMessage('Order ID is required')
  ],
  validationMiddleware,
  paymentController.createRazorpayOrder
);

router.post(
  '/razorpay/verify',
  paymentLimiter,
  [
    body('orderNumber').notEmpty().withMessage('Order number is required'),
    body('razorpay_order_id').notEmpty().withMessage('Razorpay order ID is required'),
    body('razorpay_payment_id').notEmpty().withMessage('Razorpay payment ID is required'),
    body('razorpay_signature').notEmpty().withMessage('Razorpay signature is required')
  ],
  validationMiddleware,
  paymentController.verifyRazorpayPayment
);

router.post('/razorpay/webhook', paymentController.razorpayWebhook);

// PayPal routes
router.post(
  '/paypal/create',
  paymentLimiter,
  [
    body('orderId').notEmpty().withMessage('Order ID is required')
  ],
  validationMiddleware,
  paymentController.createPaypalOrder
);

router.post(
  '/paypal/capture',
  paymentLimiter,
  [
    body('orderNumber').notEmpty().withMessage('Order number is required'),
    body('paypalOrderId').notEmpty().withMessage('PayPal order ID is required')
  ],
  validationMiddleware,
  paymentController.capturePaypalOrder
);

router.post('/paypal/webhook', paymentController.paypalWebhook);

// Manual UPI routes
router.post(
  '/upi/create',
  paymentLimiter,
  [
    body('orderId').notEmpty().withMessage('Order ID is required')
  ],
  validationMiddleware,
  paymentController.createUpiIntent
);

router.post(
  '/upi/submit-proof',
  paymentLimiter,
  [
    body('orderNumber').notEmpty().withMessage('Order number is required'),
    body('upiReferenceId').notEmpty().withMessage('UPI reference ID is required')
  ],
  validationMiddleware,
  paymentController.submitUpiProof
);

module.exports = router;
