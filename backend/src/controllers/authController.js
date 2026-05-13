const authService = require('../services/authService');
const cartService = require('../services/cartService');
const { success, error } = require('../utils/apiResponse');

exports.register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    
    // Sync guest cart if sessionId provided
    if (req.body.sessionId) {
      await cartService.syncGuestCart(result.user.id, req.body.sessionId);
    }
    
    return success(res, result, 'Registration successful', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, sessionId } = req.body;
    const result = await authService.login(email, password);
    
    // Sync guest cart if sessionId provided
    if (sessionId) {
      await cartService.syncGuestCart(result.user.id, sessionId);
    }
    
    return success(res, result, 'Login successful');
  } catch (err) {
    return error(res, err.message, 401);
  }
};

exports.getMe = async (req, res) => {
  try {
    return success(res, { user: req.user }, 'User retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.logout = async (req, res) => {
  try {
    return success(res, null, 'Logout successful');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
