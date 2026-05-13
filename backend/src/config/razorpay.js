const Razorpay = require('razorpay');
const config = require('./env');

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret
});

module.exports = razorpay;
