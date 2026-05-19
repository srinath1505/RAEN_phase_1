const cartService = require('../services/cartService');
const { success, error } = require('../utils/apiResponse');

exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    
    const cart = await cartService.getCart(userId, sessionId);
    
    return success(res, { cart }, 'Cart retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.addItem = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    const { productId, size, quantity, measurements } = req.body;
    const effectiveSize = size || (measurements ? 'CUSTOM' : null);
    if (!effectiveSize) return error(res, 'size or measurements is required', 400);
    const item = await cartService.addItem(userId, sessionId, productId, effectiveSize, quantity || 1, measurements || null);
    return success(res, { item }, 'Item added to cart', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.updateItem = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    const item = await cartService.updateItem(itemId, quantity, userId, sessionId);
    
    return success(res, { item }, 'Item updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.removeItem = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    const { itemId } = req.params;
    
    await cartService.removeItem(itemId, userId, sessionId);
    
    return success(res, null, 'Item removed from cart');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers['x-session-id'] || null;
    
    await cartService.clearCart(userId, sessionId);
    
    return success(res, null, 'Cart cleared');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.syncCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.body;
    
    if (!userId) {
      return error(res, 'User must be logged in', 401);
    }
    
    await cartService.syncGuestCart(userId, sessionId);
    
    return success(res, null, 'Cart synced');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
