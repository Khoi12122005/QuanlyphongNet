const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// GET /api/combos - Lấy danh sách combo packages (Public hoặc Staff/Admin/Customer tùy vào thiết kế, dùng verifyToken cho an toàn)
router.get('/', verifyToken, async (req, res) => {
  try {
    const [combos] = await pool.query('SELECT * FROM combo_packages ORDER BY created_at DESC');
    res.json({
      success: true,
      data: combos
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách combo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/combos - Thêm combo mới (Admin)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, price, hours_included, is_active } = req.body;

    if (!name || price === undefined || hours_included === undefined) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp name, price, hours_included' });
    }

    const [result] = await pool.query(
      `INSERT INTO combo_packages (name, description, price, hours_included, is_active) VALUES (?, ?, ?, ?, ?)`,
      [name, description || null, price, hours_included, is_active !== undefined ? is_active : true]
    );

    res.status(201).json({
      success: true,
      message: 'Tạo combo thành công',
      data: {
        id: result.insertId,
        name,
        description,
        price,
        hours_included,
        is_active: is_active !== undefined ? is_active : true
      }
    });
  } catch (error) {
    console.error('Lỗi tạo combo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PUT /api/combos/:id - Cập nhật combo (Admin)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, price, hours_included, is_active } = req.body;

    const [existing] = await pool.query('SELECT * FROM combo_packages WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy combo' });
    }

    await pool.query(
      `UPDATE combo_packages SET name = ?, description = ?, price = ?, hours_included = ?, is_active = ? WHERE id = ?`,
      [
        name || existing[0].name,
        description !== undefined ? description : existing[0].description,
        price !== undefined ? price : existing[0].price,
        hours_included !== undefined ? hours_included : existing[0].hours_included,
        is_active !== undefined ? is_active : existing[0].is_active,
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Cập nhật combo thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật combo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// DELETE /api/combos/:id - Xóa combo (Admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM combo_packages WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy combo' });
    }

    await pool.query('DELETE FROM combo_packages WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Xóa combo thành công' });
  } catch (error) {
    console.error('Lỗi xóa combo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
