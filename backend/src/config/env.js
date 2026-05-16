require('dotenv').config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  
  jwt: {
    secret: process.env.JWT_SECRET || 'raen-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  },
  
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
  },
  
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    env: process.env.PAYPAL_ENV || 'sandbox',
    webhookId: process.env.PAYPAL_WEBHOOK_ID
  },
  
  upi: {
    id: process.env.UPI_ID,
    merchantName: process.env.UPI_MERCHANT_NAME || 'RAEN',
    paymentNote: process.env.UPI_PAYMENT_NOTE || 'RAEN Order Payment'
  },
  
  email: {
    provider: process.env.EMAIL_PROVIDER || 'nodemailer',
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    from: process.env.EMAIL_FROM || 'hello@raen.design',
    supportEmail: process.env.SUPPORT_EMAIL || 'hello@raen.design'
  },
  
  pricing: {
    taxRate: parseFloat(process.env.TAX_RATE || '0.00'),
    shippingFlatRate: parseFloat(process.env.SHIPPING_FLAT_RATE || '0'),
    currency: process.env.CURRENCY || 'EUR'
  }
};

module.exports = config;
