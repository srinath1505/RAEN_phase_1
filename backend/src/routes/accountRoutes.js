const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');

router.use(authMiddleware);

router.get('/profile', accountController.getProfile);

router.patch(
  '/profile',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .custom(val => {
        if (val && !/^\+\d{7,}$/.test(val)) {
          throw new Error('Phone must be in E.164 format: + followed by at least 7 digits (e.g. +44123456789)');
        }
        return true;
      })
  ],
  validationMiddleware,
  accountController.updateProfile
);

router.get('/orders', accountController.getOrders);

router.get('/addresses', accountController.getAddresses);

router.post(
  '/addresses',
  [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('addressLine1').notEmpty().withMessage('Address line 1 is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('postalCode').notEmpty().withMessage('Postal code is required'),
    body('country').notEmpty().withMessage('Country is required')
  ],
  validationMiddleware,
  accountController.createAddress
);

router.patch('/addresses/:id', accountController.updateAddress);

router.delete('/addresses/:id', accountController.deleteAddress);

router.post('/orders/:id/cancel', accountController.cancelOrder);

router.get('/measurements', accountController.getMeasurements);
router.put('/measurements', accountController.saveMeasurements);
router.patch('/measurements', accountController.saveMeasurements);

module.exports = router;
