const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const cartController = require('../controllers/cartController');
const validationMiddleware = require('../middleware/validationMiddleware');

router.get('/', cartController.getCart);

router.post(
  '/items',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('size').optional().isString(),
    body('measurements').optional().isObject(),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
  ],
  validationMiddleware,
  cartController.addItem
);

router.patch(
  '/items/:itemId',
  [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
  ],
  validationMiddleware,
  cartController.updateItem
);

router.delete('/items/:itemId', cartController.removeItem);

router.delete('/', cartController.clearCart);

router.post('/sync', cartController.syncCart);

module.exports = router;
