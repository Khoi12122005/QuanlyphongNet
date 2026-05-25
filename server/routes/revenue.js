const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/revenue/summary - Tổng quan doanh thu (hôm nay, tuần, tháng, tổng phiên)
router.get('/summary', verifyToken, async (req, res) => {
  try {
    // Doanh thu hôm nay (từ sessions đã hoàn thành)
    const [todayRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM sessions
      WHERE status = 'completed' AND DATE(end_time) = CURDATE()
    `);

    // Doanh thu đơn hàng hôm nay
    const [todayOrderRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE DATE(created_at) = CURDATE()
    `);

    // Doanh thu tuần này
    const [weekRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM sessions
      WHERE status = 'completed' AND YEARWEEK(end_time, 1) = YEARWEEK(CURDATE(), 1)
    `);

    const [weekOrderRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
    `);

    // Doanh thu tháng này
    const [monthRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM sessions
      WHERE status = 'completed' AND MONTH(end_time) = MONTH(CURDATE()) AND YEAR(end_time) = YEAR(CURDATE())
    `);

    const [monthOrderRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
    `);

    // Tổng số phiên
    const [totalSessions] = await pool.query(`
      SELECT COUNT(*) AS count FROM sessions
    `);

    // Số phiên đang hoạt động
    const [activeSessions] = await pool.query(`
      SELECT COUNT(*) AS count FROM sessions WHERE status = 'active'
    `);

    res.json({
      success: true,
      data: {
        today: {
          session_revenue: todayRevenue[0].revenue,
          order_revenue: todayOrderRevenue[0].revenue,
          total: parseFloat(todayRevenue[0].revenue) + parseFloat(todayOrderRevenue[0].revenue)
        },
        this_week: {
          session_revenue: weekRevenue[0].revenue,
          order_revenue: weekOrderRevenue[0].revenue,
          total: parseFloat(weekRevenue[0].revenue) + parseFloat(weekOrderRevenue[0].revenue)
        },
        this_month: {
          session_revenue: monthRevenue[0].revenue,
          order_revenue: monthOrderRevenue[0].revenue,
          total: parseFloat(monthRevenue[0].revenue) + parseFloat(monthOrderRevenue[0].revenue)
        },
        total_sessions: totalSessions[0].count,
        active_sessions: activeSessions[0].count
      }
    });
  } catch (error) {
    console.error('Lỗi lấy tổng quan doanh thu:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/revenue/by-date - Doanh thu theo ngày (phân tích chi tiết)
router.get('/by-date', verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ngày bắt đầu (from) và ngày kết thúc (to)'
      });
    }

    // Doanh thu phiên theo ngày
    const [sessionRevenue] = await pool.query(`
      SELECT DATE(end_time) AS date,
             COUNT(*) AS session_count,
             COALESCE(SUM(total_amount), 0) AS session_revenue
      FROM sessions
      WHERE status = 'completed' AND DATE(end_time) BETWEEN ? AND ?
      GROUP BY DATE(end_time)
      ORDER BY date ASC
    `, [from, to]);

    // Doanh thu đơn hàng theo ngày
    const [orderRevenue] = await pool.query(`
      SELECT DATE(created_at) AS date,
             COUNT(*) AS order_count,
             COALESCE(SUM(total_amount), 0) AS order_revenue
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [from, to]);

    // Gộp dữ liệu theo ngày
    const revenueMap = new Map();

    sessionRevenue.forEach(row => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
      revenueMap.set(dateStr, {
        date: dateStr,
        session_count: row.session_count,
        session_revenue: parseFloat(row.session_revenue),
        order_count: 0,
        order_revenue: 0,
        total_revenue: parseFloat(row.session_revenue)
      });
    });

    orderRevenue.forEach(row => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
      if (revenueMap.has(dateStr)) {
        const existing = revenueMap.get(dateStr);
        existing.order_count = row.order_count;
        existing.order_revenue = parseFloat(row.order_revenue);
        existing.total_revenue += parseFloat(row.order_revenue);
      } else {
        revenueMap.set(dateStr, {
          date: dateStr,
          session_count: 0,
          session_revenue: 0,
          order_count: row.order_count,
          order_revenue: parseFloat(row.order_revenue),
          total_revenue: parseFloat(row.order_revenue)
        });
      }
    });

    // Sắp xếp theo ngày
    const dailyRevenue = Array.from(revenueMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: dailyRevenue
    });
  } catch (error) {
    console.error('Lỗi lấy doanh thu theo ngày:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/revenue/top-computers - Máy tính được sử dụng nhiều nhất
router.get('/top-computers', verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const [topComputers] = await pool.query(`
      SELECT c.id, c.name, c.zone,
             COUNT(s.id) AS total_sessions,
             COALESCE(SUM(s.total_amount), 0) AS total_revenue,
             COALESCE(SUM(TIMESTAMPDIFF(MINUTE, s.start_time, COALESCE(s.end_time, NOW()))), 0) AS total_minutes
      FROM computers c
      LEFT JOIN sessions s ON c.id = s.computer_id
      GROUP BY c.id, c.name, c.zone
      ORDER BY total_sessions DESC
      LIMIT ?
    `, [limit]);

    // Chuyển đổi phút thành giờ để dễ đọc
    const result = topComputers.map(comp => ({
      ...comp,
      total_hours: Math.round(comp.total_minutes / 60 * 100) / 100
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Lỗi lấy top máy tính:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/revenue/top-customers - Khách hàng chi tiêu nhiều nhất
router.get('/top-customers', verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const [topCustomers] = await pool.query(`
      SELECT cu.id, cu.name, cu.phone, cu.total_hours,
             COUNT(s.id) AS total_sessions,
             COALESCE(SUM(s.total_amount), 0) AS session_spending,
             COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.customer_id = cu.id), 0) AS order_spending
      FROM customers cu
      LEFT JOIN sessions s ON cu.id = s.customer_id AND s.status = 'completed'
      GROUP BY cu.id, cu.name, cu.phone, cu.total_hours
      ORDER BY (COALESCE(SUM(s.total_amount), 0) + COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.customer_id = cu.id), 0)) DESC
      LIMIT ?
    `, [limit]);

    const result = topCustomers.map(cust => ({
      ...cust,
      total_spending: parseFloat(cust.session_spending) + parseFloat(cust.order_spending)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Lỗi lấy top khách hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
