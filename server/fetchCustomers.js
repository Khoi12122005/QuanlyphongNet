const pool = require('./config/db');

async function run() {
  try {
    const [rows] = await pool.query('SELECT id, name, phone, password FROM customers');
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

run();
