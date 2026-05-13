const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const config = require('../config/env');

class AuthService {
  async register(data) {
    const { firstName, lastName, email, password, phone } = data;
    
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      throw new Error('Email already registered');
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        phone,
        role: 'CUSTOMER'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true
      }
    });
    
    const token = this.generateToken(user.id);
    
    return { user, token };
  }
  
  async login(email, password) {
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }
    
    const token = this.generateToken(user.id);
    
    const { passwordHash, ...userWithoutPassword } = user;
    
    return { user: userWithoutPassword, token };
  }
  
  generateToken(userId) {
    return jwt.sign({ userId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });
  }
}

module.exports = new AuthService();
