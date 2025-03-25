const express = require('express');
const { 
  createOrder, 
  getOrders, 
  getOrder, 
  updateOrderStatus,
  getMyOrders,
  deleteOrder,
  updatePaymentStatus
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All order routes require authentication
router.use(protect);

// My orders route
router.get('/myorders', getMyOrders);

// Main routes
router.route('/')
  .post(createOrder)
  .get(authorize('admin'), getOrders);

router.route('/:id')
  .delete(protect, deleteOrder)
  .get(getOrder)
  .put(authorize('admin'), updateOrderStatus);

// Add new route for payment status update
router.put('/:id/pay', authorize('admin'), updatePaymentStatus);

module.exports = router;