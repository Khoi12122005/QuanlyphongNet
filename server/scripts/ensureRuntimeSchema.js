const resolveSchemaName = () => process.env.DB_NAME || 'cyberhub_db';

const hasColumn = async (pool, tableName, columnName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [resolveSchemaName(), tableName, columnName]
  );
  return rows.length > 0;
};

const hasIndex = async (pool, tableName, indexName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [resolveSchemaName(), tableName, indexName]
  );
  return rows.length > 0;
};

const ensureColumn = async (pool, tableName, columnName, definitionSql) => {
  const exists = await hasColumn(pool, tableName, columnName);
  if (exists) return;

  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
  console.log(`[schema] Added ${tableName}.${columnName}`);
};

const ensureIndex = async (pool, tableName, indexName, definitionSql) => {
  const exists = await hasIndex(pool, tableName, indexName);
  if (exists) return;

  await pool.query(`CREATE INDEX ${indexName} ON ${tableName} (${definitionSql})`);
  console.log(`[schema] Added index ${indexName} on ${tableName}`);
};

const ensureSupportMessagesTable = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      sender_role ENUM('customer', 'admin', 'staff') NOT NULL,
      sender_name VARCHAR(120) NOT NULL,
      sender_user_id INT DEFAULT NULL,
      sender_customer_id INT DEFAULT NULL,
      message TEXT NOT NULL,
      read_by_admin TINYINT(1) NOT NULL DEFAULT 0,
      read_by_customer TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (sender_customer_id) REFERENCES customers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
};

async function ensureRuntimeSchema(pool) {
  // Customers table (for customer login/register)
  await ensureColumn(pool, 'customers', 'password', 'VARCHAR(255) DEFAULT NULL AFTER phone');
  await ensureColumn(pool, 'customers', 'points', 'INT NOT NULL DEFAULT 0 AFTER total_hours');
  await ensureColumn(
    pool,
    'customers',
    'member_rank',
    "ENUM('Bronze', 'Silver', 'Gold', 'Platinum') NOT NULL DEFAULT 'Bronze' AFTER points"
  );

  // Sessions table (prepaid mode)
  await ensureColumn(pool, 'sessions', 'planned_minutes', 'INT DEFAULT NULL AFTER end_time');
  await ensureColumn(pool, 'sessions', 'planned_end_time', 'DATETIME DEFAULT NULL AFTER planned_minutes');
  await ensureColumn(
    pool,
    'sessions',
    'prepaid_amount',
    'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER planned_end_time'
  );
  await ensureColumn(pool, 'sessions', 'is_prepaid', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER prepaid_amount');

  // Orders table (admin confirm flow)
  await ensureColumn(
    pool,
    'orders',
    'status',
    "ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed' AFTER total_amount"
  );
  await ensureColumn(pool, 'orders', 'confirmed_by', 'INT DEFAULT NULL AFTER created_by');
  await ensureColumn(pool, 'orders', 'confirmed_at', 'DATETIME DEFAULT NULL AFTER confirmed_by');

  // Realtime support chat
  await ensureSupportMessagesTable(pool);
  await ensureColumn(pool, 'support_messages', 'sender_user_id', 'INT DEFAULT NULL AFTER sender_name');
  await ensureColumn(pool, 'support_messages', 'sender_customer_id', 'INT DEFAULT NULL AFTER sender_user_id');
  await ensureColumn(pool, 'support_messages', 'read_by_admin', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER message');
  await ensureColumn(
    pool,
    'support_messages',
    'read_by_customer',
    'TINYINT(1) NOT NULL DEFAULT 0 AFTER read_by_admin'
  );

  await ensureIndex(pool, 'support_messages', 'idx_support_messages_customer_created', 'customer_id, created_at');
  await ensureIndex(pool, 'support_messages', 'idx_support_messages_unread_admin', 'customer_id, sender_role, read_by_admin');
  await ensureIndex(
    pool,
    'support_messages',
    'idx_support_messages_unread_customer',
    'customer_id, sender_role, read_by_customer'
  );
}

module.exports = ensureRuntimeSchema;
