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

router.post('/redeem', verifyToken, async (req, res) => {
  try {
    if (req.user?.role && req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Chỉ khách hàng mới có thể đổi điểm' });
    }

    const { points_to_spend, reward_type } = req.body;
    
    const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.user.id]);
    if (customers.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    
    const customer = customers[0];
    if (customer.points < points_to_spend) {
      return res.status(400).json({ success: false, message: 'Không đủ điểm để đổi quà' });
    }

    // Trừ điểm
    const newPoints = customer.points - points_to_spend;
    await pool.query('UPDATE customers SET points = ? WHERE id = ?', [newPoints, req.user.id]);

    // Lưu giao dịch
    await pool.query(
      'INSERT INTO transactions (customer_id, amount, type, status) VALUES (?, ?, ?, ?)',
      [req.user.id, points_to_spend, 'redeem', 'success']
    );

    return res.json({
      success: true,
      message: `Đổi quà (${reward_type}) thành công! Đã trừ ${points_to_spend} điểm.`,
      new_points: newPoints
    });
  } catch (error) {
    console.error('Lỗi đổi điểm:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

router.post('/topup_qr', verifyToken, async (req, res) => {
  try {
    if (req.user?.role && req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Chỉ khách hàng mới dùng tính năng này' });
    }

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });

    const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.user.id]);
    if (customers.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });

    const customer = customers[0];
    const newBalance = parseFloat(customer.balance) + parseFloat(amount);
    
    // Tích điểm: 10,000đ = 10 điểm
    const earnedPoints = Math.floor(amount / 1000);
    const newPoints = customer.points + earnedPoints;
    
    // Cập nhật hạng thành viên
    let newRank = customer.member_rank;
    if (newPoints >= 10000) newRank = 'Platinum';
    else if (newPoints >= 5000) newRank = 'Gold';
    else if (newPoints >= 1000) newRank = 'Silver';

    await pool.query(
      'UPDATE customers SET balance = ?, points = ?, member_rank = ? WHERE id = ?',
      [newBalance, newPoints, newRank, req.user.id]
    );

    await pool.query(
      'INSERT INTO transactions (customer_id, amount, type, status) VALUES (?, ?, ?, ?)',
      [req.user.id, amount, 'topup', 'success']
    );

    return res.json({
      success: true,
      message: `Nạp thành công ${amount}đ. Bạn nhận được ${earnedPoints} điểm!`,
      data: {
        balance: newBalance,
        points: newPoints,
        member_rank: newRank
      }
    });
  } catch (error) {
    console.error('Lỗi nạp tiền QR giả lập:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
