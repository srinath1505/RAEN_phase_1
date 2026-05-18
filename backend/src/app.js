const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/env');
const errorMiddleware = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const accountRoutes = require('./routes/accountRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const earlyAccessRoutes = require('./routes/earlyAccessRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [config.frontendUrl, 'http://127.0.0.1:4173', 'http://localhost:4173'],
  credentials: true
}));

// Raw body for webhook HMAC verification — MUST be before express.json()
// express.raw() sets req._body=true so the global express.json() below skips these routes
app.use('/api/payments/razorpay/webhook', express.raw({ type: '*/*' }));
app.use('/api/payments/paypal/webhook', express.raw({ type: '*/*' }));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Root route — only shown in development (production serves stitch/index.html)
if (config.nodeEnv !== 'production') {
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'RAEN E-commerce API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        products: '/api/products',
        cart: '/api/cart',
        checkout: '/api/checkout',
        payments: '/api/payments',
        orders: '/api/orders',
        account: '/api/account',
        newsletter: '/api/newsletter',
        earlyAccess: '/api/early-access',
        contact: '/api/contact',
        admin: '/api/admin',
        analytics: '/api/analytics'
      }
    });
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/early-access', earlyAccessRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve static frontend in production — after API routes so /api/* takes precedence
if (config.nodeEnv === 'production') {
  app.use(express.static(path.join(__dirname, '../../stitch')));
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;
