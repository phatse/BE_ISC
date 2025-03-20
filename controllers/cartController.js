const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get user's cart
// @route   GET /api/v1/cart
// @access  Private
exports.getCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
  
  if (!cart) {
    cart = await Cart.create({
      user: req.user.id,
      items: []
    });
  }
  
  res.status(200).json({
    success: true,
    data: cart
  });
});

// @desc    Add item to cart
// @route   POST /api/v1/cart/items
// @access  Private
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity, size } = req.body;
  
  // Check if product exists
  const product = await Product.findById(productId);
  
  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${productId}`, 404));
  }
  
  // Validate size
  if (!product.sizes.includes(parseFloat(size))) {
    return next(new ErrorResponse(`Size ${size} is not available for this product`, 400));
  }
  
  let cart = await Cart.findOne({ user: req.user.id });
  
  if (!cart) {
    cart = await Cart.create({
      user: req.user.id,
      items: []
    });
  }
  
  // Check if item with same product and size already exists
  const existingItemIndex = cart.items.findIndex(
    item => item.product.toString() === productId && item.size === parseFloat(size)
  );
  
  if (existingItemIndex > -1) {
    // Update quantity if item exists
    cart.items[existingItemIndex].quantity += quantity || 1;
  } else {
    // Add new item
    cart.items.push({
      product: productId,
      quantity: quantity || 1,
      size: parseFloat(size),
      price: product.priceVND
    });
  }
  
  cart.updatedAt = Date.now();
  await cart.save();
  
  res.status(200).json({
    success: true,
    data: cart
  });
});

// @desc    Update cart item
// @route   PUT /api/v1/cart/items/:itemId
// @access  Private
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  const itemId = req.params.itemId;
  
  let cart = await Cart.findOne({ user: req.user.id });
  
  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }
  
  const item = cart.items.id(itemId);
  
  if (!item) {
    return next(new ErrorResponse(`Item not found in cart`, 404));
  }
  
  item.quantity = quantity;
  cart.updatedAt = Date.now();
  
  await cart.save();
  
  res.status(200).json({
    success: true,
    data: cart
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/items/:itemId
// @access  Private
exports.removeCartItem = asyncHandler(async (req, res, next) => {
  const itemId = req.params.itemId;
  
  const result = await Cart.updateOne(
    { user: req.user.id },
    { 
      $pull: { items: { _id: itemId } },
      $set: { updatedAt: Date.now() }
    }
  );
  
  if (result.matchedCount === 0) {
    return next(new ErrorResponse('Cart not found', 404));
  }
  
  // Lấy cart sau khi đã cập nhật
  const updatedCart = await Cart.findOne({ user: req.user.id }).populate('items.product');
  
  res.status(200).json({
    success: true,
    data: updatedCart
  });
});

// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
exports.clearCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user.id });
  
  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }
  
  cart.items = [];
  cart.updatedAt = Date.now();
  
  await cart.save();
  
  res.status(200).json({
    success: true,
    data: cart
  });
}); 