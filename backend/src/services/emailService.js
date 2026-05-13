const transporter = require('../config/mail');
const config = require('../config/env');

class EmailService {
  async sendEmail(to, subject, html) {
    try {
      await transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html
      });
      
      console.log(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      // Don't throw - we don't want to block the process if email fails
      return false;
    }
  }
  
  async sendOrderConfirmation(order) {
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 10px;">${item.productName}</td>
        <td style="padding: 10px;">Size ${item.size}</td>
        <td style="padding: 10px;">${item.quantity}</td>
        <td style="padding: 10px;">€${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 10px;">€${item.lineTotal.toFixed(2)}</td>
      </tr>
    `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1c1c; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .header h1 { font-family: serif; font-size: 32px; letter-spacing: 0.5em; margin: 0; }
          .content { background: #f9f9f9; padding: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 10px; border-bottom: 2px solid #000; font-size: 10px; letter-spacing: 0.2em; }
          td { padding: 10px; border-bottom: 1px solid #e2e2e2; }
          .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
          .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #777; letter-spacing: 0.2em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>RAEN</h1>
            <p style="font-size: 12px; letter-spacing: 0.3em; margin-top: 10px;">ORDER CONFIRMATION</p>
          </div>
          
          <div class="content">
            <p>Your order has been confirmed.</p>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Email:</strong> ${order.email}</p>
            
            <h3 style="margin-top: 30px;">Order Details</h3>
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>SIZE</th>
                  <th>QTY</th>
                  <th>PRICE</th>
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <div style="text-align: right; margin-top: 20px;">
              <p>Subtotal: €${order.subtotal.toFixed(2)}</p>
              <p>Tax: €${order.tax.toFixed(2)}</p>
              <p>Shipping: €${order.shipping.toFixed(2)}</p>
              <p class="total">Total: €${order.total.toFixed(2)}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>© 2024 RAEN. TOTAL DOMINATION.</p>
            <p>Questions? Contact us at ${config.email.supportEmail}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(order.email, `Order Confirmed - ${order.orderNumber}`, html);
  }
  
  async sendPaymentPending(order) {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="text-align: center; letter-spacing: 0.5em;">RAEN</h1>
          <h2>Payment Pending Verification</h2>
          <p>Dear Customer,</p>
          <p>We have received your payment submission for order <strong>${order.orderNumber}</strong>.</p>
          <p>Your payment is currently pending verification. We will confirm your order once the payment has been verified.</p>
          <p>Order Total: <strong>€${order.total.toFixed(2)}</strong></p>
          <p>You will receive another email once your payment is confirmed.</p>
          <p>Thank you for your patience.</p>
          <p style="margin-top: 40px; text-align: center; font-size: 10px;">© 2024 RAEN</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(order.email, `Payment Pending - ${order.orderNumber}`, html);
  }
  
  async sendPaymentFailed(order) {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="text-align: center; letter-spacing: 0.5em;">RAEN</h1>
          <h2>Payment Failed</h2>
          <p>Dear Customer,</p>
          <p>Unfortunately, the payment for order <strong>${order.orderNumber}</strong> could not be processed.</p>
          <p>Order Total: <strong>€${order.total.toFixed(2)}</strong></p>
          <p>Please contact us at ${config.email.supportEmail} if you need assistance.</p>
          <p style="margin-top: 40px; text-align: center; font-size: 10px;">© 2024 RAEN</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(order.email, `Payment Failed - ${order.orderNumber}`, html);
  }
  
  async sendNewsletterWelcome(email) {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center;">
          <h1 style="letter-spacing: 0.5em;">RAEN</h1>
          <h2>Welcome to RAEN Private Access</h2>
          <p>You are now part of our exclusive circle.</p>
          <p>Be the first to know about new collections, private events, and limited editions.</p>
          <p style="margin-top: 40px; font-size: 10px;">© 2024 RAEN. TOTAL DOMINATION.</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(email, 'Welcome to RAEN Private Access', html);
  }
  
  async sendEarlyAccessConfirmation(email, firstName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="text-align: center; letter-spacing: 0.5em;">RAEN</h1>
          <h2>Early Access Request Received</h2>
          <p>Dear ${firstName},</p>
          <p>Thank you for your interest in RAEN's exclusive early access program.</p>
          <p>We have received your request and will be in touch soon.</p>
          <p style="margin-top: 40px; text-align: center; font-size: 10px;">© 2024 RAEN</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(email, 'Early Access Request Received - RAEN', html);
  }
  
  async sendContactAcknowledgment(email, name) {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="text-align: center; letter-spacing: 0.5em;">RAEN</h1>
          <h2>Message Received</h2>
          <p>Dear ${name},</p>
          <p>Thank you for contacting RAEN. We have received your message and will respond shortly.</p>
          <p style="margin-top: 40px; text-align: center; font-size: 10px;">© 2024 RAEN</p>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(email, 'Message Received - RAEN', html);
  }
}

module.exports = new EmailService();
