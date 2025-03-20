const express = require('express');
const { 
  getProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  searchProducts
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Search route
router.get('/search', searchProducts);

// Main routes
router.route('/')
  .get(getProducts)
  .post(protect, authorize('admin'), createProduct);

router.route('/:id')
  .get(getProduct)
  .put(protect, authorize('admin'), updateProduct)
  .delete(protect, authorize('admin'), deleteProduct);

module.exports = router; 