const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const earlyAccessController = require('../controllers/earlyAccessController');
const validationMiddleware = require('../middleware/validationMiddleware');

router.post(
  '/',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('city').optional().trim(),
    body('interest').optional().trim(),
    body('budgetOrPreference').optional().trim(),
    body('acceptedPrivacy').isBoolean().withMessage('Privacy acceptance is required'),
    body('wantsUpdates').optional().isBoolean()
  ],
  validationMiddleware,
  earlyAccessController.submit
);

module.exports = router;
