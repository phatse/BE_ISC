const PayOS = require("@payos/node");
require('dotenv').config();

// Tạo instance PayOS với logging cải tiến
const payosInstance = new PayOS(
  process.env.PAYOS_CLIENT_ID, 
  process.env.PAYOS_API_KEY, 
  process.env.PAYOS_CHECKSUM_KEY
);

// Bọc các phương thức chính với logging
const wrappedPayOS = {
  // Các phương thức của PayOS SDK
  createPaymentLink: async (data) => {
    console.log('Creating PayOS payment link with data:', JSON.stringify(data, null, 2));
    try {
      const result = await payosInstance.createPaymentLink(data);
      console.log('PayOS payment link created successfully:', result.paymentLinkId);
      return result;
    } catch (error) {
      console.error('Error creating PayOS payment link:', error);
      throw error;
    }
  },
  
  // Hàm cũ với tên bị lỗi chính tả (giữ lại để tương thích với code cũ)
  getPaymentLinkInfomation: async (paymentLinkId) => {
    console.log('Getting PayOS payment link information for:', paymentLinkId);
    try {
      // Kiểm tra paymentLinkId
      if (!paymentLinkId) {
        console.error('Invalid paymentLinkId: null or undefined');
        throw new Error('Invalid payment link ID');
      }
      
      // Gọi API PayOS với xử lý lỗi chi tiết
      let result;
      try {
        result = await payosInstance.getPaymentLinkInformation(paymentLinkId);
      } catch (apiError) {
        console.error('PayOS API error:', apiError);
        
        // Tạo phản hồi mặc định thay vì throw lỗi
        return {
          status: 'ERROR',
          description: 'Could not get payment status from PayOS',
          errorMessage: apiError.message || 'Unknown error'
        };
      }
      
      // Log kết quả
      console.log('PayOS payment info retrieved, status:', result.status);
      
      // Đảm bảo có thuộc tính transaction
      if (!result.transaction) {
        result.transaction = {};
      }
      
      return result;
    } catch (error) {
      console.error('Error in getPaymentLinkInfomation wrapper:', error);
      
      // Trả về đối tượng lỗi có cấu trúc thay vì throw exception
      return {
        status: 'ERROR',
        description: 'Error checking payment status',
        errorMessage: error.message || 'Unknown error'
      };
    }
  },
  
  // Hàm mới với tên đúng chính tả
  getPaymentLinkInformation: async (paymentLinkId) => {
    console.log('Getting PayOS payment link information for:', paymentLinkId);
    try {
      // Kiểm tra paymentLinkId
      if (!paymentLinkId) {
        console.error('Invalid paymentLinkId: null or undefined');
        throw new Error('Invalid payment link ID');
      }
      
      // Gọi API PayOS với xử lý lỗi chi tiết
      let result;
      try {
        result = await payosInstance.getPaymentLinkInformation(paymentLinkId);
      } catch (apiError) {
        console.error('PayOS API error:', apiError);
        
        // Tạo phản hồi mặc định thay vì throw lỗi
        return {
          status: 'ERROR',
          description: 'Could not get payment status from PayOS',
          errorMessage: apiError.message || 'Unknown error'
        };
      }
      
      // Log kết quả
      console.log('PayOS payment info retrieved, status:', result.status);
      
      // Đảm bảo có thuộc tính transaction
      if (!result.transaction) {
        result.transaction = {};
      }
      
      return result;
    } catch (error) {
      console.error('Error in getPaymentLinkInformation wrapper:', error);
      
      // Trả về đối tượng lỗi có cấu trúc thay vì throw exception
      return {
        status: 'ERROR',
        description: 'Error checking payment status',
        errorMessage: error.message || 'Unknown error'
      };
    }
  },
  
  cancelPaymentLink: async (paymentLinkId, reason) => {
    console.log('Canceling PayOS payment link:', paymentLinkId, 'Reason:', reason);
    try {
      const result = await payosInstance.cancelPaymentLink(paymentLinkId, reason);
      console.log('PayOS payment link canceled successfully');
      return result;
    } catch (error) {
      console.error('Error canceling PayOS payment link:', error);
      throw error;
    }
  },
  
  verifyPaymentWebhookData: (webhookData) => {
    try {
      if (!webhookData) {
        console.warn('Webhook data is null or undefined');
        return null;
      }
      
      const result = payosInstance.verifyPaymentWebhookData(webhookData);
      if (result) {
        console.log('PayOS webhook data verified successfully');
        return result;
      } else {
        console.warn('PayOS webhook data verification returned null or undefined');
        return null;
      }
    } catch (error) {
      console.error('Error verifying PayOS webhook data:', error);
      return null; // Trả về null thay vì throw lỗi để tránh crash webhook
    }
  }
};

module.exports = wrappedPayOS; 