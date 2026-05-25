const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const isCustomer = (user) => String(user?.role || '').toLowerCase() === 'customer';
const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatCurrency = (value) => Number(value || 0).toLocaleString('vi-VN');

const createAdminOrderNotification = async ({
  orderId,
  customerId,
  sessionId,
  totalAmount,
  itemQuantity,
}) => {
  try {
    const [customers] = await pool.query(
      'SELECT name FROM customers WHERE id = ? LIMIT 1',
      [customerId]
    );
    const customerName = customers[0]?.name || `Khách #${customerId}`;

    let computerName = '';
    if (sessionId) {
      const [computers] = await pool.query(
        `
          SELECT c.name
          FROM sessions s
          LEFT JOIN computers c ON c.id = s.computer_id
          WHERE s.id = ?
          LIMIT 1
        `,
        [sessionId]
      );
      if (computers[0]?.name) {
        computerName = String(computers[0].name);
      }
    }

    const message = [
      `Đơn mới #${orderId}`,
      `${customerName} vừa đặt ${itemQuantity} món`,
      `Giá trị: ${formatCurrency(totalAmount)} đ`,
      computerName ? `Máy: ${computerName}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    await pool.query(
      `INSERT INTO support_messages
       (customer_id, sender_role, sender_name, sender_user_id, sender_customer_id, message, read_by_admin, read_by_customer)
       VALUES (?, 'customer', ?, NULL, ?, ?, 0, 1)`,
      [customerId, customerName, customerId, message]
    );
  } catch (error) {
    // Non-blocking notification: order creation should still succeed.
    console.error('Lỗi tạo thông báo admin khi khách đặt món:', error.message);
  }
};

const createCustomerOrderConfirmationNotification = async ({
  orderId,
  customerId,
  adminRole,
  adminName,
}) => {
  try {
    const senderRole = String(adminRole || '').toLowerCase() === 'admin' ? 'admin' : 'staff';
    const senderName = String(adminName || senderRole).trim() || senderRole;
    const message = `Đơn #${orderId} đã được ${senderRole.toUpperCase()} xác nhận. Món sẽ được chuẩn bị ngay.`;

    await pool.query(
      `INSERT INTO support_messages
       (customer_id, sender_role, sender_name, sender_user_id, sender_customer_id, message, read_by_admin, read_by_customer)
       VALUES (?, ?, ?, NULL, NULL, ?, 1, 0)`,
      [customerId, senderRole, senderName, message]
    );
  } catch (error) {
    console.error('Lỗi tạo thông báo xác nhận đơn cho khách:', error.message);
  }
};

const getOrderListQuery = () => `
  SELECT o.*, cu.name AS customer_name, cu.phone AS customer_phone,
         u.full_name AS created_by_name,
         u_confirm.full_name AS confirmed_by_name,
         s.computer_id,
         c.name AS computer_name,
         (
           SELECT COUNT(*)
           FROM order_items oi
           WHERE oi.order_id = o.id
         ) AS item_count
  FROM orders o
  LEFT JOIN customers cu ON o.customer_id = cu.id
  LEFT JOIN users u ON o.created_by = u.id
  LEFT JOIN users u_confirm ON o.confirmed_by = u_confirm.id
  LEFT JOIN sessions s ON o.session_id = s.id
  LEFT JOIN computers c ON s.computer_id = c.id
`;

// GET /api/orders - Lấy danh sách đơn hàng
router.get('/', verifyToken, async (req, res) => {
  try {
    const params = [];
    let sql = getOrderListQuery();

    if (isCustomer(req.user)) {
      sql += ' WHERE o.customer_id = ?';
      params.push(Number(req.user.id));
    }

    sql += ' ORDER BY o.created_at DESC';

    const [orders] = await pool.query(sql, params);

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/orders/:id - Lấy chi tiết đơn hàng
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [orders] = await pool.query(
      `${getOrderListQuery()} WHERE o.id = ?`,
      [req.params.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng',
      });
    }

    const order = orders[0];

    if (isCustomer(req.user) && Number(order.customer_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem đơn hàng này',
      });
    }

    const [items] = await pool.query(
      `
        SELECT oi.*, p.name AS product_name, p.category
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/orders - Tạo đơn hàng mới
router.post('/', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const roleCustomer = isCustomer(req.user);

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Vui lòng thêm ít nhất 1 sản phẩm vào đơn hàng',
      });
    }

    const normalizedItems = rawItems
      .map((item) => ({
        product_id: Number(item.product_id ?? item.productId),
        quantity: Math.max(1, Math.floor(toNumber(item.quantity, 1))),
      }))
      .filter((item) => item.product_id > 0);

    if (normalizedItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Danh sách sản phẩm không hợp lệ',
      });
    }

    let customerId = roleCustomer ? Number(req.user.id) : toNumber(req.body.customer_id ?? req.body.customerId, 0) || null;
    let sessionId = toNumber(req.body.session_id ?? req.body.sessionId, 0) || null;
    const createdBy = roleCustomer ? null : Number(req.user.id);
    const orderStatus = roleCustomer ? 'pending' : 'confirmed';
    const confirmedBy = roleCustomer ? null : Number(req.user.id);
    const confirmedAt = roleCustomer ? null : new Date();

    if (customerId) {
      const [customers] = await connection.query('SELECT id FROM customers WHERE id = ?', [customerId]);
      if (customers.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
      }
    }

    if (roleCustomer && !sessionId) {
      const [activeSession] = await connection.query(
        `
          SELECT id
          FROM sessions
          WHERE status = 'active' AND customer_id = ?
          ORDER BY start_time DESC
          LIMIT 1
        `,
        [customerId]
      );
      if (activeSession.length > 0) {
        sessionId = Number(activeSession[0].id);
      }
    }

    if (sessionId) {
      const [sessions] = await connection.query('SELECT id, customer_id FROM sessions WHERE id = ?', [sessionId]);
      if (sessions.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Không tìm thấy phiên máy' });
      }

      if (roleCustomer && Number(sessions[0].customer_id || 0) !== Number(customerId || 0)) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Không thể đặt món cho phiên máy của khách khác',
        });
      }

      if (!customerId && sessions[0].customer_id) {
        customerId = Number(sessions[0].customer_id);
      }
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of normalizedItems) {
      const [products] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (products.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy sản phẩm với ID: ${item.product_id}`,
        });
      }

      const product = products[0];
      if (Number(product.stock) < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Sản phẩm "${product.name}" không đủ hàng (còn ${product.stock})`,
        });
      }

      const unitPrice = toNumber(product.price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
      });

      await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    const [orderResult] = await connection.query(
      `INSERT INTO orders
        (session_id, customer_id, total_amount, created_by, status, confirmed_by, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, customerId, totalAmount, createdBy, orderStatus, confirmedBy, confirmedAt]
    );

    const orderId = orderResult.insertId;

    for (const item of orderItems) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.unit_price]
      );
    }

    await connection.commit();

    if (roleCustomer && customerId) {
      const itemQuantity = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      await createAdminOrderNotification({
        orderId,
        customerId,
        sessionId,
        totalAmount,
        itemQuantity,
      });
    }

    const [newOrder] = await pool.query(`${getOrderListQuery()} WHERE o.id = ?`, [orderId]);
    const [newItems] = await pool.query(
      `
        SELECT oi.*, p.name AS product_name, p.category
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `,
      [orderId]
    );

    res.status(201).json({
      success: true,
      data: {
        ...newOrder[0],
        items: newItems,
      },
      message: roleCustomer
        ? 'Khách hàng đặt món thành công. Admin sẽ nhận đơn ngay.'
        : 'Tạo đơn hàng thành công',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Lỗi tạo đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  } finally {
    connection.release();
  }
});

// POST /api/orders/:id/confirm - Admin xác nhận đơn khách đặt
router.post('/:id/confirm', verifyToken, async (req, res) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Khách hàng không có quyền xác nhận đơn',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [req.params.id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng',
      });
    }

    const order = orders[0];
    if (String(order.status || '').toLowerCase() === 'confirmed') {
      await connection.rollback();
      return res.json({
        success: true,
        data: order,
        message: 'Đơn hàng đã được xác nhận trước đó',
      });
    }

    await connection.query(
      'UPDATE orders SET status = ?, confirmed_by = ?, confirmed_at = NOW() WHERE id = ?',
      ['confirmed', Number(req.user.id), req.params.id]
    );

    await connection.commit();

    if (order.customer_id) {
      await createCustomerOrderConfirmationNotification({
        orderId: Number(req.params.id),
        customerId: Number(order.customer_id),
        adminRole: req.user.role,
        adminName: req.user.full_name || req.user.username || req.user.name,
      });
    }

    const [updatedOrders] = await pool.query(
      `${getOrderListQuery()} WHERE o.id = ?`,
      [req.params.id]
    );

    return res.json({
      success: true,
      data: updatedOrders[0] || null,
      message: 'Xác nhận đơn hàng thành công',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Lỗi xác nhận đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  } finally {
    connection.release();
  }
});

module.exports = router;
