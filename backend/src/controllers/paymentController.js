const crypto = require('crypto');
const prisma = require('../config/db');
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

// Razorpay webhook — express.raw() in app.js ensures req.body is a Buffer here
exports.razorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body.toString(); // raw string for HMAC

  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(body)
    .digest('hex');

  // Authentication failure — 400 so Razorpay knows this event was rejected
  if (!signature || signature !== expected) {
    console.error('Razorpay webhook: invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const event = JSON.parse(body);

    if (event.event === 'payment.captured') {
      const razorpayOrderId = event.payload.payment.entity.order_id;
      const razorpayPaymentId = event.payload.payment.entity.id;
      const amount = event.payload.payment.entity.amount / 100; // paise → rupees

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { providerOrderId: razorpayOrderId }
        });
        if (!payment) throw new Error('Payment record not found for order: ' + razorpayOrderId);

        // Idempotency guard — skip if already processed
        if (payment.status === 'SUCCESS') return;

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', providerPaymentId: razorpayPaymentId }
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paymentStatus: 'PAID' }
        });

        const orderItems = await tx.orderItem.findMany({
          where: { orderId: payment.orderId }
        });
        for (const item of orderItems) {
          await tx.inventory.updateMany({
            where: { productId: item.productId, size: item.size },
            data: { stock: { decrement: item.quantity } }
          });
        }

        // G6 fix: adminUserId is a FK to User.id — fetch real admin, skip log if none exists
        const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN' } });
        if (adminUser) {
          await tx.adminAuditLog.create({
            data: {
              adminUserId: adminUser.id,
              action: 'PAYMENT_CONFIRMED',
              entityType: 'Payment',
              entityId: payment.id,
              metadata: { razorpayOrderId, razorpayPaymentId, amount }
            }
          });
        }
      });

      // Non-blocking confirmation email — fetch fresh after transaction commits
      const paidPayment = await prisma.payment.findFirst({
        where: { providerOrderId: razorpayOrderId }
      });
      if (paidPayment) {
        const order = await prisma.order.findUnique({
          where: { id: paidPayment.orderId },
          include: { items: true }
        });
        if (order) {
          const emailService = require('../services/emailService');
          emailService.sendOrderConfirmation(order).catch(err =>
            console.error('Razorpay email error:', err.message)
          );
        }
      }
    }

    // Processing success — always 200 so Razorpay does not retry
    return res.status(200).json({ received: true });
  } catch (err) {
    // Valid signature, processing failed — still 200 to suppress Razorpay retry
    console.error('Razorpay webhook processing error:', err.message);
    return res.status(200).json({ received: true });
  }
};

// PayPal webhook — express.raw() in app.js ensures req.body is a Buffer here
exports.paypalWebhook = async (req, res) => {
  // TODO: Full PayPal webhook signature verification
  // Requires PAYPAL_WEBHOOK_ID in .env and a PayPal SDK round-trip verification call
  // Implement before going live with real PayPal credentials
  const sig = req.headers['paypal-transmission-sig'];
  if (!sig) console.warn('PayPal webhook: missing transmission signature — verify in production');

  try {
    const body = req.body.toString();
    const event = JSON.parse(body);

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id
        || event.resource?.id;
      const captureId = event.resource?.id;
      const amount = parseFloat(event.resource?.amount?.value || 0);

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { providerOrderId: paypalOrderId }
        });
        if (!payment) throw new Error('Payment not found for PayPal order: ' + paypalOrderId);

        // Idempotency guard — skip if already processed
        if (payment.status === 'SUCCESS') return;

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', providerPaymentId: captureId }
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paymentStatus: 'PAID' }
        });

        const orderItems = await tx.orderItem.findMany({
          where: { orderId: payment.orderId }
        });
        for (const item of orderItems) {
          await tx.inventory.updateMany({
            where: { productId: item.productId, size: item.size },
            data: { stock: { decrement: item.quantity } }
          });
        }
      });

      const paidPayment = await prisma.payment.findFirst({
        where: { providerOrderId: paypalOrderId }
      });
      if (paidPayment) {
        const order = await prisma.order.findUnique({
          where: { id: paidPayment.orderId },
          include: { items: true }
        });
        if (order) {
          const emailService = require('../services/emailService');
          emailService.sendOrderConfirmation(order).catch(err =>
            console.error('PayPal email error:', err.message)
          );
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayPal webhook processing error:', err.message);
    return res.status(200).json({ received: true });
  }
};
