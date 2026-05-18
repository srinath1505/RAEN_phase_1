const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const adminAuthController = require('../controllers/adminAuthController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');

// Public admin login — must be declared BEFORE the auth middleware stack
router.post(
  '/auth/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
  ],
  validationMiddleware,
  adminAuthController.adminLogin
);

// All routes below this line require a valid admin token
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard-extended', adminController.getDashboardExtended);

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Products — order is permanent: stats route MUST be registered before /:id
router.get('/products', adminController.getAllProducts);
router.post(
  '/products',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('salePrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Sale price must be non-negative'),
    body('discountPercent').optional({ nullable: true }).isInt({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100')
  ],
  validationMiddleware,
  adminController.createProduct
);
router.get('/products/:id/stats', adminController.getProductStats);
router.get('/products/:id', adminController.getProduct);
router.patch(
  '/products/:id',
  [
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('salePrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Sale price must be non-negative'),
    body('discountPercent').optional({ nullable: true }).isInt({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100')
  ],
  validationMiddleware,
  adminController.updateProduct
);
router.delete('/products/:id', adminController.deleteProduct);

// Orders
router.get('/orders', adminController.getAllOrders);
router.get('/orders/:id', adminController.getOrder);
router.patch(
  '/orders/:id/status',
  [
    body('status').isIn(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
      .withMessage('Invalid order status')
  ],
  validationMiddleware,
  adminController.updateOrderStatus
);
router.post('/orders/:id/cancel', adminController.cancelOrder);

// Inventory
router.get('/inventory', adminController.getAllInventory);
router.patch(
  '/inventory/:id',
  [
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
  ],
  validationMiddleware,
  adminController.updateInventory
);

// Customers
router.get('/customers', adminController.getAllCustomers);

// Payments
router.get('/payments', adminController.getAllPayments);
router.get('/payments/pending-verification', adminController.getPendingVerifications);
router.patch('/payments/:id/approve', adminController.approvePayment);
router.patch('/payments/:id/reject', adminController.rejectPayment);

// Early Access
router.get('/early-access', adminController.getAllEarlyAccess);
router.patch(
  '/early-access/:id/status',
  [
    body('status').isIn(['NEW', 'REVIEWED', 'APPROVED', 'REJECTED'])
      .withMessage('Invalid early access status')
  ],
  validationMiddleware,
  adminController.updateEarlyAccessStatus
);

// Contact Messages
router.get('/contact-messages', adminController.getAllContactMessages);
router.patch(
  '/contact-messages/:id/status',
  [
    body('status').isIn(['NEW', 'READ', 'REPLIED'])
      .withMessage('Invalid message status')
  ],
  validationMiddleware,
  adminController.updateContactMessageStatus
);

module.exports = router;
