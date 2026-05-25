const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const normalizeText = (value) => String(value || '').trim();
const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ''));

router.post('/login', async (req, res) => {
  try {
    const body = req.body || {};
    const username = normalizeText(body.username);
    const password = normalizeText(body.password);

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập (tên hoặc số điện thoại) và mật khẩu',
      });
    }

    const [customers] = await pool.query(
      'SELECT * FROM customers WHERE phone = ? OR name = ? LIMIT 1',
      [username, username]
    );

    if (customers.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    const customer = customers[0];
    const storedPassword = normalizeText(customer.password);

    if (!storedPassword) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản chưa được thiết lập mật khẩu',
      });
    }

    let isMatch = false;
    if (isBcryptHash(storedPassword)) {
      try {
        isMatch = await bcrypt.compare(password, storedPassword);
      } catch (error) {
        console.warn('Cảnh báo: không thể so sánh mật khẩu bcrypt cho customer', customer.id, error.message);
      }
    } else {
      // Legacy fallback: plain-text password stored in old data.
      isMatch = storedPassword === password;
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    const token = jwt.sign(
      { id: customer.id, name: customer.name, phone: customer.phone, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const { password: _password, ...customerWithoutPassword } = customer;

    return res.json({
      success: true,
      data: {
        user: {
          ...customerWithoutPassword,
          role: 'customer',
        },
        token,
      },
    });
  } catch (error) {
    console.error('Lỗi đăng nhập khách hàng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const body = req.body || {};
    const name = normalizeText(body.name);
    const phone = normalizeText(body.phone);
    const password = normalizeText(body.password);

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ tên, số điện thoại và mật khẩu',
      });
    }

    const [existing] = await pool.query('SELECT id FROM customers WHERE phone = ? LIMIT 1', [phone]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại đã được đăng ký',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO customers (name, phone, password, balance, total_hours) VALUES (?, ?, ?, 0, 0)',
      [name, phone, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name,
        phone,
        balance: 0,
        total_hours: 0,
      },
    });
  } catch (error) {
    console.error('Lỗi đăng ký khách hàng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    if (req.user?.role && req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Token không hợp lệ cho tài khoản khách hàng',
      });
    }

    const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.user.id]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng',
      });
    }

    const { password: _password, ...customerWithoutPassword } = customers[0];

    return res.json({
      success: true,
      data: {
        ...customerWithoutPassword,
        role: 'customer',
      },
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin khách hàng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
