const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');

router.use(authMiddleware);

router.get('/orders', accountController.getOrders);

router.get('/addresses', accountController.getAddresses);

router.post(
  '/addresses',
  [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('addressLine1').notEmpty().withMessage('Address line 1 is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('state').notEmpty().withMessage('State is required'),
    body('postalCode').notEmpty().withMessage('Postal code is required'),
    body('country').notEmpty().withMessage('Country is required')
  ],
  validationMiddleware,
  accountController.createAddress
);

router.patch('/addresses/:id', accountController.updateAddress);

router.delete('/addresses/:id', accountController.deleteAddress);

module.exports = router;
