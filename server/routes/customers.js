const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/customers - Lấy danh sách khách hàng
router.get('/', verifyToken, async (req, res) => {
  try {
    const [customers] = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách khách hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/customers/:id - Lấy thông tin chi tiết khách hàng
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng'
      });
    }

    res.json({
      success: true,
      data: customers[0]
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin khách hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/customers - Thêm khách hàng mới
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên khách hàng'
      });
    }

    // Kiểm tra số điện thoại đã tồn tại chưa
    if (phone) {
      const [existing] = await pool.query('SELECT id FROM customers WHERE phone = ?', [phone]);
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại đã được đăng ký'
        });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO customers (name, phone, balance, total_hours) VALUES (?, ?, 0, 0)',
      [name, phone || null]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name,
        phone,
        balance: 0,
        total_hours: 0
      }
    });
  } catch (error) {
    console.error('Lỗi thêm khách hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PUT /api/customers/:id - Cập nhật thông tin khách hàng
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng'
      });
    }

    // Kiểm tra số điện thoại trùng (trừ chính khách hàng đó)
    if (phone) {
      const [phoneCheck] = await pool.query(
        'SELECT id FROM customers WHERE phone = ? AND id != ?',
        [phone, req.params.id]
      );
      if (phoneCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại đã được đăng ký bởi khách hàng khác'
        });
      }
    }

    await pool.query(
      'UPDATE customers SET name = ?, phone = ? WHERE id = ?',
      [name || existing[0].name, phone !== undefined ? phone : existing[0].phone, req.params.id]
    );

    const [updated] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      data: updated[0]
    });
  } catch (error) {
    console.error('Lỗi cập nhật khách hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// DELETE /api/customers/:id - Xoá khách hàng
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng'
      });
    }

    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'Xoá khách hàng thành công'
    });
  } catch (error) {
    console.error('Lỗi xoá khách hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/customers/:id/topup - Nạp tiền cho khách hàng
router.post('/:id/topup', verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền nạp phải lớn hơn 0'
      });
    }

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng'
      });
    }

    const newBalance = parseFloat(existing[0].balance) + parseFloat(amount);

    await pool.query('UPDATE customers SET balance = ? WHERE id = ?', [newBalance, req.params.id]);

    res.json({
      success: true,
      data: {
        id: existing[0].id,
        name: existing[0].name,
        old_balance: existing[0].balance,
        topup_amount: parseFloat(amount),
        new_balance: newBalance
      }
    });
  } catch (error) {
    console.error('Lỗi nạp tiền:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
