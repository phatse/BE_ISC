const Order = require('../models/Order');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const payOS = require('../utils/payos');

// @desc    Create payment link with PayOS
// @route   POST /api/v1/payment/:orderId
// @access  Private
exports.createPaymentLink = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.orderId}`, 404));
  }

  // Make sure user is order owner
  if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this order', 401));
  }

  // Make sure order isn't already paid
  if (order.isPaid) {
    return next(new ErrorResponse('Order is already paid', 400));
  }

  // Build the returnUrl and cancelUrl
  const { returnUrl, cancelUrl } = req.body;
  
  // Create a payment link with PayOS
  // Tạo orderCode sao cho đảm bảo là số nguyên dương không quá lớn
  // Tạo mã ngẫu nhiên từ 1000 đến 999999
  const randomCode = Math.floor(1000 + Math.random() * 999000);
  
  const paymentLinkData = {
    orderCode: randomCode, // Sử dụng mã số đơn giản thay vì chuỗi
    amount: Math.round(order.totalPrice),
    description: `Thanh toán #${randomCode}`, // Rút gọn mô tả dưới 25 ký tự
    cancelUrl: cancelUrl || `${process.env.CLIENT_URL}/order-cancel/${order._id}`,
    returnUrl: returnUrl || `${process.env.CLIENT_URL}/order-success/${order._id}`
  };

  try {
    const paymentLinkRes = await payOS.createPaymentLink(paymentLinkData);
    
    // Log thông tin từ PayOS để debug
    console.log('PayOS response (payment link):', JSON.stringify({
      checkoutUrl: paymentLinkRes.checkoutUrl,
      qrCode: paymentLinkRes.qrCode ? 'Present' : 'Missing',
      accountNumber: paymentLinkRes.accountNumber ? 'Present' : 'Missing',
    }));
    
    // Update order with PayOS payment info
    order.paymentMethod = 'payos';
    order.paymentLinkId = paymentLinkRes.paymentLinkId;
    order.paymentLinkCode = paymentLinkRes.orderCode;
    order.checkoutUrl = paymentLinkRes.checkoutUrl;
    order.qrCode = paymentLinkRes.qrCode;
    
    await order.save();

    // Nếu PayOS không trả về qrCode, tạo qrCode từ checkoutUrl
    const responseData = {
      success: true,
      data: {
        bin: paymentLinkRes.bin,
        checkoutUrl: paymentLinkRes.checkoutUrl,
        accountNumber: paymentLinkRes.accountNumber,
        accountName: paymentLinkRes.accountName,
        amount: paymentLinkRes.amount,
        description: paymentLinkRes.description,
        orderCode: paymentLinkRes.orderCode,
        status: paymentLinkRes.status,
      }
    };
    
    // Chỉ thêm qrCode vào response nếu API PayOS trả về
    if (paymentLinkRes.qrCode) {
      responseData.data.qrCode = paymentLinkRes.qrCode;
    } else {
      // Nếu không có qrCode từ PayOS, tạo URL qrCode với checkout URL thay thế
      const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentLinkRes.checkoutUrl)}`;
      responseData.data.qrCode = qrServiceUrl;
      console.log('Tạo QR code thay thế:', qrServiceUrl);
      
      // Cập nhật order với QR code đã tạo
      order.qrCode = qrServiceUrl;
      await order.save();
    }
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('PayOS API Error:', error);
    return next(new ErrorResponse('Payment service temporarily unavailable', 500));
  }
});

// @desc    Verify payment webhook
// @route   POST /api/v1/payment/webhook
// @access  Public
exports.paymentWebhook = asyncHandler(async (req, res) => {
  try {
    // Log toàn bộ webhook data để debug
    console.log('PayOS Webhook received:', JSON.stringify(req.body));
    
    // Thử xác thực webhook data
    let webhookData;
    try {
      webhookData = payOS.verifyPaymentWebhookData(req.body);
      console.log('PayOS Webhook verified data:', JSON.stringify(webhookData));
    } catch (verifyError) {
      console.error('PayOS Webhook verification error:', verifyError);
      // Trả về thành công để PayOS không tiếp tục gửi lại
      return res.status(200).json({
        error: 0,
        message: "Webhook received but verification failed",
      });
    }
    
    // Only proceed if the webhookData is valid
    if (webhookData) {
      // Find the order by orderCode
      const orderCode = webhookData.orderCode;
      console.log('Looking for order with paymentLinkCode:', orderCode);
      
      const order = await Order.findOne({ paymentLinkCode: orderCode });

      if (order) {
        console.log(`Found order: ${order._id}, current isPaid status: ${order.isPaid}, current status: ${order.status}`);
        
        // Update order payment status based on transaction status
        if (webhookData.status === 'PAID' && !order.isPaid) {
          console.log(`Updating order ${order._id} to PAID status via webhook`);
          
          // Thêm thông tin thanh toán
          order.isPaid = true;
          order.paidAt = Date.now();
          order.transactionInfo = {
            transactionId: webhookData.transactionId,
            amount: webhookData.amount,
            description: webhookData.description,
            time: webhookData.time
          };
          
          try {
            await order.save();
            console.log(`Order ${order._id} marked as paid successfully`);
          } catch (saveError) {
            console.error(`Error saving order ${order._id}:`, saveError);
            // Vẫn trả về 200 để webhook không được gửi lại
          }
        } else if (webhookData.status === 'PAID' && order.isPaid) {
          console.log(`Order ${order._id} is already marked as paid, no update needed`);
        } else if (webhookData.status === 'CANCELLED' && order.status !== 'cancelled') {
          console.log(`Updating order ${order._id} to CANCELLED status via webhook`);
          order.status = 'cancelled';
          try {
            await order.save();
            console.log(`Order ${order._id} marked as cancelled successfully`);
          } catch (saveError) {
            console.error(`Error saving cancelled order ${order._id}:`, saveError);
          }
        } else {
          console.log(`Order status from PayOS is: ${webhookData.status}, no update needed`);
        }
      } else {
        console.log(`No order found with paymentLinkCode: ${orderCode}`);
      }
    } else {
      console.log('Invalid webhook data received from PayOS');
    }

    // Luôn trả về 200 cho webhook
    return res.status(200).json({
      error: 0,
      message: "Webhook processed successfully",
      data: webhookData || {}
    });
  } catch (error) {
    console.error('PayOS webhook error:', error);
    
    // Always return 200 to PayOS to prevent retries
    return res.status(200).json({
      error: -1,
      message: "Error processing webhook, but acknowledged",
    });
  }
});

// @desc    Kiểm tra trạng thái thanh toán
// @route   GET /api/v1/payment/:orderId/check
// @access  Protected
exports.getPaymentStatus = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  console.log(`Kiểm tra trạng thái thanh toán cho đơn hàng: ${orderId}`);

  const order = await Order.findById(orderId);
  if (!order) {
    console.log(`Không tìm thấy đơn hàng với ID: ${orderId}`);
    return next(new ErrorResponse('Không tìm thấy đơn hàng', 404));
  }

  // Kiểm tra nếu đơn hàng đã được đánh dấu là đã thanh toán
  if (order.isPaid) {
    console.log(`Đơn hàng ${orderId} đã được đánh dấu là đã thanh toán`);
    return res.status(200).json({
      success: true,
      isPaid: true,
      paymentStatus: 'Đã thanh toán',
      order
    });
  }

  // Kiểm tra nếu không có thông tin thanh toán
  if (!order.paymentLinkId) {
    console.log(`Đơn hàng ${orderId} không có paymentLinkId`);
    return next(new ErrorResponse('Đơn hàng không có thông tin thanh toán', 400));
  }

  // Lấy thông tin thanh toán từ PayOS
  const paymentId = order.paymentLinkId;
  console.log(`Gọi API PayOS kiểm tra trạng thái với paymentId: ${paymentId}`);
  
  const payosData = await payOS.getPaymentLinkInformation(paymentId);
  console.log(`Kết quả từ PayOS:`, JSON.stringify(payosData, null, 2));

  if (payosData.error) {
    console.error(`Lỗi từ PayOS API: ${payosData.error}`);
    return next(new ErrorResponse(`Lỗi khi kiểm tra với PayOS: ${payosData.error}`, 400));
  }

  // Lấy trạng thái từ PayOS
  const paymentStatus = payosData.data?.status || 'UNKNOWN';
  console.log(`Trạng thái thanh toán từ PayOS: ${paymentStatus}`);

  // Chuyển đổi trạng thái PayOS sang trạng thái cho frontend hiển thị
  let displayStatus = 'Chờ thanh toán';
  let isPaid = false;
  
  // Kiểm tra trước tiên xem có giao dịch hoàn thành không, bất kể trạng thái là gì
  if (payosData.data?.transactions && payosData.data.transactions.length > 0) {
    console.log(`Phát hiện ${payosData.data.transactions.length} giao dịch trong đơn hàng, coi như đã thanh toán`);
    order.isPaid = true;
    order.paidAt = Date.now();
    order.transactionInfo = {
      transactions: payosData.data.transactions
    };
    displayStatus = 'Đã thanh toán';
    isPaid = true;
    await order.save();
    console.log(`Đã cập nhật trạng thái thanh toán từ thông tin giao dịch cho đơn hàng ${orderId}`);
  } 
  // Nếu không có giao dịch, kiểm tra dựa vào trạng thái
  else if (paymentStatus === 'PAID' || paymentStatus === 'SUCCESS' || paymentStatus === 'COMPLETED') {
    console.log(`Cập nhật đơn hàng ${orderId} thành đã thanh toán với trạng thái: ${paymentStatus}`);
    order.isPaid = true;
    order.paidAt = Date.now();
    displayStatus = 'Đã thanh toán';
    isPaid = true;
    
    if (payosData.data?.description) {
      try {
        const descData = JSON.parse(payosData.data.description);
        if (descData.buyerId) order.paymentInfo = {
          ...order.paymentInfo || {},
          buyerId: descData.buyerId
        };
      } catch (e) {
        console.error(`Lỗi khi parse description: ${e.message}`);
      }
    }
    
    await order.save();
    console.log(`Đã cập nhật thành công trạng thái thanh toán cho đơn hàng ${orderId}`);
  } else if (paymentStatus === 'CANCELLED') {
    console.log(`Đơn hàng ${orderId} đã bị hủy trên PayOS`);
    // Cập nhật trạng thái đơn hàng thành "cancelled" nếu nó không phải đã được thanh toán
    if (order.status !== 'cancelled') {
      order.status = 'cancelled';
      await order.save();
    }
    displayStatus = 'Hủy';
  } else if (paymentStatus === 'PENDING') {
    displayStatus = 'Chờ thanh toán';
  } else {
    console.log(`Trạng thái không rõ từ PayOS: ${paymentStatus}, kiểm tra thêm các dấu hiệu thanh toán khác`);
    
    // Kiểm tra số tiền đã thanh toán
    if (payosData.data?.amountPaid && payosData.data.amountPaid >= payosData.data.amount) {
      console.log(`Số tiền đã thanh toán (${payosData.data.amountPaid}) >= số tiền cần thanh toán (${payosData.data.amount})`);
      order.isPaid = true;
      order.paidAt = Date.now();
      displayStatus = 'Đã thanh toán';
      isPaid = true;
      await order.save();
    } else if (order.paymentMethod === 'payos' && order.status === 'processing') {
      // Nếu đơn hàng đã chuyển sang processing, coi như đã thanh toán
      console.log(`Đơn hàng đã chuyển sang trạng thái processing, coi như đã thanh toán`);
      order.isPaid = true;
      order.paidAt = Date.now();
      displayStatus = 'Đã thanh toán';
      isPaid = true;
      await order.save();
    }
  }

  // Kiểm tra lại trạng thái isPaid của đơn hàng sau khi cập nhật
  console.log(`Trạng thái thanh toán cuối cùng: isPaid=${order.isPaid}, displayStatus=${displayStatus}`);

  return res.status(200).json({
    success: true,
    paymentStatus: displayStatus,
    rawStatus: paymentStatus,
    isPaid: order.isPaid,
    order
  });
});

// @desc    Cancel payment link
// @route   DELETE /api/v1/payment/:orderId
// @access  Private
exports.cancelPayment = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.orderId}`, 404));
  }

  // Make sure user is order owner or admin
  if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to cancel this payment', 401));
  }

  // Make sure order has a payment link and isn't paid
  if (!order.paymentLinkId) {
    return next(new ErrorResponse('This order has no associated payment link', 400));
  }

  if (order.isPaid) {
    return next(new ErrorResponse('Cannot cancel payment that is already completed', 400));
  }

  try {
    const cancelReason = req.body.cancelReason || 'Cancelled by user';
    await payOS.cancelPaymentLink(order.paymentLinkId, cancelReason);
    
    // Update order
    order.status = 'cancelled';
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: {}
    });
  } catch (error) {
    console.error(error);
    return next(new ErrorResponse('Error cancelling payment', 500));
  }
});

// @desc    Manually check and update payment status
// @route   POST /api/v1/payment/:orderId/check
// @access  Private
exports.checkAndUpdatePayment = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.orderId}`, 404));
  }

  // Make sure user is order owner or admin
  if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this order', 401));
  }

  // Make sure order has a payment link ID
  if (!order.paymentLinkId) {
    return next(new ErrorResponse('This order has no associated payment link', 400));
  }

  try {
    console.log(`Manually checking payment status for order: ${order._id}, paymentLinkId: ${order.paymentLinkId}`);
    const paymentInfo = await payOS.getPaymentLinkInformation(order.paymentLinkId);
    console.log(`Payment status from PayOS: ${paymentInfo.status}`);
    
    // Update order status if payment is verified as paid
    if (paymentInfo.status === 'PAID' && !order.isPaid) {
      console.log(`Updating order ${order._id} to paid status`);
      order.isPaid = true;
      order.paidAt = Date.now();
      order.transactionInfo = {
        transactionId: paymentInfo.transaction?.transactionId,
        amount: paymentInfo.amount,
        description: paymentInfo.description
      };
      
      await order.save();
      console.log(`Order ${order._id} marked as paid successfully via manual check`);
    }

    return res.status(200).json({
      success: true,
      isPaid: order.isPaid,
      data: paymentInfo
    });
  } catch (error) {
    console.error('Error checking payment status manually:', error);
    return next(new ErrorResponse('Error checking payment status', 500));
  }
});

// @desc    Cập nhật bắt buộc trạng thái thanh toán (khi đã thanh toán thành công nhưng API chưa cập nhật)
// @route   PUT /api/v1/payment/:orderId/force-update
// @access  Protected
exports.forceUpdatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`----- BẮT ĐẦU CẬP NHẬT BẮT BUỘC -----`);
    console.log(`Cập nhật bắt buộc trạng thái thanh toán cho đơn hàng: ${orderId}`);

    const order = await Order.findById(orderId);
    if (!order) {
      console.log(`Không tìm thấy đơn hàng với ID: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    // Kiểm tra nếu đơn hàng đã được đánh dấu là đã thanh toán
    if (order.isPaid) {
      console.log(`Đơn hàng ${orderId} đã được đánh dấu là đã thanh toán trước đó`);
      return res.status(200).json({
        success: true,
        message: 'Đơn hàng đã được đánh dấu là đã thanh toán trước đó',
        isPaid: true,
        order
      });
    }

    // Kiểm tra xem user có phải là người đặt hàng không
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      console.log(`User ${req.user._id} không có quyền cập nhật đơn hàng ${orderId}`);
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật đơn hàng này'
      });
    }

    try {
      // Thực hiện kiểm tra lại với PayOS nếu có paymentLinkId
      if (order.paymentInfo && order.paymentInfo.paymentLinkId) {
        const paymentId = order.paymentInfo.paymentLinkId;
        console.log(`Kiểm tra lại với PayOS sử dụng paymentLinkId: ${paymentId}`);
        
        try {
          const payosData = await payOS.getPaymentLinkInformation(paymentId);
          console.log(`Kết quả PayOS:`, JSON.stringify(payosData, null, 2));
          
          if (!payosData.error && payosData.data?.status === 'PAID') {
            console.log(`PayOS xác nhận đơn hàng đã thanh toán, cập nhật theo thông tin PayOS`);
            order.isPaid = true;
            order.paidAt = Date.now();
            
            // Thử phân tích description nếu có
            if (payosData.data?.description) {
              try {
                const descData = JSON.parse(payosData.data.description);
                if (descData.buyerId) order.paymentInfo.buyerId = descData.buyerId;
              } catch (e) {
                console.error(`Lỗi khi parse description: ${e.message}`);
              }
            }
            
            await order.save();
            console.log(`Đã cập nhật thành công trạng thái từ dữ liệu PayOS`);
            
            return res.status(200).json({
              success: true,
              message: 'Đã cập nhật trạng thái thanh toán từ dữ liệu PayOS',
              isPaid: true,
              order
            });
          }
          
          console.log(`PayOS không xác nhận thanh toán, tiếp tục cập nhật bắt buộc`);
        } catch (payosError) {
          console.error(`Lỗi khi kiểm tra với PayOS: ${payosError.message}`);
          // Tiếp tục cập nhật bắt buộc ngay cả khi không thể kiểm tra với PayOS
        }
      }

      // Cập nhật bắt buộc
      console.log(`Thực hiện cập nhật bắt buộc trạng thái thanh toán cho đơn hàng ${orderId}`);
      order.isPaid = true;
      order.paidAt = Date.now();
      
      // Thêm thông tin cập nhật bắt buộc
      if (!order.paymentInfo) order.paymentInfo = {};
      order.paymentInfo.updatedManually = true;
      order.paymentInfo.updatedBy = req.user._id;
      order.paymentInfo.updatedAt = Date.now();
      
      await order.save();
      
      console.log(`Đã cập nhật bắt buộc thành công trạng thái thanh toán cho đơn hàng ${orderId}`);
      console.log(`----- KẾT THÚC CẬP NHẬT BẮT BUỘC -----`);
      
      return res.status(200).json({
        success: true,
        message: 'Đã cập nhật bắt buộc trạng thái thanh toán',
        isPaid: true,
        order
      });
    } catch (updateError) {
      console.error(`Lỗi khi cập nhật bắt buộc: ${updateError.message}`, updateError);
      return res.status(500).json({
        success: false,
        message: `Lỗi khi cập nhật bắt buộc: ${updateError.message}`
      });
    }
  } catch (error) {
    console.error(`Lỗi server khi cập nhật bắt buộc: ${error.message}`, error);
    console.log(`----- KẾT THÚC CẬP NHẬT BẮT BUỘC VỚI LỖI -----`);
    return res.status(500).json({
      success: false,
      message: `Lỗi máy chủ: ${error.message}`
    });
  }
}; 