require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      profession TEXT
    );
  `;
  try {
    await pool.query(queryText);
    console.log('Users table is ready.');

    // Upsert admin user
    const saltRounds = 10;
    const hash = await bcrypt.hash('password', saltRounds);
    const adminQuery = `
      INSERT INTO users (username, password, role) 
      VALUES ('admin', $1, 'admin') 
      ON CONFLICT (username) DO NOTHING;
    `;
    await pool.query(adminQuery, [hash]);
    console.log('Admin user checked/created.');
  } catch (err) {
    console.error('Error creating table or admin user', err.stack);
  }
};

createTable();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
