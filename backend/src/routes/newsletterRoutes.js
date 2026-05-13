const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const newsletterController = require('../controllers/newsletterController');
const validationMiddleware = require('../middleware/validationMiddleware');

router.post(
  '/subscribe',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  validationMiddleware,
  newsletterController.subscribe
);

module.exports = router;
