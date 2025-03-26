const express = require('express');
const {
  createPaymentLink,
  getPaymentStatus,
  cancelPayment,
  forceUpdatePaymentStatus,
  paymentWebhook
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Route webhook không yêu cầu xác thực
router.post('/webhook', paymentWebhook);

// Tất cả các routes bên dưới đều yêu cầu đăng nhập
router.use(protect);

// Tạo link thanh toán
router.post('/:orderId/create-link', createPaymentLink);

// Kiểm tra trạng thái thanh toán
router.get('/:orderId/check', getPaymentStatus);

// Cập nhật bắt buộc trạng thái thanh toán
router.put('/:orderId/force-update', forceUpdatePaymentStatus);

// Hủy link thanh toán
router.delete('/:orderId/cancel', cancelPayment);

module.exports = router; 