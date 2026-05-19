const productService = require('../services/productService');
const { success, error } = require('../utils/apiResponse');

exports.getAllProducts = async (req, res) => {
  try {
    const {
      category, status, search,
      minPrice, maxPrice, inStockOnly, onSaleOnly,
      sortBy, page, limit
    } = req.query;
    const result = await productService.getAllProducts({
      category, status, search,
      minPrice, maxPrice, inStockOnly, onSaleOnly,
      sortBy, page, limit
    });
    return success(res, result, 'Products retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await productService.getCategories();
    return success(res, { categories }, 'Categories retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await productService.getProductBySlug(slug);
    return success(res, { product }, 'Product retrieved');
  } catch (err) {
    return error(res, err.message, 404);
  }
};

exports.getProductInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const inventory = await productService.getInventory(id);
    return success(res, { inventory }, 'Inventory retrieved');
  } catch (err) {
    return error(res, err.message, 404);
  }
};
