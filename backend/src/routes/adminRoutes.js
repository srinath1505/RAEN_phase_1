const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/dashboard', adminController.getDashboard);

// Products
router.get('/products', adminController.getAllProducts);
router.post('/products', adminController.createProduct);
router.patch('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Orders
router.get('/orders', adminController.getAllOrders);
router.get('/orders/:id', adminController.getOrder);
router.patch(
  '/orders/:id/status',
  [
    body('status').isIn(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
  ],
  validationMiddleware,
  adminController.updateOrderStatus
);

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
  ],
  validationMiddleware,
  adminController.updateContactMessageStatus
);

module.exports = router;
