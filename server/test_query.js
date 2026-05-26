const pool = require('./config/db');
async function run() {
  try {
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
    console.log(rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}
run();
