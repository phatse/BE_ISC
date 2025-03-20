# Shoe Store API

Backend API for Shoe Store e-commerce application built with Node.js, Express, and MongoDB.

## Setup

```bash
# Install dependencies
npm install

# Create .env file (and update with your values)
cp .env.example .env

# Run in development mode
npm run dev

# Run in production mode
npm start
```

## API Documentation

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get logged in user
- `PUT /api/v1/auth/updatedetails` - Update user details
- `PUT /api/v1/auth/updatepassword` - Update password

### Products
- `GET /api/v1/products` - Get all products
- `GET /api/v1/products/:id` - Get single product
- `POST /api/v1/products` - Create new product (Admin)
- `PUT /api/v1/products/:id` - Update product (Admin)
- `DELETE /api/v1/products/:id` - Delete product (Admin)
- `GET /api/v1/products/search` - Search products

### Cart
- `GET /api/v1/cart` - Get user's cart
- `POST /api/v1/cart/items` - Add item to cart
- `PUT /api/v1/cart/items/:itemId` - Update cart item
- `DELETE /api/v1/cart/items/:itemId` - Remove item from cart
- `DELETE /api/v1/cart` - Clear cart

### Orders
- `POST /api/v1/orders` - Create new order
- `GET /api/v1/orders` - Get all orders (Admin)
- `GET /api/v1/orders/:id` - Get order by ID
- `PUT /api/v1/orders/:id` - Update order status (Admin)
- `GET /api/v1/orders/myorders` - Get logged in user orders