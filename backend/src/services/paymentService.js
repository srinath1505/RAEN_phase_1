const prisma = require('../config/db');
const orderService = require('./orderService');
const inventoryService = require('./inventoryService');
const emailService = require('./emailService');
const cartService = require('./cartService');
const razorpayService = require('./razorpayService');
const paypalService = require('./paypalService');
const upiService = require('./upiService');

class PaymentService {
  async createRazorpayPayment(orderId) {
    const order = await orderService.getOrderById(orderId);
    
    // Create Razorpay order
    const razorpayOrder = await razorpayService.createOrder(
      order.total,
      order.orderNumber,
      'INR'
    );
    
    // Create payment record
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
    
    // Verify signature
    await razorpayService.handlePaymentSuccess(
      order.id,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    
    // Update order status
    await orderService.updatePaymentStatus(order.id, 'PAID');
    await orderService.updateOrderStatus(order.id, 'PROCESSING');
    
    // Reduce inventory
    await inventoryService.reduceStockForOrder(order.id);
    
    // Clear cart
    await cartService.clearCart(userId, sessionId);
    
    // Send confirmation email
    const updatedOrder = await orderService.getOrderById(order.id);
    await emailService.sendOrderConfirmation(updatedOrder);
    
    return updatedOrder;
  }
  
  async createPaypalPayment(orderId) {
    const order = await orderService.getOrderById(orderId);
    
    // Convert EUR to USD for PayPal (in production, use real exchange rates)
    const usdAmount = order.total * 1.1; // Simplified conversion
    
    // Create PayPal order
    const paypalOrder = await paypalService.createOrder(
      usdAmount,
      order.orderNumber,
      'USD'
    );
    
    // Create payment record
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
    
    return {
      paypalOrderId: paypalOrder.id,
      payment
    };
  }
  
  async capturePaypalPayment(orderNumber, paypalOrderId, userId, sessionId) {
    const order = await orderService.getOrderByNumber(orderNumber);
    
    // Capture payment
    const captureResult = await paypalService.captureOrder(paypalOrderId);
    
    if (captureResult.status !== 'COMPLETED') {
      throw new Error('PayPal payment was not completed');
    }
    
    // Update payment record
    await paypalService.handlePaymentSuccess(order.id, paypalOrderId, captureResult);
    
    // Update order status
    await orderService.updatePaymentStatus(order.id, 'PAID');
    await orderService.updateOrderStatus(order.id, 'PROCESSING');
    
    // Reduce inventory
    await inventoryService.reduceStockForOrder(order.id);
    
    // Clear cart
    await cartService.clearCart(userId, sessionId);
    
    // Send confirmation email
    const updatedOrder = await orderService.getOrderById(order.id);
    await emailService.sendOrderConfirmation(updatedOrder);
    
    return updatedOrder;
  }
  
  async createUpiPayment(orderId) {
    const order = await orderService.getOrderById(orderId);
    
    // Generate UPI intent
    const upiIntent = upiService.generateUpiIntent(order.orderNumber, order.total);
    
    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'UPI_MANUAL',
        amount: order.total,
        currency: order.currency,
        status: 'PENDING'
      }
    });
    
    return {
      ...upiIntent,
      payment
    };
  }
  
  async submitUpiProof(orderNumber, upiReferenceId) {
    const order = await orderService.getOrderByNumber(orderNumber);
    
    // Submit proof
    await upiService.submitProof(order.id, upiReferenceId);
    
    // Update order payment status
    await orderService.updatePaymentStatus(order.id, 'PENDING_VERIFICATION');
    
    // Send pending verification email
    await emailService.sendPaymentPending(order);
    
    return order;
  }
  
  async approveUpiPayment(paymentId, userId, sessionId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            items: true
          }
        }
      }
    });
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // Approve payment
    await upiService.approvePayment(paymentId);
    
    // Update order status
    await orderService.updatePaymentStatus(payment.orderId, 'PAID');
    await orderService.updateOrderStatus(payment.orderId, 'PROCESSING');
    
    // Reduce inventory
    await inventoryService.reduceStockForOrder(payment.orderId);
    
    // Clear cart if sessionId is available
    if (userId || sessionId) {
      await cartService.clearCart(userId, sessionId);
    }
    
    // Send confirmation email
    await emailService.sendOrderConfirmation(payment.order);
    
    return payment.order;
  }
  
  async rejectUpiPayment(paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true
      }
    });
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // Reject payment
    await upiService.rejectPayment(paymentId);
    
    // Update order status
    await orderService.updatePaymentStatus(payment.orderId, 'FAILED');
    
    // Send payment failed email
    await emailService.sendPaymentFailed(payment.order);
    
    return payment.order;
  }
}

module.exports = new PaymentService();
