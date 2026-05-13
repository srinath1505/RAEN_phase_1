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
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });
    
    if (!user) {
      return error(res, 'User not found', 401);
    }
    
    req.user = user;
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
}

module.exports = authMiddleware;
