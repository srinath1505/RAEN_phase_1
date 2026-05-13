const paypal = require('@paypal/checkout-server-sdk');
const config = require('./env');

function environment() {
  const clientId = config.paypal.clientId;
  const clientSecret = config.paypal.clientSecret;
  
  if (config.paypal.env === 'production') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  }
  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

module.exports = { client };
