const config = require('../config/env');
const prisma = require('../config/db');

class UpiService {
  generateUpiIntent(orderNumber, amount) {
    const upiId = config.upi.id;
    const merchantName = config.upi.merchantName;
    const paymentNote = `${config.upi.paymentNote} - ${orderNumber}`;
    
    // UPI deep link format
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(paymentNote)}`;
    
    return {
      upiId,
      merchantName,
      amount,
      orderNumber,
      paymentNote,
      upiLink,
      qrString: upiLink // Can be used to generate QR code on frontend
    };
  }
  
  async submitProof(orderId, upiReferenceId) {
    // Check for duplicate reference ID
    const existingPayment = await prisma.payment.findFirst({
      where: {
        provider: 'UPI_MANUAL',
        upiReferenceId,
        status: { in: ['VERIFICATION_REQUIRED', 'SUCCESS'] }
      }
    });
    
    if (existingPayment) {
      throw new Error('This UPI reference ID has already been submitted');
    }
    
    // Find payment record
    const payment = await prisma.payment.findFirst({
      where: {
        orderId,
        provider: 'UPI_MANUAL'
      }
    });
    
    if (!payment) {
      throw new Error('Payment record not found');
    }
    
    // Update payment with reference ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        upiReferenceId,
        status: 'VERIFICATION_REQUIRED'
      }
    });
    
    return true;
  }
  
  async approvePayment(paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    if (payment.status !== 'VERIFICATION_REQUIRED') {
      throw new Error('Payment is not pending verification');
    }
    
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCESS'
      }
    });
    
    return true;
  }
  
  async rejectPayment(paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    if (payment.status !== 'VERIFICATION_REQUIRED') {
      throw new Error('Payment is not pending verification');
    }
    
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED'
      }
    });
    
    return true;
  }
}

module.exports = new UpiService();
