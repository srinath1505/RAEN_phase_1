const Razorpay = require('razorpay');
const config = require('./env');

// Only instantiate when real keys are provided — placeholder keys crash the SDK
const isConfigured = config.razorpay.keyId && !config.razorpay.keyId.includes('placeholder');

const razorpay = isConfigured
  ? new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret })
  : null;

module.exports = razorpay;
