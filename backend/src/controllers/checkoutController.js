const checkoutService = require('../services/checkoutService');
const { success, error } = require('../utils/apiResponse');

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    const { email, phone, shippingAddress, billingAddress } = req.body;
    
    const order = await checkoutService.createOrder({
      userId,
      sessionId,
      email,
      phone,
      shippingAddress,
      billingAddress
    });
    
    return success(res, { order }, 'Order created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.getCheckoutSummary = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    
    const summary = await checkoutService.getCheckoutSummary(userId, sessionId);
    
    return success(res, summary, 'Checkout summary retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
