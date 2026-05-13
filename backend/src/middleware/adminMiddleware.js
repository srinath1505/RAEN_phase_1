const { error } = require('../utils/apiResponse');

function adminMiddleware(req, res, next) {
  if (!req.user) {
    return error(res, 'Authentication required', 401);
  }
  
  if (req.user.role !== 'ADMIN') {
    return error(res, 'Admin access required', 403);
  }
  
  next();
}

module.exports = adminMiddleware;
