const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const AUTO_CLOSE_INTERVAL_MS = 15000;

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const roundMoney = (value) => Math.round(Number(value || 0));

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toMysqlDateTime = (dateInput) => {
  const date = toDate(dateInput);
  if (!date) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const calculateDurationHours = (startTime, endTime) => {
  const start = toDate(startTime);
  const end = toDate(endTime);
  if (!start || !end) return 0;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, round2(hours));
};

const calculatePrepaidAmount = (pricePerHour, durationMinutes) => {
  const price = Number(pricePerHour || 0);
  const minutes = Number(durationMinutes || 0);
  return roundMoney((minutes / 60) * price);
};

const closeSession = async (connection, session, customEndTime = null) => {
  const now = new Date();
  const plannedEnd = toDate(session.planned_end_time);
  const endDate = customEndTime
    ? toDate(customEndTime)
    : session.is_prepaid && plannedEnd
      ? plannedEnd
      : now;
  const safeEndDate = endDate || now;
  const endTimeForDb = toMysqlDateTime(safeEndDate);
  const durationHours = calculateDurationHours(session.start_time, safeEndDate);
  const computedUsageAmount = roundMoney(durationHours * Number(session.price_per_hour || 0));

  // Prepaid sessions have already been paid when starting the session.
  const totalAmount = session.is_prepaid
    ? Number(session.prepaid_amount || computedUsageAmount)
    : computedUsageAmount;

  await connection.query(
    'UPDATE sessions SET end_time = ?, total_amount = ?, status = ? WHERE id = ?',
    [endTimeForDb, totalAmount, 'completed', session.id]
  );
  await connection.query('UPDATE computers SET status = ? WHERE id = ?', ['available', session.computer_id]);

  let balanceDeducted = 0;
  if (session.customer_id) {
    await connection.query(
      'UPDATE customers SET total_hours = total_hours + ? WHERE id = ?',
      [durationHours, session.customer_id]
    );

    // Pay-later sessions are deducted on end.
    if (!session.is_prepaid) {
      const [customers] = await connection.query('SELECT balance FROM customers WHERE id = ? FOR UPDATE', [
        session.customer_id,
      ]);
      if (customers.length > 0) {
        const currentBalance = Number(customers[0].balance || 0);
        balanceDeducted = Math.min(currentBalance, totalAmount);
        if (balanceDeducted > 0) {
          await connection.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [
            balanceDeducted,
            session.customer_id,
          ]);
        }
      }
    }
  }

  return {
    session_id: session.id,
    computer_id: session.computer_id,
    customer_id: session.customer_id,
    start_time: session.start_time,
    end_time: safeEndDate,
    duration_hours: durationHours,
    total_amount: totalAmount,
    balance_deducted: balanceDeducted,
    remaining_payment: session.is_prepaid ? 0 : Math.max(0, totalAmount - balanceDeducted),
    is_prepaid: Boolean(session.is_prepaid),
    prepaid_amount: Number(session.prepaid_amount || 0),
    status: 'completed',
  };
};

const closeExpiredPrepaidSessions = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [expiredSessions] = await connection.query(
      `SELECT s.*, c.price_per_hour
       FROM sessions s
       LEFT JOIN computers c ON s.computer_id = c.id
       WHERE s.status = 'active'
         AND s.is_prepaid = 1
         AND s.planned_end_time IS NOT NULL
         AND s.planned_end_time <= NOW()
       FOR UPDATE`
    );

    for (const session of expiredSessions) {
      await closeSession(connection, session, session.planned_end_time);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Lỗi đóng phiên trả trước tự động:', error);
  } finally {
    connection.release();
  }
};

const ensureAutoCloseWatcher = () => {
  if (!global.__cyberhubPrepaidAutoCloseTimer) {
    global.__cyberhubPrepaidAutoCloseTimer = setInterval(() => {
      closeExpiredPrepaidSessions().catch((error) => {
        console.error('Lỗi watcher đóng phiên trả trước:', error);
      });
    }, AUTO_CLOSE_INTERVAL_MS);

    if (typeof global.__cyberhubPrepaidAutoCloseTimer.unref === 'function') {
      global.__cyberhubPrepaidAutoCloseTimer.unref();
    }
  }
};

ensureAutoCloseWatcher();

// GET /api/sessions - Lấy danh sách phiên sử dụng
router.get('/', verifyToken, async (req, res) => {
  try {
    await closeExpiredPrepaidSessions();

    const where = [];
    const params = [];

    if (String(req.user?.role || '').toLowerCase() === 'customer') {
      where.push('s.customer_id = ?');
      params.push(Number(req.user.id));
    }

    if (req.query.status) {
      where.push('s.status = ?');
      params.push(req.query.status);
    }

    let sql = `
      SELECT s.*, c.name AS computer_name, cu.name AS customer_name
      FROM sessions s
      LEFT JOIN computers c ON s.computer_id = c.id
      LEFT JOIN customers cu ON s.customer_id = cu.id
    `;

    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }

    sql += ' ORDER BY s.created_at DESC';

    if (req.query.limit) {
      const limit = Number(req.query.limit);
      if (Number.isFinite(limit) && limit > 0) {
        sql += ` LIMIT ${Math.floor(limit)}`;
      }
    }

    const [sessions] = await pool.query(sql, params);

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách phiên:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/sessions/active - Lấy danh sách phiên đang hoạt động
router.get('/active', verifyToken, async (req, res) => {
  try {
    await closeExpiredPrepaidSessions();

    const params = [];
    let sql = `
      SELECT s.*, c.name AS computer_name, c.price_per_hour,
             cu.name AS customer_name, cu.balance AS customer_balance
      FROM sessions s
      LEFT JOIN computers c ON s.computer_id = c.id
      LEFT JOIN customers cu ON s.customer_id = cu.id
      WHERE s.status = 'active'
    `;

    if (String(req.user?.role || '').toLowerCase() === 'customer') {
      sql += ' AND s.customer_id = ?';
      params.push(Number(req.user.id));
    }

    sql += ' ORDER BY s.start_time ASC';

    const [sessions] = await pool.query(sql, params);

    const sessionsWithDuration = sessions.map((session) => {
      const now = new Date();
      const durationHours = calculateDurationHours(session.start_time, now);
      const currentAmount = roundMoney(durationHours * Number(session.price_per_hour || 0));
      const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(session.start_time).getTime()) / 1000));
      const plannedEnd = toDate(session.planned_end_time);
      const remainingMinutes = plannedEnd
        ? Math.max(0, Math.ceil((plannedEnd.getTime() - now.getTime()) / 60000))
        : null;
      const prepaidAmount = Number(session.prepaid_amount || 0);
      const usedAmount = Number(session.is_prepaid) === 1 ? Math.min(prepaidAmount, currentAmount) : currentAmount;
      const remainingAmount = Number(session.is_prepaid) === 1 ? Math.max(0, prepaidAmount - usedAmount) : null;

      return {
        ...session,
        current_duration_hours: durationHours,
        elapsed_seconds: elapsedSeconds,
        current_amount: currentAmount,
        used_amount: usedAmount,
        remaining_amount: remainingAmount,
        remaining_minutes: remainingMinutes,
      };
    });

    res.json({
      success: true,
      data: sessionsWithDuration,
    });
  } catch (error) {
    console.error('Lỗi lấy phiên hoạt động:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/sessions/start - Bắt đầu phiên theo hình thức trả trước
router.post('/start', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const computerId = Number(req.body.computer_id || req.body.computerId);
    const customerIdRaw = req.body.customer_id || req.body.customerId;
    const customerId = customerIdRaw ? Number(customerIdRaw) : null;
    const durationMinutesRaw = req.body.duration_minutes || req.body.durationMinutes;
    const durationHoursRaw = req.body.duration_hours || req.body.durationHours;
    const durationMinutes = durationMinutesRaw
      ? Number(durationMinutesRaw)
      : durationHoursRaw
        ? Number(durationHoursRaw) * 60
        : NaN;

    if (!computerId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn máy tính',
      });
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 720) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Thời gian chơi phải trong khoảng 15 đến 720 phút',
      });
    }

    const [computers] = await connection.query('SELECT * FROM computers WHERE id = ? FOR UPDATE', [computerId]);
    if (computers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy máy tính',
      });
    }

    const computer = computers[0];
    if (computer.status !== 'available') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Máy tính không khả dụng (đang sử dụng hoặc bảo trì)',
      });
    }

    const prepaidAmount = calculatePrepaidAmount(computer.price_per_hour, durationMinutes);

    if (customerId) {
      const [customers] = await connection.query('SELECT * FROM customers WHERE id = ? FOR UPDATE', [customerId]);
      if (customers.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khách hàng',
        });
      }

      const balance = Number(customers[0].balance || 0);
      if (balance < prepaidAmount) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Số dư không đủ. Cần ${prepaidAmount.toLocaleString('vi-VN')} đ`,
        });
      }

      await connection.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [prepaidAmount, customerId]);
    }

    const [result] = await connection.query(
      `INSERT INTO sessions
        (computer_id, customer_id, start_time, planned_minutes, planned_end_time, prepaid_amount, is_prepaid, status)
       VALUES (?, ?, NOW(), ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, 1, 'active')`,
      [computerId, customerId, Math.floor(durationMinutes), Math.floor(durationMinutes), prepaidAmount]
    );

    await connection.query('UPDATE computers SET status = ? WHERE id = ?', ['in_use', computerId]);
    await connection.commit();

    const [newSession] = await pool.query(
      `SELECT s.*, c.name AS computer_name, cu.name AS customer_name
       FROM sessions s
       LEFT JOIN computers c ON s.computer_id = c.id
       LEFT JOIN customers cu ON s.customer_id = cu.id
       WHERE s.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: {
        ...newSession[0],
        prepaid_amount: prepaidAmount,
        balance_deducted: customerId ? prepaidAmount : 0,
      },
      message: 'Bắt đầu phiên thành công. Khách đã trả trước theo thời gian đã chọn.',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Lỗi bắt đầu phiên:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  } finally {
    connection.release();
  }
});

// POST /api/sessions/:id/end - Kết thúc phiên sử dụng
router.post('/:id/end', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [sessions] = await connection.query(
      'SELECT s.*, c.price_per_hour FROM sessions s LEFT JOIN computers c ON s.computer_id = c.id WHERE s.id = ? FOR UPDATE',
      [req.params.id]
    );

    if (sessions.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiên sử dụng',
      });
    }

    const session = sessions[0];
    if (session.status !== 'active') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Phiên này đã kết thúc',
      });
    }

    const result = await closeSession(connection, session);
    await connection.commit();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Lỗi kết thúc phiên:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  } finally {
    connection.release();
  }
});

module.exports = router;
