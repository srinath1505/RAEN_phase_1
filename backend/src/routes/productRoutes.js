const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/categories', productController.getCategories);
router.get('/', productController.getAllProducts);
router.get('/:slug', productController.getProductBySlug);
router.get('/:id/inventory', productController.getProductInventory);

module.exports = router;
