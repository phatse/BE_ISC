const express = require('express');
const { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeCartItem, 
  clearCart 
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All cart routes require authentication
router.use(protect);

// Cart routes
router.route('/')
  .get(getCart)
  .delete(clearCart);

// Cart items routes
router.route('/items')
  .post(addToCart);

router.route('/items/:itemId')
  .put(updateCartItem)
  .delete(removeCartItem);

module.exports = router; 