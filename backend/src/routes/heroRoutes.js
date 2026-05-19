const express = require('express');
const router = express.Router();
const heroController = require('../controllers/heroController');

router.get('/', heroController.getSlides);

module.exports = router;
