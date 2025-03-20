const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  size: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  }
});

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [CartItemSchema],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate total price
CartSchema.methods.getTotalPrice = function() {
  return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
};

module.exports = mongoose.model('Cart', CartSchema); 