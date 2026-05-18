const { error } = require('../utils/apiResponse');

function adminMiddleware(req, res, next) {
  if (!req.user) {
    return error(res, 'Authentication required', 401);
  }

  if (req.user.role !== 'ADMIN') {
    return error(res, 'Admin access required', 403);
  }

  // Require the token to have been issued by the dedicated admin login endpoint.
  // This prevents regular-user tokens (even those with role=ADMIN from legacy seeding)
  // from accessing admin routes — only tokens from POST /api/admin/auth/login are accepted.
  if (!req.user.adminLogin) {
    return error(res, 'Admin access requires sign-in via the Admin Portal', 403);
  }

  next();
}

module.exports = adminMiddleware;
