const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const ZONE_DEFAULT_PRICES = {
  Thuong: 50000,
  VIP: 100000,
  Streaming: 150000,
};

const normalizeZone = (value) => {
  const zone = String(value || '').trim().toLowerCase();
  if (zone.includes('vip')) return 'VIP';
  if (zone.includes('stream')) return 'Streaming';
  return 'Thuong';
};

// GET /api/computers
router.get('/', verifyToken, async (req, res) => {
  try {
    const [computers] = await pool.query(`
      SELECT c.*,
        s.id AS session_id,
        s.start_time AS session_start,
        s.planned_minutes AS session_planned_minutes,
        s.planned_end_time AS session_planned_end,
        s.prepaid_amount AS session_prepaid_amount,
        s.is_prepaid AS session_is_prepaid,
        s.customer_id AS session_customer_id,
        cu.name AS customer_name
      FROM computers c
      LEFT JOIN sessions s ON s.computer_id = c.id AND s.status = 'active'
      LEFT JOIN customers cu ON s.customer_id = cu.id
      ORDER BY c.name ASC
    `);

    res.json({
      success: true,
      data: computers,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách máy tính:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/computers/virtual
router.post('/virtual', verifyToken, async (req, res) => {
  try {
    const count = Math.max(1, Math.min(100, Number(req.body.count) || 1));
    const zone = normalizeZone(req.body.zone || 'Thuong');
    const specs = req.body.specs || 'Virtual machine';
    const prefix = (req.body.prefix || 'VM').toString().replace(/\s+/g, '').toUpperCase();
    const customPrice = Number(req.body.price_per_hour || req.body.pricePerHour || 0);
    const price_per_hour = customPrice > 0 ? customPrice : (ZONE_DEFAULT_PRICES[zone] || ZONE_DEFAULT_PRICES.Thuong);

    const [existingVM] = await pool.query('SELECT name FROM computers WHERE name LIKE ?', [`${prefix}-%`]);
    let maxIndex = 0;

    for (const item of existingVM) {
      const match = String(item.name || '').match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const value = Number(match[1]);
        if (!Number.isNaN(value)) {
          maxIndex = Math.max(maxIndex, value);
        }
      }
    }

    const created = [];
    for (let i = 1; i <= count; i += 1) {
      const name = `${prefix}-${String(maxIndex + i).padStart(2, '0')}`;
      const [result] = await pool.query(
        'INSERT INTO computers (name, status, specs, price_per_hour, zone) VALUES (?, ?, ?, ?, ?)',
        [name, 'available', specs, price_per_hour, zone]
      );

      created.push({
        id: result.insertId,
        name,
        status: 'available',
        specs,
        price_per_hour,
        zone,
      });
    }

    res.status(201).json({
      success: true,
      data: created,
      message: `Đã tạo ${created.length} máy ảo`,
    });
  } catch (error) {
    console.error('Lỗi tạo máy ảo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /api/computers/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [computers] = await pool.query('SELECT * FROM computers WHERE id = ?', [req.params.id]);

    if (computers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy máy tính',
      });
    }

    res.json({
      success: true,
      data: computers[0],
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin máy tính:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/computers
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, specs } = req.body;
    const zone = normalizeZone(req.body.zone);
    const price_per_hour = Number(req.body.price_per_hour ?? req.body.pricePerHour ?? ZONE_DEFAULT_PRICES[zone]);

    if (!name || !price_per_hour) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên máy và giá/giờ',
      });
    }

    const [result] = await pool.query(
      'INSERT INTO computers (name, status, specs, price_per_hour, zone) VALUES (?, ?, ?, ?, ?)',
      [name, 'available', specs || null, price_per_hour, zone]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name,
        status: 'available',
        specs,
        price_per_hour,
        zone,
      },
    });
  } catch (error) {
    console.error('Lỗi thêm máy tính:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PUT /api/computers/:id
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, specs } = req.body;

    const [existing] = await pool.query('SELECT * FROM computers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy máy tính',
      });
    }

    const zone = req.body.zone !== undefined ? normalizeZone(req.body.zone) : existing[0].zone;
    const price_per_hour = Number(req.body.price_per_hour ?? req.body.pricePerHour ?? existing[0].price_per_hour);

    await pool.query('UPDATE computers SET name = ?, specs = ?, price_per_hour = ?, zone = ? WHERE id = ?', [
      name || existing[0].name,
      specs !== undefined ? specs : existing[0].specs,
      price_per_hour,
      zone,
      req.params.id,
    ]);

    const [updated] = await pool.query('SELECT * FROM computers WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      data: updated[0],
    });
  } catch (error) {
    console.error('Lỗi cập nhật máy tính:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// DELETE /api/computers/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM computers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy máy tính',
      });
    }

    if (existing[0].status === 'in_use') {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa máy tính đang được sử dụng',
      });
    }

    await pool.query('DELETE FROM computers WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'Xóa máy tính thành công',
    });
  } catch (error) {
    console.error('Lỗi xóa máy tính:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// PATCH /api/computers/:id/status
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'in_use', 'maintenance'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(', ')}`,
      });
    }

    const [existing] = await pool.query('SELECT * FROM computers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy máy tính',
      });
    }

    await pool.query('UPDATE computers SET status = ? WHERE id = ?', [status, req.params.id]);

    res.json({
      success: true,
      data: { ...existing[0], status },
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
