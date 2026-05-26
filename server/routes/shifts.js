const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// GET /api/shifts - Lấy danh sách ca trực (Admin)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const [shifts] = await pool.query('SELECT * FROM shifts ORDER BY start_time DESC');
    res.json({ success: true, data: shifts });
  } catch (error) {
    console.error('Lỗi lấy ca trực:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/shifts/current - Lấy ca trực hiện tại
router.get('/current', verifyToken, isAdmin, async (req, res) => {
  try {
    const [shifts] = await pool.query('SELECT * FROM shifts WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1');
    res.json({ success: true, data: shifts.length > 0 ? shifts[0] : null });
  } catch (error) {
    console.error('Lỗi lấy ca trực hiện tại:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/shifts/start - Bắt đầu ca
router.post('/start', verifyToken, isAdmin, async (req, res) => {
  try {
    const { starting_cash } = req.body;
    
    // Kiểm tra xem có ca nào đang mở không
    const [openShifts] = await pool.query('SELECT * FROM shifts WHERE end_time IS NULL');
    if (openShifts.length > 0) {
      return res.status(400).json({ success: false, message: 'Vẫn còn ca trực chưa kết thúc!' });
    }

    const [result] = await pool.query(
      'INSERT INTO shifts (user_id, start_time, starting_cash) VALUES (?, NOW(), ?)',
      [req.user.id, starting_cash || 0]
    );

    res.status(201).json({ success: true, message: 'Đã bắt đầu ca trực mới', shiftId: result.insertId });
  } catch (error) {
    console.error('Lỗi bắt đầu ca trực:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/shifts/end - Kết thúc ca
router.post('/end', verifyToken, isAdmin, async (req, res) => {
  try {
    const { ending_cash, note } = req.body;
    
    const [openShifts] = await pool.query('SELECT * FROM shifts WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1');
    if (openShifts.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có ca trực nào đang mở' });
    }
    
    const shiftId = openShifts[0].id;
    await pool.query(
      'UPDATE shifts SET end_time = NOW(), ending_cash = ?, note = ? WHERE id = ?',
      [ending_cash || 0, note || '', shiftId]
    );

    res.json({ success: true, message: 'Đã kết thúc ca trực' });
  } catch (error) {
    console.error('Lỗi kết thúc ca trực:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
