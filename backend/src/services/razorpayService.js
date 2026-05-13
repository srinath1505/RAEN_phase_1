const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const config = require('../config/env');
const prisma = require('../config/db');

class RazorpayService {
  async createOrder(orderTotal, orderNumber, currency = 'INR') {
    try {
      const options = {
        amount: Math.round(orderTotal * 100), // Convert to smallest currency unit (paise for INR)
        currency,
        receipt: orderNumber,
        notes: {
          orderNumber
        }
      };
      
      const razorpayOrder = await razorpay.orders.create(options);
      
      return razorpayOrder;
    } catch (error) {
      console.error('Razorpay create order error:', error);
      throw new Error('Failed to create Razorpay order');
    }
  }
  
  verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(body.toString())
      .digest('hex');
    
    return expectedSignature === razorpaySignature;
  }
  
  async handlePaymentSuccess(orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    // Verify signature
    const isValid = this.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    
    if (!isValid) {
      throw new Error('Invalid payment signature');
    }
    
    // Update payment record
    const payment = await prisma.payment.findFirst({
      where: {
        orderId,
        providerOrderId: razorpayOrderId
      }
    });
    
    if (!payment) {
      throw new Error('Payment record not found');
    }
    
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        providerPaymentId: razorpayPaymentId,
        providerSignature: razorpaySignature
      }
    });
    
    return true;
  }
}

module.exports = new RazorpayService();
