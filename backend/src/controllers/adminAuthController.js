const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const config = require('../config/env');
const { success, error } = require('../utils/apiResponse');

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password are required', 400);
    }

    if (!config.admin.email || !config.admin.password) {
      return error(res, 'Admin credentials not configured on this server', 503);
    }

    // Validate against env-var credentials only — never touches the customer User table password
    if (email.toLowerCase() !== config.admin.email.toLowerCase()) {
      return error(res, 'Invalid credentials', 401);
    }
    if (password !== config.admin.password) {
      return error(res, 'Invalid credentials', 401);
    }

    // Look up the DB record only to get the id for audit logs — not for password validation
    const adminUser = await prisma.user.findFirst({
      where: { email: config.admin.email, role: 'ADMIN' },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    const payload = {
      id: adminUser?.id || 'admin',
      email: config.admin.email,
      firstName: adminUser?.firstName || 'Admin',
      lastName: adminUser?.lastName || '',
      role: 'ADMIN',
      adminLogin: true
    };

    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '12h' });

    return success(res, {
      token,
      user: { email: config.admin.email, role: 'ADMIN' }
    }, 'Admin login successful');

  } catch (err) {
    return error(res, 'Login failed', 500);
  }
};
