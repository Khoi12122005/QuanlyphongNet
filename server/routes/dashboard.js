const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/dashboard/stats - Thống kê tổng quan
router.get('/stats', verifyToken, async (req, res) => {
  try {
    // Doanh thu hôm nay (từ sessions + orders)
    const [sessionRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM sessions
      WHERE DATE(end_time) = CURDATE() AND status = 'completed'
    `);

    const [orderRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM orders
      WHERE DATE(created_at) = CURDATE()
    `);

    const todayRevenue = parseFloat(sessionRevenue[0].total) + parseFloat(orderRevenue[0].total);

    // Số máy đang sử dụng
    const [activeComputers] = await pool.query(`
      SELECT COUNT(*) AS count FROM computers WHERE status = 'in_use'
    `);

    // Tổng khách hàng
    const [totalCustomers] = await pool.query(`
      SELECT COUNT(*) AS count FROM customers
    `);

    // Số đơn hàng hôm nay
    const [todayOrders] = await pool.query(`
      SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = CURDATE()
    `);

    res.json({
      success: true,
      data: {
        todayRevenue,
        activeComputers: activeComputers[0].count,
        totalCustomers: totalCustomers[0].count,
        todayOrders: todayOrders[0].count
      }
    });
  } catch (error) {
    console.error('Lỗi lấy thống kê dashboard:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/dashboard/chart - Dữ liệu biểu đồ doanh thu 7 ngày
router.get('/chart', verifyToken, async (req, res) => {
  try {
    const labels = [];
    const values = [];

    for (let i = 6; i >= 0; i--) {
      const [sessionRev] = await pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM sessions
        WHERE DATE(end_time) = DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status = 'completed'
      `, [i]);

      const [orderRev] = await pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM orders
        WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL ? DAY)
      `, [i]);

      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));
      values.push(parseFloat(sessionRev[0].total) + parseFloat(orderRev[0].total));
    }

    res.json({
      success: true,
      data: { labels, values }
    });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu biểu đồ:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
