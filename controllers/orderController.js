const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { shippingAddress, paymentMethod, phone } = req.body;
  
  // Get user's cart
  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
  
  if (!cart || cart.items.length === 0) {
    return next(new ErrorResponse('No items in cart', 400));
  }
  
  // Create order items from cart items
  const orderItems = cart.items.map(item => {
    return {
      product: item.product._id,
      name: item.product.name,
      price: item.price,
      quantity: item.quantity,
      size: item.size
    };
  });
  
  // Calculate total price
  const totalPrice = cart.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  // Create order
  const order = await Order.create({
    user: req.user.id,
    items: orderItems,
    shippingAddress,
    phone,
    totalPrice,
    paymentMethod
  });
  
  // Clear cart after order is placed
  cart.items = [];
  await cart.save();
  
  res.status(201).json({
    success: true,
    data: order
  });
});

// @desc    Get all orders
// @route   GET /api/v1/orders
// @access  Private/Admin
exports.getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find().populate({
    path: 'user',
    select: 'name email'
  });
  
  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get order by ID
// @route   GET /api/v1/orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate({
    path: 'user',
    select: 'name email'
  });
  
  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user is order owner or admin
  if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this order', 401));
  }
  
  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Update order status
// @route   PUT /api/v1/orders/:id
// @access  Private/Admin
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  
  let order = await Order.findById(req.params.id);
  
  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }
  
  // Update fields
  order.status = status;
  
  // If status is paid, update payment info
  if (status === 'paid') {
    order.isPaid = true;
    order.paidAt = Date.now();
  }
  
  await order.save();
  
  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Get logged in user orders
// @route   GET /api/v1/orders/myorders
// @access  Private
exports.getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id });
  
  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
}); 