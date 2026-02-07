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
  const usersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      profession TEXT
    );
  `;

      const conversationsTableQuery = `
        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES users(id),
          doctor_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
  
      const messagesTableQuery = `
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER REFERENCES conversations(id),
          sender_id INTEGER REFERENCES users(id),
          message_content TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
  try {
    await pool.query(usersTableQuery);
    console.log('Users table is ready.');

    await pool.query(conversationsTableQuery);
    console.log('Conversations table is ready.');

    await pool.query(messagesTableQuery);
    console.log('Messages table is ready.');

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
    console.error('Error creating tables or admin user', err.stack);
  }
};

createTable();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
