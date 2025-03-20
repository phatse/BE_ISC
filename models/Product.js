const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true
  },
  brand: {
    type: String,
    required: [true, 'Please add a brand'],
    enum: ['Nike', 'Adidas', 'Reebok', 'Vans', 'Converse', 'Puma', 'Asics', 'New Balance']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price']
  },
  priceVND: {
    type: Number,
    required: [true, 'Please add a price in VND']
  },
  image: {
    type: String,
    required: [true, 'Please add an image']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  sizes: {
    type: [Number],
    required: [true, 'Please add available sizes']
  },
  inStock: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create index for search
ProductSchema.index({ name: 'text', brand: 'text', description: 'text' });

module.exports = mongoose.model('Product', ProductSchema); 