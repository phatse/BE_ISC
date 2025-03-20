const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res, next) => {
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 8;
  const startIndex = (page - 1) * limit;
  
  let query = {};
  
  // Filter by brand
  if (req.query.brand && req.query.brand !== 'all') {
    query.brand = req.query.brand;
  }
  
  // Sorting
  let sort = {};
  if (req.query.sort) {
    switch (req.query.sort) {
      case 'price-low':
        sort = { price: 1 };
        break;
      case 'price-high':
        sort = { price: -1 };
        break;
      case 'name':
        sort = { name: 1 };
        break;
      default:
        sort = { createdAt: -1 };
    }
  } else {
    sort = { createdAt: -1 };
  }
  
  const products = await Product.find(query)
    .sort(sort)
    .skip(startIndex)
    .limit(limit);
  
  const total = await Product.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: products.length,
    pagination: {
      current: page,
      totalPages: Math.ceil(total / limit),
      total
    },
    data: products
  });
});

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Create new product
// @route   POST /api/v1/products
// @access  Private/Admin
exports.createProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.create(req.body);
  
  res.status(201).json({
    success: true,
    data: product
  });
});

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
exports.updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);
  
  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }
  
  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }
  
  await product.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Search products
// @route   GET /api/v1/products/search
// @access  Public
exports.searchProducts = asyncHandler(async (req, res, next) => {
  const { q } = req.query;
  
  if (!q) {
    return next(new ErrorResponse('Please provide a search term', 400));
  }
  
  const products = await Product.find({
    $text: { $search: q }
  }).sort({ score: { $meta: 'textScore' } });
  
  res.status(200).json({
    success: true,
    count: products.length,
    data: products
  });
}); 