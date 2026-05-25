const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

async function updateDB() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      multipleStatements: true
    });

    console.log('Connected to MySQL server.');

    // Read update_v2.sql
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'update_v2.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing V2 update schema...');
    
    await connection.query(schema);
    
    console.log('Database updated to V2 successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating database:', error);
    process.exit(1);
  }
}

updateDB();
