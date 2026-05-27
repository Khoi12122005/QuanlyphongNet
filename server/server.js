const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = require('./config/db');
const ensureRuntimeSchema = require('./scripts/ensureRuntimeSchema');

const authRoutes = require('./routes/auth');
const computerRoutes = require('./routes/computers');
const customerRoutes = require('./routes/customers');
const sessionRoutes = require('./routes/sessions');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const revenueRoutes = require('./routes/revenue');
const dashboardRoutes = require('./routes/dashboard');
const bookingRoutes = require('./routes/bookings');
const promotionRoutes = require('./routes/promotions');
const comboRoutes = require('./routes/combos');
const customerAuthRoutes = require('./routes/customerAuth');
const supportRoutes = require('./routes/support');
const shiftsRoutes = require('./routes/shifts');

app.use('/api/auth', authRoutes);
app.use('/api/computers', computerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/customer-auth', customerAuthRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/shifts', shiftsRoutes);
// Compatibility aliases for older frontend builds.
app.use('/api', supportRoutes); // /api/conversations, /api/messages

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'CyberHub API Server đang hoạt động',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      computers: '/api/computers',
      customers: '/api/customers',
      sessions: '/api/sessions',
      products: '/api/products',
      orders: '/api/orders',
      revenue: '/api/revenue',
      bookings: '/api/bookings',
      promotions: '/api/promotions',
      combos: '/api/combos',
      customerAuth: '/api/customer-auth',
      support: '/api/support',
    },
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod' || true) { // Always try to serve if exists for ease of use
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// 404 handler for API
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route API ${req.method} ${req.originalUrl} không tồn tại`,
  });
});

app.use((err, req, res, next) => {
  // Express JSON parse errors should be 400 instead of 500.
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu JSON không hợp lệ',
    });
  }

  console.error('Lỗi server:', err);
  return res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi server',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await ensureRuntimeSchema(pool);
    app.listen(PORT, () => {
      console.log(`CyberHub Server đang chạy tại http://localhost:${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('Không thể khởi động server vì lỗi schema/runtime:', error);
    process.exit(1);
  }
};

// Vercel Serverless environment checks
if (!process.env.VERCEL) {
  startServer();
}

module.exports = app;
