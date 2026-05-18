const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const config = require('../config/env');
const { success, error } = require('../utils/apiResponse');

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password are required', 400);
    }

    let adminUser = null;

    // ── Path A: env-var credentials are configured ────────────────────────
    // ADMIN_EMAIL + ADMIN_PASSWORD set in Railway → validate against them
    if (config.admin.email && config.admin.password) {
      if (email.toLowerCase() !== config.admin.email.toLowerCase()) {
        return error(res, 'Invalid credentials', 401);
      }
      if (password !== config.admin.password) {
        return error(res, 'Invalid credentials', 401);
      }
      // Fetch DB record only for the id (audit logs) — not for auth
      adminUser = await prisma.user.findFirst({
        where: { email: config.admin.email, role: 'ADMIN' },
        select: { id: true, email: true, firstName: true, lastName: true }
      });

    // ── Path B: env vars not set → fall back to DB + bcrypt ──────────────
    // This covers Railway deployments where ADMIN_EMAIL/ADMIN_PASSWORD are
    // not yet configured as env vars. The admin user must have role='ADMIN'.
    } else {
      adminUser = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), role: 'ADMIN' },
        select: { id: true, email: true, firstName: true, lastName: true, passwordHash: true }
      });

      if (!adminUser) {
        return error(res, 'Invalid credentials', 401);
      }

      const passwordMatch = await bcrypt.compare(password, adminUser.passwordHash);
      if (!passwordMatch) {
        return error(res, 'Invalid credentials', 401);
      }
    }

    const payload = {
      id: adminUser?.id || 'admin',
      email: adminUser?.email || email,
      firstName: adminUser?.firstName || 'Admin',
      lastName: adminUser?.lastName || '',
      role: 'ADMIN',
      adminLogin: true
    };

    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '12h' });

    return success(res, {
      token,
      user: { email: payload.email, role: 'ADMIN' }
    }, 'Admin login successful');

  } catch (err) {
    console.error('Admin login error:', err.message);
    return error(res, 'Login failed. Please try again.', 500);
  }
};
