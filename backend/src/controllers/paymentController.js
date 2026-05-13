const paymentService = require('../services/paymentService');
const config = require('../config/env');
const { success, error } = require('../utils/apiResponse');

// Razorpay
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const result = await paymentService.createRazorpayPayment(orderId);
    
    return success(res, {
      id: result.razorpayOrderId,
      amount: result.amount,
      currency: result.currency,
      key_id: config.razorpay.keyId // Send public key to frontend
    }, 'Razorpay order created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    const { orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    const order = await paymentService.verifyRazorpayPayment(
      orderNumber,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      sessionId
    );
    
    return success(res, { order }, 'Payment verified successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// PayPal
exports.createPaypalOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const result = await paymentService.createPaypalPayment(orderId);
    
    return success(res, result, 'PayPal order created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.capturePaypalOrder = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    const { orderNumber, paypalOrderId } = req.body;
    
    const order = await paymentService.capturePaypalPayment(
      orderNumber,
      paypalOrderId,
      userId,
      sessionId
    );
    
    return success(res, { order }, 'Payment captured successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Manual UPI
exports.createUpiIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const result = await paymentService.createUpiPayment(orderId);
    
    return success(res, result, 'UPI payment intent created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.submitUpiProof = async (req, res) => {
  try {
    const { orderNumber, upiReferenceId } = req.body;
    
    const order = await paymentService.submitUpiProof(orderNumber, upiReferenceId);
    
    return success(res, { order }, 'UPI proof submitted. Payment is pending verification.');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Webhooks (placeholder for production implementation)
exports.razorpayWebhook = async (req, res) => {
  try {
    // Implement Razorpay webhook verification and handling
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.paypalWebhook = async (req, res) => {
  try {
    // Implement PayPal webhook verification and handling
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
