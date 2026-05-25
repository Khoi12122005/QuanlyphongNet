const mysql = require('mysql2/promise');
require('dotenv').config();

// Tạo connection pool để quản lý kết nối MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cyberhub_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Kiểm tra kết nối khi khởi động
pool.getConnection()
  .then(connection => {
    console.log('✅ Kết nối MySQL thành công!');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
  });

module.exports = pool;
