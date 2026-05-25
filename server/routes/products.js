const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/products - Lấy danh sách sản phẩm
router.get('/', verifyToken, async (req, res) => {
  try {
    // Hỗ trợ lọc theo danh mục
    const { category } = req.query;
    let query = 'SELECT * FROM products';
    const params = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY category ASC, name ASC';

    const [products] = await pool.query(query, params);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách sản phẩm:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/products/:id - Lấy thông tin chi tiết sản phẩm
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin sản phẩm:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/products - Thêm sản phẩm mới
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, category, price, stock, image_url } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên sản phẩm và giá'
      });
    }

    const [result] = await pool.query(
      'INSERT INTO products (name, category, price, stock, image_url) VALUES (?, ?, ?, ?, ?)',
      [name, category || null, price, stock || 0, image_url || null]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name,
        category,
        price,
        stock: stock || 0,
        image_url
      }
    });
  } catch (error) {
    console.error('Lỗi thêm sản phẩm:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PUT /api/products/:id - Cập nhật sản phẩm
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, category, price, stock, image_url } = req.body;

    const [existing] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    await pool.query(
      'UPDATE products SET name = ?, category = ?, price = ?, stock = ?, image_url = ? WHERE id = ?',
      [
        name || existing[0].name,
        category !== undefined ? category : existing[0].category,
        price || existing[0].price,
        stock !== undefined ? stock : existing[0].stock,
        image_url !== undefined ? image_url : existing[0].image_url,
        req.params.id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      data: updated[0]
    });
  } catch (error) {
    console.error('Lỗi cập nhật sản phẩm:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// DELETE /api/products/:id - Xoá sản phẩm
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'Xoá sản phẩm thành công'
    });
  } catch (error) {
    console.error('Lỗi xoá sản phẩm:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
