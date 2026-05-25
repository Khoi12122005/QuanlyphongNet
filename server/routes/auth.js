const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// POST /api/auth/login - Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu'
      });
    }

    // Tìm user trong database
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    const user = users[0];

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Trả về thông tin user (không bao gồm mật khẩu)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token
      }
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
});

// POST /api/auth/register - Đăng ký (chỉ admin mới được tạo tài khoản)
router.post('/register', verifyToken, isAdmin, async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!username || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin'
      });
    }

    // Kiểm tra username đã tồn tại chưa
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập đã tồn tại'
      });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo user mới
    const [result] = await pool.query(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, full_name, role || 'staff']
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        username,
        full_name,
        role: role || 'staff'
      }
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
});

// GET /api/auth/me - Lấy thông tin user hiện tại
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, full_name, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
});

module.exports = router;
