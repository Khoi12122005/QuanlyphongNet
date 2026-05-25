const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Middleware kiểm tra quyền customer
const isCustomer = (req, res, next) => {
  if (req.user && req.user.role === 'customer') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Chỉ khách hàng mới có quyền thực hiện thao tác này'
    });
  }
};

// POST /api/bookings - Khách hàng tạo booking mới
router.post('/', verifyToken, isCustomer, async (req, res) => {
  try {
    const { zone, computer_id, start_time, duration_hours } = req.body;
    const customer_id = req.user.id;

    if (!zone || !start_time || !duration_hours) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đủ thông tin: zone, start_time, duration_hours'
      });
    }

    // Tính toán tổng tiền, nếu computer_id được cung cấp thì dùng giá của máy, không thì dựa vào zone
    // Tạm thời fixed 1 giá hoặc cần join bảng computers nếu có
    let price_per_hour = 10000;
    if (computer_id) {
      const [comps] = await pool.query('SELECT price_per_hour FROM computers WHERE id = ?', [computer_id]);
      if (comps.length > 0) {
        price_per_hour = comps[0].price_per_hour;
      }
    } else {
      if (zone.toLowerCase() === 'vip') price_per_hour = 15000;
      if (zone.toLowerCase() === 'streaming') price_per_hour = 25000;
    }

    const total_amount = price_per_hour * duration_hours;

    const [result] = await pool.query(
      'INSERT INTO bookings (customer_id, zone, computer_id, start_time, duration_hours, total_amount) VALUES (?, ?, ?, ?, ?, ?)',
      [customer_id, zone, computer_id || null, start_time, duration_hours, total_amount]
    );

    res.status(201).json({
      success: true,
      message: 'Tạo booking thành công',
      data: {
        id: result.insertId,
        customer_id,
        zone,
        computer_id,
        start_time,
        duration_hours,
        total_amount,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Lỗi tạo booking:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/bookings/my-bookings - Lấy danh sách booking của khách hàng
router.get('/my-bookings', verifyToken, isCustomer, async (req, res) => {
  try {
    const customer_id = req.user.id;
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE customer_id = ? ORDER BY created_at DESC',
      [customer_id]
    );

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách booking của khách:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/bookings - Lấy danh sách tất cả booking (Admin/Staff)
router.get('/', verifyToken, async (req, res) => {
  try {
    // Both admin and staff should be able to view, assuming verifyToken is enough
    // But let's check if they are not customer
    if (req.user.role === 'customer') {
       return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    const [bookings] = await pool.query('SELECT b.*, c.name as customer_name, c.phone as customer_phone FROM bookings b JOIN customers c ON b.customer_id = c.id ORDER BY b.created_at DESC');

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách booking:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PUT /api/bookings/:id/status - Cập nhật trạng thái booking (Admin)
router.put('/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
      });
    }

    const [existing] = await pool.query('SELECT id FROM bookings WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
    }

    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);

    res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công'
    });
  } catch (error) {
    console.error('Lỗi cập nhật booking:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
