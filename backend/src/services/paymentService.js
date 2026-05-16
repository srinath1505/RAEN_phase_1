const prisma = require('../config/db');
const orderService = require('./orderService');
const emailService = require('./emailService');
const cartService = require('./cartService');
const razorpayService = require('./razorpayService');
const paypalService = require('./paypalService');
const upiService = require('./upiService');
const inventoryService = require('./inventoryService');

// Fetches a live exchange rate from Frankfurter (api.frankfurter.app).
// Falls back to `fallback` on any network failure, timeout, or parse error.
async function getExchangeRate(from, to, fallback) {
  return new Promise((resolve) => {
    const https = require('https');
    const req = https.get(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const rate = parsed.rates && parsed.rates[to];
            if (rate && typeof rate === 'number') return resolve(rate);
          } catch (_) {}
          console.warn(`Frankfurter: parse failed for ${from}/${to} — using fallback ${fallback}`);
          resolve(fallback);
        });
      }
    );
    req.on('error', () => {
      console.warn(`Frankfurter: request error for ${from}/${to} — using fallback ${fallback}`);
      resolve(fallback);
    });
    req.setTimeout(3000, () => {
      req.destroy();
      console.warn(`Frankfurter: timeout for ${from}/${to} — using fallback ${fallback}`);
      resolve(fallback);
    });
  });
}

class PaymentService {
  async createRazorpayPayment(orderId) {
    const order = await orderService.getOrderById(orderId);

    // N2: reuse an existing CREATED record rather than accumulating stale duplicates
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId: order.id, provider: 'RAZORPAY', status: 'CREATED' }
    });

    // C4: order.total is stored in EUR; Razorpay settles in INR for Indian merchant accounts.
    // Passing the raw EUR value as INR would charge ~1% of the correct amount.
    const inrRate = await getExchangeRate('EUR', 'INR', 90);
    const inrAmount = order.total * inrRate; // e.g. €2400 × 90 = ₹216000

    // razorpayService.createOrder internally does Math.round(amount * 100) → paise
    const razorpayOrder = await razorpayService.createOrder(inrAmount, order.orderNumber, 'INR');

    if (existingPayment) {
      const updated = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { providerOrderId: razorpayOrder.id }
      });
      return {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        payment: updated
      };
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'RAZORPAY',
        providerOrderId: razorpayOrder.id,
        amount: order.total,
        currency: order.currency,
        status: 'CREATED'
      }
    });

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      payment
    };
  }

  async verifyRazorpayPayment(orderNumber, razorpayOrderId, razorpayPaymentId, razorpaySignature, userId, sessionId) {
    const order = await orderService.getOrderByNumber(orderNumber);

    // Signature verification is pure crypto — no DB access needed, run outside the transaction
    const isValid = razorpayService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) throw new Error('Invalid payment signature');

    // M1: wrap all DB mutations in one transaction — a mid-flight failure leaves no inconsistent state
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { orderId: order.id, providerOrderId: razorpayOrderId }
      });
      if (!payment) throw new Error('Payment record not found');

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          providerPaymentId: razorpayPaymentId,
          providerSignature: razorpaySignature
        }
      });

      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID', status: 'PROCESSING' }
      });

      const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of orderItems) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, size: item.size },
          data: { stock: { decrement: item.quantity } }
        });
      }
    });

    // Side effects: outside the transaction — failures here do not roll back the payment
    cartService.clearCart(userId, sessionId).catch(err =>
      console.error('Razorpay verify: cart clear error:', err.message)
    );
    const updatedOrder = await orderService.getOrderById(order.id);
    emailService.sendOrderConfirmation(updatedOrder).catch(err =>
      console.error('Razorpay verify: confirmation email error:', err.message)
    );

    return updatedOrder;
  }

  async createPaypalPayment(orderId) {
    const order = await orderService.getOrderById(orderId);

    // N2: reuse existing CREATED record
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId: order.id, provider: 'PAYPAL', status: 'CREATED' }
    });

    // M2: replace hardcoded 1.10 with a live EUR/USD rate (fallback: 1.10)
    const usdRate = await getExchangeRate('EUR', 'USD', 1.10);
    const usdAmount = order.total * usdRate;

    const paypalOrder = await paypalService.createOrder(usdAmount, order.orderNumber, 'USD');

    if (existingPayment) {
      const updated = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { providerOrderId: paypalOrder.id }
      });
      return { paypalOrderId: paypalOrder.id, payment: updated };
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'PAYPAL',
        providerOrderId: paypalOrder.id,
        amount: order.total,
        currency: order.currency,
        status: 'CREATED'
      }
    });

    return { paypalOrderId: paypalOrder.id, payment };
  }

  async capturePaypalPayment(orderNumber, paypalOrderId, userId, sessionId) {
    const order = await orderService.getOrderByNumber(orderNumber);

    // External PayPal API call must run OUTSIDE the transaction (network I/O in a DB tx is unsafe)
    const captureResult = await paypalService.captureOrder(paypalOrderId);
    if (captureResult.status !== 'COMPLETED') {
      throw new Error('PayPal payment was not completed');
    }

    // M1: wrap all DB mutations in one transaction
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { orderId: order.id, providerOrderId: paypalOrderId }
      });
      if (!payment) throw new Error('Payment record not found');

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          providerPaymentId: captureResult.id,
          rawResponse: captureResult
        }
      });

      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID', status: 'PROCESSING' }
      });

      const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of orderItems) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, size: item.size },
          data: { stock: { decrement: item.quantity } }
        });
      }
    });

    // Side effects: outside the transaction
    cartService.clearCart(userId, sessionId).catch(err =>
      console.error('PayPal capture: cart clear error:', err.message)
    );
    const updatedOrder = await orderService.getOrderById(order.id);
    emailService.sendOrderConfirmation(updatedOrder).catch(err =>
      console.error('PayPal capture: confirmation email error:', err.message)
    );

    return updatedOrder;
  }

  async createUpiPayment(orderId) {
    const order = await orderService.getOrderById(orderId);

    const upiIntent = upiService.generateUpiIntent(order.orderNumber, order.total);

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'UPI_MANUAL',
        amount: order.total,
        currency: order.currency,
        status: 'PENDING'
      }
    });

    return { ...upiIntent, payment };
  }

  async submitUpiProof(orderNumber, upiReferenceId) {
    const order = await orderService.getOrderByNumber(orderNumber);

    await upiService.submitProof(order.id, upiReferenceId);
    await orderService.updatePaymentStatus(order.id, 'PENDING_VERIFICATION');
    await emailService.sendPaymentPending(order);

    return order;
  }

  async approveUpiPayment(paymentId, userId, sessionId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { items: true } } }
    });

    if (!payment) throw new Error('Payment not found');

    await upiService.approvePayment(paymentId);
    await orderService.updatePaymentStatus(payment.orderId, 'PAID');
    await orderService.updateOrderStatus(payment.orderId, 'PROCESSING');
    await inventoryService.reduceStockForOrder(payment.orderId);

    if (userId || sessionId) {
      await cartService.clearCart(userId, sessionId);
    }

    await emailService.sendOrderConfirmation(payment.order);

    return payment.order;
  }

  async rejectUpiPayment(paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true }
    });

    if (!payment) throw new Error('Payment not found');

    await upiService.rejectPayment(paymentId);
    await orderService.updatePaymentStatus(payment.orderId, 'FAILED');
    await orderService.updateOrderStatus(payment.orderId, 'CANCELLED');
    await emailService.sendPaymentFailed(payment.order);

    return payment.order;
  }
}

module.exports = new PaymentService();
