const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

async function initDB() {
  try {
    // Connect without database first to create it
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      multipleStatements: true
    });

    console.log('Connected to MySQL server.');

    // Read schema.sql
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema...');
    
    // Execute all statements
    await connection.query(schema);
    
    console.log('Database cyberhub_db created and seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDB();
