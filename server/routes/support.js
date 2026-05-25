const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const isCustomer = (user) => String(user?.role || '').toLowerCase() === 'customer';

const formatMessage = (row) => ({
  id: row.id,
  customer_id: row.customer_id,
  sender_role: row.sender_role,
  sender_name: row.sender_name,
  message: row.message,
  read_by_admin: Number(row.read_by_admin || 0) === 1,
  read_by_customer: Number(row.read_by_customer || 0) === 1,
  created_at: row.created_at,
});

// GET /api/support/conversations (admin/staff)
router.get('/conversations', verifyToken, async (req, res) => {
  try {
    if (isCustomer(req.user)) {
      return res.status(403).json({ success: false, message: 'Khách hàng không có quyền xem danh sách hội thoại admin' });
    }

    const [rows] = await pool.query(`
      SELECT
        latest.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        latest.id AS last_message_id,
        latest.sender_role AS last_sender_role,
        latest.sender_name AS last_sender_name,
        latest.message AS last_message,
        latest.created_at AS last_message_at,
        COALESCE(unread.unread_count, 0) AS unread_count
      FROM (
        SELECT sm.*
        FROM support_messages sm
        INNER JOIN (
          SELECT customer_id, MAX(id) AS max_id
          FROM support_messages
          GROUP BY customer_id
        ) t ON sm.id = t.max_id
      ) latest
      INNER JOIN customers c ON c.id = latest.customer_id
      LEFT JOIN (
        SELECT customer_id, COUNT(*) AS unread_count
        FROM support_messages
        WHERE sender_role = 'customer' AND read_by_admin = 0
        GROUP BY customer_id
      ) unread ON unread.customer_id = latest.customer_id
      ORDER BY latest.created_at DESC
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('Lỗi lấy hội thoại support:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/support/messages
router.get('/messages', verifyToken, async (req, res) => {
  try {
    const markRead = String(req.query.mark_read ?? '1') !== '0';
    let customerId;

    if (isCustomer(req.user)) {
      customerId = Number(req.user.id);
    } else {
      customerId = Number(req.query.customer_id || req.query.customerId);
      if (!customerId) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp customer_id' });
      }
    }

    const [messages] = await pool.query(
      'SELECT * FROM support_messages WHERE customer_id = ? ORDER BY id ASC LIMIT 300',
      [customerId]
    );

    if (markRead) {
      if (isCustomer(req.user)) {
        await pool.query(
          "UPDATE support_messages SET read_by_customer = 1 WHERE customer_id = ? AND sender_role <> 'customer' AND read_by_customer = 0",
          [customerId]
        );
      } else {
        await pool.query(
          "UPDATE support_messages SET read_by_admin = 1 WHERE customer_id = ? AND sender_role = 'customer' AND read_by_admin = 0",
          [customerId]
        );
      }
    }

    res.json({
      success: true,
      data: messages.map(formatMessage),
    });
  } catch (error) {
    console.error('Lỗi lấy tin nhắn support:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/support/messages
router.post('/messages', verifyToken, async (req, res) => {
  try {
    const rawMessage = String(req.body.message || '').trim();
    if (!rawMessage) {
      return res.status(400).json({ success: false, message: 'Nội dung yêu cầu không được để trống' });
    }

    if (rawMessage.length > 1000) {
      return res.status(400).json({ success: false, message: 'Nội dung tối đa 1000 ký tự' });
    }

    let customerId;
    let senderRole;
    let senderName;
    let senderUserId = null;
    let senderCustomerId = null;

    if (isCustomer(req.user)) {
      customerId = Number(req.user.id);
      senderRole = 'customer';
      senderName = String(req.user.name || req.user.phone || 'Customer');
      senderCustomerId = customerId;
    } else {
      customerId = Number(req.body.customer_id || req.body.customerId);
      if (!customerId) {
        return res.status(400).json({ success: false, message: 'Admin cần customer_id để phản hồi' });
      }

      const [customers] = await pool.query('SELECT id FROM customers WHERE id = ?', [customerId]);
      if (customers.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
      }

      senderRole = String(req.user.role || 'staff').toLowerCase() === 'admin' ? 'admin' : 'staff';
      senderName = String(req.user.username || req.user.name || senderRole);
      senderUserId = Number(req.user.id || 0) || null;
    }

    const [result] = await pool.query(
      `INSERT INTO support_messages
       (customer_id, sender_role, sender_name, sender_user_id, sender_customer_id, message, read_by_admin, read_by_customer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        senderRole,
        senderName,
        senderUserId,
        senderCustomerId,
        rawMessage,
        senderRole === 'customer' ? 0 : 1,
        senderRole === 'customer' ? 1 : 0,
      ]
    );

    const [saved] = await pool.query('SELECT * FROM support_messages WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      data: saved.length > 0 ? formatMessage(saved[0]) : null,
    });
  } catch (error) {
    console.error('Lỗi gửi tin nhắn support:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
