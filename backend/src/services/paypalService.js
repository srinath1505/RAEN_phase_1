const paypalClient = require('../config/paypal');
const paypal = require('@paypal/checkout-server-sdk');
const prisma = require('../config/db');

class PaypalService {
  async createOrder(orderTotal, orderNumber, currency = 'USD') {
    try {
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderNumber,
          amount: {
            currency_code: currency,
            value: orderTotal.toFixed(2)
          },
          description: `RAEN Order ${orderNumber}`
        }]
      });
      
      const response = await paypalClient.client().execute(request);
      
      return response.result;
    } catch (error) {
      console.error('PayPal create order error:', error);
      throw new Error('Failed to create PayPal order');
    }
  }
  
  async captureOrder(paypalOrderId) {
    try {
      const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
      request.requestBody({});
      
      const response = await paypalClient.client().execute(request);
      
      return response.result;
    } catch (error) {
      console.error('PayPal capture order error:', error);
      throw new Error('Failed to capture PayPal payment');
    }
  }
  
  async refundPayment(captureId) {
    try {
      // No amount in body = full refund of the captured amount
      const request = new paypal.payments.CapturesRefundRequest(captureId);
      request.requestBody({});
      const response = await paypalClient.client().execute(request);
      console.log(`PayPal refund initiated for capture ${captureId}`);
      return response.result;
    } catch (err) {
      console.error('PayPal refund error:', err);
      throw new Error('PayPal refund failed: ' + err.message);
    }
  }

  async handlePaymentSuccess(orderId, paypalOrderId, captureResult) {
    const payment = await prisma.payment.findFirst({
      where: {
        orderId,
        providerOrderId: paypalOrderId
      }
    });
    
    if (!payment) {
      throw new Error('Payment record not found');
    }
    
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        providerPaymentId: captureResult.id,
        rawResponse: captureResult
      }
    });
    
    return true;
  }
}

module.exports = new PaypalService();
