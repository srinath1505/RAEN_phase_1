const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const checkoutController = require('../controllers/checkoutController');
const validationMiddleware = require('../middleware/validationMiddleware');

router.post(
  '/',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    body('shippingAddress.fullName').notEmpty().withMessage('Full name is required'),
    body('shippingAddress.addressLine1').notEmpty().withMessage('Address is required'),
    body('shippingAddress.city').notEmpty().withMessage('City is required'),
    body('shippingAddress.state').notEmpty().withMessage('State is required'),
    body('shippingAddress.postalCode').notEmpty().withMessage('Postal code is required'),
    body('shippingAddress.country').notEmpty().withMessage('Country is required')
  ],
  validationMiddleware,
  checkoutController.createOrder
);

router.get('/summary', checkoutController.getCheckoutSummary);

module.exports = router;
