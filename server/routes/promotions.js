const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// GET /api/promotions - Lấy danh sách khuyến mãi (Admin/Staff)
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'customer') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }
    const [promotions] = await pool.query('SELECT * FROM promotions ORDER BY created_at DESC');
    res.json({
      success: true,
      data: promotions
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách khuyến mãi:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/promotions - Thêm mới (Admin)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { code, description, discount_percent, discount_amount, valid_from, valid_to, usage_limit } = req.body;

    if (!code || !valid_from || !valid_to) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp code, valid_from, valid_to' });
    }

    const [existing] = await pool.query('SELECT id FROM promotions WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Mã khuyến mãi đã tồn tại' });
    }

    const [result] = await pool.query(
      `INSERT INTO promotions (code, description, discount_percent, discount_amount, valid_from, valid_to, usage_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, description || null, discount_percent || 0, discount_amount || 0, valid_from, valid_to, usage_limit || null]
    );

    res.status(201).json({
      success: true,
      message: 'Tạo khuyến mãi thành công',
      data: { id: result.insertId, code, description, discount_percent, discount_amount, valid_from, valid_to, usage_limit, used_count: 0 }
    });
  } catch (error) {
    console.error('Lỗi tạo khuyến mãi:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PUT /api/promotions/:id - Cập nhật (Admin)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { code, description, discount_percent, discount_amount, valid_from, valid_to, usage_limit } = req.body;
    
    const [existing] = await pool.query('SELECT * FROM promotions WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khuyến mãi' });
    }

    if (code) {
      const [codeCheck] = await pool.query('SELECT id FROM promotions WHERE code = ? AND id != ?', [code, req.params.id]);
      if (codeCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Mã khuyến mãi đã tồn tại' });
      }
    }

    await pool.query(
      `UPDATE promotions SET code = ?, description = ?, discount_percent = ?, discount_amount = ?, valid_from = ?, valid_to = ?, usage_limit = ? WHERE id = ?`,
      [
        code || existing[0].code, 
        description !== undefined ? description : existing[0].description,
        discount_percent !== undefined ? discount_percent : existing[0].discount_percent,
        discount_amount !== undefined ? discount_amount : existing[0].discount_amount,
        valid_from || existing[0].valid_from,
        valid_to || existing[0].valid_to,
        usage_limit !== undefined ? usage_limit : existing[0].usage_limit,
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Cập nhật khuyến mãi thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật khuyến mãi:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// DELETE /api/promotions/:id - Xóa (Admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM promotions WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khuyến mãi' });
    }

    await pool.query('DELETE FROM promotions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Xóa khuyến mãi thành công' });
  } catch (error) {
    console.error('Lỗi xóa khuyến mãi:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/promotions/validate - Kiểm tra mã khuyến mãi
router.post('/validate', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã khuyến mãi' });
    }

    const [promos] = await pool.query('SELECT * FROM promotions WHERE code = ?', [code]);
    
    if (promos.length === 0) {
      return res.status(404).json({ success: false, message: 'Mã khuyến mãi không tồn tại' });
    }

    const promo = promos[0];
    const now = new Date();

    if (new Date(promo.valid_from) > now) {
      return res.status(400).json({ success: false, message: 'Mã khuyến mãi chưa có hiệu lực' });
    }

    if (new Date(promo.valid_to) < now) {
      return res.status(400).json({ success: false, message: 'Mã khuyến mãi đã hết hạn' });
    }

    if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
      return res.status(400).json({ success: false, message: 'Mã khuyến mãi đã hết lượt sử dụng' });
    }

    res.json({
      success: true,
      message: 'Mã khuyến mãi hợp lệ',
      data: promo
    });
  } catch (error) {
    console.error('Lỗi kiểm tra mã khuyến mãi:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
