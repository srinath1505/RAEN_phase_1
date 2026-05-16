const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { error } = require('../utils/apiResponse');
const prisma = require('../config/db');

async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return error(res, 'Authentication required', 401);
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    if (decoded.id) {
      // N3: new token format — all fields embedded, no DB round-trip needed
      req.user = {
        id: decoded.id,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        role: decoded.role
      };
    } else if (decoded.userId) {
      // Legacy token format (issued before N3 fix) — do DB lookup until it expires (7-day window)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, firstName: true, lastName: true, role: true }
      });
      if (!user) return error(res, 'User not found', 401);
      req.user = user;
    } else {
      return error(res, 'Invalid or expired token', 401);
    }

    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
}

module.exports = authMiddleware;
