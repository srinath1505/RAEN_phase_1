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

    // ── Primary path: DB lookup + bcrypt ─────────────────────────────────
    // The admin user is created by seed.js with role=ADMIN and a bcrypt hash.
    // We look up any admin user matching the submitted email (case-insensitive).
    const adminUser = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        role: 'ADMIN'
      }
    });

    if (adminUser) {
      const valid = await bcrypt.compare(password, adminUser.passwordHash);
      if (!valid) {
        return error(res, 'Invalid email or password', 401);
      }

      const token = jwt.sign(
        {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: 'ADMIN',
          adminLogin: true
        },
        config.jwt.secret,
        { expiresIn: '12h' }
      );

      return success(res, {
        token,
        user: { email: adminUser.email, role: 'ADMIN' }
      }, 'Admin login successful');
    }

    // ── Fallback: env-var credentials (for when DB has no admin user yet) ─
    // This covers a fresh Railway deployment where seed hasn't been run.
    if (config.admin.email && config.admin.password) {
      const emailOk = email.toLowerCase() === config.admin.email.toLowerCase();
      const passOk  = password === config.admin.password;

      if (!emailOk || !passOk) {
        return error(res, 'Invalid email or password', 401);
      }

      const token = jwt.sign(
        { id: 'admin', email: config.admin.email, firstName: 'Admin', lastName: '', role: 'ADMIN', adminLogin: true },
        config.jwt.secret,
        { expiresIn: '12h' }
      );

      return success(res, {
        token,
        user: { email: config.admin.email, role: 'ADMIN' }
      }, 'Admin login successful');
    }

    // No admin user in DB and no env-var credentials configured
    return error(res, 'No admin account found. Please run the database seed (npm run prisma:seed).', 503);

  } catch (err) {
    console.error('Admin login error:', err.message);
    return error(res, 'Login failed. Please try again.', 500);
  }
};
