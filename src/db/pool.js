// src/db/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'globallinkers',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,                    // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

// Helper: run a query with values
const query = (text, params) => pool.query(text, params);

// Helper: get a client for transactions
const getClient = () => pool.connect();

// Test connection on startup
const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() as now');
    console.log('✅ PostgreSQL connected:', res.rows[0].now);
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.error('   Check your .env DB_* variables and that PostgreSQL is running.');
  }
};

module.exports = { pool, query, getClient, testConnection };
